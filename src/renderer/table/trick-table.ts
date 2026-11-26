/**
 * Shared presentation for 4-player trick-taking games (spec 12): the table, portraits, speech
 * bubbles, card sprites, dealing, the player's card gestures (spec 16), trick play and collection,
 * overlays, the pause menu, and the KardCoins award. Each game (Hearts, Spades) subclasses it and
 * adds its own phases, score panel, and dialogs. Game state is only changed through engine actions.
 */
import { dialogue, effectiveSkill, layout, settings, sortHand, type Card, type Difficulty, type Seat } from '../../logic/index.js';
import { portraitColors, preloadCardImages } from '../content.js';
import { h, onTap, type Stage } from '../stage.js';
import { CardSprite } from './card-sprite.js';
import { audio } from '../audio.js';
import { soundSettingsPanel } from '../sound-settings.js';
import { settingsPanel } from '../settings-panel.js';

type CharacterDef = dialogue.CharacterDef;

export const SEATS: readonly Seat[] = [0, 1, 2, 3];
export const COMPUTER_SEATS: readonly Seat[] = [1, 2, 3];
export const T = layout.TIMING;

export interface TrickTableOptions {
  difficulty: Difficulty;
  /** Characters for West, North, East. */
  opponents: readonly CharacterDef[];
  seed: number;
  /** Demo/testing: the human seat is played by the computer. */
  autoplay?: boolean;
  /** Demo/testing: divide all game timings by this factor. */
  speed?: number;
  /** The player's current settings (spec 16); read live, so changes apply mid-game. Defaults if absent. */
  getSettings?(): settings.PlayerSettings;
  onExit(next: 'menu' | 'again'): void;
}

/** What the game-over box shows about the KardCoins earned (spec 15 §3). */
export interface AwardView {
  total: number;
  /** Breakdown line, e.g. "2nd place: 40 × 1.5 (Medium)". */
  detail: string;
  balance: number;
}

export class Cancelled extends Error {}

/** One finger, pen, or mouse press on a card in the player's hand (spec 16 §2). */
interface Gesture {
  pointerId: number;
  card: Card;
  start: layout.Point;
  /** Pointer position minus card center, so a dragged card stays under the finger where it was grabbed. */
  grab: layout.Point;
  dragging: boolean;
  /** The press already acted (Instant tap, Quick select toggle, illegal-card shake); release does nothing. */
  handled: boolean;
}

export const DIFFICULTY_NAMES: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export abstract class TrickTable<E> {
  protected readonly seatsDef: (CharacterDef | null)[];
  protected readonly director: dialogue.DialogueDirector;
  protected lay: layout.TableLayout;
  protected readonly speed: number;

  protected readonly root = h('div', 'hearts-table');
  protected readonly cardLayer = h('div', 'card-layer');
  protected readonly portraits: HTMLDivElement[] = [];
  protected readonly bubbles: HTMLDivElement[] = [];
  protected readonly youPlate = h('div', 'nameplate you', 'You');
  protected readonly scorePanel = h('div', 'score-panel');
  protected readonly menuBtn = h('button', 'menu-button', '☰');
  protected readonly actionBtn = h('button', 'action-button');
  protected readonly message = h('div', 'table-message');
  protected readonly toast = h('div', 'toast');
  protected overlay: HTMLDivElement | null = null;

  protected readonly sprites = new Map<Card, CardSprite>();
  /** Cards lifted in the player's hand: chosen to pass, or just received. */
  protected readonly lifted = new Set<Card>();
  /** How many cards may be lifted in 'select' mode. */
  protected selectLimit = 3;
  /** Called by the action button in 'select' mode once `selectLimit` cards are lifted. */
  protected selectDone: (() => void) | null = null;
  /** A playable card lifted on press (Card response: Quick) until it is released. */
  private pressed: Card | null = null;
  private gesture: Gesture | null = null;
  protected mode: 'idle' | 'select' | 'play' = 'idle';
  private legal = new Set<Card>();
  private pick: { resolve: (c: Card) => void; reject: (e: Error) => void } | null = null;
  protected alive = true;
  private paused = false;
  private resumeWaiters: (() => void)[] = [];
  private readonly timers = new Set<number>();
  private idleTimer = 0;
  private bubbleTimer = 0;
  private toastTimer = 0;
  private readonly unsubscribeResize: () => void;
  /** Extra cleanup for subclasses (e.g. panels with their own timers). */
  protected onDestroy: (() => void) | null = null;

  constructor(protected readonly stage: Stage, protected readonly base: TrickTableOptions) {
    this.speed = base.speed ?? 1;
    this.seatsDef = [null, ...base.opponents];
    this.director = new dialogue.DialogueDirector(this.seatsDef, (base.seed ^ 0x5eed) >>> 0);
    this.lay = layout.tableLayout(stage.vp);
    this.unsubscribeResize = stage.onResize(() => this.relayout());
    window.addEventListener('keydown', this.onKey);
  }

  /** Build the DOM and lay it out. Subclasses call this at the end of their constructor. */
  protected init(): void {
    this.build();
    this.relayout();
  }

  // ------------------------------------------------------------------ game-specific hooks

  /** The cards a seat holds, in engine order. */
  protected abstract hand(seat: Seat): Card[];
  /** Whose turn it is in the play phase. */
  protected abstract turnSeat(): Seat | null;
  /** Cards already played to the current trick (0–3), for stacking order. */
  protected abstract trickPlayCount(): number;
  protected abstract legalPlays(seat: Seat): Card[];
  /** A computer player's card (or the autoplay human's). */
  protected abstract aiPlay(seat: Seat): Card;
  /** Submit a play to the engine. */
  protected abstract applyPlay(seat: Seat, card: Card): E[];
  /** Submit the deal action to the engine. */
  protected abstract applyDeal(): void;
  /** The first seat to receive a card. */
  protected abstract dealStartSeat(): Seat;
  /** React to one play's events after its card has landed: toasts, collecting a won trick, statistics. */
  protected abstract afterPlay(events: readonly E[]): Promise<void>;
  /** Dialogue candidates for a batch of events. */
  protected abstract candidates(events: readonly E[]): dialogue.DialogueCandidate[];
  /** Fill the score panel (called once). */
  protected abstract buildScorePanel(): void;
  /** Refresh the score panel. */
  protected abstract updateScores(): void;
  /** Extra per-seat layout (badges and so on), after the shared layout. */
  protected relayoutExtras(): void {}

  // ------------------------------------------------------------------ lifecycle

  /** Load images and voices, then greet. Subclasses call this at the start of run(). */
  protected async start(): Promise<void> {
    await Promise.all([preloadCardImages(), audio.preloadVoices(this.base.opponents.map((c) => c.id))]);
    await this.sleep(400);
    this.say(dialogue.gameStartCandidates());
  }

  destroy(): void {
    this.alive = false;
    for (const t of this.timers) clearTimeout(t);
    clearTimeout(this.idleTimer);
    clearTimeout(this.bubbleTimer);
    clearTimeout(this.toastTimer);
    this.pick?.reject(new Cancelled());
    this.pick = null;
    for (const w of this.resumeWaiters) w();
    this.director.reset();
    audio.stopSpeaking();
    this.unsubscribeResize();
    window.removeEventListener('keydown', this.onKey);
    this.onDestroy?.();
    this.root.remove();
  }

  protected guard(): void {
    if (!this.alive) throw new Cancelled();
  }

  protected ms(t: number): number {
    return t / this.speed;
  }

  protected prefs(): settings.PlayerSettings {
    return this.base.getSettings?.() ?? settings.DEFAULT_PLAYER_SETTINGS;
  }

  /** The player's own card timings for the current Card response level. */
  protected response(): layout.ResponseTiming {
    return layout.RESPONSE_TIMING[this.prefs().cardResponse];
  }

  /** Computer thinking and trick pause, scaled by Game speed. */
  protected paced(t: number): number {
    return t * layout.GAME_SPEED_FACTOR[this.prefs().gameSpeed];
  }

  protected async sleep(t: number): Promise<void> {
    await new Promise<void>((resolve) => {
      const id = window.setTimeout(() => {
        this.timers.delete(id);
        resolve();
      }, this.ms(t));
      this.timers.add(id);
    });
    while (this.paused && this.alive) await new Promise<void>((r) => this.resumeWaiters.push(r));
    this.guard();
  }

  /** Computer "thinking" before an action. */
  protected think(): Promise<void> {
    return this.sleep(this.paced(T.aiThinkMin + Math.random() * (T.aiThinkMax - T.aiThinkMin)));
  }

  /** The computer skill and risk for a seat (spec 08). */
  protected aiProfile(seat: Seat): { skill: number; risk: number } {
    if (seat === 0) return { skill: 0.6, risk: 0.3 };
    const c = this.seatsDef[seat]!;
    return { skill: effectiveSkill(this.base.difficulty, c.traits.skillAdjust), risk: c.traits.risk };
  }

  protected aiSeed(seat: Seat): number {
    return seat === 0 ? this.base.seed + 1000 : (this.base.seed + seat * 7919) >>> 0;
  }

  // ------------------------------------------------------------------ DOM

  private build(): void {
    this.root.append(this.cardLayer);
    for (const seat of COMPUTER_SEATS) {
      const c = this.seatsDef[seat]!;
      const p = h('div', 'portrait');
      const face = h('div', 'portrait-face', c.nickname.replace(/^The /, '').charAt(0));
      const [light, dark] = portraitColors(c.id);
      face.style.background = `radial-gradient(circle at 35% 30%, ${light}, ${dark})`;
      p.append(face, h('div', 'nameplate', c.nickname));
      p.title = `${c.name} — ${c.tagline}`;
      this.portraits[seat] = p;
      const b = h('div', `bubble ${this.lay.seats[seat].bubbleSide}`);
      onTap(b, () => this.endBubble());
      this.bubbles[seat] = b;
      this.root.append(p, b);
    }
    this.buildScorePanel();
    onTap(this.menuBtn, () => this.openMenu());
    this.actionBtn.hidden = true;
    onTap(this.actionBtn, () => {
      if (this.mode === 'select' && this.lifted.size === this.selectLimit) this.selectDone?.();
    });
    this.message.hidden = true;
    this.cardLayer.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.cardLayer.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.cardLayer.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.cardLayer.addEventListener('pointercancel', (e) => this.onPointerCancel(e));
    this.root.append(this.youPlate, this.scorePanel, this.menuBtn, this.actionBtn, this.message, this.toast);
    this.stage.el.append(this.root);
  }

  protected nameOf(seat: Seat): string {
    return seat === 0 ? 'You' : this.seatsDef[seat]!.nickname;
  }

  protected place(el: HTMLElement, p: layout.Point): void {
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
  }

  private relayout(): void {
    this.lay = layout.tableLayout(this.stage.vp);
    const L = this.lay;
    for (const seat of COMPUTER_SEATS) {
      const sl = L.seats[seat];
      this.place(this.portraits[seat]!, sl.portrait);
      const off = layout.LAYOUT.portraitSize / 2 + 18;
      this.place(this.bubbles[seat]!, { x: sl.portrait.x + (sl.bubbleSide === 'right' ? off : -off), y: sl.portrait.y - 10 });
    }
    const first = layout.handPlacement(L, 0, 0, 13);
    this.place(this.youPlate, { x: first.x - layout.CARD_W / 2 - 80, y: first.y });
    this.scorePanel.style.left = `${L.scorePanel.x}px`;
    this.scorePanel.style.top = `${L.scorePanel.y}px`;
    this.scorePanel.style.width = `${L.scorePanel.w}px`;
    this.place(this.menuBtn, L.menuButton);
    this.place(this.actionBtn, L.actionButton);
    this.place(this.message, L.message);
    this.place(this.toast, { x: L.center.x, y: L.center.y - 290 });
    this.relayoutExtras();
    for (const seat of SEATS) void this.syncHand(seat, 0);
  }

  /** Highlight whose turn it is: portrait glow, "You" plate, and `rowFor(seat)` in the score panel. */
  protected setTurn(seat: Seat | null): void {
    for (const s of COMPUTER_SEATS) this.portraits[s]!.classList.toggle('turn', s === seat);
    this.youPlate.classList.toggle('turn', seat === 0);
    this.turnChanged(seat);
  }

  /** Score-panel turn highlight (game-specific). */
  protected turnChanged(_seat: Seat | null): void {}

  protected showMessage(text: string | null): void {
    this.message.hidden = text === null;
    if (text !== null) this.message.textContent = text;
  }

  protected showToast(text: string, ms = 1800): void {
    clearTimeout(this.toastTimer);
    this.toast.textContent = text;
    this.toast.classList.add('show');
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('show'), ms);
  }

  // ------------------------------------------------------------------ dialogue

  protected say(candidates: readonly dialogue.DialogueCandidate[]): void {
    const u = this.director.react(candidates, performance.now());
    if (u) this.showBubble(u);
  }

  private showBubble(u: dialogue.Utterance): void {
    if (!this.alive) return;
    for (const b of this.bubbles) b?.classList.remove('show');
    const b = this.bubbles[u.seat]!;
    b.textContent = u.line.text;
    b.classList.add('show');
    const clipMs = audio.speak(u.characterId, u.line.id);
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => this.endBubble(), dialogue.bubbleDurationMs(u.line.text, clipMs));
  }

  private endBubble(): void {
    clearTimeout(this.bubbleTimer);
    audio.stopSpeaking();
    for (const b of this.bubbles) b?.classList.remove('show');
    const next = this.director.bubbleEnded(performance.now());
    if (next) this.showBubble(next);
  }

  // ------------------------------------------------------------------ cards

  protected displayHand(seat: Seat): Card[] {
    return seat === 0 ? sortHand(this.hand(0), this.prefs().cardOrder) : [...this.hand(seat)];
  }

  protected syncHand(seat: Seat, duration: number): Promise<unknown> {
    const hand = this.displayHand(seat);
    return Promise.all(
      hand.map((card, i) => {
        const sp = this.sprites.get(card);
        if (!sp) return undefined;
        sp.setZ(10 + i);
        const lift = seat === 0 && (this.lifted.has(card) || this.pressed === card);
        return sp.moveTo(layout.handPlacement(this.lay, seat, i, hand.length, lift), { duration: this.ms(duration) });
      }),
    );
  }

  private refreshPlayable(): void {
    for (const card of this.hand(0)) {
      this.sprites.get(card)?.el.classList.toggle('dim', this.mode === 'play' && !this.legal.has(card));
    }
  }

  private onCardTap(card: Card): void {
    if (!this.hand(0).includes(card)) return;
    const sp = this.sprites.get(card);
    if (this.mode === 'select') {
      if (this.lifted.has(card)) this.lifted.delete(card);
      else if (this.lifted.size < this.selectLimit) this.lifted.add(card);
      else {
        sp?.shake();
        return;
      }
      this.actionBtn.disabled = this.lifted.size !== this.selectLimit;
      audio.play('card.select');
      void this.syncHand(0, this.response().passToggle);
    } else if (this.mode === 'play' && this.pick) {
      if (this.legal.has(card)) {
        const p = this.pick;
        this.pick = null;
        this.pressed = null;
        p.resolve(card);
      } else sp?.shake();
    }
  }

  // ------------------------------------------------------------------ touch, pen, and mouse (spec 16 §2)

  /** Window coordinates → logical table units. */
  private toLogical(e: PointerEvent): layout.Point {
    const r = this.stage.el.getBoundingClientRect();
    const k = this.stage.vp.scale;
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  }

  private canDrag(card: Card): boolean {
    return this.mode === 'play' && this.pick !== null && this.legal.has(card);
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.gesture || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const card = (e.target as HTMLElement).closest<HTMLElement>('.card')?.dataset['card'] as Card | undefined;
    if (!card || !this.hand(0).includes(card)) return;
    const sp = this.sprites.get(card);
    if (!sp) return;
    const r = this.response();
    const at = this.toLogical(e);
    const g: Gesture = { pointerId: e.pointerId, card, start: at, grab: { x: at.x - sp.place.x, y: at.y - sp.place.y }, dragging: false, handled: false };
    this.gesture = g;
    try {
      this.cardLayer.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety; the gesture still works without it */
    }
    if (r.tapOn === 'press') {
      g.handled = true;
      this.onCardTap(card);
    } else if (r.liftOnPress) {
      if (this.mode === 'select') {
        g.handled = true;
        this.onCardTap(card);
      } else if (this.mode === 'play' && this.pick) {
        if (this.legal.has(card)) {
          this.pressed = card;
          void this.syncHand(0, r.passToggle);
        } else {
          g.handled = true;
          sp.shake();
        }
      }
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const g = this.gesture;
    if (!g || g.pointerId !== e.pointerId || g.handled) return;
    const at = this.toLogical(e);
    if (!g.dragging) {
      if (Math.hypot(at.x - g.start.x, at.y - g.start.y) < layout.LAYOUT.dragStart || !this.canDrag(g.card)) return;
      g.dragging = true;
      this.sprites.get(g.card)?.setZ(300);
    }
    this.sprites.get(g.card)?.jumpTo({ x: at.x - g.grab.x, y: at.y - g.grab.y, rot: 0, scale: 1 });
  }

  private onPointerUp(e: PointerEvent): void {
    const g = this.gesture;
    if (!g || g.pointerId !== e.pointerId) return;
    this.gesture = null;
    if (g.handled) return;
    if (!g.dragging) {
      this.onCardTap(g.card);
      return;
    }
    const sp = this.sprites.get(g.card);
    const rest = layout.handPlacement(this.lay, 0, 0, 1);
    if (sp && this.canDrag(g.card) && rest.y - sp.place.y >= layout.LAYOUT.dragPlayRise) this.onCardTap(g.card);
    else this.settleHand();
  }

  private onPointerCancel(e: PointerEvent): void {
    const g = this.gesture;
    if (!g || g.pointerId !== e.pointerId) return;
    this.gesture = null;
    this.settleHand();
  }

  /** Put a dragged or pressed card back in its place in the hand. */
  private settleHand(): void {
    this.pressed = null;
    void this.syncHand(0, this.response().resort);
  }

  /** Re-apply the player's settings mid-game (after the Settings panel closes). */
  private applySettings(): void {
    const deck = this.prefs().cardDeck;
    for (const sp of this.sprites.values()) sp.setDeck(deck);
    void this.syncHand(0, this.response().resort);
  }

  // ------------------------------------------------------------------ phases

  /** Shuffle sound, then deal one card at a time clockwise from `dealStartSeat()`; the player's cards turn face up. */
  protected async dealHand(): Promise<void> {
    for (const sp of this.sprites.values()) sp.remove();
    this.sprites.clear();
    this.lifted.clear();
    this.applyDeal();
    this.updateScores();
    const deck: layout.Placement = { ...this.lay.deck, rot: 0, scale: layout.LAYOUT.trickCardScale };
    const hands = SEATS.map((s) => this.displayHand(s));
    for (const hand of hands) for (const card of hand) this.sprites.set(card, new CardSprite(card, this.cardLayer, deck, this.prefs().cardDeck));

    audio.play('card.shuffle');
    await this.sleep(audio.hasCue('card.shuffle') ? 1500 : 0);
    const moves: Promise<void>[] = [];
    const first = this.dealStartSeat();
    const order = [0, 1, 2, 3].map((k) => ((first + k) % 4) as Seat);
    let k = 0;
    for (let r = 0; r < 13; r++) {
      for (const seat of order) {
        const card = hands[seat]![r]!;
        const sp = this.sprites.get(card)!;
        sp.setZ(10 + r);
        const id = window.setTimeout(() => {
          this.timers.delete(id);
          audio.play('card.deal');
        }, this.ms(k * T.dealStagger));
        this.timers.add(id);
        moves.push(
          sp.moveTo(layout.handPlacement(this.lay, seat, r, 13), {
            duration: this.ms(T.dealFlight),
            delay: this.ms(k++ * T.dealStagger),
          }),
        );
      }
    }
    await Promise.all(moves);
    this.guard();
    for (const card of hands[0]!) this.sprites.get(card)!.setFaceUp(true);
    await this.sleep(250);
  }

  /** Let the player lift exactly `count` cards and confirm with the action button. */
  protected async selectCards(count: number, prompt: string, buttonText: string): Promise<Card[]> {
    this.selectLimit = count;
    this.mode = 'select';
    this.showMessage(prompt);
    this.actionBtn.textContent = buttonText;
    this.actionBtn.disabled = true;
    this.actionBtn.hidden = false;
    this.setTurn(0);
    await new Promise<void>((resolve) => (this.selectDone = resolve));
    this.guard();
    const chosen = [...this.lifted];
    this.selectDone = null;
    this.mode = 'idle';
    this.actionBtn.hidden = true;
    this.setTurn(null);
    this.showMessage(null);
    return chosen;
  }

  /** One play: the player's pick or a computer's choice, animated to the trick. Returns the events. */
  protected async playTurn(): Promise<E[]> {
    const seat = this.turnSeat();
    if (seat === null) throw new Error('no player to act in play phase');
    this.setTurn(seat);
    let card: Card;
    if (seat === 0 && !this.base.autoplay) {
      card = await this.humanPick();
    } else {
      await this.think();
      card = this.aiPlay(seat);
    }
    const trickIndex = this.trickPlayCount();
    const events = this.applyPlay(seat, card);
    this.setTurn(null);

    const sp = this.sprites.get(card)!;
    sp.setFaceUp(true);
    sp.setZ(200 + trickIndex);
    const slot = this.lay.seats[seat].trickSlot;
    const mine = seat === 0 && !this.base.autoplay;
    const r = this.response();
    await Promise.all([
      sp.moveTo({ ...slot, rot: slot.rot + (Math.random() * 8 - 4) }, { duration: this.ms(mine ? r.playFlight : T.playFlight) }),
      this.syncHand(seat, mine ? r.resort : T.resort),
    ]);
    this.guard();
    audio.play('card.place');
    await this.afterPlay(events);
    this.updateScores();
    this.say(this.candidates(events));
    return events;
  }

  protected async collectTrick(winner: Seat, cards: readonly Card[]): Promise<void> {
    await this.sleep(this.paced(T.trickPause));
    const target = this.lay.seats[winner].collect;
    audio.play('card.collect');
    await Promise.all(
      cards.map((c) =>
        this.sprites.get(c)?.moveTo({ ...target, rot: 0, scale: 0.45 }, { duration: this.ms(T.collect), opacity: 0, easing: 'ease-in' }),
      ),
    );
    for (const c of cards) {
      this.sprites.get(c)?.remove();
      this.sprites.delete(c);
    }
    this.guard();
  }

  private humanPick(): Promise<Card> {
    this.legal = new Set(this.legalPlays(0));
    this.mode = 'play';
    this.refreshPlayable();
    const idle = () => {
      this.say(dialogue.idleCandidates());
      this.idleTimer = window.setTimeout(idle, T.idleRepeat);
    };
    this.idleTimer = window.setTimeout(idle, T.idleHuman);
    return new Promise<Card>((resolve, reject) => {
      this.pick = { resolve, reject };
    }).finally(() => {
      clearTimeout(this.idleTimer);
      this.pressed = null;
      this.mode = 'idle';
      this.refreshPlayable();
    });
  }

  /** Wait for the player (idle comments as for a card play). Rejects if the table is destroyed. */
  protected waitForPlayer<R>(setup: (resolve: (r: R) => void) => void): Promise<R> {
    const idle = () => {
      this.say(dialogue.idleCandidates());
      this.idleTimer = window.setTimeout(idle, T.idleRepeat);
    };
    this.idleTimer = window.setTimeout(idle, T.idleHuman);
    return new Promise<R>((resolve, reject) => {
      this.pick = { resolve: () => undefined, reject };
      setup((r) => {
        this.pick = null;
        resolve(r);
      });
    }).finally(() => clearTimeout(this.idleTimer));
  }

  // ------------------------------------------------------------------ overlays

  protected showOverlay(content: HTMLElement): HTMLDivElement {
    this.overlay?.remove();
    const o = h('div', 'overlay');
    o.append(content);
    this.root.append(o);
    this.overlay = o;
    return o;
  }

  protected closeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  /** Show a dialog with one button and wait for it (demo mode continues by itself after 2.5 s). */
  protected async dialogWithButton(panel: HTMLElement, label: string): Promise<void> {
    const btn = h('button', 'big-button', label);
    panel.append(btn);
    this.showOverlay(panel);
    await new Promise<void>((resolve) => {
      onTap(btn, () => resolve());
      if (this.base.autoplay) window.setTimeout(resolve, 2500); // demo mode: real time, so screenshots can catch it
    });
    this.guard();
    this.closeOverlay();
  }

  /** Game-over dialog: title, standings, optional award, and Play again / Main menu. */
  protected showGameOver(title: string, standings: HTMLElement, award: AwardView | null, won: boolean): void {
    audio.play(won ? 'game.win' : 'game.lose');
    const panel = h('div', 'dialog');
    panel.append(h('h2', '', title), standings);
    if (award) panel.append(this.awardPanel(award));
    const row = h('div', 'dialog-buttons');
    const again = h('button', 'big-button', 'Play again');
    const menu = h('button', 'big-button secondary', 'Main menu');
    onTap(again, () => this.base.onExit('again'));
    onTap(menu, () => this.base.onExit('menu'));
    row.append(again, menu);
    panel.append(row);
    this.showOverlay(panel);
  }

  /** KardCoins award with a count-up (spec 15 §3). */
  private awardPanel(a: AwardView): HTMLElement {
    const box = h('div', 'award');
    const amount = h('span', 'award-amount', '+0');
    const top = h('div', 'award-top');
    top.append(h('span', 'coin-icon large', 'K'), amount, h('span', 'coin-label', 'KardCoins'));
    const balance = h('div', 'award-balance', `Balance: ${a.balance.toLocaleString('en-US')} KardCoins`);
    box.append(top, h('div', 'award-detail', a.detail), balance);
    const start = performance.now();
    const DURATION = 1200;
    audio.play('coins.award');
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      amount.textContent = `+${Math.round(a.total * (1 - (1 - t) ** 3)).toLocaleString('en-US')}`;
      if (t < 1 && this.alive) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return box;
  }

  /**
   * Esc (spec 12 §4, D-058): opens the pause menu like ☰. While paused it resumes, or, if Sound or
   * Settings is open on top, closes that panel (as its Done button would). Ignored on other dialogs.
   */
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || e.repeat) return;
    e.preventDefault();
    const nested = this.overlay?.querySelector<HTMLElement>('.overlay');
    if (nested) nested.querySelector<HTMLElement>('[data-escape]')?.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
    else if (this.paused) this.resume();
    else this.openMenu();
  };

  private resume(): void {
    this.closeOverlay();
    this.paused = false;
    const w = this.resumeWaiters;
    this.resumeWaiters = [];
    for (const fn of w) fn();
  }

  private openMenu(): void {
    if (this.overlay) return;
    this.paused = true;
    const panel = h('div', 'dialog');
    panel.append(h('h2', '', 'Paused'));
    const col = h('div', 'dialog-buttons column');
    const resume = h('button', 'big-button', 'Resume');
    const sound = h('button', 'big-button secondary', 'Sound');
    onTap(sound, () => {
      const back = this.overlay;
      const o = h('div', 'overlay');
      o.append(soundSettingsPanel(() => o.remove()));
      back?.append(o);
    });
    const prefs = h('button', 'big-button secondary', 'Settings');
    onTap(prefs, () => {
      const back = this.overlay;
      const o = h('div', 'overlay');
      o.append(
        settingsPanel(() => {
          o.remove();
          this.applySettings();
        }),
      );
      back?.append(o);
    });
    const restart = h('button', 'big-button secondary', 'New game');
    const menu = h('button', 'big-button secondary', 'Main menu');
    onTap(resume, () => this.resume());
    onTap(restart, () => this.base.onExit('again'));
    onTap(menu, () => this.base.onExit('menu'));
    col.append(resume, sound, prefs, restart, menu);
    panel.append(col);
    this.showOverlay(panel);
  }
}

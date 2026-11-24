/**
 * The Hearts table: presentation + flow controller (spec 12). Drives the engine-neutral rules
 * engine, computer players, and dialogue director, and turns their events into animation,
 * speech bubbles, and score updates. Game state is only ever changed through engine actions.
 */
import { dialogue, effectiveSkill, hearts, layout, sortHand, type Card, type Difficulty } from '../../logic/index.js';
import { portraitColors, preloadCardImages } from '../content.js';
import { h, onTap, type Stage } from '../stage.js';
import { CardSprite } from './card-sprite.js';
import { audio } from '../audio.js';
import { soundSettingsPanel } from '../sound-settings.js';

type Seat = hearts.Seat;
type CharacterDef = dialogue.CharacterDef;

const SEATS: readonly Seat[] = [0, 1, 2, 3];
const COMPUTER_SEATS: readonly Seat[] = [1, 2, 3];
const T = layout.TIMING;

export interface HeartsTableOptions {
  ruleSet: hearts.HeartsRuleSet;
  difficulty: Difficulty;
  /** Opponents for West, North, East. */
  opponents: readonly CharacterDef[];
  seed: number;
  /** Demo/testing: the human seat is played by the computer. */
  autoplay?: boolean;
  /** Demo/testing: divide all game timings by this factor. */
  speed?: number;
  onExit(next: 'menu' | 'again'): void;
}

class Cancelled extends Error {}

const DIRECTION_TEXT: Record<hearts.PassDirection, string> = {
  left: 'to the left',
  right: 'to the right',
  across: 'across',
  none: '',
};
const DIRECTION_ARROW: Record<hearts.PassDirection, string> = { left: '←', right: '→', across: '↑', none: '' };

export class HeartsTable {
  private state: hearts.HeartsState;
  private readonly ais: (hearts.HeartsAiPlayer | null)[];
  private readonly seatsDef: (CharacterDef | null)[];
  private readonly director: dialogue.DialogueDirector;
  private lay: layout.TableLayout;
  private readonly speed: number;

  private readonly root = h('div', 'hearts-table');
  private readonly cardLayer = h('div', 'card-layer');
  private readonly portraits: HTMLDivElement[] = [];
  private readonly bubbles: HTMLDivElement[] = [];
  private readonly youPlate = h('div', 'nameplate you', 'You');
  private readonly scorePanel = h('div', 'score-panel');
  private readonly scoreCells: { hand: HTMLElement; total: HTMLElement; row: HTMLElement }[] = [];
  private readonly scoreInfo = h('div', 'score-info');
  private readonly menuBtn = h('button', 'menu-button', '☰');
  private readonly actionBtn = h('button', 'action-button');
  private readonly message = h('div', 'table-message');
  private readonly toast = h('div', 'toast');
  private overlay: HTMLDivElement | null = null;

  private readonly sprites = new Map<Card, CardSprite>();
  private readonly lifted = new Set<Card>();
  private mode: 'idle' | 'pass' | 'play' = 'idle';
  private legal = new Set<Card>();
  private pick: { resolve: (c: Card) => void; reject: (e: Error) => void } | null = null;
  private passDone: (() => void) | null = null;
  private alive = true;
  private paused = false;
  private resumeWaiters: (() => void)[] = [];
  private readonly timers = new Set<number>();
  private idleTimer = 0;
  private bubbleTimer = 0;
  private toastTimer = 0;
  private readonly unsubscribeResize: () => void;

  constructor(private readonly stage: Stage, private readonly opts: HeartsTableOptions) {
    this.speed = opts.speed ?? 1;
    this.state = hearts.createHeartsGame({ ruleSet: opts.ruleSet, seed: opts.seed });
    this.seatsDef = [null, ...opts.opponents];
    this.ais = SEATS.map((seat) => {
      if (seat === 0) return opts.autoplay ? hearts.createHeartsAi({ skill: 0.6, risk: 0.3 }, opts.seed + 1000) : null;
      const c = this.seatsDef[seat]!;
      return hearts.createHeartsAi(
        { skill: effectiveSkill(opts.difficulty, c.traits.skillAdjust), risk: c.traits.risk },
        (opts.seed + seat * 7919) >>> 0,
      );
    });
    this.director = new dialogue.DialogueDirector(this.seatsDef, (opts.seed ^ 0x5eed) >>> 0);
    this.lay = layout.tableLayout(stage.vp);
    this.build();
    this.unsubscribeResize = stage.onResize(() => this.relayout());
    this.relayout();
  }

  // ------------------------------------------------------------------ lifecycle

  async run(): Promise<void> {
    try {
      await preloadCardImages();
      await this.sleep(400);
      this.say(dialogue.gameStartCandidates());
      for (;;) {
        await this.dealHand();
        if (this.state.phase === 'pass') await this.passPhase();
        let lastEvents: hearts.HeartsEvent[] = [];
        while (this.state.phase === 'play') lastEvents = await this.playTurn();
        await this.handSummary(lastEvents);
        const events = this.apply({ type: 'continue' });
        this.say(dialogue.heartsCandidates(events, this.state));
        if (this.state.phase === 'game_over') {
          await this.gameOver();
          return;
        }
      }
    } catch (e) {
      if (!(e instanceof Cancelled)) throw e;
    }
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
    this.unsubscribeResize();
    this.root.remove();
  }

  private guard(): void {
    if (!this.alive) throw new Cancelled();
  }

  private ms(t: number): number {
    return t / this.speed;
  }

  private async sleep(t: number): Promise<void> {
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

  private apply(action: hearts.HeartsAction): hearts.HeartsEvent[] {
    const step = hearts.applyHeartsAction(this.state, action);
    this.state = step.state;
    return step.events;
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

    this.scorePanel.append(h('div', 'score-title', this.opts.ruleSet === 'standard' ? 'Hearts' : 'Hearts · J♦ −10'));
    const table = h('div', 'score-grid');
    table.append(h('span', 'score-head', ''), h('span', 'score-head', 'Hand'), h('span', 'score-head', 'Total'));
    for (const seat of SEATS) {
      const name = h('span', 'score-name', this.nameOf(seat));
      const hand = h('span', 'score-num', '0');
      const total = h('span', 'score-num total', '0');
      table.append(name, hand, total);
      this.scoreCells[seat] = { hand, total, row: name };
    }
    this.scorePanel.append(table, this.scoreInfo);

    onTap(this.menuBtn, () => this.openMenu());
    this.actionBtn.hidden = true;
    onTap(this.actionBtn, () => {
      if (this.mode === 'pass' && this.lifted.size === 3) this.passDone?.();
    });
    this.message.hidden = true;
    this.cardLayer.addEventListener('pointerup', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.card');
      const card = el?.dataset['card'] as Card | undefined;
      if (card) this.onCardTap(card);
    });
    this.root.append(this.youPlate, this.scorePanel, this.menuBtn, this.actionBtn, this.message, this.toast);
    this.stage.el.append(this.root);
  }

  private nameOf(seat: Seat): string {
    return seat === 0 ? 'You' : this.seatsDef[seat]!.nickname;
  }

  private place(el: HTMLElement, p: layout.Point): void {
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
    for (const seat of SEATS) void this.syncHand(seat, 0);
  }

  private updateScores(): void {
    for (const seat of SEATS) {
      const cells = this.scoreCells[seat]!;
      cells.hand.textContent = String(hearts.cardsPoints(this.state.taken[seat], this.state.ruleSet));
      cells.total.textContent = String(this.state.scores[seat]);
    }
    const s = this.state;
    this.scoreInfo.textContent =
      s.phase === 'pass' ? `Hand ${s.handNumber} · Pass ${DIRECTION_ARROW[s.passDirection]}` : `Hand ${s.handNumber} · to ${s.targetScore}`;
  }

  private setTurn(seat: Seat | null): void {
    for (const s of COMPUTER_SEATS) this.portraits[s]!.classList.toggle('turn', s === seat);
    this.youPlate.classList.toggle('turn', seat === 0);
    for (const s of SEATS) this.scoreCells[s]!.row.classList.toggle('turn', s === seat);
  }

  private showMessage(text: string | null): void {
    this.message.hidden = text === null;
    if (text !== null) this.message.textContent = text;
  }

  private showToast(text: string, ms = 1800): void {
    clearTimeout(this.toastTimer);
    this.toast.textContent = text;
    this.toast.classList.add('show');
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('show'), ms);
  }

  // ------------------------------------------------------------------ dialogue

  private say(candidates: readonly dialogue.DialogueCandidate[]): void {
    const u = this.director.react(candidates, performance.now());
    if (u) this.showBubble(u);
  }

  private showBubble(u: dialogue.Utterance): void {
    if (!this.alive) return;
    for (const b of this.bubbles) b?.classList.remove('show');
    const b = this.bubbles[u.seat]!;
    b.textContent = u.line.text;
    b.classList.add('show');
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => this.endBubble(), dialogue.bubbleDurationMs(u.line.text));
  }

  private endBubble(): void {
    clearTimeout(this.bubbleTimer);
    for (const b of this.bubbles) b?.classList.remove('show');
    const next = this.director.bubbleEnded(performance.now());
    if (next) this.showBubble(next);
  }

  // ------------------------------------------------------------------ cards

  private displayHand(seat: Seat): Card[] {
    return seat === 0 ? sortHand(this.state.hands[0]) : [...this.state.hands[seat]];
  }

  private syncHand(seat: Seat, duration: number): Promise<unknown> {
    const hand = this.displayHand(seat);
    return Promise.all(
      hand.map((card, i) => {
        const sp = this.sprites.get(card);
        if (!sp) return undefined;
        sp.setZ(10 + i);
        const lift = seat === 0 && this.lifted.has(card);
        return sp.moveTo(layout.handPlacement(this.lay, seat, i, hand.length, lift), { duration: this.ms(duration) });
      }),
    );
  }

  private refreshPlayable(): void {
    for (const card of this.state.hands[0]) {
      this.sprites.get(card)?.el.classList.toggle('dim', this.mode === 'play' && !this.legal.has(card));
    }
  }

  private onCardTap(card: Card): void {
    if (!this.state.hands[0].includes(card)) return;
    const sp = this.sprites.get(card);
    if (this.mode === 'pass') {
      if (this.lifted.has(card)) this.lifted.delete(card);
      else if (this.lifted.size < 3) this.lifted.add(card);
      else {
        sp?.shake();
        return;
      }
      this.actionBtn.disabled = this.lifted.size !== 3;
      audio.play('card.select');
      void this.syncHand(0, 140);
    } else if (this.mode === 'play' && this.pick) {
      if (this.legal.has(card)) {
        const p = this.pick;
        this.pick = null;
        p.resolve(card);
      } else sp?.shake();
    }
  }

  // ------------------------------------------------------------------ phases

  private async dealHand(): Promise<void> {
    for (const sp of this.sprites.values()) sp.remove();
    this.sprites.clear();
    this.lifted.clear();
    this.apply({ type: 'deal' });
    this.updateScores();
    const deck: layout.Placement = { ...this.lay.deck, rot: 0, scale: layout.LAYOUT.trickCardScale };
    const hands = SEATS.map((s) => this.displayHand(s));
    for (const hand of hands) for (const card of hand) this.sprites.set(card, new CardSprite(card, this.cardLayer, deck));

    audio.play('card.shuffle');
    await this.sleep(audio.hasCue('card.shuffle') ? 700 : 0);
    const moves: Promise<void>[] = [];
    let k = 0;
    for (let r = 0; r < 13; r++) {
      for (const seat of [1, 2, 3, 0] as const) {
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

  private async passPhase(): Promise<void> {
    const dir = this.state.passDirection;
    this.updateScores();
    let mine: Card[];
    if (this.opts.autoplay) {
      mine = this.ais[0]!.choosePass(this.state, 0);
    } else {
      this.mode = 'pass';
      this.showMessage(`Choose 3 cards to pass ${DIRECTION_TEXT[dir]}`);
      this.actionBtn.textContent = `Pass ${DIRECTION_ARROW[dir]}`;
      this.actionBtn.disabled = true;
      this.actionBtn.hidden = false;
      this.setTurn(0);
      await new Promise<void>((resolve) => (this.passDone = resolve));
      this.guard();
      mine = [...this.lifted];
      this.passDone = null;
      this.mode = 'idle';
      this.actionBtn.hidden = true;
      this.setTurn(null);
    }
    this.showMessage(null);
    this.lifted.clear();
    let events = this.apply({ type: 'pass', seat: 0, cards: mine });
    for (const seat of COMPUTER_SEATS) events = [...events, ...this.apply({ type: 'pass', seat, cards: this.ais[seat]!.choosePass(this.state, seat) })];

    audio.play('card.pass');
    for (const seat of SEATS) for (const card of this.state.hands[seat]) this.sprites.get(card)?.setFaceUp(seat === 0);
    for (const card of this.state.received[0]) this.lifted.add(card);
    await Promise.all(SEATS.map((s) => this.syncHand(s, T.passFlight)));
    this.say(dialogue.heartsCandidates(events, this.state));
    await this.sleep(T.passReveal);
    this.lifted.clear();
    await this.syncHand(0, T.resort);
    this.updateScores();
  }

  private async playTurn(): Promise<hearts.HeartsEvent[]> {
    const seat = hearts.currentSeat(this.state);
    if (seat === null) throw new Error('no player to act in play phase');
    this.setTurn(seat);
    let card: Card;
    if (seat === 0 && !this.opts.autoplay) {
      card = await this.humanPick();
    } else {
      await this.sleep(T.aiThinkMin + Math.random() * (T.aiThinkMax - T.aiThinkMin));
      card = this.ais[seat]!.choosePlay(this.state, seat);
    }
    const trickIndex = this.state.trick.plays.length;
    const events = this.apply({ type: 'play', seat, card });
    this.setTurn(null);

    const sp = this.sprites.get(card)!;
    sp.setFaceUp(true);
    sp.setZ(200 + trickIndex);
    const slot = this.lay.seats[seat].trickSlot;
    await Promise.all([
      sp.moveTo({ ...slot, rot: slot.rot + (Math.random() * 8 - 4) }, { duration: this.ms(T.playFlight) }),
      this.syncHand(seat, T.resort),
    ]);
    this.guard();
    audio.play('card.place');

    for (const e of events) {
      if (e.type === 'hearts_broken') {
        this.showToast('Hearts are broken!');
        audio.play('table.hearts_broken');
      }
      if (e.type === 'trick_won') await this.collectTrick(e.seat as Seat, e.cards);
      if (e.type === 'queen_of_spades_taken') {
        this.showToast(`${this.nameOf(e.seat as Seat)} took the Queen of Spades!`, 2200);
        audio.play('table.queen');
      }
      if (e.type === 'jack_of_diamonds_taken') this.showToast(`${this.nameOf(e.seat as Seat)} took the Jack of Diamonds (−10)`, 2200);
      if (e.type === 'moon_shot') {
        this.showToast(`${this.nameOf(e.seat as Seat)} shot the moon!`, 3000);
        audio.play('table.moon');
      }
    }
    this.updateScores();
    this.say(dialogue.heartsCandidates(events, this.state));
    return events;
  }

  private async collectTrick(winner: Seat, cards: readonly Card[]): Promise<void> {
    await this.sleep(T.trickPause);
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
    this.legal = new Set(hearts.legalPlays(this.state, 0));
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
      this.mode = 'idle';
      this.refreshPlayable();
    });
  }

  // ------------------------------------------------------------------ overlays

  private showOverlay(content: HTMLElement): HTMLDivElement {
    this.overlay?.remove();
    const o = h('div', 'overlay');
    o.append(content);
    this.root.append(o);
    this.overlay = o;
    return o;
  }

  private closeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private standingsTable(handPoints: readonly number[] | null): HTMLElement {
    const grid = h('div', `results-grid${handPoints ? '' : ' final'}`);
    grid.append(h('span', 'results-head', 'Player'));
    if (handPoints) grid.append(h('span', 'results-head', 'This hand'));
    grid.append(h('span', 'results-head', 'Total'));
    const order = handPoints ? [...SEATS] : [...SEATS].sort((a, b) => this.state.scores[a] - this.state.scores[b]);
    for (const seat of order) {
      grid.append(h('span', 'results-name', this.nameOf(seat)));
      if (handPoints) grid.append(h('span', 'results-num', `+${handPoints[seat]}`));
      grid.append(h('span', 'results-num total', String(this.state.scores[seat])));
    }
    return grid;
  }

  private async handSummary(events: readonly hearts.HeartsEvent[]): Promise<void> {
    const scored = events.find((e) => e.type === 'hand_scored');
    const moon = events.find((e) => e.type === 'moon_shot');
    await this.sleep(500);
    const panel = h('div', 'dialog');
    panel.append(h('h2', '', `Hand ${this.state.handNumber} results`));
    if (moon) panel.append(h('p', 'dialog-note', `${this.nameOf(moon.seat as Seat)} shot the moon!`));
    panel.append(this.standingsTable(scored?.type === 'hand_scored' ? scored.handPoints : [0, 0, 0, 0]));
    const over = hearts.gameWinner(this.state.scores, this.state.targetScore) !== null;
    const btn = h('button', 'big-button', over ? 'Final results' : 'Next hand');
    panel.append(btn);
    this.showOverlay(panel);
    await new Promise<void>((resolve) => {
      onTap(btn, () => resolve());
      if (this.opts.autoplay) window.setTimeout(resolve, 2500); // demo mode: real time, so screenshots can catch it
    });
    this.guard();
    this.closeOverlay();
  }

  private async gameOver(): Promise<void> {
    const winner = this.state.winner;
    audio.play(winner === 0 ? 'game.win' : 'game.lose');
    const panel = h('div', 'dialog');
    panel.append(h('h2', '', winner === 0 ? 'You win!' : `${this.nameOf(winner ?? 0)} wins!`));
    panel.append(this.standingsTable(null));
    const row = h('div', 'dialog-buttons');
    const again = h('button', 'big-button', 'Play again');
    const menu = h('button', 'big-button secondary', 'Main menu');
    onTap(again, () => this.opts.onExit('again'));
    onTap(menu, () => this.opts.onExit('menu'));
    row.append(again, menu);
    panel.append(row);
    this.showOverlay(panel);
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
    const restart = h('button', 'big-button secondary', 'New game');
    const menu = h('button', 'big-button secondary', 'Main menu');
    onTap(resume, () => {
      this.closeOverlay();
      this.paused = false;
      const w = this.resumeWaiters;
      this.resumeWaiters = [];
      for (const fn of w) fn();
    });
    onTap(restart, () => this.opts.onExit('again'));
    onTap(menu, () => this.opts.onExit('menu'));
    col.append(resume, sound, restart, menu);
    panel.append(col);
    this.showOverlay(panel);
  }
}

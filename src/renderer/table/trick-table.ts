/**
 * Shared presentation for 4-player trick-taking games (spec 12): card sprites, dealing, the player's
 * card gestures (spec 16), and trick play and collection, on top of the shared table (TableBase).
 * Each game (Hearts, Spades) subclasses it and adds its own phases, score panel, and dialogs.
 * Game state is only changed through engine actions.
 */
import { dialogue, layout, sortHand, type Card, type Seat } from '../../logic/index.js';
import { h, onTap } from '../stage.js';
import { CardSprite } from './card-sprite.js';
import { audio } from '../audio.js';
import { Cancelled, DIFFICULTY_NAMES, T, TableBase, type AwardView, type TableOptions } from './table-base.js';

export { Cancelled, DIFFICULTY_NAMES, T, type AwardView };

export const SEATS: readonly Seat[] = [0, 1, 2, 3];
export const COMPUTER_SEATS: readonly Seat[] = [1, 2, 3];

/** Options for a trick-taking table; `opponents` are West, North, East. */
export type TrickTableOptions = TableOptions;

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

export abstract class TrickTable<E> extends TableBase {
  protected readonly actionBtn = h('button', 'action-button');

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
  private pick: { resolve: (c: Card) => void } | null = null;

  constructor(stage: ConstructorParameters<typeof TableBase>[0], base: TrickTableOptions) {
    super(stage, base);
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
  /** Extra per-seat layout (badges and so on), after the shared layout. */
  protected relayoutExtras(): void {}

  protected portraitSpot(seat: number): { point: layout.Point; bubbleSide: 'left' | 'right' } {
    const sl = this.lay.seats[seat as Seat];
    return { point: sl.portrait, bubbleSide: sl.bubbleSide };
  }

  // ------------------------------------------------------------------ DOM

  protected override buildTable(): void {
    this.actionBtn.hidden = true;
    onTap(this.actionBtn, () => {
      if (this.mode === 'select' && this.lifted.size === this.selectLimit) this.selectDone?.();
    });
    this.cardLayer.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.cardLayer.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.cardLayer.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.cardLayer.addEventListener('pointercancel', (e) => this.onPointerCancel(e));
    this.root.append(this.actionBtn);
  }

  protected relayoutTable(): void {
    const first = layout.handPlacement(this.lay, 0, 0, 13);
    this.place(this.youPlate, { x: first.x - layout.CARD_W / 2 - 80, y: first.y });
    this.place(this.actionBtn, this.lay.actionButton);
    this.relayoutExtras();
    for (const seat of SEATS) void this.syncHand(seat, 0);
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
  protected override settingsChanged(): void {
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
        this.later(k * T.dealStagger, () => audio.play('card.deal'));
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
    return this.waitForPlayer<Card>((resolve) => {
      this.pick = { resolve };
    }).finally(() => {
      this.pick = null;
      this.pressed = null;
      this.mode = 'idle';
      this.refreshPlayable();
    });
  }
}

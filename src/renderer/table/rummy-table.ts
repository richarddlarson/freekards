/**
 * Shared presentation for the 2-player rummy games (spec 18 §4): the computer at the top, the stock
 * and discard pile in the middle, meld rows, and the player's hand arranged in groups at the bottom,
 * with an action bar of prompts and buttons above it. Every card has a sprite for the whole hand;
 * after each action the game lays all cards out again (`layoutCards`) and the sprites fly there.
 * Gin Rummy and Rummy 500 subclass it. Game state is only changed through engine actions.
 */
import { DISPLAY_SUIT_ORDER, layout, rankOf, rummy, rummyLayout, suitOf, type Card } from '../../logic/index.js';
import { h, onTap } from '../stage.js';
import { CardSprite } from './card-sprite.js';
import { audio } from '../audio.js';
import { TableBase, T, type TableOptions } from './table-base.js';

/** How the player's hand is arranged (spec 18 §4.3). */
export type Arrange = 'melds' | 'suit' | 'rank';
const ARRANGE_NEXT: Record<Arrange, Arrange> = { melds: 'suit', suit: 'rank', rank: 'melds' };
const ARRANGE_NAME: Record<Arrange, string> = { melds: 'Melds', suit: 'Suit', rank: 'Rank' };

/** Where one card should be: placement, face up or down, and stacking order. */
export interface CardSpot {
  p: layout.Placement;
  up: boolean;
  z: number;
}

export interface ActionButton {
  label: string;
  enabled: boolean;
  primary?: boolean;
  onTap(): void;
}

interface Gesture {
  pointerId: number;
  card: Card;
  start: layout.Point;
  grab: layout.Point;
  dragging: boolean;
  handled: boolean;
}

/** Ace-low rank for sorting rummy hands. */
export const lowRank = (c: Card): number => (rankOf(c) === 14 ? 1 : rankOf(c));

export abstract class RummyTable extends TableBase {
  protected rl: rummyLayout.RummyLayout;
  protected readonly sprites = new Map<Card, CardSprite>();
  /** Cards the player has selected (lifted) in their hand. */
  protected readonly lifted = new Set<Card>();
  protected arrange: Arrange = 'melds';
  private readonly actionBar = h('div', 'rummy-actions');
  private readonly arrangeBtn = h('button', 'choice arrange-button');
  private gesture: Gesture | null = null;

  constructor(stage: ConstructorParameters<typeof TableBase>[0], base: TableOptions, private readonly game: 'gin' | 'rummy500') {
    super(stage, base);
    this.rl = rummyLayout.tableLayout(stage.vp, game);
  }

  // ------------------------------------------------------------------ game-specific hooks

  /** The player's hand and the computer's hand, in engine order. */
  protected abstract hand(player: 0 | 1): Card[];
  /** Where every card on the table should be right now. */
  protected abstract layoutCards(): Map<Card, CardSpot>;
  /** The player tapped a card (in the hand, the stock, the discard pile, or a meld). */
  protected abstract cardTapped(card: Card): void;
  /** Whether the player may drag this hand card onto the discard pile now. */
  protected canDragToDiscard(_card: Card): boolean {
    return false;
  }
  /** The player dropped a hand card on the discard pile. */
  protected droppedOnDiscard(_card: Card): void {}
  /** The best arrangement of the player's hand for the Melds view. */
  protected abstract arrangement(hand: readonly Card[]): rummy.Arrangement;

  protected portraitSpot(): { point: layout.Point; bubbleSide: 'left' | 'right' } {
    return { point: this.lay.seats[2].portrait, bubbleSide: 'right' };
  }

  // ------------------------------------------------------------------ DOM

  protected override buildTable(): void {
    this.root.classList.add('rummy-table');
    this.actionBar.hidden = true;
    onTap(this.arrangeBtn, () => {
      this.arrange = ARRANGE_NEXT[this.arrange];
      this.updateArrangeButton();
      audio.play('card.select');
      void this.sync(this.response().resort);
    });
    this.updateArrangeButton();
    this.cardLayer.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.cardLayer.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.cardLayer.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.cardLayer.addEventListener('pointercancel', () => this.cancelGesture());
    this.root.append(this.actionBar, this.arrangeBtn);
  }

  private updateArrangeButton(): void {
    this.arrangeBtn.textContent = `Arrange: ${ARRANGE_NAME[this.arrange]}`;
  }

  protected relayoutTable(): void {
    this.rl = rummyLayout.tableLayout(this.stage.vp, this.game);
    this.place(this.youPlate, this.rl.you);
    this.place(this.arrangeBtn, { x: this.rl.you.x, y: this.rl.you.y - 92 });
    this.place(this.actionBar, this.rl.actionBar);
    // Toasts sit just below the stock and discard pile, clear of both meld rows.
    this.place(this.toast, { x: this.rl.center.x, y: this.rl.center.y + rummyLayout.RUMMY_LAYOUT.toastBelow });
    void this.sync(0);
  }

  protected override settingsChanged(): void {
    const deck = this.prefs().cardDeck;
    for (const sp of this.sprites.values()) sp.setDeck(deck);
    void this.sync(this.response().resort);
  }

  /** Show a prompt and buttons above the hand, or hide the bar (null). */
  protected setActions(prompt: string | null, buttons: readonly ActionButton[] = []): void {
    this.actionBar.replaceChildren();
    this.actionBar.hidden = prompt === null && buttons.length === 0;
    if (prompt !== null) this.actionBar.append(h('div', 'rummy-prompt', prompt));
    for (const b of buttons) {
      const el = h('button', `action-button inline${b.primary === false ? ' secondary' : ''}`, b.label);
      el.disabled = !b.enabled;
      onTap(el, () => {
        if (!el.disabled) b.onTap();
      });
      this.actionBar.append(el);
    }
  }

  // ------------------------------------------------------------------ layout helpers for subclasses

  /** The player's hand in display groups, by the current arrangement (spec 18 §4.3). */
  protected handGroups(hand: readonly Card[]): Card[][] {
    const order = this.prefs().cardOrder === 'low-right' ? -1 : 1;
    const bySuit = (a: Card, b: Card) =>
      DISPLAY_SUIT_ORDER.indexOf(suitOf(a)) - DISPLAY_SUIT_ORDER.indexOf(suitOf(b)) || order * (lowRank(a) - lowRank(b));
    if (this.arrange === 'rank') {
      return [[...hand].sort((a, b) => order * (lowRank(a) - lowRank(b)) || DISPLAY_SUIT_ORDER.indexOf(suitOf(a)) - DISPLAY_SUIT_ORDER.indexOf(suitOf(b)))];
    }
    if (this.arrange === 'suit') {
      return DISPLAY_SUIT_ORDER.map((s) => hand.filter((c) => suitOf(c) === s).sort(bySuit));
    }
    const a = this.arrangement(hand);
    const melds = a.melds
      .map((m) => (m.kind === 'set' ? [...m.cards].sort(bySuit) : order < 0 ? [...m.cards].reverse() : [...m.cards]))
      .sort((x, y) => bySuit(x[0]!, y[0]!));
    return [...melds, [...a.deadwood].sort(bySuit)];
  }

  /** Spots for the player's hand (face up, or face down in a demo if `up` is false). */
  protected playerHandSpots(out: Map<Card, CardSpot>, groups: readonly Card[][], up = true): void {
    const places = rummyLayout.groupedHandPlacements(this.rl, groups, this.lifted);
    let i = 0;
    for (const g of groups) for (const c of g) out.set(c, { p: places.get(c)!, up, z: 400 + i++ });
  }

  protected opponentHandSpots(out: Map<Card, CardSpot>, cards: readonly Card[]): void {
    cards.forEach((c, i) => out.set(c, { p: rummyLayout.opponentHandPlacement(this.rl, i, cards.length), up: false, z: 300 + i }));
  }

  /** The stock as a slightly offset stack, top card last. */
  protected stockSpots(out: Map<Card, CardSpot>, stock: readonly Card[]): void {
    const s = rummyLayout.RUMMY_LAYOUT.pileScale;
    stock.forEach((c, i) => {
      const lift = Math.floor(i / 4);
      out.set(c, { p: { x: this.rl.stock.x - lift * 0.6, y: this.rl.stock.y - lift, rot: 0, scale: s }, up: false, z: 10 + i });
    });
  }

  protected meldRowSpots(out: Map<Card, CardSpot>, melds: readonly (readonly Card[])[], row: 'opponent' | 'player', z = 200): void {
    const places = rummyLayout.meldRowPlacements(this.rl, melds, row);
    let i = 0;
    for (const m of melds) for (const c of m) out.set(c, { p: places.get(c)!, up: true, z: z + i++ });
  }

  // ------------------------------------------------------------------ sprites

  /** New sprites for a fresh deal, all stacked on the stock face down. */
  protected resetSprites(cards: readonly Card[]): void {
    for (const sp of this.sprites.values()) sp.remove();
    this.sprites.clear();
    this.lifted.clear();
    const at: layout.Placement = { ...this.rl.stock, rot: 0, scale: rummyLayout.RUMMY_LAYOUT.pileScale };
    for (const c of cards) this.sprites.set(c, new CardSprite(c, this.cardLayer, at, this.prefs().cardDeck));
  }

  /** Move every card to where `layoutCards` says. Cards in `faceUpFirst` turn over before they move. */
  protected sync(duration: number, opts: { stagger?: number; only?: ReadonlySet<Card> } = {}): Promise<unknown> {
    const spots = this.layoutCards();
    const moves: Promise<void>[] = [];
    let k = 0;
    for (const [card, spot] of spots) {
      const sp = this.sprites.get(card);
      if (!sp) continue;
      if (opts.only && !opts.only.has(card)) continue;
      sp.setZ(spot.z);
      sp.setFaceUp(spot.up);
      const delay = opts.stagger ? this.ms(k++ * opts.stagger) : 0;
      moves.push(sp.moveTo(spot.p, { duration: this.ms(duration), delay }));
    }
    return Promise.all(moves);
  }

  /** Deal animation: cards fly from the stock to the hands in `order`, one at a time. */
  protected async dealAnimation(order: readonly Card[]): Promise<void> {
    audio.play('card.shuffle');
    await this.sleep(audio.hasCue('card.shuffle') ? 1500 : 0);
    const spots = this.layoutCards();
    const moves: Promise<void>[] = [];
    order.forEach((card, k) => {
      const sp = this.sprites.get(card)!;
      const spot = spots.get(card)!;
      sp.setZ(spot.z);
      this.later(k * T.dealStagger * 1.6, () => audio.play('card.deal'));
      moves.push(sp.moveTo(spot.p, { duration: this.ms(T.dealFlight), delay: this.ms(k * T.dealStagger * 1.6) }));
    });
    await Promise.all(moves);
    this.guard();
    await this.sync(T.resort);
    await this.sleep(250);
  }

  // ------------------------------------------------------------------ touch, pen, and mouse

  private toLogical(e: PointerEvent): layout.Point {
    const r = this.stage.el.getBoundingClientRect();
    const k = this.stage.vp.scale;
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.gesture || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const card = (e.target as HTMLElement).closest<HTMLElement>('.card')?.dataset['card'] as Card | undefined;
    const sp = card ? this.sprites.get(card) : undefined;
    if (!card || !sp) return;
    const at = this.toLogical(e);
    const g: Gesture = { pointerId: e.pointerId, card, start: at, grab: { x: at.x - sp.place.x, y: at.y - sp.place.y }, dragging: false, handled: false };
    this.gesture = g;
    try {
      this.cardLayer.setPointerCapture(e.pointerId);
    } catch {
      /* the gesture still works without capture */
    }
    const r = this.response();
    // Instant acts on press; Quick lifts a hand card on press (spec 16 §3).
    if (r.tapOn === 'press' || (r.liftOnPress && this.hand(0).includes(card) && !this.canDragToDiscard(card))) {
      g.handled = true;
      this.cardTapped(card);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const g = this.gesture;
    if (!g || g.pointerId !== e.pointerId || g.handled) return;
    const at = this.toLogical(e);
    if (!g.dragging) {
      if (Math.hypot(at.x - g.start.x, at.y - g.start.y) < layout.LAYOUT.dragStart) return;
      if (!this.hand(0).includes(g.card) || !this.canDragToDiscard(g.card)) return;
      g.dragging = true;
      this.sprites.get(g.card)?.setZ(900);
    }
    this.sprites.get(g.card)?.jumpTo({ x: at.x - g.grab.x, y: at.y - g.grab.y, rot: 0, scale: 1 });
  }

  private onPointerUp(e: PointerEvent): void {
    const g = this.gesture;
    if (!g || g.pointerId !== e.pointerId) return;
    this.gesture = null;
    if (g.handled) return;
    if (!g.dragging) {
      this.cardTapped(g.card);
      return;
    }
    const sp = this.sprites.get(g.card);
    if (sp && this.canDragToDiscard(g.card) && this.overDiscard(sp.place)) this.droppedOnDiscard(g.card);
    else void this.sync(this.response().resort);
  }

  private cancelGesture(): void {
    this.gesture = null;
    void this.sync(this.response().resort);
  }

  /** A dragged card counts as dropped on the discard pile within this area (the pile, or anywhere above the hand toward it). */
  protected overDiscard(p: layout.Point): boolean {
    const d = this.rl.discard;
    if (this.game === 'gin') return Math.abs(p.x - d.x) < 220 && Math.abs(p.y - d.y) < 220;
    return p.y < this.rl.actionBar.y - 40 && p.y > d.y - 200;
  }
}

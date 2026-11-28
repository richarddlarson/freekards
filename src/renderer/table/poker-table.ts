/**
 * The poker table (spec 19 §4): Five-Card Draw for the player and up to three regulars, with chips.
 * Antes, bets, and pots move as chip piles; the player bets with buttons above her cards and taps
 * cards to throw away. Regulars who run out of chips buy more or leave, and another regular may take
 * the seat. Leaving the table cashes everyone out through the bank (spec 15 §6.3). Game state is only
 * changed through engine actions.
 */
import { dialogue, layout, poker, pokerLayout, rankOf, suitOf, DISPLAY_SUIT_ORDER, type Card, type casino } from '../../logic/index.js';
import { preloadChipImages } from '../content.js';
import { h, onTap } from '../stage.js';
import { audio } from '../audio.js';
import { CardSprite } from './card-sprite.js';
import { ChipPile, flyChips } from './chips.js';
import { Cancelled, T, TableBase, type TableOptions } from './table-base.js';
import { cardName } from './gin-table.js';

type CharacterDef = dialogue.CharacterDef;
type DrawState = poker.DrawState;
type DrawEvent = poker.DrawEvent;
type BetKind = poker.BetKind;

const SEATS = [0, 1, 2, 3] as const;
const PL = pokerLayout.POKER_LAYOUT;

/** Presentation timing (spec 19 §4.4), milliseconds. */
export const POKER_TIMING = {
  chipFlight: 420,
  collect: 450,
  potToWinner: 650,
  dealStagger: 70,
  foldFlight: 360,
  drawFlight: 300,
  showFlight: 420,
  /** Pause after the hands are shown, before the pot moves (× Game speed). */
  showPause: 1000,
  /** Pause after the pot is paid, before the next-hand buttons (× Game speed). */
  afterPot: 900,
  /** Demo mode: wait between hands. */
  demoNextHand: 1500,
};
const PT = POKER_TIMING;

/** What the table asks of the player's KardCoins and the regulars' (implemented with the profile). */
export interface PokerBank {
  /** The player's KardCoins away from the table. */
  balance(): number;
  /** The player buys more chips; returns how many, or null if she can't afford the minimum. */
  rebuy(): number | null;
  /** A regular who ran out buys more chips; returns how many, or null. */
  regularRebuy(id: string): number | null;
  /** A regular leaves the table (their chips go back to their balance). */
  regularLeaves(id: string): void;
  /** Another regular takes an empty seat: who, and their chips; null if nobody can. */
  seatRegular(exclude: readonly string[]): { character: CharacterDef; chips: number } | null;
  /** Save everyone's chips after a hand. */
  saveTable(you: number, regulars: Record<string, number>): void;
  /** The player leaves: everyone cashes out. Returns the result to show. */
  cashOut(session: casino.PokerSession): { net: number; cashed: number; balance: number };
}

export interface PokerTableOptions extends TableOptions {
  stakes: poker.Stakes;
  /** Chips for the player, then each opponent (seats 1–3, matching `opponents`). */
  chips: number[];
  bank: PokerBank;
}

type Choice = { kind: BetKind } | { discards: Card[] };

export class PokerTable extends TableBase {
  protected readonly rulesGame = 'five-card-draw' as const;
  private state: DrawState;
  private readonly ais: (poker.DrawAiPlayer | null)[] = [];
  private pl: pokerLayout.PokerLayout;
  private readonly sprites = new Map<Card, CardSprite>();
  private readonly stacks: ChipPile[] = [];
  private readonly bets: ChipPile[] = [];
  private pot!: ChipPile;
  private readonly chipLayer = h('div', 'chip-layer');
  private readonly dealerButton = h('div', 'dealer-button', 'D');
  private readonly tags: HTMLElement[] = [];
  private readonly showLabels: HTMLElement[] = [];
  private readonly actionBar = h('div', 'rummy-actions poker-actions');
  /** Cards the player chose to throw away. */
  private readonly selected = new Set<Card>();
  private drawing = false;
  private choose: ((c: Choice) => void) | null = null;
  /** The stacks are built at the start (D-095); until then they stay empty. */
  private stacksBuilt = false;
  /** The player asked to leave; she folds the rest of this hand and cashes out after it. */
  private leaving = false;
  private betweenWait: ((go: boolean) => void) | null = null;
  private readonly rows: { name: HTMLElement; chips: HTMLElement }[] = [];
  private readonly scoreInfo = h('div', 'score-info');
  private readonly session: { -readonly [K in keyof casino.PokerSession]: casino.PokerSession[K] };
  private readonly bank: PokerBank;
  private readonly seatRng: () => number;

  constructor(stage: ConstructorParameters<typeof TableBase>[0], private readonly opts: PokerTableOptions) {
    super(stage, opts);
    this.bank = opts.bank;
    this.pl = pokerLayout.pokerLayout(stage.vp);
    this.state = poker.createDrawGame({ seed: opts.seed, stakes: opts.stakes, chips: SEATS.map((s) => opts.chips[s] ?? null) });
    for (const s of SEATS) this.ais[s] = s === 0 && !opts.autoplay ? null : this.seatAi(s);
    this.session = { broughtIn: opts.chips[0]!, handsPlayed: 0, handsWon: 0, biggestPot: null, bestHand: null, regularIds: opts.opponents.map((c) => c.id) };
    let r = (opts.seed ^ 0x51e47) >>> 0;
    this.seatRng = () => ((r = (Math.imul(r ^ (r >>> 15), 2246822519) + 1) >>> 0) / 4294967296);
    this.init();
  }

  private seatAi(seat: number): poker.DrawAiPlayer | null {
    if (seat !== 0 && !this.seatsDef[seat]) return null;
    return poker.createDrawAi(this.aiProfile(seat), this.aiSeed(seat) + this.state.handNumber * 101);
  }

  // ------------------------------------------------------------------ TableBase hooks

  protected portraitSpot(seat: number): { point: layout.Point; bubbleSide: 'left' | 'right' } {
    const sl = this.lay.seats[seat as 0 | 1 | 2 | 3];
    return { point: sl.portrait, bubbleSide: sl.bubbleSide };
  }

  protected override buildTable(): void {
    this.root.classList.add('poker-table');
    this.root.insertBefore(this.chipLayer, this.cardLayer);
    for (const s of SEATS) {
      this.stacks[s] = new ChipPile(this.chipLayer, true, 'seat-stack', 'stack');
      this.bets[s] = new ChipPile(this.chipLayer, true, 'bet-pile');
      const tag = h('div', 'action-tag');
      tag.hidden = true;
      this.tags[s] = tag;
      const label = h('div', 'show-label');
      label.hidden = true;
      this.showLabels[s] = label;
      this.root.append(tag, label);
    }
    this.pot = new ChipPile(this.chipLayer, true, 'pot-pile');
    this.dealerButton.hidden = true;
    this.chipLayer.append(this.dealerButton);
    this.actionBar.hidden = true;
    this.root.append(this.actionBar);
    const tapEvent = () => (this.response().tapOn === 'press' ? 'pointerdown' : 'pointerup');
    for (const type of ['pointerdown', 'pointerup'] as const) {
      this.cardLayer.addEventListener(type, (e) => {
        if (type !== tapEvent() || (e.pointerType === 'mouse' && e.button !== 0)) return;
        const card = (e.target as HTMLElement).closest<HTMLElement>('.card')?.dataset['card'] as Card | undefined;
        if (card) this.cardTapped(card);
      });
    }
    this.syncChips();
  }

  protected relayoutTable(): void {
    this.pl = pokerLayout.pokerLayout(this.stage.vp);
    const L = this.pl;
    this.place(this.youPlate, L.you);
    this.place(this.actionBar, L.actionBar);
    for (const s of SEATS) {
      this.stacks[s]!.placeAt(L.stacks[s]!);
      this.bets[s]!.placeAt(L.bets[s]!);
      this.place(this.tags[s]!, this.tagSpot(s));
      const sh = L.show[s]!;
      this.place(this.showLabels[s]!, s === 0 ? { x: sh.x, y: L.actionBar.y + 70 } : { x: sh.x, y: sh.y + (layout.CARD_H * PL.showScale) / 2 + 26 });
    }
    this.pot.placeAt(L.pot);
    if (this.state.button >= 0) this.place(this.dealerButton, L.buttons[this.state.button]!);
    this.place(this.toast, { x: L.center.x, y: L.center.y + 115 });
    void this.syncCards(0);
  }

  private tagSpot(seat: number): layout.Point {
    if (seat === 0) return { x: this.pl.you.x, y: this.pl.you.y - 70 };
    // Under the seat's chips and their amount, with room for a second row of stacks.
    const st = this.pl.stacks[seat]!;
    return { x: st.x, y: st.y + 78 + PL.rowStep };
  }

  protected override settingsChanged(): void {
    const deck = this.prefs().cardDeck;
    for (const sp of this.sprites.values()) sp.setDeck(deck);
    void this.syncCards(this.response().resort);
  }

  protected override menuExits(): { label: string; onTap(): void }[] {
    return [{ label: 'Leave table', onTap: () => this.askToLeave() }];
  }

  protected buildScorePanel(): void {
    const st = this.opts.stakes;
    this.scorePanel.append(h('div', 'score-title', 'Five-Card Draw'), h('div', 'score-sub', `Ante ${st.ante} · Bets ${st.smallBet} / ${st.bigBet}`));
    const grid = h('div', 'score-grid poker-grid');
    grid.append(h('span', 'score-head', ''), h('span', 'score-head', 'Chips'));
    for (const s of SEATS) {
      const name = h('span', 'score-name', '');
      const chips = h('span', 'score-num total', '');
      grid.append(name, chips);
      this.rows[s] = { name, chips };
    }
    this.scorePanel.append(grid, this.scoreInfo);
  }

  protected updateScores(): void {
    const s = this.state;
    for (const seat of SEATS) {
      const here = seat === 0 || (s.present[seat] && this.seatsDef[seat]);
      this.rows[seat]!.name.textContent = here ? this.nameOf(seat) : 'Empty seat';
      this.rows[seat]!.name.classList.toggle('folded', s.inHand[seat]! && s.folded[seat]!);
      this.rows[seat]!.chips.textContent = here ? s.chips[seat]!.toLocaleString('en-US') : '—';
    }
    const pot = this.potShown();
    this.scoreInfo.textContent = s.handNumber === 0 ? '' : `Hand ${s.handNumber}${pot > 0 ? ` · Pot ${pot.toLocaleString('en-US')}` : ''}`;
  }

  protected override turnChanged(seat: number | null): void {
    for (const s of SEATS) this.rows[s]!.name.classList.toggle('turn', s === seat);
  }

  // ------------------------------------------------------------------ the game loop

  async run(): Promise<void> {
    try {
      await Promise.all([this.start(), preloadChipImages()]);
      await this.buildStacks([0, 1, 2, 3]);
      for (;;) {
        await this.playHand();
        if (!(await this.betweenHands())) break;
      }
      this.leaveTable();
    } catch (e) {
      if (!(e instanceof Cancelled)) throw e;
    }
  }

  private apply(action: poker.DrawAction): { prev: DrawState; events: DrawEvent[] } {
    const prev = this.state;
    const step = poker.applyDrawAction(this.state, action);
    this.state = step.state;
    return { prev, events: step.events };
  }

  private talk(events: readonly DrawEvent[]): void {
    const bluffing = new Set<number>();
    for (const s of SEATS) if (s !== 0 && this.ais[s]?.bluffing) bluffing.add(s);
    const computerSeats = SEATS.filter((s) => s !== 0 && this.seatsDef[s] && this.state.present[s]);
    this.say(dialogue.pokerCandidates(events, { computerSeats, bigBet: this.opts.stakes.bigBet, bluffing }));
  }

  private async playHand(): Promise<void> {
    for (const s of SEATS) if (s !== 0 || this.opts.autoplay) this.ais[s] = this.seatAi(s);
    const { prev, events } = this.apply({ type: 'deal' });
    this.session.handsPlayed += this.state.inHand[0] ? 1 : 0;
    await this.animate(events, prev);
    while (this.state.phase !== 'hand_over') {
      const seat = poker.actingSeat(this.state);
      if (seat === null) throw new Error('nobody to act');
      this.setTurn(seat);
      const human = seat === 0 && !this.opts.autoplay;
      let action: poker.DrawAction;
      if (this.state.phase === 'draw') {
        const discards = human ? await this.humanDraw() : (await this.think(), this.ais[seat]!.chooseDiscards(this.state, seat));
        action = { type: 'draw', seat, discards };
      } else {
        const kind = human ? await this.humanBet() : (await this.think(), this.ais[seat]!.chooseBet(this.state, seat));
        action = { type: kind, seat };
      }
      this.setTurn(null);
      this.setActions(null);
      const step = this.apply(action);
      await this.animate(step.events, step.prev);
    }
    this.recordHand();
  }

  /** The player's results this hand, for the session statistics. */
  private recordHand(): void {
    const r = this.state.lastHand;
    if (!r || !this.state.inHand[0]) return;
    const won = r.won[0]!;
    if (won > 0) {
      this.session.handsWon++;
      this.session.biggestPot = Math.max(this.session.biggestPot ?? 0, won);
    }
    const mine = r.shown?.find((x) => x.seat === 0);
    if (mine && (!this.session.bestHand || mine.value.score > this.session.bestHand.score)) {
      this.session.bestHand = { score: mine.value.score, name: poker.handName(mine.value) };
    }
  }

  // ------------------------------------------------------------------ the player's turns

  private humanBet(): Promise<BetKind> {
    const lb = poker.drawLegalBets(this.state, 0);
    if (this.leaving) return Promise.resolve(lb.kinds.includes('fold') ? 'fold' : 'check');
    const all = (n: number) => (n >= this.state.chips[0]! ? ' (all in)' : '');
    const buttons: { label: string; kind: BetKind; primary?: boolean }[] = [];
    if (lb.kinds.includes('fold')) buttons.push({ label: 'Fold', kind: 'fold', primary: false });
    if (lb.kinds.includes('check')) buttons.push({ label: 'Check', kind: 'check' });
    if (lb.kinds.includes('call')) buttons.push({ label: `Call ${lb.callAmount}${all(lb.callAmount)}`, kind: 'call' });
    if (lb.kinds.includes('bet')) buttons.push({ label: `Bet ${lb.raiseAmount}${all(lb.raiseAmount)}`, kind: 'bet' });
    if (lb.kinds.includes('raise')) buttons.push({ label: `Raise to ${this.state.round!.bets[0]! + lb.raiseAmount}${all(lb.raiseAmount)}`, kind: 'raise' });
    const hand = poker.handName(poker.evaluate5(this.state.hands[0]!));
    const prompt = lb.toCall > 0 ? `${hand} · ${lb.toCall} to call` : `${hand} · Your bet`;
    return this.waitForPlayer<Choice>((resolve) => {
      this.choose = resolve;
      this.setActions(
        prompt,
        buttons.map((b) => ({ label: b.label, enabled: true, primary: b.primary, onTap: () => this.pick({ kind: b.kind }) })),
      );
    }).then((c) => ('kind' in c ? c.kind : 'check'));
  }

  private humanDraw(): Promise<Card[]> {
    if (this.leaving) return Promise.resolve([]);
    this.selected.clear();
    this.drawing = true;
    return this.waitForPlayer<Choice>((resolve) => {
      this.choose = resolve;
      this.drawActions();
    })
      .then((c) => ('discards' in c ? c.discards : []))
      .finally(() => {
        this.drawing = false;
      });
  }

  private drawActions(): void {
    const n = this.selected.size;
    const hand = poker.handName(poker.evaluate5(this.state.hands[0]!));
    this.setActions(n === 0 ? `${hand} · Tap the cards to throw away` : `${hand} · Throw away ${n} card${n > 1 ? 's' : ''}`, [
      { label: n === 0 ? 'Draw' : `Draw ${n}`, enabled: n > 0, onTap: () => this.pick({ discards: [...this.selected] }) },
      { label: 'Stand pat', enabled: true, primary: false, onTap: () => this.pick({ discards: [] }) },
    ]);
  }

  private cardTapped(card: Card): void {
    if (!this.drawing || !this.choose || !this.state.hands[0]!.includes(card)) return;
    if (this.selected.has(card)) this.selected.delete(card);
    else this.selected.add(card);
    audio.play('card.select');
    this.drawActions();
    void this.syncCards(this.response().passToggle);
  }

  private pick(c: Choice): void {
    const f = this.choose;
    this.choose = null;
    f?.(c);
  }

  private setActions(prompt: string | null, buttons: readonly { label: string; enabled: boolean; primary?: boolean; onTap(): void }[] = []): void {
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

  // ------------------------------------------------------------------ cards

  /** The player's cards in display order: by rank (Card order decides the direction), then suit. */
  private playerOrder(): Card[] {
    const dir = this.prefs().cardOrder === 'low-right' ? -1 : 1;
    return [...this.state.hands[0]!].sort((a, b) => dir * (rankOf(a) - rankOf(b)) || DISPLAY_SUIT_ORDER.indexOf(suitOf(a)) - DISPLAY_SUIT_ORDER.indexOf(suitOf(b)));
  }

  /** Where a seat's cards belong now: the player's along the bottom, opponents' as face-down fans. */
  private handSpot(seat: number, i: number, count: number, card: Card): layout.Placement {
    if (seat === 0) return pokerLayout.playerCardPlacement(this.pl, i, count, this.selected.has(card));
    return layout.handPlacement(this.lay, seat as 1 | 2 | 3, i, count);
  }

  private syncCards(duration: number): Promise<unknown> {
    const moves: Promise<void>[] = [];
    const s = this.state;
    const shown = s.phase === 'hand_over' ? s.lastHand?.shown : null;
    for (const seat of SEATS) {
      if (!s.inHand[seat] || s.folded[seat]) continue;
      const shownHand = seat !== 0 ? shown?.find((x) => x.seat === seat) : undefined;
      const cards = seat === 0 ? this.playerOrder() : s.hands[seat]!;
      cards.forEach((c, i) => {
        const sp = this.sprites.get(c);
        if (!sp) return;
        sp.setZ(10 + seat * 10 + i);
        const to = shownHand ? pokerLayout.shownCardPlacement(this.pl, seat, i, cards.length) : this.handSpot(seat, i, cards.length, c);
        moves.push(sp.moveTo(to, { duration: this.ms(duration) }));
      });
    }
    return Promise.all(moves);
  }

  private sprite(card: Card, at: layout.Point): CardSprite {
    let sp = this.sprites.get(card);
    if (!sp) {
      sp = new CardSprite(card, this.cardLayer, { ...at, rot: 0, scale: 0.6 }, this.prefs().cardDeck);
      this.sprites.set(card, sp);
    }
    return sp;
  }

  /** Cards fly to the middle and vanish (a fold, or discards). */
  private async muck(cards: readonly Card[], duration: number): Promise<void> {
    await Promise.all(
      cards.map((c) => this.sprites.get(c)?.moveTo({ ...this.pl.deck, rot: 0, scale: 0.4 }, { duration: this.ms(duration), opacity: 0, easing: 'ease-in' })),
    );
    for (const c of cards) {
      this.sprites.get(c)?.remove();
      this.sprites.delete(c);
    }
  }

  // ------------------------------------------------------------------ chips

  /** The pot as drawn: everything put in this hand except the current round's bets. */
  private potShown(): number {
    const s = this.state;
    const committed = s.committed.reduce((a, b) => a + b, 0);
    const bets = s.round ? s.round.bets.reduce((a, b) => a + b, 0) : 0;
    return committed - bets;
  }

  /** Build seats' stacks chip by chip, one seat after another (D-095). */
  private async buildStacks(seats: readonly number[]): Promise<void> {
    const s = this.state;
    const stagger = this.ms(this.paced(PL.buildStagger));
    const drop = this.ms(this.paced(PL.buildDrop));
    const builds = seats
      .filter((seat) => s.present[seat] && (seat === 0 || this.seatsDef[seat]) && s.chips[seat]! > 0)
      .map((seat, i) => {
        const pile = this.stacks[seat]!;
        pile.el.hidden = false;
        pile.set(0);
        return new Promise<void>((resolve) => {
          this.later(this.paced(PL.buildSeatGap) * i, () => {
            void pile.buildUp(s.chips[seat]!, stagger, drop, (at) => this.later(at * this.speed, () => audio.play('chips.stack'))).then(resolve);
          });
        });
      });
    this.stacksBuilt = true;
    await Promise.all(builds);
    this.guard();
  }

  /** Draw every chip pile from the engine state. */
  private syncChips(): void {
    const s = this.state;
    for (const seat of SEATS) {
      const here = s.present[seat]! && (seat === 0 || !!this.seatsDef[seat]);
      this.stacks[seat]!.el.hidden = !here;
      if (!this.stacksBuilt) continue;
      this.stacks[seat]!.set(here ? s.chips[seat]! : 0);
      this.bets[seat]!.set(s.round ? s.round.bets[seat]! : 0);
    }
    this.pot.set(this.potShown());
    this.updateScores();
  }

  private setTag(seat: number, text: string | null, kind = ''): void {
    const tag = this.tags[seat]!;
    tag.hidden = text === null;
    tag.className = `action-tag${kind ? ` ${kind}` : ''}`;
    if (text !== null) tag.textContent = text;
  }

  // ------------------------------------------------------------------ animating a batch of events

  private async animate(events: readonly DrawEvent[], prev: DrawState): Promise<void> {
    const s = this.state;
    const L = this.pl;
    const antes: Promise<void>[] = [];
    for (const e of events) {
      switch (e.type) {
        case 'hand_started':
          for (const sp of this.sprites.values()) sp.remove();
          this.sprites.clear();
          this.selected.clear();
          for (const seat of SEATS) {
            this.setTag(seat, null);
            this.showLabels[seat]!.hidden = true;
          }
          this.showMessage(null);
          this.dealerButton.hidden = false;
          this.place(this.dealerButton, L.buttons[e.button]!);
          break;
        case 'ante':
          this.stacks[e.seat]!.set(this.stacks[e.seat]!.value - e.amount);
          antes.push(flyChips(this.chipLayer, e.amount, L.stacks[e.seat]!, L.pot, this.ms(PT.chipFlight)).then(() => this.pot.set(this.pot.value + e.amount)));
          break;
        case 'dealt':
          audio.play('chips.bet');
          await Promise.all(antes);
          this.guard();
          await this.dealCards();
          break;
        case 'bet_action':
          await this.showBet(e);
          break;
        case 'bet_returned':
          await flyChips(this.chipLayer, e.amount, L.bets[e.seat]!, L.stacks[e.seat]!, this.ms(PT.chipFlight));
          break;
        case 'round_over': {
          const moving = SEATS.filter((x) => this.bets[x]!.value > 0);
          const amounts = moving.map((x) => this.bets[x]!.value);
          for (const x of moving) this.bets[x]!.set(0);
          if (moving.length) audio.play('chips.collect');
          await Promise.all(moving.map((x, i) => flyChips(this.chipLayer, amounts[i]!, L.bets[x]!, L.pot, this.ms(PT.collect))));
          this.pot.set(this.potShown());
          for (const x of SEATS) if (s.inHand[x] && !s.folded[x] && !s.chips[x]) this.setTag(x, 'All in', 'allin');
          else if (s.inHand[x] && !s.folded[x]) this.setTag(x, null);
          break;
        }
        case 'drew':
          await this.showDraw(e.seat, e.count, prev);
          break;
        case 'showdown':
          await this.showHands(e.hands);
          break;
        case 'pot_won':
          await this.payPot(e);
          break;
        case 'busted':
          this.setTag(e.seat, 'Out of chips', 'out');
          break;
        default:
          break;
      }
      this.guard();
    }
    this.talk(events);
    this.syncChips();
  }

  private async dealCards(): Promise<void> {
    const s = this.state;
    audio.play('card.shuffle');
    await this.sleep(audio.hasCue('card.shuffle') ? 900 : 0);
    const order = [1, 2, 3, 4].map((k) => (s.button + k) % 4).filter((x) => s.inHand[x]);
    const moves: Promise<void>[] = [];
    const playerCards = this.playerOrder();
    let k = 0;
    for (let i = 0; i < poker.DRAW_HAND_SIZE; i++) {
      for (const seat of order) {
        const card = s.hands[seat]![i]!;
        const sp = this.sprite(card, this.pl.deck);
        const idx = seat === 0 ? playerCards.indexOf(card) : i;
        sp.setZ(10 + seat * 10 + idx);
        this.later(k * PT.dealStagger, () => audio.play('card.deal'));
        moves.push(sp.moveTo(this.handSpot(seat, idx, poker.DRAW_HAND_SIZE, card), { duration: this.ms(T.dealFlight), delay: this.ms(k++ * PT.dealStagger) }));
      }
    }
    await Promise.all(moves);
    this.guard();
    if (s.inHand[0]) for (const c of s.hands[0]!) this.sprites.get(c)!.setFaceUp(true);
    await this.sleep(200);
  }

  private async showBet(e: Extract<DrawEvent, { type: 'bet_action' }>): Promise<void> {
    const L = this.pl;
    const name = e.seat === 0 ? 'You' : this.nameOf(e.seat);
    const allIn = e.allIn ? ' (all in)' : '';
    const text: Record<BetKind, string> = {
      fold: 'Fold',
      check: 'Check',
      call: `Call ${e.amount}${allIn}`,
      bet: `Bet ${e.amount}${allIn}`,
      raise: `Raise to ${this.state.round?.bets[e.seat] ?? e.amount}${allIn}`,
    };
    this.setTag(e.seat, text[e.kind], e.kind === 'fold' ? 'fold' : e.kind === 'raise' || e.kind === 'bet' ? 'aggressive' : '');
    if (e.kind === 'fold') {
      if (e.seat !== 0) this.showToast(`${name} folds`, 1200);
      await this.muck(this.state.hands[e.seat]!, PT.foldFlight);
      return;
    }
    if (e.amount > 0) {
      audio.play(e.kind === 'raise' ? 'chips.raise' : 'chips.bet');
      this.stacks[e.seat]!.set(this.stacks[e.seat]!.value - e.amount);
      await flyChips(this.chipLayer, e.amount, L.stacks[e.seat]!, L.bets[e.seat]!, this.ms(PT.chipFlight));
      this.bets[e.seat]!.set(this.bets[e.seat]!.value + e.amount);
    } else await this.sleep(150);
  }

  private async showDraw(seat: number, count: number, prev: DrawState): Promise<void> {
    const before = prev.hands[seat]!;
    const after = this.state.hands[seat]!;
    const gone = before.filter((c) => !after.includes(c));
    const fresh = after.filter((c) => !before.includes(c));
    this.setTag(seat, count === 0 ? 'Stands pat' : `Draws ${count}`, count === 0 ? 'pat' : '');
    if (count === 0) {
      if (seat !== 0) this.showToast(`${this.nameOf(seat)} stands pat`, 1200);
      await this.sleep(300);
      return;
    }
    this.selected.clear();
    await this.muck(gone, PT.drawFlight);
    this.guard();
    for (const c of fresh) {
      const sp = this.sprite(c, this.pl.deck);
      if (seat === 0) sp.setFaceUp(true);
    }
    fresh.forEach((_, i) => this.later(i * PT.dealStagger, () => audio.play('card.deal')));
    await this.syncCards(PT.drawFlight);
  }

  private async showHands(hands: readonly { seat: number; cards: Card[]; value: poker.HandValue }[]): Promise<void> {
    for (const hd of hands) {
      if (hd.seat !== 0) for (const c of hd.cards) this.sprites.get(c)?.setFaceUp(true);
      const label = this.showLabels[hd.seat]!;
      label.textContent = poker.handName(hd.value);
      label.hidden = false;
    }
    audio.play('card.place');
    await this.syncCards(PT.showFlight);
    await this.sleep(this.paced(PT.showPause));
  }

  private async payPot(e: Extract<DrawEvent, { type: 'pot_won' }>): Promise<void> {
    const L = this.pl;
    const names = e.winners.map((w) => (w === 0 ? 'You' : this.nameOf(w)));
    const who = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
    const verb = names.length === 1 && e.winners[0] === 0 ? 'win' : names.length > 1 ? 'split' : 'wins';
    const side = e.potIndex > 0 ? ' side pot' : '';
    this.showMessage(`${who} ${verb}${side ? ` the${side} of` : ''} ${e.amount.toLocaleString('en-US')}${e.handName ? ` with ${e.handName}` : ''}`);
    for (const w of e.winners) this.showLabels[w]?.classList.add('winner');
    this.pot.set(Math.max(0, this.pot.value - e.amount));
    audio.play('chips.win');
    await Promise.all(e.shares.map(([seat, amt]) => flyChips(this.chipLayer, amt, L.pot, L.stacks[seat]!, this.ms(PT.potToWinner)).then(() => this.stacks[seat]!.set(this.stacks[seat]!.value + amt))));
    await this.sleep(this.paced(PT.afterPot));
  }

  // ------------------------------------------------------------------ between hands

  /** Regulars come and go, the player may buy more chips, then Next hand or Leave. Returns false to leave. */
  private async betweenHands(): Promise<boolean> {
    for (const s of SEATS) this.showLabels[s]!.classList.remove('winner');
    await this.reseat();
    this.saveTable();
    if (this.state.chips[0] === 0 && !(await this.outOfChips())) return false;
    if (this.leaving) return false;
    if (poker.dealableSeats(this.state).length < 2) {
      this.showMessage('Everyone else has left the table');
      await this.dialogWithButton(h('div', 'dialog', ''), 'Leave the table');
      return false;
    }
    if (this.opts.autoplay) {
      await this.sleep(PT.demoNextHand);
      return true;
    }
    const go = await this.waitForPlayer<boolean>((resolve) => {
      this.betweenWait = resolve;
      this.setActions('Ready for the next hand?', [
        { label: 'Next hand', enabled: true, onTap: () => resolve(true) },
        { label: 'Leave table', enabled: true, primary: false, onTap: () => resolve(false) },
      ]);
    });
    this.betweenWait = null;
    this.setActions(null);
    return go;
  }

  /** Busted regulars buy more chips (chance = risk) or leave; another regular may take an empty seat. */
  private async reseat(): Promise<void> {
    for (const seat of [1, 2, 3]) {
      const c = this.seatsDef[seat];
      if (!c || !this.state.present[seat] || this.state.chips[seat]! > 0) continue;
      const more = this.seatRng() < c.traits.risk ? this.bank.regularRebuy(c.id) : null;
      if (more) {
        this.state = poker.applyDrawAction(this.state, { type: 'sit', seat, chips: more }).state;
        this.setTag(seat, null);
        this.showToast(`${c.nickname} buys more chips`, 1600);
        await this.buildStacks([seat]);
        continue;
      }
      this.bank.regularLeaves(c.id);
      this.state = poker.applyDrawAction(this.state, { type: 'leave', seat }).state;
      this.setTag(seat, null);
      this.setSeatCharacter(seat, null);
      this.ais[seat] = null;
      this.showToast(`${c.nickname} leaves the table`, 1600);
      this.syncChips();
      await this.sleep(900);
      const here = [1, 2, 3].flatMap((x) => (this.seatsDef[x] ? [this.seatsDef[x]!.id] : []));
      const next = this.bank.seatRegular([...here, c.id]);
      if (next) {
        this.setSeatCharacter(seat, next.character);
        const step = this.apply({ type: 'sit', seat, chips: next.chips });
        this.ais[seat] = this.seatAi(seat);
        if (!this.session.regularIds.includes(next.character.id)) this.session.regularIds = [...this.session.regularIds, next.character.id];
        void audio.preloadVoices([next.character.id]);
        this.showToast(`${next.character.nickname} sits down`, 1600);
        this.talk(step.events);
        await this.buildStacks([seat]);
        this.syncChips();
        await this.sleep(400);
      }
    }
    this.syncChips();
  }

  private saveTable(): void {
    const regulars: Record<string, number> = {};
    for (const seat of [1, 2, 3]) {
      const c = this.seatsDef[seat];
      if (c && this.state.present[seat]) regulars[c.id] = this.state.chips[seat]!;
    }
    this.bank.saveTable(this.state.chips[0]!, regulars);
  }

  /** The player is out of chips: buy more, or leave. Returns true to keep playing. */
  private async outOfChips(): Promise<boolean> {
    if (this.opts.autoplay) return false;
    const st = this.opts.stakes;
    const can = this.bank.balance() >= st.minBuyIn;
    const amount = Math.min(this.bank.balance(), st.buyIn);
    const panel = h('div', 'dialog');
    panel.append(
      h('h2', '', "You're out of chips"),
      h('p', 'dialog-text', can ? `Buy ${amount.toLocaleString('en-US')} more chips from your ${this.bank.balance().toLocaleString('en-US')} KardCoins?` : `You need at least ${st.minBuyIn} KardCoins to buy more chips. Win some in the other games and come back!`),
    );
    const row = h('div', 'dialog-buttons');
    const leave = h('button', 'big-button secondary', 'Leave table');
    const buy = h('button', 'big-button', `Buy ${amount.toLocaleString('en-US')} chips`);
    buy.disabled = !can;
    row.append(leave, buy);
    panel.append(row);
    this.showOverlay(panel);
    const yes = await this.waitForPlayer<boolean>((resolve) => {
      onTap(leave, () => resolve(false));
      onTap(buy, () => {
        if (!buy.disabled) resolve(true);
      });
    });
    this.closeOverlay();
    if (!yes) return false;
    const chips = this.bank.rebuy();
    if (!chips) return false;
    this.session.broughtIn += chips;
    this.state = poker.applyDrawAction(this.state, { type: 'sit', seat: 0, chips }).state;
    this.setTag(0, null);
    await this.buildStacks([0]);
    this.syncChips();
    this.saveTable();
    return true;
  }

  /** ☰ → Leave table: between hands at once; during a hand, after it (folding the rest). */
  private askToLeave(): void {
    this.resumeFromMenu();
    if (this.betweenWait) {
      this.betweenWait(false);
      return;
    }
    this.leaving = true;
    this.showToast("You'll leave after this hand", 2200);
    // If it's the player's turn right now, answer for her.
    if (this.choose) {
      const lb = poker.drawLegalBets(this.state, 0);
      this.pick(this.drawing ? { discards: [] } : { kind: lb.kinds.includes('fold') ? 'fold' : 'check' });
    }
  }

  /** Cash out and show what the player takes home. */
  private leaveTable(): void {
    this.setActions(null);
    this.saveTable();
    const r = this.bank.cashOut(this.session);
    const won = r.net >= 0;
    audio.play(won ? 'game.win' : 'game.lose');
    const panel = h('div', 'dialog');
    panel.append(h('h2', '', won ? (r.net > 0 ? 'Nice session!' : 'Breaking even') : 'Better luck next time'));
    const box = h('div', 'award');
    const top = h('div', 'award-top');
    const amount = h('span', `award-amount${won ? '' : ' minus'}`, won ? '+0' : '−0');
    top.append(h('span', 'coin-icon large', 'K'), amount, h('span', 'coin-label', 'KardCoins'));
    const hands = this.session.handsPlayed;
    const detail = [
      `Sat down with ${this.session.broughtIn.toLocaleString('en-US')}, left with ${r.cashed.toLocaleString('en-US')}`,
      `${hands} hand${hands === 1 ? '' : 's'}, won ${this.session.handsWon}`,
      ...(this.session.bestHand ? [`best hand: ${this.session.bestHand.name}`] : []),
    ].join(' · ');
    box.append(top, h('div', 'award-detail', detail), h('div', 'award-balance', `Balance: ${r.balance.toLocaleString('en-US')} KardCoins`));
    panel.append(box);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      const v = Math.round(Math.abs(r.net) * (1 - (1 - t) ** 3)).toLocaleString('en-US');
      amount.textContent = won ? `+${v}` : `−${v}`;
      if (t < 1 && this.alive) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    if (r.net !== 0) audio.play('chips.win');
    const row = h('div', 'dialog-buttons');
    const again = h('button', 'big-button', 'Play again');
    const menu = h('button', 'big-button secondary', 'Main menu');
    onTap(again, () => this.base.onExit('again'));
    onTap(menu, () => this.base.onExit('menu'));
    row.append(again, menu);
    panel.append(row);
    this.showOverlay(panel);
  }
}

export type { CharacterDef };

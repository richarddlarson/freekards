/**
 * The Rummy 500 table (spec 18 §4): the spread discard pile, both players' meld rows, melding and
 * laying off, hand results, and game over, on top of the shared rummy table.
 */
import { dialogue, rummy, rummy500, rummyLayout, type Card } from '../../logic/index.js';
import { h } from '../stage.js';
import { audio } from '../audio.js';
import { Cancelled, DIFFICULTY_NAMES, T, type TableOptions } from './table-base.js';
import { RummyTable, type CardSpot } from './rummy-table.js';
import { cardName, type TwoPlayerAward } from './gin-table.js';

export interface Rummy500TableOptions extends TableOptions {
  onGameFinished?(result: Rummy500GameResult): TwoPlayerAward | null;
}

/** What the table reports about the player's game (spec 15 §2). */
export interface Rummy500GameResult {
  won: boolean;
  finalScore: number;
  handsPlayed: number;
  wentOut: number;
  bestHand: number | null;
}

type Choice =
  | { type: 'draw_stock' }
  | { type: 'take_discard'; index: number }
  | { type: 'meld'; cards: Card[] }
  | { type: 'lay_off'; plays: { card: Card; meld: number }[] }
  | { type: 'discard'; card: Card };

export class Rummy500Table extends RummyTable {
  private state: rummy500.Rummy500State;
  private readonly ais: (rummy500.Rummy500AiPlayer | null)[];
  private choose: ((c: Choice) => void) | null = null;
  /** Draw phase: the discard-pile index the player has chosen to take from (below the top). */
  private pileChoice: number | null = null;
  /** At the end of a hand, the computer's cards are shown face up. */
  private reveal = false;
  private readonly rows: { name: HTMLElement; table: HTMLElement; score: HTMLElement }[] = [];
  private readonly scoreInfo = h('div', 'score-info');
  private readonly stats = { wentOut: 0, bestHand: null as number | null };

  constructor(stage: ConstructorParameters<typeof RummyTable>[0], private readonly opts: Rummy500TableOptions) {
    super(stage, opts, 'rummy500');
    this.state = rummy500.createRummy500Game({ seed: opts.seed });
    this.ais = [
      opts.autoplay ? rummy500.createRummy500Ai(this.aiProfile(0), this.aiSeed(0)) : null,
      rummy500.createRummy500Ai(this.aiProfile(1), this.aiSeed(1)),
    ];
    this.init();
  }

  async run(): Promise<void> {
    try {
      await this.start();
      for (;;) {
        await this.deal();
        while (this.state.phase === 'draw' || this.state.phase === 'play') await this.turn();
        await this.handOver();
        this.apply({ type: 'continue' });
        if (this.state.phase === 'game_over') {
          this.gameOver();
          return;
        }
      }
    } catch (e) {
      if (!(e instanceof Cancelled)) throw e;
    }
  }

  private apply(action: rummy500.Rummy500Action): rummy500.Rummy500Event[] {
    const step = rummy500.applyRummy500Action(this.state, action);
    this.state = step.state;
    this.ais.forEach((ai, p) => ai?.observe(step.events, p as rummy500.Player));
    this.say(dialogue.rummy500Candidates(step.events));
    this.updateScores();
    return step.events;
  }

  // ------------------------------------------------------------------ hooks

  protected hand(player: 0 | 1): Card[] {
    return this.state.hands[player];
  }

  protected arrangement(hand: readonly Card[]) {
    return rummy.bestArrangement(hand, rummy500.rummy500Value, 'both');
  }

  protected layoutCards(): Map<Card, CardSpot> {
    const s = this.state;
    const out = new Map<Card, CardSpot>();
    this.stockSpots(out, s.stock);
    s.discard.forEach((c, i) => {
      const p = rummyLayout.spreadPlacement(this.rl, i, s.discard.length);
      const chosen = this.pileChoice !== null && i >= this.pileChoice;
      out.set(c, { p: chosen ? { ...p, y: p.y - 26 } : p, up: true, z: 100 + i });
    });
    this.meldRowSpots(out, s.melds.filter((m) => m.owner === 1).map((m) => m.cards), 'opponent');
    this.meldRowSpots(out, s.melds.filter((m) => m.owner === 0).map((m) => m.cards), 'player');
    if (this.reveal) {
      // The computer's leftover cards, face up in a small fan at the top.
      s.hands[1].forEach((c, i) => {
        const p = rummyLayout.opponentHandPlacement(this.rl, i, s.hands[1].length);
        out.set(c, { p: { ...p, rot: 0, scale: 0.55, x: this.rl.center.x + (i - (s.hands[1].length - 1) / 2) * 44 }, up: true, z: 300 + i });
      });
    } else this.opponentHandSpots(out, s.hands[1]);
    this.playerHandSpots(out, this.handGroups(s.hands[0]));
    for (const [c, sp] of this.sprites) sp.el.classList.toggle('must-use', c === s.mustUse);
    return out;
  }

  protected cardTapped(card: Card): void {
    const s = this.state;
    if (!this.choose) return;
    if (s.phase === 'draw') {
      if (s.stock.includes(card)) return this.pick({ type: 'draw_stock' });
      const i = s.discard.indexOf(card);
      if (i < 0) return;
      if (i === s.discard.length - 1) return this.pick({ type: 'take_discard', index: i });
      if (!rummy500.takeableIndexes(s, 0).includes(i)) {
        this.sprites.get(card)?.shake();
        this.showToast(`You can take the ${cardName(card)} only if you can meld it right away`, 2400);
        return;
      }
      this.pileChoice = this.pileChoice === i ? null : i;
      audio.play('card.select');
      this.drawActions();
      void this.sync(this.response().passToggle);
      return;
    }
    if (s.phase === 'play' && s.hands[0].includes(card)) {
      if (this.lifted.has(card)) this.lifted.delete(card);
      else this.lifted.add(card);
      audio.play('card.select');
      this.playActions();
      void this.sync(this.response().passToggle);
      return;
    }
    this.sprites.get(card)?.shake();
  }

  protected override canDragToDiscard(card: Card): boolean {
    return this.choose !== null && rummy500.legalDiscards(this.state, 0).includes(card);
  }

  protected override droppedOnDiscard(card: Card): void {
    this.pick({ type: 'discard', card });
  }

  private pick(c: Choice): void {
    const f = this.choose;
    this.choose = null;
    f?.(c);
  }

  protected buildScorePanel(): void {
    this.scorePanel.append(h('div', 'score-title', `Rummy 500 · to ${this.state.targetScore}`));
    const grid = h('div', 'score-grid');
    grid.append(h('span', 'score-head', ''), h('span', 'score-head', 'On table'), h('span', 'score-head', 'Score'));
    for (const p of [0, 1]) {
      const name = h('span', 'score-name', this.nameOf(p));
      const table = h('span', 'score-num', '0');
      const score = h('span', 'score-num total', '0');
      grid.append(name, table, score);
      this.rows[p] = { name, table, score };
    }
    this.scorePanel.append(grid, this.scoreInfo);
  }

  protected updateScores(): void {
    const s = this.state;
    for (const p of [0, 1] as const) {
      this.rows[p]!.table.textContent = String(rummy.valueOf(s.played[p], rummy500.rummy500Value));
      this.rows[p]!.score.textContent = String(s.scores[p]);
    }
    this.scoreInfo.textContent = s.handNumber === 0 ? '' : `Hand ${s.handNumber} · Stock ${s.stock.length}`;
  }

  protected override turnChanged(seat: number | null): void {
    for (const p of [0, 1]) this.rows[p]!.name.classList.toggle('turn', p === seat);
  }

  // ------------------------------------------------------------------ phases

  private async deal(): Promise<void> {
    this.reveal = false;
    this.apply({ type: 'deal' });
    const s = this.state;
    this.resetSprites([...s.hands[0], ...s.hands[1], ...s.discard, ...s.stock]);
    const first = (1 - s.dealer) as rummy500.Player;
    const order: Card[] = [];
    for (let i = 0; i < rummy500.RUMMY500_HAND_SIZE; i++) order.push(s.hands[first][i]!, s.hands[s.dealer][i]!);
    await this.dealAnimation(order);
  }

  /** One action of the current player: a draw, a meld or lay-off, or the discard. */
  private async turn(): Promise<void> {
    const p = this.state.turn;
    this.setTurn(p);
    const human = p === 0 && !this.opts.autoplay;
    const choice = human ? await this.humanChoice() : await this.aiChoice(p);
    this.setActions(null);
    this.pileChoice = null;
    this.lifted.clear();
    const events: rummy500.Rummy500Event[] = [];
    if (choice.type === 'lay_off') {
      for (const l of choice.plays) events.push(...this.apply({ type: 'lay_off', player: p, card: l.card, meld: l.meld }));
    } else {
      events.push(...this.apply(choice.type === 'take_discard' ? { type: 'take_discard', player: p, index: choice.index } : choice.type === 'draw_stock' ? { type: 'draw_stock', player: p } : { ...choice, player: p }));
    }
    if (this.state.phase !== 'draw' && this.state.phase !== 'play') this.setTurn(null);
    for (const e of events) {
      if (e.type === 'drew_stock' || e.type === 'took_discard') audio.play('card.deal');
      if (e.type === 'melded' || e.type === 'laid_off' || e.type === 'discarded') audio.play('card.place');
      if (e.type === 'took_discard' && e.cards.length > 1) this.showToast(`${e.player === 0 ? 'You take' : `${this.nameOf(1)} takes`} ${e.cards.length} cards`);
    }
    await this.sync(human ? this.response().playFlight : T.playFlight + 120, { stagger: 20 });
  }

  private async aiChoice(p: rummy500.Player): Promise<Choice> {
    const ai = this.ais[p]!;
    const s = this.state;
    if (s.phase === 'draw') {
      await this.think();
      const d = ai.chooseDraw(s, p);
      return d.source === 'stock' ? { type: 'draw_stock' } : { type: 'take_discard', index: d.index };
    }
    await this.sleep(this.paced(T.aiThinkMin));
    const a = ai.nextPlay(s, p);
    if (a?.type === 'meld') return { type: 'meld', cards: a.cards };
    if (a?.type === 'lay_off') return { type: 'lay_off', plays: [{ card: a.card, meld: a.meld }] };
    return { type: 'discard', card: ai.chooseDiscard(s, p) };
  }

  private humanChoice(): Promise<Choice> {
    if (this.state.phase === 'draw') this.drawActions();
    else this.playActions();
    return this.waitForPlayer<Choice>((resolve) => (this.choose = resolve));
  }

  private drawActions(): void {
    const s = this.state;
    if (this.pileChoice === null) {
      this.setActions('Draw from the stock, or take cards from the discard pile');
      return;
    }
    const n = s.discard.length - this.pileChoice;
    this.setActions(`Take the ${cardName(s.discard[this.pileChoice]!)} and the ${n - 1} card${n > 2 ? 's' : ''} above it? You must meld it right away.`, [
      { label: `Take ${n} cards`, enabled: true, onTap: () => this.pick({ type: 'take_discard', index: this.pileChoice! }) },
      { label: 'Cancel', enabled: true, primary: false, onTap: () => {
        this.pileChoice = null;
        this.drawActions();
        void this.sync(this.response().passToggle);
      } },
    ]);
  }

  /** The play-phase prompt and buttons for the cards selected (spec 18 §4.5). */
  private playActions(): void {
    const s = this.state;
    const sel = [...this.lifted];
    const must = s.mustUse;
    const meld = sel.length >= 3 ? rummy.asMeld(sel, 'both') : null;
    const canMeld = meld !== null && (!must || sel.includes(must));
    const lay = this.layOffPlan(sel);
    const canLay = lay !== null;
    const legal = rummy500.legalDiscards(s, 0);
    const canDiscard = sel.length === 1 && legal.includes(sel[0]!);
    let prompt: string;
    if (must) prompt = `Meld or lay off the ${cardName(must)} you picked up`;
    else if (sel.length === 0) prompt = 'Select cards to meld or lay off, or one card to discard';
    else if (sel.length === 1 && sel[0] === s.takenTop && s.hands[0].length > 1) prompt = "You can't discard the card you just picked up";
    else prompt = `${sel.length} card${sel.length > 1 ? 's' : ''} selected`;
    this.setActions(prompt, [
      { label: 'Meld', enabled: canMeld, onTap: () => this.pick({ type: 'meld', cards: sel }) },
      { label: 'Lay off', enabled: canLay, onTap: () => lay && this.pick({ type: 'lay_off', plays: lay }) },
      { label: canDiscard ? `Discard ${cardName(sel[0]!)}` : 'Discard', enabled: canDiscard, onTap: () => this.pick({ type: 'discard', card: sel[0]! }) },
    ]);
  }

  /**
   * Lay-offs for every selected card, in an order the engine accepts (a required card goes first,
   * then run extensions that make room for others), or null if some selected card doesn't fit.
   */
  private layOffPlan(sel: readonly Card[]): { card: Card; meld: number }[] | null {
    const s = this.state;
    if (sel.length === 0) return null;
    const must = s.mustUse;
    if (must) {
      if (!sel.includes(must)) return null;
      const first = s.melds.findIndex((m) => rummy.canLayOff(must, m, 'both'));
      if (first < 0) return null;
      const melds = s.melds.map((m, i) => (i === first ? rummy.layOff(m, must, 'both') : m));
      const rest = rummy.layOffAll(sel.filter((c) => c !== must), melds, 'both');
      return rest.rest.length === 0 ? [{ card: must, meld: first }, ...rest.layoffs] : null;
    }
    const all = rummy.layOffAll(sel, s.melds, 'both');
    return all.rest.length === 0 ? all.layoffs : null;
  }

  // ------------------------------------------------------------------ results

  private async handOver(): Promise<void> {
    const r = this.state.lastHand!;
    if (r.outPlayer === 0) this.stats.wentOut++;
    this.stats.bestHand = this.stats.bestHand === null ? r.total[0] : Math.max(this.stats.bestHand, r.total[0]);
    this.showToast(r.endedBy === 'stock' ? 'The stock is empty' : r.outPlayer === 0 ? 'You went out!' : `${this.nameOf(1)} went out!`, 2200);
    this.reveal = true;
    await this.sync(420);
    await this.sleep(this.paced(1600));
    const panel = h('div', 'dialog');
    panel.append(h('h2', '', `Hand ${this.state.handNumber} results`));
    const grid = h('div', 'results-grid rummy');
    grid.style.gridTemplateColumns = '1fr repeat(4, auto)';
    grid.append(h('span', 'results-head', 'Player'), h('span', 'results-head', 'Melded'), h('span', 'results-head', 'In hand'), h('span', 'results-head', 'This hand'), h('span', 'results-head', 'Total'));
    const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
    for (const p of [0, 1] as rummy500.Player[]) {
      grid.append(
        h('span', 'results-name', this.nameOf(p)),
        h('span', 'results-num', String(r.melded[p])),
        h('span', 'results-num', r.inHand[p] ? `−${r.inHand[p]}` : '0'),
        h('span', 'results-num', signed(r.total[p])),
        h('span', 'results-num total', String(this.state.scores[p])),
      );
    }
    panel.append(grid);
    const over = rummy500.rummy500Winner(this.state.scores, this.state.targetScore) !== null;
    await this.dialogWithButton(panel, over ? 'Final results' : 'Next hand');
  }

  private gameOver(): void {
    const s = this.state;
    const won = s.winner === 0;
    const award = this.opts.onGameFinished?.({ won, finalScore: s.scores[0], handsPlayed: s.handNumber, ...this.stats }) ?? null;
    let view = null;
    if (award) {
      const p = award.payout;
      view = { total: p.total, detail: `${p.won ? 'Win' : 'Good try'}: ${p.resultCoins} × ${p.multiplier} (${DIFFICULTY_NAMES[this.opts.difficulty]})`, balance: award.profile.coins };
    }
    const standings = h('div', 'results-grid final');
    standings.append(h('span', 'results-head', 'Player'), h('span', 'results-head', 'Score'));
    for (const p of (won ? [0, 1] : [1, 0]) as rummy500.Player[]) {
      standings.append(h('span', 'results-name', this.nameOf(p)), h('span', 'results-num total', String(s.scores[p])));
    }
    this.showGameOver(won ? 'You win!' : `${this.nameOf(1)} wins!`, standings, view, won);
  }
}

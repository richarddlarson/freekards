/**
 * The Gin Rummy table (spec 18 §4): the upcard choice, draw and discard, knocking, the reveal with
 * lay-offs, hand results, and game over, on top of the shared rummy table.
 */
import { dialogue, gin, rummy, type Card } from '../../logic/index.js';
import { h } from '../stage.js';
import { audio } from '../audio.js';
import { Cancelled, DIFFICULTY_NAMES, T, type TableOptions } from './table-base.js';
import { RummyTable, type CardSpot } from './rummy-table.js';

export interface GinTableOptions extends TableOptions {
  /** Called once when a game finishes (never for abandoned games). Returns the award to show, if any. */
  onGameFinished?(result: GinGameResult): TwoPlayerAward | null;
}

/** What the table reports about the player's game (spec 15 §2). */
export interface GinGameResult {
  won: boolean;
  finalTotal: number;
  handsPlayed: number;
  handsWon: number;
  gins: number;
  undercuts: number;
}

export interface TwoPlayerAward {
  payout: { won: boolean; resultCoins: number; multiplier: number; bonus: number; total: number };
  profile: { coins: number };
}

type Choice = { type: 'take_upcard' } | { type: 'pass_upcard' } | { type: 'draw'; source: 'stock' | 'discard' } | { type: 'discard' | 'knock'; card: Card };

const SUIT_SYMBOL: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };
/** A card as text, e.g. "7♥" or "10♠". */
export function cardName(c: Card): string {
  return `${c[0] === 'T' ? '10' : c[0]}${SUIT_SYMBOL[c[1]!]}`;
}

export class GinTable extends RummyTable {
  protected readonly rulesGame = 'gin' as const;
  private state: gin.GinState;
  private readonly ais: (gin.GinAiPlayer | null)[];
  /** The player's pending choice, while waiting for them. */
  private choose: ((c: Choice) => void) | null = null;
  /** 0 = normal; 1 = hands revealed in melds; 2 = also the lay-offs. */
  private reveal = 0;
  private readonly rows: { name: HTMLElement; won: HTMLElement; score: HTMLElement }[] = [];
  private readonly scoreInfo = h('div', 'score-info');
  private readonly stats = { gins: 0, undercuts: 0 };

  constructor(stage: ConstructorParameters<typeof RummyTable>[0], private readonly opts: GinTableOptions) {
    super(stage, opts, 'gin');
    this.state = gin.createGinGame({ seed: opts.seed });
    this.ais = [opts.autoplay ? gin.createGinAi(this.aiProfile(0), this.aiSeed(0)) : null, gin.createGinAi(this.aiProfile(1), this.aiSeed(1))];
    this.init();
  }

  async run(): Promise<void> {
    try {
      await this.start();
      for (;;) {
        await this.deal();
        while (this.state.phase === 'upcard' || this.state.phase === 'draw' || this.state.phase === 'discard') await this.turn();
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

  private apply(action: gin.GinAction): gin.GinEvent[] {
    const step = gin.applyGinAction(this.state, action);
    this.state = step.state;
    this.ais.forEach((ai, p) => ai?.observe(step.events, p as gin.Player));
    this.say(dialogue.ginCandidates(step.events));
    this.updateScores();
    return step.events;
  }

  // ------------------------------------------------------------------ hooks

  protected hand(player: 0 | 1): Card[] {
    return this.state.hands[player];
  }

  protected arrangement(hand: readonly Card[]) {
    return gin.ginArrangement(hand);
  }

  protected layoutCards(): Map<Card, CardSpot> {
    const s = this.state;
    const out = new Map<Card, CardSpot>();
    this.stockSpots(out, s.stock);
    s.discard.forEach((c, i) => out.set(c, { p: { ...this.rl.discard, rot: 0, scale: 0.75 }, up: true, z: 100 + i }));
    const r = s.lastHand;
    if (this.reveal > 0 && r) {
      for (const p of [0, 1] as gin.Player[]) {
        const melds = r.melds[p].map((m) => ({ kind: m.kind, cards: [...m.cards] }));
        if (this.reveal === 2 && p === r.knocker) for (const l of r.layoffs) melds[l.meld] = rummy.layOff(melds[l.meld]!, l.card, 'low');
        const dead = this.reveal === 2 && p !== r.knocker ? r.deadwood[p] : [...r.deadwood[p], ...(p !== r.knocker ? r.layoffs.map((l) => l.card) : [])];
        this.meldRowSpots(out, [...melds.map((m) => m.cards), ...(dead.length ? [dead] : [])], p === 1 ? 'opponent' : 'player');
      }
      return out;
    }
    this.opponentHandSpots(out, s.hands[1]);
    this.playerHandSpots(out, this.handGroups(s.hands[0]));
    return out;
  }

  protected cardTapped(card: Card): void {
    const s = this.state;
    if (!this.choose) return;
    const top = s.discard.at(-1);
    if (s.phase === 'upcard' && card === top) return this.pick({ type: 'take_upcard' });
    if (s.phase === 'draw') {
      if (s.stock.includes(card)) return this.pick({ type: 'draw', source: 'stock' });
      if (card === top) {
        if (s.stockOnly) {
          this.sprites.get(card)?.shake();
          this.showToast('Draw from the stock this time');
          return;
        }
        return this.pick({ type: 'draw', source: 'discard' });
      }
    }
    if (s.phase === 'discard' && s.hands[0].includes(card)) {
      if (card === s.takenDiscard) {
        this.sprites.get(card)?.shake();
        this.showToast("You can't throw back the card you just picked up");
        return;
      }
      const was = this.lifted.has(card);
      this.lifted.clear();
      if (!was) this.lifted.add(card);
      audio.play('card.select');
      this.discardActions();
      void this.sync(this.response().passToggle);
      return;
    }
    this.sprites.get(card)?.shake();
  }

  protected override canDragToDiscard(card: Card): boolean {
    return this.choose !== null && gin.legalDiscards(this.state, 0).includes(card);
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
    this.scorePanel.append(h('div', 'score-title', `Gin Rummy · to ${this.state.targetScore}`));
    const grid = h('div', 'score-grid');
    grid.append(h('span', 'score-head', ''), h('span', 'score-head', 'Hands'), h('span', 'score-head', 'Score'));
    for (const p of [0, 1]) {
      const name = h('span', 'score-name', this.nameOf(p));
      const won = h('span', 'score-num', '0');
      const score = h('span', 'score-num total', '0');
      grid.append(name, won, score);
      this.rows[p] = { name, won, score };
    }
    this.scorePanel.append(grid, this.scoreInfo);
  }

  protected updateScores(): void {
    const s = this.state;
    for (const p of [0, 1] as const) {
      this.rows[p]!.won.textContent = String(s.handsWon[p]);
      this.rows[p]!.score.textContent = String(s.scores[p]);
    }
    this.scoreInfo.textContent = s.handNumber === 0 ? '' : `Hand ${s.handNumber} · Stock ${s.stock.length}`;
  }

  protected override turnChanged(seat: number | null): void {
    for (const p of [0, 1]) this.rows[p]!.name.classList.toggle('turn', p === seat);
  }

  // ------------------------------------------------------------------ phases

  private async deal(): Promise<void> {
    this.reveal = 0;
    this.apply({ type: 'deal' });
    const s = this.state;
    this.resetSprites([...s.hands[0], ...s.hands[1], ...s.discard, ...s.stock]);
    const first = gin.other(s.dealer);
    const order: Card[] = [];
    for (let i = 0; i < gin.HAND_SIZE; i++) order.push(s.hands[first][i]!, s.hands[s.dealer][i]!);
    await this.dealAnimation(order);
  }

  private async turn(): Promise<void> {
    const s = this.state;
    const p = s.turn;
    this.setTurn(p);
    const choice = p === 0 && !this.opts.autoplay ? await this.humanChoice() : await this.aiChoice(p);
    this.setActions(null);
    this.lifted.clear();
    const events = this.apply(this.toAction(choice, p));
    this.setTurn(null);
    for (const e of events) {
      if (e.type === 'upcard_passed') this.showToast(e.player === 0 ? 'You pass' : `${this.nameOf(1)} passes`);
      if (e.type === 'drew') audio.play('card.deal');
      if (e.type === 'discarded' || e.type === 'knocked' || e.type === 'gin') audio.play('card.place');
    }
    await this.sync(p === 0 && !this.opts.autoplay ? this.response().playFlight : T.playFlight + 120);
  }

  private toAction(c: Choice, player: gin.Player): gin.GinAction {
    switch (c.type) {
      case 'take_upcard':
      case 'pass_upcard':
        return { type: c.type, player };
      case 'draw':
        return { type: 'draw', player, source: c.source };
      default:
        return { type: c.type, player, card: c.card };
    }
  }

  private async aiChoice(p: gin.Player): Promise<Choice> {
    await this.think();
    const ai = this.ais[p]!;
    const s = this.state;
    if (s.phase === 'upcard') return ai.takeUpcard(s, p) ? { type: 'take_upcard' } : { type: 'pass_upcard' };
    if (s.phase === 'draw') return { type: 'draw', source: ai.chooseDraw(s, p) };
    const d = ai.chooseDiscard(s, p);
    return { type: d.knock ? 'knock' : 'discard', card: d.card };
  }

  private humanChoice(): Promise<Choice> {
    const s = this.state;
    if (s.phase === 'upcard') {
      const up = cardName(s.discard.at(-1)!);
      this.setActions(`Take the ${up}, or pass?`, [
        { label: `Take ${up}`, enabled: true, onTap: () => this.pick({ type: 'take_upcard' }) },
        { label: 'Pass', enabled: true, primary: false, onTap: () => this.pick({ type: 'pass_upcard' }) },
      ]);
    } else if (s.phase === 'draw') {
      this.setActions(s.stockOnly ? 'Draw a card from the stock' : 'Draw from the stock or the discard pile');
    } else this.discardActions();
    return this.waitForPlayer<Choice>((resolve) => (this.choose = resolve));
  }

  /** The discard-phase prompt and buttons, for the card currently selected (spec 18 §4.4). */
  private discardActions(): void {
    const s = this.state;
    const hand = s.hands[0];
    const card = [...this.lifted][0] ?? null;
    const legal = gin.legalDiscards(s, 0);
    const now = Math.min(...legal.map((c) => gin.deadwoodValue(hand.filter((x) => x !== c))));
    const after = card ? gin.deadwoodValue(hand.filter((x) => x !== card)) : null;
    const prompt = card ? `Discard the ${cardName(card)}? Deadwood after: ${after}` : `Choose a card to discard · Lowest deadwood after discard: ${now}`;
    const buttons = [{ label: card ? `Discard ${cardName(card)}` : 'Discard', enabled: card !== null, onTap: () => card && this.pick({ type: 'discard', card }) }];
    if (now <= gin.KNOCK_LIMIT) {
      const can = card !== null && gin.canKnockWith(s, 0, card);
      buttons.push({ label: can && after === 0 ? 'Gin!' : 'Knock', enabled: can, onTap: () => card && this.pick({ type: 'knock', card }) });
    }
    this.setActions(prompt, buttons);
  }

  // ------------------------------------------------------------------ results

  private async handOver(): Promise<void> {
    const r = this.state.lastHand!;
    if (r.winner === 0 && r.kind === 'gin') this.stats.gins++;
    if (r.winner === 0 && r.kind === 'undercut') this.stats.undercuts++;
    if (r.kind === 'dead') this.showToast('Dead hand: nobody scores', 2200);
    else {
      const who = r.knocker === 0 ? 'You' : this.nameOf(1);
      this.showToast(r.kind === 'gin' ? `${who === 'You' ? 'You go' : `${who} goes`} gin!` : `${who} ${who === 'You' ? 'knock' : 'knocks'}!`, 2200);
      if (r.kind === 'gin') audio.play('table.moon');
    }
    this.reveal = 1;
    await this.sync(520, { stagger: 18 });
    if (r.layoffs.length > 0) {
      await this.sleep(this.paced(900));
      this.reveal = 2;
      audio.play('card.place');
      await this.sync(420);
    }
    if (r.kind === 'undercut') this.showToast(r.winner === 0 ? 'You undercut!' : `${this.nameOf(1)} undercuts!`, 2200);
    await this.sleep(this.paced(1600));
    const panel = h('div', 'dialog');
    panel.append(h('h2', '', `Hand ${this.state.handNumber} results`), this.handResult(r));
    const over = gin.ginGameWinner(this.state.scores, this.state.targetScore) !== null;
    await this.dialogWithButton(panel, over ? 'Final results' : 'Next hand');
  }

  private handResult(r: gin.GinHandResult): HTMLElement {
    const box = h('div', 'rummy-result');
    const name = (p: gin.Player | null) => (p === 0 ? 'You' : this.nameOf(1));
    const line =
      r.kind === 'dead'
        ? 'Only two cards were left in the stock. Nobody scores.'
        : r.kind === 'gin'
          ? `${name(r.knocker)} went gin: ${r.points} deadwood + 25 gin bonus.`
          : r.kind === 'undercut'
            ? `${name(r.knocker)} knocked with ${r.deadwoodValue[r.knocker!]}, but ${name(r.winner)} had ${r.deadwoodValue[r.winner!]}: undercut! ${r.points} + 25 bonus.`
            : `${name(r.knocker)} knocked with ${r.deadwoodValue[r.knocker!]} against ${r.deadwoodValue[gin.other(r.knocker!)]}.`;
    box.append(h('p', 'dialog-note', line));
    const grid = h('div', 'results-grid rummy');
    grid.style.gridTemplateColumns = '1fr repeat(3, auto)';
    grid.append(h('span', 'results-head', 'Player'), h('span', 'results-head', 'Deadwood'), h('span', 'results-head', 'This hand'), h('span', 'results-head', 'Total'));
    for (const p of [0, 1] as gin.Player[]) {
      grid.append(
        h('span', 'results-name', name(p)),
        h('span', 'results-num', String(r.deadwoodValue[p])),
        h('span', 'results-num', r.winner === p ? `+${r.total}` : '0'),
        h('span', 'results-num total', String(this.state.scores[p])),
      );
    }
    box.append(grid);
    if (r.layoffs.length > 0) box.append(h('p', 'results-small', `Laid off: ${r.layoffs.map((l) => cardName(l.card)).join(' ')}`));
    return box;
  }

  private gameOver(): void {
    const g = this.state.result!;
    const won = g.winner === 0;
    const award = this.opts.onGameFinished?.({
      won,
      finalTotal: g.finalTotals[0],
      handsPlayed: this.state.handNumber,
      handsWon: this.state.handsWon[0],
      ...this.stats,
    }) ?? null;
    let view = null;
    if (award) {
      const p = award.payout;
      let detail = `${p.won ? 'Win' : 'Good try'}: ${p.resultCoins} × ${p.multiplier} (${DIFFICULTY_NAMES[this.opts.difficulty]})`;
      if (p.bonus) detail += ` · Gin bonus +${p.bonus}`;
      view = { total: p.total, detail, balance: award.profile.coins };
    }
    const grid = h('div', 'results-grid rummy-final');
    grid.style.gridTemplateColumns = '1fr auto auto';
    grid.append(h('span', 'results-head', ''), h('span', 'results-head', 'You'), h('span', 'results-head', this.nameOf(1)));
    const row = (label: string, a: string, b: string, cls = '') => grid.append(h('span', `results-name ${cls}`, label), h('span', `results-num ${cls}`, a), h('span', `results-num ${cls}`, b));
    row('Score', String(this.state.scores[0]), String(this.state.scores[1]));
    row(`Hands won × ${gin.BOX_BONUS}`, `+${g.boxBonus[0]}`, `+${g.boxBonus[1]}`);
    row('Game bonus', won ? `+${g.gameBonus}` : '—', won ? '—' : `+${g.gameBonus}`);
    if (g.shutout) row('Shutout', won ? '× 2' : '—', won ? '—' : '× 2');
    row('Final total', String(g.finalTotals[0]), String(g.finalTotals[1]), 'total');
    this.showGameOver(won ? 'You win!' : `${this.nameOf(1)} wins!`, grid, view, won);
  }
}

/**
 * The Hearts table (spec 12): the Hearts phases, score panel, and dialogs on top of the shared
 * trick-table presentation. Game state is only ever changed through engine actions.
 */
import { dialogue, hearts, type Card, type Seat } from '../../logic/index.js';
import { h } from '../stage.js';
import { audio } from '../audio.js';
import { COMPUTER_SEATS, DIFFICULTY_NAMES, SEATS, T, TrickTable, Cancelled, type TrickTableOptions } from './trick-table.js';

export interface HeartsTableOptions extends TrickTableOptions {
  ruleSet: hearts.HeartsRuleSet;
  /** Called once when a game finishes (never for abandoned games). Returns the award to show, if any. */
  onGameFinished?(result: HeartsGameResult): GameAward | null;
}

/** What the table reports about the player (seat 0) when a game finishes (spec 15 §3). */
export interface HeartsGameResult {
  finalScores: number[];
  handsPlayed: number;
  moonsShot: number;
  queensTaken: number;
}

export interface GameAward {
  payout: { place: number; placeCoins: number; multiplier: number; moonBonus: number; total: number };
  profile: { coins: number };
}

const DIRECTION_TEXT: Record<hearts.PassDirection, string> = {
  left: 'to the left',
  right: 'to the right',
  across: 'across',
  none: '',
};
const DIRECTION_ARROW: Record<hearts.PassDirection, string> = { left: '←', right: '→', across: '↑', none: '' };

export class HeartsTable extends TrickTable<hearts.HeartsEvent> {
  private state: hearts.HeartsState;
  private readonly ais: (hearts.HeartsAiPlayer | null)[];
  private readonly scoreCells: { hand: HTMLElement; total: HTMLElement; row: HTMLElement }[] = [];
  private readonly scoreInfo = h('div', 'score-info');
  private humanMoons = 0;
  private humanQueens = 0;

  constructor(stage: ConstructorParameters<typeof TrickTable>[0], private readonly opts: HeartsTableOptions) {
    super(stage, opts);
    this.state = hearts.createHeartsGame({ ruleSet: opts.ruleSet, seed: opts.seed });
    this.ais = SEATS.map((seat) =>
      seat === 0 && !opts.autoplay ? null : hearts.createHeartsAi(this.aiProfile(seat), this.aiSeed(seat)),
    );
    this.init();
  }

  async run(): Promise<void> {
    try {
      await this.start();
      for (;;) {
        await this.dealHand();
        if (this.state.phase === 'pass') await this.passPhase();
        let lastEvents: hearts.HeartsEvent[] = [];
        while (this.state.phase === 'play') lastEvents = await this.playTurn();
        await this.handSummary(lastEvents);
        const events = this.apply({ type: 'continue' });
        this.say(dialogue.heartsCandidates(events, this.state));
        if (this.state.phase === 'game_over') {
          this.gameOver();
          return;
        }
      }
    } catch (e) {
      if (!(e instanceof Cancelled)) throw e;
    }
  }

  private apply(action: hearts.HeartsAction): hearts.HeartsEvent[] {
    const step = hearts.applyHeartsAction(this.state, action);
    this.state = step.state;
    return step.events;
  }

  // ------------------------------------------------------------------ hooks

  protected hand(seat: Seat): Card[] {
    return this.state.hands[seat];
  }

  protected turnSeat(): Seat | null {
    return hearts.currentSeat(this.state);
  }

  protected trickPlayCount(): number {
    return this.state.trick.plays.length;
  }

  protected legalPlays(seat: Seat): Card[] {
    return hearts.legalPlays(this.state, seat);
  }

  protected aiPlay(seat: Seat): Card {
    return this.ais[seat]!.choosePlay(this.state, seat);
  }

  protected applyPlay(seat: Seat, card: Card): hearts.HeartsEvent[] {
    return this.apply({ type: 'play', seat, card });
  }

  protected applyDeal(): void {
    this.apply({ type: 'deal' });
  }

  protected dealStartSeat(): Seat {
    return 1;
  }

  protected candidates(events: readonly hearts.HeartsEvent[]): dialogue.DialogueCandidate[] {
    return dialogue.heartsCandidates(events, this.state);
  }

  protected async afterPlay(events: readonly hearts.HeartsEvent[]): Promise<void> {
    for (const e of events) {
      if (e.type === 'hearts_broken') {
        this.showToast('Hearts are broken!');
        audio.play('table.hearts_broken');
      }
      if (e.type === 'trick_won') await this.collectTrick(e.seat as Seat, e.cards);
      if (e.type === 'queen_of_spades_taken' && e.seat === 0) this.humanQueens++;
      if (e.type === 'moon_shot' && e.seat === 0) this.humanMoons++;
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
  }

  protected buildScorePanel(): void {
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
  }

  protected updateScores(): void {
    for (const seat of SEATS) {
      const cells = this.scoreCells[seat]!;
      cells.hand.textContent = String(hearts.cardsPoints(this.state.taken[seat], this.state.ruleSet));
      cells.total.textContent = String(this.state.scores[seat]);
    }
    const s = this.state;
    this.scoreInfo.textContent =
      s.phase === 'pass' ? `Hand ${s.handNumber} · Pass ${DIRECTION_ARROW[s.passDirection]}` : `Hand ${s.handNumber} · to ${s.targetScore}`;
  }

  protected override turnChanged(seat: Seat | null): void {
    for (const s of SEATS) this.scoreCells[s]!.row.classList.toggle('turn', s === seat);
  }

  // ------------------------------------------------------------------ phases

  private async passPhase(): Promise<void> {
    const dir = this.state.passDirection;
    this.updateScores();
    const mine = this.opts.autoplay
      ? this.ais[0]!.choosePass(this.state, 0)
      : await this.selectCards(3, `Choose 3 cards to pass ${DIRECTION_TEXT[dir]}`, `Pass ${DIRECTION_ARROW[dir]}`);
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
    await this.dialogWithButton(panel, over ? 'Final results' : 'Next hand');
  }

  private gameOver(): void {
    const winner = this.state.winner;
    const award = this.opts.onGameFinished?.({
      finalScores: [...this.state.scores],
      handsPlayed: this.state.handNumber,
      moonsShot: this.humanMoons,
      queensTaken: this.humanQueens,
    }) ?? null;
    const PLACE = ['1st', '2nd', '3rd', '4th'];
    let view = null;
    if (award) {
      const p = award.payout;
      let detail = `${PLACE[p.place - 1]} place: ${p.placeCoins} × ${p.multiplier} (${DIFFICULTY_NAMES[this.opts.difficulty]})`;
      if (p.moonBonus) detail += ` · Moon bonus +${p.moonBonus}`;
      view = { total: p.total, detail, balance: award.profile.coins };
    }
    this.showGameOver(winner === 0 ? 'You win!' : `${this.nameOf(winner ?? 0)} wins!`, this.standingsTable(null), view, winner === 0);
  }
}

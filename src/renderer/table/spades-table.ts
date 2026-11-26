/**
 * The Spades table (spec 17 §8, spec 12 §8): bidding, team score panel, bid badges, hand summary,
 * and game over, on top of the shared trick-table presentation. State changes only through engine actions.
 */
import { dialogue, spades, type Card, type Seat } from '../../logic/index.js';
import { h, onTap } from '../stage.js';
import { audio } from '../audio.js';
import { layout } from '../../logic/index.js';
import { COMPUTER_SEATS, DIFFICULTY_NAMES, SEATS, TrickTable, Cancelled, type TrickTableOptions } from './trick-table.js';

export interface SpadesTableOptions extends TrickTableOptions {
  targetScore: 300 | 500;
  /** Called once when a game finishes (never for abandoned games). Returns the award to show, if any. */
  onGameFinished?(result: SpadesGameResult): SpadesAward | null;
}

/** What the table reports about the player's game when it finishes (spec 15 §2–3). */
export interface SpadesGameResult {
  won: boolean;
  teamScore: number;
  handsPlayed: number;
  contractsBid: number;
  contractsMade: number;
  nilsBid: number;
  nilsMade: number;
}

export interface SpadesAward {
  payout: { won: boolean; resultCoins: number; multiplier: number; nilBonus: number; total: number };
  profile: { coins: number };
}

const bidText = (b: number): string => (b === 0 ? 'Nil' : `Bid ${b}`);

export class SpadesTable extends TrickTable<spades.SpadesEvent> {
  protected readonly rulesGame = 'spades' as const;
  private state: spades.SpadesState;
  private readonly ais: (spades.SpadesAiPlayer | null)[];
  private readonly badges: HTMLDivElement[] = [];
  private readonly teamRows: { row: HTMLElement; bid: HTMLElement; won: HTMLElement; score: HTMLElement; bags: HTMLElement }[] = [];
  private readonly scoreInfo = h('div', 'score-info');
  private readonly stats = { contractsBid: 0, contractsMade: 0, nilsBid: 0, nilsMade: 0 };

  constructor(stage: ConstructorParameters<typeof TrickTable>[0], private readonly opts: SpadesTableOptions) {
    super(stage, opts);
    this.state = spades.createSpadesGame({ seed: opts.seed, targetScore: opts.targetScore });
    this.ais = SEATS.map((seat) =>
      seat === 0 && !opts.autoplay ? null : spades.createSpadesAi(this.aiProfile(seat), this.aiSeed(seat)),
    );
    for (const seat of SEATS) {
      const b = h('div', 'bid-badge');
      b.hidden = true;
      this.badges[seat] = b;
      this.root.append(b);
    }
    this.init();
  }

  async run(): Promise<void> {
    try {
      await this.start();
      for (;;) {
        await this.dealHand();
        await this.biddingPhase();
        let lastEvents: spades.SpadesEvent[] = [];
        while (this.state.phase === 'play') lastEvents = await this.playTurn();
        this.recordHand();
        await this.handSummary(lastEvents);
        const events = this.apply({ type: 'continue' });
        this.say(dialogue.spadesCandidates(events));
        if (this.state.phase === 'game_over') {
          this.gameOver();
          return;
        }
      }
    } catch (e) {
      if (!(e instanceof Cancelled)) throw e;
    }
  }

  private apply(action: spades.SpadesAction): spades.SpadesEvent[] {
    const step = spades.applySpadesAction(this.state, action);
    this.state = step.state;
    return step.events;
  }

  private teamName(team: spades.Team): string {
    const [a, b] = spades.teamSeats(team);
    return team === 0 ? `You & ${this.nameOf(b)}` : `${this.nameOf(a)} & ${this.nameOf(b)}`;
  }

  // ------------------------------------------------------------------ hooks

  protected hand(seat: Seat): Card[] {
    return this.state.hands[seat];
  }

  protected turnSeat(): Seat | null {
    return this.state.phase === 'play' ? spades.currentSeat(this.state) : null;
  }

  protected trickPlayCount(): number {
    return this.state.trick.plays.length;
  }

  protected legalPlays(seat: Seat): Card[] {
    return spades.legalPlays(this.state, seat);
  }

  protected aiPlay(seat: Seat): Card {
    return this.ais[seat]!.choosePlay(this.state, seat);
  }

  protected applyPlay(seat: Seat, card: Card): spades.SpadesEvent[] {
    return this.apply({ type: 'play', seat, card });
  }

  protected applyDeal(): void {
    this.apply({ type: 'deal' });
    for (const b of this.badges) if (b) b.hidden = true;
  }

  protected dealStartSeat(): Seat {
    return ((this.state.dealer + 1) % 4) as Seat;
  }

  protected candidates(events: readonly spades.SpadesEvent[]): dialogue.DialogueCandidate[] {
    return dialogue.spadesCandidates(events);
  }

  protected async afterPlay(events: readonly spades.SpadesEvent[]): Promise<void> {
    for (const e of events) {
      if (e.type === 'spades_broken') this.showToast('Spades are broken!');
      if (e.type === 'trick_won') await this.collectTrick(e.seat as Seat, e.cards);
      if (e.type === 'nil_failed') {
        this.showToast(e.seat === 0 ? 'Your Nil is broken!' : `${this.nameOf(e.seat as Seat)}'s Nil is broken!`, 2200);
      }
    }
    this.updateBadges();
  }

  protected buildScorePanel(): void {
    this.scorePanel.append(h('div', 'score-title', `Spades · to ${this.opts.targetScore}`));
    const grid = h('div', 'team-grid');
    for (const team of [0, 1] as const) {
      const row = h('div', 'team-name', this.teamName(team));
      const bid = h('span', 'team-stat', '');
      const won = h('span', 'team-stat', '');
      const bags = h('span', 'team-stat', '');
      const score = h('span', 'team-score', '0');
      const line = h('div', 'team-line');
      const left = h('div', 'team-stats');
      left.append(bid, won, bags);
      line.append(left, score);
      grid.append(row, line);
      this.teamRows[team] = { row, bid, won, score, bags };
    }
    this.scorePanel.append(grid, this.scoreInfo);
  }

  protected updateScores(): void {
    const s = this.state;
    for (const team of [0, 1] as const) {
      const r = this.teamRows[team]!;
      const seats = spades.teamSeats(team);
      const bids = seats.map((st) => s.bids[st]);
      const known = bids.every((b) => b !== null);
      const contract = bids.reduce<number>((sum, b) => sum + (b ?? 0), 0);
      const nil = bids.some((b) => b === 0);
      r.bid.textContent = known ? `Bid ${contract}${nil ? ' + Nil' : ''}` : 'Bid –';
      r.won.textContent = `Won ${seats.reduce<number>((sum, st) => sum + s.won[st], 0)}`;
      r.bags.textContent = `Bags ${s.bags[team]}`;
      r.score.textContent = String(s.scores[team]);
    }
    this.scoreInfo.textContent = `Hand ${s.handNumber} · Dealer: ${this.nameOf(s.dealer)}`;
  }

  protected override turnChanged(seat: Seat | null): void {
    for (const team of [0, 1] as const) this.teamRows[team]!.row.classList.toggle('turn', seat !== null && spades.teamOf(seat) === team);
  }

  protected override relayoutExtras(): void {
    for (const seat of COMPUTER_SEATS) {
      const p = this.lay.seats[seat].portrait;
      this.place(this.badges[seat]!, { x: p.x, y: p.y + layout.LAYOUT.portraitSize / 2 + 62 });
    }
    const first = layout.handPlacement(this.lay, 0, 0, 13);
    this.place(this.badges[0]!, { x: first.x - layout.CARD_W / 2 - 80, y: first.y - 52 });
  }

  private updateBadges(): void {
    for (const seat of SEATS) {
      const b = this.badges[seat]!;
      const bid = this.state.bids[seat];
      b.hidden = bid === null;
      if (bid === null) continue;
      const playing = this.state.phase !== 'bid';
      b.textContent = playing ? `${bidText(bid)} · Won ${this.state.won[seat]}` : bidText(bid);
      b.classList.toggle('nil', bid === 0);
      b.classList.toggle('broken', bid === 0 && this.state.won[seat] > 0);
    }
  }

  // ------------------------------------------------------------------ bidding

  private async biddingPhase(): Promise<void> {
    while (this.state.phase === 'bid') {
      const seat = spades.currentSeat(this.state)!;
      this.setTurn(seat);
      let bid: number;
      if (seat === 0 && !this.opts.autoplay) bid = await this.humanBid();
      else {
        await this.think();
        bid = this.ais[seat]!.chooseBid(this.state, seat);
      }
      const events = this.apply({ type: 'bid', seat, bid });
      this.setTurn(null);
      audio.play('card.select');
      this.updateBadges();
      this.updateScores();
      this.say(dialogue.spadesCandidates(events));
      if (bid === 0) this.showToast(seat === 0 ? 'You bid Nil!' : `${this.nameOf(seat)} bids Nil!`);
    }
    if (this.state.bids[0] === 0) this.stats.nilsBid++;
    await this.sleep(400);
  }

  /** The bid panel (spec 17 §8): Nil and 1–13, the bids so far, a suggestion, and a confirm button. */
  private humanBid(): Promise<number> {
    const panel = h('div', 'bid-panel');
    panel.append(h('div', 'bid-title', 'Your bid'));
    const others = h('div', 'bid-others');
    for (const seat of [2, 1, 3] as Seat[]) {
      const b = this.state.bids[seat];
      const who = seat === 2 ? `Partner (${this.nameOf(2)})` : this.nameOf(seat);
      others.append(h('span', 'bid-other', `${who}: ${b === null ? '—' : b === 0 ? 'Nil' : b}`));
    }
    panel.append(others);
    const grid = h('div', 'bid-grid');
    const confirm = h('button', 'big-button', 'Bid');
    confirm.disabled = true;
    let chosen: number | null = null;
    const buttons: HTMLButtonElement[] = [];
    for (let n = 0; n <= 13; n++) {
      const b = h('button', 'choice bid-choice', n === 0 ? 'Nil' : String(n));
      onTap(b, () => {
        chosen = n;
        for (const x of buttons) x.classList.toggle('selected', x === b);
        confirm.disabled = false;
        confirm.textContent = n === 0 ? 'Bid Nil' : `Bid ${n}`;
        audio.play('card.select');
      });
      buttons.push(b);
      grid.append(b);
    }
    const suggestion = Math.min(13, Math.max(1, Math.round(spades.estimateTricks(this.state.hands[0]) - spades.SPADES_AI_TUNING.bidHedge)));
    panel.append(grid, h('div', 'bid-hint', `Suggested: ${suggestion}`), confirm);
    this.place(panel, this.lay.center);
    this.root.append(panel);
    this.onDestroy = () => panel.remove();
    return this.waitForPlayer<number>((resolve) => {
      onTap(confirm, () => {
        if (chosen === null) return;
        panel.remove();
        this.onDestroy = null;
        resolve(chosen);
      });
    });
  }

  // ------------------------------------------------------------------ results

  private recordHand(): void {
    const r = this.state.lastHand?.[0];
    if (!r) return;
    if (r.contract > 0) {
      this.stats.contractsBid++;
      if (r.made) this.stats.contractsMade++;
    }
    if (r.nils.some((n) => n.seat === 0 && n.made)) this.stats.nilsMade++;
  }

  private resultsTable(results: spades.Two<spades.TeamHandResult>): HTMLElement {
    const grid = h('div', 'spades-results');
    grid.append(h('span', 'results-head', ''), h('span', 'results-head', this.teamName(0)), h('span', 'results-head', this.teamName(1)));
    const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
    const row = (label: string, cells: [string, string], cls = '') => {
      grid.append(h('span', `results-name ${cls}`, label), h('span', `results-num ${cls}`, cells[0]), h('span', `results-num ${cls}`, cells[1]));
    };
    const both = (f: (r: spades.TeamHandResult, t: 0 | 1) => string): [string, string] => [f(results[0], 0), f(results[1], 1)];
    row('Bid', both((r, t) => {
      const nil = spades.teamSeats(t).some((st) => this.state.bids[st] === 0);
      return `${r.contract}${nil ? ' + Nil' : ''}`;
    }));
    row('Won', both((r, t) => String(spades.teamSeats(t).reduce<number>((sum, st) => sum + this.state.won[st], 0))));
    row('Contract', both((r) => (r.contract === 0 ? '—' : `${signed(r.contractPoints)}${r.made ? '' : ' (set)'}`)));
    row('Bags', both((r) => signed(r.bags)));
    if (results.some((r) => r.nils.length > 0)) {
      row('Nil', both((r) => (r.nils.length === 0 ? '—' : r.nils.map((n) => `${this.nameOf(n.seat)} ${n.made ? '+100' : '−100'}`).join(', '))));
    }
    if (results.some((r) => r.bagPenalty !== 0)) row('Bag penalty', both((r) => (r.bagPenalty ? signed(r.bagPenalty) : '—')));
    row('This hand', both((r) => signed(r.total)), 'strong');
    row('Total', both((_r, t) => String(this.state.scores[t])), 'total');
    row('Bags so far', both((_r, t) => String(this.state.bags[t])));
    return grid;
  }

  private async handSummary(events: readonly spades.SpadesEvent[]): Promise<void> {
    const scored = events.find((e) => e.type === 'hand_scored');
    await this.sleep(500);
    const panel = h('div', 'dialog');
    panel.append(h('h2', '', `Hand ${this.state.handNumber} results`));
    if (scored?.type === 'hand_scored') panel.append(this.resultsTable(scored.results));
    const over = spades.gameWinner(this.state.scores, this.state.targetScore) !== null;
    await this.dialogWithButton(panel, over ? 'Final results' : 'Next hand');
  }

  private gameOver(): void {
    const team = this.state.winner ?? 0;
    const won = team === 0;
    const award = this.opts.onGameFinished?.({
      won,
      teamScore: this.state.scores[0],
      handsPlayed: this.state.handNumber,
      ...this.stats,
    }) ?? null;
    let view = null;
    if (award) {
      const p = award.payout;
      let detail = `${p.won ? 'Win' : 'Good try'}: ${p.resultCoins} × ${p.multiplier} (${DIFFICULTY_NAMES[this.opts.difficulty]})`;
      if (p.nilBonus) detail += ` · Nil bonus +${p.nilBonus}`;
      view = { total: p.total, detail, balance: award.profile.coins };
    }
    const standings = h('div', 'results-grid final');
    standings.append(h('span', 'results-head', 'Team'), h('span', 'results-head', 'Score'));
    for (const t of ([team, 1 - team] as spades.Team[])) {
      standings.append(h('span', 'results-name', this.teamName(t)), h('span', 'results-num total', String(this.state.scores[t])));
    }
    const [a, b] = spades.teamSeats(team);
    const title = won ? `You and ${this.nameOf(2)} win!` : `${this.nameOf(a)} and ${this.nameOf(b)} win!`;
    this.showGameOver(title, standings, view, won);
  }
}

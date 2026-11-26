/**
 * What every game table shares (spec 12): the table root and card layer, the computer players'
 * portraits and speech bubbles, the score panel, the menu button, the center message and toasts,
 * pacing (sleep, pause, computer thinking), the dialogs, the game-over dialog with the KardCoins
 * award, and the pause menu. Trick-taking games (TrickTable) and the 2-player rummy games
 * (RummyTable) extend it. Game state is only changed through engine actions.
 */
import { dialogue, effectiveSkill, layout, settings, type Difficulty } from '../../logic/index.js';
import { portraitColors, preloadCardImages } from '../content.js';
import { h, onTap, type Stage } from '../stage.js';
import { audio } from '../audio.js';
import { soundSettingsPanel } from '../sound-settings.js';
import { settingsPanel } from '../settings-panel.js';

type CharacterDef = dialogue.CharacterDef;

export const T = layout.TIMING;
export const DIFFICULTY_NAMES: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export interface TableOptions {
  difficulty: Difficulty;
  /** The computer players, by dialogue seat 1, 2, … (seat 0 is the player). */
  opponents: readonly CharacterDef[];
  seed: number;
  /** Demo/testing: the player's seat is played by the computer. */
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

export abstract class TableBase {
  /** Character at each dialogue seat; null for the player. */
  protected readonly seatsDef: (CharacterDef | null)[];
  protected readonly director: dialogue.DialogueDirector;
  /** Shared table positions: score panel, menu button, center (spec 12 §2). */
  protected lay: layout.TableLayout;
  protected readonly speed: number;

  protected readonly root = h('div', 'hearts-table');
  protected readonly cardLayer = h('div', 'card-layer');
  protected readonly portraits: HTMLDivElement[] = [];
  protected readonly bubbles: HTMLDivElement[] = [];
  protected readonly youPlate = h('div', 'nameplate you', 'You');
  protected readonly scorePanel = h('div', 'score-panel');
  protected readonly menuBtn = h('button', 'menu-button', '☰');
  protected readonly message = h('div', 'table-message');
  protected readonly toast = h('div', 'toast');
  protected overlay: HTMLDivElement | null = null;

  protected alive = true;
  private paused = false;
  private resumeWaiters: (() => void)[] = [];
  private readonly timers = new Set<number>();
  private idleTimer = 0;
  private bubbleTimer = 0;
  private toastTimer = 0;
  /** Rejecters of promises waiting on the player; all are rejected with Cancelled when the table closes. */
  protected readonly waiting = new Set<(e: Error) => void>();
  private readonly unsubscribeResize: () => void;
  /** Extra cleanup for subclasses (e.g. panels with their own timers). */
  protected onDestroy: (() => void) | null = null;

  constructor(protected readonly stage: Stage, protected readonly base: TableOptions) {
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

  /** Fill the score panel (called once). */
  protected abstract buildScorePanel(): void;
  /** Refresh the score panel. */
  protected abstract updateScores(): void;
  /** Where a computer seat's portrait sits, and which way its bubble opens. */
  protected abstract portraitSpot(seat: number): { point: layout.Point; bubbleSide: 'left' | 'right' };
  /** Lay out everything game-specific (cards, the "You" plate, badges) after a resize. */
  protected abstract relayoutTable(): void;
  /** Extra DOM for the game, built once before the shared chrome is appended. */
  protected buildTable(): void {}
  /** Score-panel turn highlight (game-specific). */
  protected turnChanged(_seat: number | null): void {}
  /** The player's settings changed mid-game (after the Settings panel closes). */
  protected settingsChanged(): void {}

  /** The dialogue seats with a computer player. */
  protected get computerSeats(): number[] {
    return this.seatsDef.flatMap((c, i) => (c ? [i] : []));
  }

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
    for (const reject of this.waiting) reject(new Cancelled());
    this.waiting.clear();
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

  /** Run `fn` after `t` (game time), cancelled if the table closes. */
  protected later(t: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, this.ms(t));
    this.timers.add(id);
  }

  /** Computer "thinking" before an action. */
  protected think(): Promise<void> {
    return this.sleep(this.paced(T.aiThinkMin + Math.random() * (T.aiThinkMax - T.aiThinkMin)));
  }

  /** The computer skill and risk for a seat (spec 08); seat 0 is the autoplaying player in demos. */
  protected aiProfile(seat: number): { skill: number; risk: number } {
    if (seat === 0) return { skill: 0.6, risk: 0.3 };
    const c = this.seatsDef[seat]!;
    return { skill: effectiveSkill(this.base.difficulty, c.traits.skillAdjust), risk: c.traits.risk };
  }

  protected aiSeed(seat: number): number {
    return seat === 0 ? this.base.seed + 1000 : (this.base.seed + seat * 7919) >>> 0;
  }

  // ------------------------------------------------------------------ DOM

  private build(): void {
    this.root.append(this.cardLayer);
    for (const seat of this.computerSeats) {
      const c = this.seatsDef[seat]!;
      const p = h('div', 'portrait');
      const face = h('div', 'portrait-face', c.nickname.replace(/^The /, '').charAt(0));
      const [light, dark] = portraitColors(c.id);
      face.style.background = `radial-gradient(circle at 35% 30%, ${light}, ${dark})`;
      p.append(face, h('div', 'nameplate', c.nickname));
      p.title = `${c.name} — ${c.tagline}`;
      this.portraits[seat] = p;
      const b = h('div', `bubble ${this.portraitSpot(seat).bubbleSide}`);
      onTap(b, () => this.endBubble());
      this.bubbles[seat] = b;
      this.root.append(p, b);
    }
    this.buildScorePanel();
    onTap(this.menuBtn, () => this.openMenu());
    this.message.hidden = true;
    this.buildTable();
    this.root.append(this.youPlate, this.scorePanel, this.menuBtn, this.message, this.toast);
    this.stage.el.append(this.root);
  }

  protected nameOf(seat: number): string {
    return seat === 0 ? 'You' : this.seatsDef[seat]!.nickname;
  }

  protected place(el: HTMLElement, p: layout.Point): void {
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
  }

  private relayout(): void {
    this.lay = layout.tableLayout(this.stage.vp);
    const L = this.lay;
    for (const seat of this.computerSeats) {
      const { point, bubbleSide } = this.portraitSpot(seat);
      this.place(this.portraits[seat]!, point);
      const off = layout.LAYOUT.portraitSize / 2 + 18;
      this.place(this.bubbles[seat]!, { x: point.x + (bubbleSide === 'right' ? off : -off), y: point.y - 10 });
    }
    this.scorePanel.style.left = `${L.scorePanel.x}px`;
    this.scorePanel.style.top = `${L.scorePanel.y}px`;
    this.scorePanel.style.width = `${L.scorePanel.w}px`;
    this.place(this.menuBtn, L.menuButton);
    this.place(this.message, L.message);
    this.place(this.toast, { x: L.center.x, y: L.center.y - 290 });
    this.relayoutTable();
  }

  /** Highlight whose turn it is: portrait glow, "You" plate, and the score panel (turnChanged). */
  protected setTurn(seat: number | null): void {
    for (const s of this.computerSeats) this.portraits[s]!.classList.toggle('turn', s === seat);
    this.youPlate.classList.toggle('turn', seat === 0);
    this.turnChanged(seat);
  }

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

  // ------------------------------------------------------------------ waiting for the player

  /** Start the idle-comment timer (spec 12 §3); returns a function that stops it. */
  protected startIdle(): () => void {
    const idle = () => {
      this.say(dialogue.idleCandidates());
      this.idleTimer = window.setTimeout(idle, T.idleRepeat);
    };
    this.idleTimer = window.setTimeout(idle, T.idleHuman);
    return () => clearTimeout(this.idleTimer);
  }

  /** Wait for the player (idle comments while waiting). Rejects with Cancelled if the table is destroyed. */
  protected waitForPlayer<R>(setup: (resolve: (r: R) => void) => void): Promise<R> {
    const stopIdle = this.startIdle();
    let reject: (e: Error) => void = () => undefined;
    return new Promise<R>((resolve, rej) => {
      reject = rej;
      this.waiting.add(rej);
      setup(resolve);
    }).finally(() => {
      this.waiting.delete(reject);
      stopIdle();
    });
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
          this.settingsChanged();
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

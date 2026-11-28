/**
 * Chip piles and flying chips (spec 19 §4.3). A pile draws an amount as stacks of chip images
 * (pokerLayout.chipStacks), with the amount written under it. Flying chips are a temporary pile
 * moved with the Web Animations API.
 */
import { pokerLayout, type layout } from '../../logic/index.js';
import { chipUrl } from '../content.js';
import { h } from '../stage.js';

const P = pokerLayout.POKER_LAYOUT;
const CHIP_H = (P.chipWidth * 84) / 120;

/** Small fixed offsets so a stack doesn't look machine-perfect (the same every time). */
const JITTER = [0, 1.2, -0.8, 0.6, -1.4, 0.9, -0.3, 1.5, -1.1, 0.4, -0.6, 1.0];

/** Fill `el` with stacks of chips for `amount`, centered, bottoms on y = 0 (stack by stack, bottom chip first). */
function drawStacks(el: HTMLElement, amount: number, style: pokerLayout.ChipStyle): number {
  el.replaceChildren();
  const stacks = pokerLayout.chipStacks(amount, P.maxPerStack, style);
  const spots = pokerLayout.stackPositions(stacks.length);
  // Back rows first, so front stacks are drawn on top (and stacks build from the back).
  const order = stacks.map((_, i) => i).sort((a, b) => spots[a]!.y - spots[b]!.y);
  order.forEach((i) => {
    const s = stacks[i]!;
    const x = spots[i]!.x - P.chipWidth / 2;
    for (let k = 0; k < s.count; k++) {
      const img = h('img', 'chip');
      img.src = chipUrl(s.value);
      img.alt = '';
      img.draggable = false;
      img.style.left = `${x + JITTER[(k + i * 5) % JITTER.length]!}px`;
      img.style.top = `${spots[i]!.y - CHIP_H - k * P.chipStep}px`;
      el.append(img);
    }
  });
  return Math.max(0, ...spots.map((p) => p.y));
}

export class ChipPile {
  readonly el = h('div', 'chip-pile');
  private readonly chipsEl = h('div', 'chip-stacks');
  private readonly label = h('div', 'chip-label');
  private amount = -1;

  constructor(
    parent: HTMLElement,
    private readonly showLabel = true,
    className = '',
    private readonly style: pokerLayout.ChipStyle = 'fewest',
  ) {
    if (className) this.el.classList.add(className);
    this.el.append(this.chipsEl, this.label);
    parent.append(this.el);
    this.set(0);
  }

  get value(): number {
    return this.amount;
  }

  set(amount: number): void {
    if (amount === this.amount) return;
    this.amount = amount;
    this.label.style.top = `${8 + drawStacks(this.chipsEl, amount, this.style)}px`;
    this.label.textContent = amount.toLocaleString('en-US');
    this.label.hidden = !this.showLabel || amount <= 0;
  }

  /**
   * Build the pile chip by chip (D-095): stacks left to right, each from the bottom up, every chip
   * dropping in with a small bounce. `landed(ms)` is told when each chip lands (for a click sound).
   * Times are already scaled by the caller. The amount shows once the last chip lands.
   */
  async buildUp(amount: number, stagger: number, drop: number, landed?: (atMs: number) => void): Promise<void> {
    this.amount = amount;
    this.label.style.top = `${8 + drawStacks(this.chipsEl, amount, this.style)}px`;
    this.label.textContent = amount.toLocaleString('en-US');
    this.label.hidden = true;
    const h = P.buildHeight;
    const anims = [...this.chipsEl.children].map((img, k) => {
      landed?.(k * stagger + drop * 0.7);
      return (img as HTMLElement).animate(
        [
          { transform: `translateY(${-h}px)`, opacity: 0 },
          { transform: 'translateY(0)', opacity: 1, offset: 0.7 },
          { transform: 'translateY(-5px)', offset: 0.85 },
          { transform: 'translateY(0)', opacity: 1 },
        ],
        { duration: drop, delay: k * stagger, easing: 'ease-in', fill: 'backwards' },
      );
    });
    await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
    this.label.hidden = !this.showLabel || amount <= 0;
  }

  placeAt(p: layout.Point): void {
    this.el.style.left = `${p.x}px`;
    this.el.style.top = `${p.y}px`;
  }

  remove(): void {
    this.el.remove();
  }
}

/** Chips sliding from one place to another; resolves when they arrive (and are removed). */
export async function flyChips(parent: HTMLElement, amount: number, from: layout.Point, to: layout.Point, duration: number): Promise<void> {
  if (amount <= 0) return;
  const pile = new ChipPile(parent, false, 'flying');
  pile.placeAt(from);
  if (duration <= 0) {
    pile.remove();
    return;
  }
  const anim = pile.el.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${to.x - from.x}px, ${to.y - from.y}px)` }], {
    duration,
    easing: 'cubic-bezier(0.33, 0, 0.2, 1)',
    fill: 'forwards',
  });
  await anim.finished.catch(() => undefined);
  pile.remove();
}

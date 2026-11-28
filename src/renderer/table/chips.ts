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

/** Fill `el` with stacks of chips for `amount`, centered, bottoms on y = 0. */
function drawStacks(el: HTMLElement, amount: number): void {
  el.replaceChildren();
  const stacks = pokerLayout.chipStacks(amount);
  const total = stacks.length * P.chipWidth + Math.max(0, stacks.length - 1) * P.stackGap;
  stacks.forEach((s, i) => {
    const x = -total / 2 + i * (P.chipWidth + P.stackGap);
    for (let k = 0; k < s.count; k++) {
      const img = h('img', 'chip');
      img.src = chipUrl(s.value);
      img.alt = '';
      img.draggable = false;
      img.style.left = `${x + JITTER[(k + i * 5) % JITTER.length]!}px`;
      img.style.top = `${-CHIP_H - k * P.chipStep}px`;
      el.append(img);
    }
  });
}

export class ChipPile {
  readonly el = h('div', 'chip-pile');
  private readonly chipsEl = h('div', 'chip-stacks');
  private readonly label = h('div', 'chip-label');
  private amount = -1;

  constructor(parent: HTMLElement, private readonly showLabel = true, className = '') {
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
    drawStacks(this.chipsEl, amount);
    this.label.textContent = amount.toLocaleString('en-US');
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

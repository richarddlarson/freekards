/** A card on the table: one element per card, moved with the Web Animations API (spec 12 §3). */
import { layout, type Card, type settings } from '../../logic/index.js';
import { cardBackUrl, cardFaceUrl } from '../content.js';

const { CARD_W, CARD_H } = layout;

export interface MoveOptions {
  duration: number;
  delay?: number;
  easing?: string;
  opacity?: number;
}

export function transformFor(p: layout.Placement): string {
  return `translate(${(p.x - CARD_W / 2).toFixed(1)}px, ${(p.y - CARD_H / 2).toFixed(1)}px) rotate(${p.rot}deg) scale(${p.scale})`;
}

export class CardSprite {
  readonly el: HTMLDivElement;
  private readonly img: HTMLImageElement;
  place: layout.Placement;
  private faceUp = false;

  constructor(
    readonly card: Card,
    parent: HTMLElement,
    at: layout.Placement,
    private deck: settings.CardDeck,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'card';
    this.el.dataset['card'] = card;
    this.img = document.createElement('img');
    this.img.draggable = false;
    this.img.alt = '';
    this.img.src = cardBackUrl(deck);
    this.el.appendChild(this.img);
    this.place = at;
    this.el.style.transform = transformFor(at);
    parent.appendChild(this.el);
  }

  setFaceUp(up: boolean): void {
    if (up === this.faceUp) return;
    this.faceUp = up;
    this.showImage();
  }

  /** Switch to another card deck in place (D-062). */
  setDeck(deck: settings.CardDeck): void {
    if (deck === this.deck) return;
    this.deck = deck;
    this.showImage();
  }

  private showImage(): void {
    this.img.src = this.faceUp ? cardFaceUrl(this.card, this.deck) : cardBackUrl(this.deck);
    this.img.alt = this.faceUp ? this.card : '';
  }

  setZ(z: number): void {
    this.el.style.zIndex = String(z);
  }

  async moveTo(to: layout.Placement, opts: MoveOptions): Promise<void> {
    const from = transformFor(this.place);
    const target = transformFor(to);
    this.place = to;
    for (const a of this.el.getAnimations()) a.cancel();
    const opacity = opts.opacity ?? 1;
    const fromOpacity = this.el.style.opacity === '' ? 1 : Number(this.el.style.opacity);
    this.el.style.transform = target;
    this.el.style.opacity = String(opacity);
    if (opts.duration <= 0 || (from === target && fromOpacity === opacity)) return;
    const anim = this.el.animate(
      [
        { transform: from, opacity: fromOpacity },
        { transform: target, opacity },
      ],
      { duration: opts.duration, delay: opts.delay ?? 0, easing: opts.easing ?? 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
    );
    await anim.finished.catch(() => undefined);
  }

  /** Move instantly, with no animation (a card following the player's finger). */
  jumpTo(to: layout.Placement): void {
    for (const a of this.el.getAnimations()) a.cancel();
    this.place = to;
    this.el.style.transform = transformFor(to);
  }

  /** Quick sideways shake for an illegal tap. */
  shake(): void {
    const base = transformFor(this.place);
    this.el.animate(
      [{ transform: base }, { transform: `${base} translateX(-10px)` }, { transform: `${base} translateX(10px)` }, { transform: base }],
      { duration: 240, easing: 'ease-in-out' },
    );
  }

  remove(): void {
    this.el.remove();
  }
}

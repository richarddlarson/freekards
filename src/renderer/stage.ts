/**
 * The stage: one element sized in logical units and scaled uniformly to fill the window
 * (spec 11 §2). Everything inside uses logical px, so layout math is resolution-independent.
 */
import { layout } from '../logic/index.js';

export class Stage {
  readonly el: HTMLDivElement;
  vp: layout.Viewport = layout.fitViewport(window.innerWidth, window.innerHeight);
  private listeners = new Set<() => void>();

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'stage';
    parent.appendChild(this.el);
    window.addEventListener('resize', () => this.fit());
    this.fit();
  }

  fit(): void {
    this.vp = layout.fitViewport(window.innerWidth, window.innerHeight);
    this.el.style.width = `${this.vp.width}px`;
    this.el.style.height = `${this.vp.height}px`;
    this.el.style.transform = `scale(${this.vp.scale})`;
    for (const fn of this.listeners) fn();
  }

  onResize(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  clear(): void {
    this.listeners.clear();
    this.el.replaceChildren();
  }
}

/** Small DOM helper: create an element with a class and optional text. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Tap handler that works the same for touch, pen, and mouse. */
export function onTap(el: HTMLElement, fn: (e: PointerEvent) => void): void {
  el.addEventListener('pointerup', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    fn(e);
  });
}

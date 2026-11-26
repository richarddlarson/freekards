/**
 * The Rules panel (spec 12 §10, D-082): how to play one game, from spec/content/rules/<game>.md.
 * Opened from each game's setup screen (Rules) and from its table (the ? button, or Rules in the
 * pause menu). A contents list on the left jumps to each section; the text scrolls on the right.
 */
import { rules } from '../logic/index.js';
import { h, onTap } from './stage.js';

type RulesGame = rules.RulesGame;

const files = import.meta.glob<string>('../../spec/content/rules/*.md', { eager: true, query: '?raw', import: 'default' });
const cache = new Map<RulesGame, rules.RulesDoc>();

export function rulesDoc(game: RulesGame): rules.RulesDoc {
  let doc = cache.get(game);
  if (!doc) {
    const src = files[`../../spec/content/rules/${game}.md`];
    if (src === undefined) throw new Error(`missing rules for ${game}`);
    doc = rules.parseRules(src);
    cache.set(game, doc);
  }
  return doc;
}

function inline(tag: 'p' | 'li', runs: rules.Inline): HTMLElement {
  const el = h(tag);
  for (const r of runs) el.append(r.bold ? h('strong', '', r.text) : document.createTextNode(r.text));
  return el;
}

function block(b: rules.RulesBlock): HTMLElement {
  if (b.kind === 'paragraph') return inline('p', b.text);
  const list = h(b.kind === 'steps' ? 'ol' : 'ul');
  for (const item of b.items) list.append(inline('li', item));
  return list;
}

export function rulesPanel(game: RulesGame, onDone: () => void): HTMLElement {
  const doc = rulesDoc(game);
  const panel = h('div', 'dialog rules-panel');
  panel.append(h('h2', '', `How to play ${doc.title}`));

  const body = h('div', 'rules-body');
  const contents = h('div', 'rules-contents');
  const scroller = h('div', 'rules-scroll');
  for (const b of doc.intro) {
    const el = block(b);
    el.classList.add('rules-intro');
    scroller.append(el);
  }

  const links: HTMLButtonElement[] = [];
  const sections: HTMLElement[] = [];
  doc.sections.forEach((s, i) => {
    const sec = h('section', 'rules-section');
    sec.append(h('h3', '', s.heading), ...s.blocks.map(block));
    scroller.append(sec);
    sections.push(sec);
    const link = h('button', 'rules-link', s.heading);
    onTap(link, () => scroller.scrollTo({ top: sec.offsetTop - 8, behavior: 'smooth' }));
    contents.append(link);
    links.push(link);
    if (i === 0) link.classList.add('current');
  });
  // Mark the section being read in the contents list.
  scroller.addEventListener('scroll', () => {
    const top = scroller.scrollTop + 40;
    const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
    let current = 0;
    sections.forEach((sec, i) => {
      if (sec.offsetTop <= top) current = i;
    });
    if (atEnd) current = sections.length - 1;
    links.forEach((l, i) => l.classList.toggle('current', i === current));
  });
  body.append(contents, scroller);

  const row = h('div', 'dialog-buttons');
  const done = h('button', 'big-button', 'Done');
  done.dataset['escape'] = ''; // the Esc key presses this button (D-058)
  onTap(done, onDone);
  row.append(done);
  panel.append(body, row);
  return panel;
}

/** Open the Rules panel over a screen (setup screens); it closes itself. */
export function openRules(parent: HTMLElement, game: RulesGame): void {
  const overlay = h('div', 'overlay centered');
  const close = () => {
    overlay.remove();
    window.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !e.repeat) {
      e.preventDefault();
      close();
    }
  };
  overlay.append(rulesPanel(game, close));
  parent.append(overlay);
  window.addEventListener('keydown', onKey);
}

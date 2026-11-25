/**
 * About & Credits screen (spec 09 §5, spec 12 §1, D-066).
 *
 * Everything shown is bundled at build time, so the screen works offline: the asset register
 * (sbom/assets.json), the shipped-code SBOM (sbom/code.cdx.json), the MIT license (LICENSE), the
 * Creative Commons legal code (assets/licenses/), and each font's own OFL.txt. The runtime's notices
 * (Electron, Chromium) are files in the install folder, opened through the preload bridge.
 */
import { h, onTap, type Stage } from './stage.js';

interface AssetEntry {
  path: string;
  title: string;
  kind: string;
  author: string;
  source: string;
  license: string;
  licenseUrl: string;
  attribution: string | null;
}

interface CdxComponent {
  name: string;
  version?: string;
  description?: string;
  licenses?: { license?: { id?: string } }[];
  externalReferences?: { type: string; url: string }[];
}

const one = <T>(glob: Record<string, T>): T => {
  const v = Object.values(glob)[0];
  if (v === undefined) throw new Error('credits: bundled file missing');
  return v;
};

const VERSION = one(import.meta.glob<string>('../../package.json', { eager: true, import: 'version' }));
const ASSETS = one(import.meta.glob<AssetEntry[]>('../../sbom/assets.json', { eager: true, import: 'assets' }));
const CODE = one(import.meta.glob<CdxComponent[]>('../../sbom/code.cdx.json', { eager: true, import: 'components' }));
const MIT_TEXT = one(import.meta.glob<string>('../../LICENSE', { eager: true, query: '?raw', import: 'default' }));
const CC_TEXTS = import.meta.glob<string>('../../assets/licenses/*.txt', { eager: true, query: '?raw', import: 'default' });
const FONT_LICENSES = import.meta.glob<string>('../../assets/fonts/*/OFL.txt', { eager: true, query: '?raw', import: 'default' });

const REPO_URL = 'https://github.com/richarddlarson/freekards';

/** Asset groups in display order; kinds not listed fall into "Game content". */
const GROUPS: [kind: string, label: string][] = [
  ['music', 'Music'],
  ['voice', 'Character voices'],
  ['sfx', 'Sound effects'],
  ['font', 'Fonts'],
  ['image', 'Artwork'],
  ['other', 'Game content'],
];

/** Full license texts, in the order they are listed on the Licenses tab. */
function licenseTexts(): [title: string, text: string][] {
  const cc = (id: string) => Object.entries(CC_TEXTS).find(([p]) => p.endsWith(`/${id}.txt`))?.[1] ?? '';
  const fonts = Object.entries(FONT_LICENSES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([p, text]): [string, string] => [`SIL Open Font License 1.1 (${fontName(p)})`, text]);
  return [
    ['MIT License (FreeKards)', MIT_TEXT],
    ['Creative Commons Attribution 4.0', cc('CC-BY-4.0')],
    ['Creative Commons CC0 1.0', cc('CC0-1.0')],
    ...fonts,
  ];
}

const FONT_NAMES: Record<string, string> = { 'fira-sans': 'Fira Sans', 'fira-sans-condensed': 'Fira Sans Condensed', nunito: 'Nunito' };
function fontName(path: string): string {
  const dir = path.split('/').at(-2) ?? '';
  return FONT_NAMES[dir] ?? dir;
}

/** A link that opens in the system browser (the main process routes window.open there). */
function link(url: string, text = url): HTMLElement {
  if (!/^https:\/\//.test(url)) return h('span', 'credit-source', text);
  const a = h('a', 'credit-link', text);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  onTap(a, (e) => {
    e.preventDefault();
    window.open(url, '_blank', 'noopener');
  });
  a.addEventListener('click', (e) => e.preventDefault());
  return a;
}

function creditItem(a: AssetEntry): HTMLElement {
  const item = h('div', 'credit-item');
  item.append(h('div', 'credit-title', a.title));
  item.append(h('div', 'credit-meta', `${a.author} · ${a.license.replaceAll(' AND ', ' and ')}`));
  if (a.attribution) item.append(h('div', 'credit-attribution', a.attribution));
  item.append(link(a.source));
  return item;
}

type Bridge = { credits?: { openNotice(which: 'electron' | 'chromium'): Promise<boolean> } };
const bridge = (): Bridge | undefined => (window as unknown as { freekards?: Bridge }).freekards;

function runtimeSection(): HTMLElement {
  const section = h('section', 'credit-group');
  section.append(h('h3', 'credit-heading', 'Software'));
  for (const c of CODE) {
    const item = h('div', 'credit-item');
    const lic = c.licenses?.map((l) => l.license?.id).filter(Boolean).join(', ') ?? '';
    item.append(h('div', 'credit-title', `${c.name === 'electron' ? 'Electron' : c.name} ${c.version ?? ''}`.trim()));
    item.append(h('div', 'credit-meta', `${lic}${c.description ? ` · ${c.description}` : ''}`));
    const web = c.externalReferences?.find((r) => r.type === 'website');
    if (web) item.append(link(web.url));
    if (c.name === 'electron') {
      const row = h('div', 'credit-notice-row');
      const status = h('span', 'credit-notice-status', '');
      for (const [which, label] of [['electron', 'Electron license'], ['chromium', 'Chromium licenses']] as const) {
        const b = h('button', 'choice', label);
        onTap(b, () => {
          const api = bridge()?.credits;
          if (!api) {
            status.textContent = 'Available in the installed app.';
            return;
          }
          void api.openNotice(which).then((ok) => {
            status.textContent = ok ? '' : 'That file was not found in the install folder.';
          });
        });
        row.append(b);
      }
      row.append(status);
      item.append(row);
    }
    section.append(item);
  }
  return section;
}

function creditsTab(): HTMLElement {
  const body = h('div', 'credits-body');
  body.append(runtimeSection());
  const named = new Set(GROUPS.map(([k]) => k).filter((k) => k !== 'other'));
  for (const [kind, label] of GROUPS) {
    const items = ASSETS.filter((a) => (kind === 'other' ? !named.has(a.kind) : a.kind === kind));
    if (items.length === 0) continue;
    const section = h('section', 'credit-group');
    section.append(h('h3', 'credit-heading', label));
    for (const a of items) section.append(creditItem(a));
    body.append(section);
  }
  const sbom = h('p', 'credit-note', 'The complete software bill of materials (SBOM) is in the "sbom" folder of the installed app and is attached to every release.');
  body.append(sbom);
  return body;
}

function licensesTab(): HTMLElement {
  const body = h('div', 'credits-body');
  for (const [title, text] of licenseTexts()) {
    const section = h('section', 'credit-group');
    section.append(h('h3', 'credit-heading', title), h('pre', 'license-text', text.trim()));
    body.append(section);
  }
  return body;
}

export function showAbout(stage: Stage, opts: { onBack(): void }): void {
  stage.clear();
  const screen = h('div', 'screen');
  const panel = h('div', 'setup-panel about-panel');

  const head = h('div', 'about-head');
  const titles = h('div', 'about-titles');
  titles.append(h('h2', 'setup-title about-title', 'FreeKards'), h('div', 'about-version', `Version ${VERSION}`));
  const blurb = h('div', 'about-blurb');
  blurb.append(
    h('p', '', 'Free, open-source card games with friendly faces. MIT License.'),
    link(REPO_URL, 'github.com/richarddlarson/freekards'),
  );
  head.append(titles, blurb);

  const tabs = h('div', 'choice-group about-tabs');
  const credits = h('button', 'choice selected', 'Credits');
  const licenses = h('button', 'choice', 'Licenses');
  tabs.append(credits, licenses);

  const scroller = h('div', 'about-scroll');
  const show = (which: 'credits' | 'licenses') => {
    credits.classList.toggle('selected', which === 'credits');
    licenses.classList.toggle('selected', which === 'licenses');
    scroller.replaceChildren(which === 'credits' ? creditsTab() : licensesTab());
    scroller.scrollTop = 0;
  };
  onTap(credits, () => show('credits'));
  onTap(licenses, () => show('licenses'));
  show('credits');

  const row = h('div', 'dialog-buttons');
  const back = h('button', 'big-button', 'Back');
  onTap(back, opts.onBack);
  row.append(back);

  panel.append(head, tabs, scroller, row);
  screen.append(panel);
  stage.el.append(screen);
}

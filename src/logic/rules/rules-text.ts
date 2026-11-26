/**
 * Rules screens (spec 12 §10, D-082). Each game's rules are a Markdown file in spec/content/rules
 * (canonical content, D-031). This parses the small subset those files use into plain data, so any
 * front end can draw it without an HTML or Markdown library:
 *
 * - `# Title` (the first line), then an optional intro paragraph;
 * - `## Section` headings;
 * - paragraphs (consecutive lines are joined);
 * - `- item` bullet lists and `1. item` numbered lists (an indented line continues the item);
 * - `**bold**` inside any text.
 */

/** Plain text and bold runs, in order. */
export type Inline = { text: string; bold: boolean }[];

export type RulesBlock = { kind: 'paragraph'; text: Inline } | { kind: 'bullets' | 'steps'; items: Inline[] };

export interface RulesSection {
  heading: string;
  blocks: RulesBlock[];
}

export interface RulesDoc {
  title: string;
  /** Paragraphs before the first section. */
  intro: RulesBlock[];
  sections: RulesSection[];
}

/** The games that have a rules screen, and the file each one reads (spec/content/rules/<id>.md). */
export const RULES_GAMES = ['hearts', 'spades', 'rummy500', 'gin'] as const;
export type RulesGame = (typeof RULES_GAMES)[number];

/** Split `**bold**` runs. An unpaired `**` is an error, so a typo can't turn the rest of a line bold. */
export function parseInline(text: string): Inline {
  const parts = text.split('**');
  if (parts.length % 2 === 0) throw new Error(`unpaired ** in: ${text}`);
  return parts.map((t, i) => ({ text: t, bold: i % 2 === 1 })).filter((r) => r.text.length > 0);
}

const BULLET = /^- (.*)$/;
const STEP = /^\d+\. (.*)$/;

export function parseRules(source: string): RulesDoc {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const first = lines.findIndex((l) => l.trim() !== '');
  const title = lines[first]?.match(/^# (.+)$/)?.[1];
  if (!title) throw new Error('rules file must start with "# Title"');

  const doc: RulesDoc = { title: title.trim(), intro: [], sections: [] };
  let blocks = doc.intro;
  let para: string[] = [];
  let list: { kind: 'bullets' | 'steps'; items: string[] } | null = null;

  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', text: parseInline(para.join(' ')) });
    if (list) blocks.push({ kind: list.kind, items: list.items.map(parseInline) });
    para = [];
    list = null;
  };

  for (const raw of lines.slice(first + 1)) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      flush();
      continue;
    }
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      flush();
      const section: RulesSection = { heading: heading[1]!.trim(), blocks: [] };
      doc.sections.push(section);
      blocks = section.blocks;
      continue;
    }
    if (line.startsWith('#')) throw new Error(`unsupported heading: ${line}`);
    const bullet = line.match(BULLET);
    const step = line.match(STEP);
    if (bullet || step) {
      const kind = bullet ? 'bullets' : 'steps';
      if (para.length || (list && list.kind !== kind)) flush();
      list ??= { kind, items: [] };
      list.items.push((bullet ?? step)![1]!.trim());
      continue;
    }
    if (/^\s+\S/.test(line) && list) {
      // An indented line continues the last list item.
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (list) flush();
    para.push(line.trim());
  }
  flush();
  for (const s of doc.sections) if (s.blocks.length === 0) throw new Error(`empty section: ${s.heading}`);
  return doc;
}

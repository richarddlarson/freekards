import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseInline, parseRules, RULES_GAMES, type RulesDoc, type RulesGame } from '../../src/logic/rules/rules-text.js';
import * as gin from '../../src/logic/gin/index.js';
import * as hearts from '../../src/logic/hearts/index.js';
import * as rummy500 from '../../src/logic/rummy500/index.js';
import * as spades from '../../src/logic/spades/index.js';
import { twoPlayerPayout } from '../../src/logic/profile/profile.js';
import * as poker from '../../src/logic/poker/index.js';

function load(game: RulesGame): { src: string; doc: RulesDoc } {
  const src = readFileSync(new URL(`../../spec/content/rules/${game}.md`, import.meta.url), 'utf8');
  return { src, doc: parseRules(src) };
}

/** All the text of a rules file, bold markers removed, for checking numbers against the engines. */
function plain(src: string): string {
  return src.replace(/\*\*/g, '').replace(/−/g, '-').replace(/\s+/g, ' ');
}

describe('rules text parser', () => {
  it('parses the title, intro, sections, lists, and bold', () => {
    const doc = parseRules(
      ['# Game', '', 'Intro line one', 'and two.', '', '## Turn', '', '1. Draw **one**', '   card.', '2. Discard.', '', '- a', '- b', 'After.'].join('\n'),
    );
    expect(doc.title).toBe('Game');
    expect(doc.intro).toEqual([{ kind: 'paragraph', text: [{ text: 'Intro line one and two.', bold: false }] }]);
    expect(doc.sections).toHaveLength(1);
    const [steps, bullets, after] = doc.sections[0]!.blocks;
    expect(steps).toEqual({
      kind: 'steps',
      items: [
        [
          { text: 'Draw ', bold: false },
          { text: 'one', bold: true },
          { text: ' card.', bold: false },
        ],
        [{ text: 'Discard.', bold: false }],
      ],
    });
    expect(bullets).toMatchObject({ kind: 'bullets', items: [[{ text: 'a' }], [{ text: 'b' }]] });
    expect(after).toMatchObject({ kind: 'paragraph' });
  });

  it('rejects mistakes instead of showing them', () => {
    expect(() => parseInline('a **bold')).toThrow();
    expect(() => parseRules('no title')).toThrow();
    expect(() => parseRules('# T\n\n## Empty\n\n## Next\n\ntext')).toThrow(/empty section/);
    expect(() => parseRules('# T\n\n### Deep\n\ntext')).toThrow(/unsupported heading/);
  });
});

describe('rules content (spec/content/rules)', () => {
  it.each(RULES_GAMES)('%s has an intro, the order of play, special rules, and the on-screen help', (game) => {
    const { doc } = load(game);
    expect(doc.intro.length).toBeGreaterThan(0);
    const headings = doc.sections.map((s) => s.heading);
    expect(headings).toContain('Order of play');
    expect(headings).toContain('Winning');
    expect(headings).toContain('KardCoins');
    expect(headings[headings.length - 1]).toBe('Playing on this table');
    expect(headings.some((h) => h === 'Special rules' || h === 'FreeKards choices')).toBe(true);
    // Every section has text, and the order of play is a numbered list.
    expect(doc.sections.find((s) => s.heading === 'Order of play')!.blocks.some((b) => b.kind === 'steps')).toBe(true);
  });

  it('match the numbers Five-Card Draw uses', () => {
    const p = plain(load('five-card-draw').src);
    for (const st of Object.values(poker.STAKES)) {
      expect(p).toContain(`ante ${st.ante}, bets of ${st.smallBet} and ${st.bigBet}. Buy-in ${st.buyIn.toLocaleString('en-US')} (at least ${st.minBuyIn})`);
    }
    expect(p).toContain(`a bet and ${poker.RAISE_CAP} raises`);
    expect(p).toContain(`${poker.DRAW_HAND_SIZE} cards`);
  });

  it('match the numbers the game engines use', () => {
    const h = plain(load('hearts').src);
    expect(h).toContain(`reaches ${hearts.DEFAULT_TARGET_SCORE} or more`);
    expect(h).toContain(`every other player gets +${hearts.MOON_PENALTY}`);

    const s = plain(load('spades').src);
    expect(s).toContain(`${spades.DEFAULT_TARGET_SCORE} or 500`);
    expect(s).toContain(`${spades.MERCY_SCORE} or below`);
    expect(s).toContain(`collected ${spades.BAG_LIMIT} bags, it loses ${spades.BAG_PENALTY} points`);
    expect(s).toContain(`+${spades.NIL_POINTS} if the Nil bidder wins no tricks`);
    expect(spades.FIRST_DEALER).toBe(0); // "You deal the first hand"
    expect(s).toContain('You deal the first hand');

    const g = plain(load('gin').src);
    expect(g).toContain(`${gin.HAND_SIZE} cards`);
    expect(g).toContain(`deadwood after discarding is ${gin.KNOCK_LIMIT} or less`);
    expect(g).toContain(`the difference + ${gin.UNDERCUT_BONUS}`);
    expect(g).toContain(`deadwood + ${gin.GIN_BONUS}`);
    expect(g).toContain(`reaches ${gin.DEFAULT_GIN_TARGET} points`);
    expect(g).toContain(`+${gin.BOX_BONUS} for each hand`);
    expect(g).toContain(`+${gin.GAME_BONUS} for winning the game`);
    expect(g).toContain(`leaves only ${gin.DEAD_STOCK} cards in the stock`);
    expect(gin.FIRST_DEALER).toBe(1); // "The computer deals the first hand"
    expect(gin.ginValue('AS')).toBe(1);
    expect(gin.ginValue('KH')).toBe(10);

    const r = plain(load('rummy500').src);
    expect(r).toContain(`${rummy500.RUMMY500_HAND_SIZE} cards`);
    expect(r).toContain(`${rummy500.DEFAULT_RUMMY500_TARGET} or more`);
    expect(rummy500.RUMMY500_FIRST_DEALER).toBe(1);
    expect(rummy500.rummy500Value('AS')).toBe(15);
    expect(rummy500.rummy500Value('TS')).toBe(10);
    expect(rummy500.rummy500Value('9S')).toBe(9);

    // KardCoins for the 2-player games and Spades: 80 for a win, 10 for a loss (× difficulty), +25 per gin.
    for (const text of [s, g, r]) expect(text).toContain('A win earns 80 KardCoins and a loss 10');
    expect(twoPlayerPayout(true, 'easy', 0).total).toBe(80);
    expect(twoPlayerPayout(false, 'easy', 0).total).toBe(10);
    expect(twoPlayerPayout(true, 'easy', 1).total).toBe(105);
  });
});

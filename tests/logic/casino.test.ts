import { describe, expect, it } from 'vitest';
import { afterGame, backgroundRound, cashOut, heartsCredits, leaderboard, rebuy, recoverTable, regularLeaves, saveTable, seatRegular, sitDown, spadesCredits, syncRegulars, twoPlayerCredits, type Regular } from '../../src/logic/casino/index.js';
import { createProfile, normalizeProfilesFile, type Profile } from '../../src/logic/profile/profile.js';

const NOW = '2026-11-27T12:00:00.000Z';
const ROSTER: Regular[] = [
  { id: 'gus', skillAdjust: 0.1, risk: 0.3 },
  { id: 'dot', skillAdjust: 0.15, risk: 0.6 },
  { id: 'chad', skillAdjust: -0.15, risk: 0.9 },
  { id: 'marguerite', skillAdjust: 0.05, risk: 0.2 },
  { id: 'bernie', skillAdjust: -0.05, risk: 0.5 },
  { id: 'reginald', skillAdjust: 0, risk: 0.4 },
];
const fresh = (): Profile => syncRegulars(createProfile('Ann', 'ann-id', NOW), ROSTER);
/** Every coin on the books: the player, the regulars, and the table. */
const allCoins = (p: Profile) =>
  p.coins + Object.values(p.casino.regulars).reduce((a, b) => a + b, 0) + (p.casino.pokerTable ? p.casino.pokerTable.you + Object.values(p.casino.pokerTable.regulars).reduce((a, b) => a + b, 0) : 0);

describe('casino regulars (spec 15 §6)', () => {
  it('start everyone at 500, like the player', () => {
    const p = fresh();
    expect(Object.values(p.casino.regulars)).toEqual([500, 500, 500, 500, 500, 500]);
    expect(p.casino.rounds).toBe(0);
  });

  it('pays the regulars who played with the player, and plays a background round for the rest', () => {
    const p = afterGame(fresh(), ROSTER, heartsCredits([40, 80, 20, 60], ['gus', 'dot', 'chad'], 'medium'));
    expect(p.casino.regulars['gus']).toBe(500 + 8); // 4th place at Medium: round(5 × 1.5)
    expect(p.casino.regulars['dot']).toBe(500 + 150); // 1st (lowest score)
    expect(p.casino.regulars['chad']).toBe(500 + 23); // 3rd
    expect(p.casino.rounds).toBe(1);
    expect(p.casino.regulars['marguerite']).not.toBe(500);
  });

  it('credits Spades and two-player games by team and result', () => {
    expect(spadesCredits(true, 'dot', ['gus', 'chad'], 'hard')).toEqual([
      { id: 'dot', amount: 160 },
      { id: 'gus', amount: 20 },
      { id: 'chad', amount: 20 },
    ]);
    expect(twoPlayerCredits(true, 'gus', 'easy')).toEqual([{ id: 'gus', amount: 10 }]);
  });

  it('background rounds are deterministic, never go negative, and favor better players', () => {
    let a = fresh().casino;
    let b = fresh().casino;
    for (let i = 0; i < 400; i++) {
      a = backgroundRound('ann-id', a, ROSTER, new Set());
      b = backgroundRound('ann-id', b, ROSTER, new Set());
    }
    expect(a).toEqual(b);
    expect(Object.values(a.regulars).every((v) => v >= 0)).toBe(true);
    // Over many rounds everyone earns more than they lose, the best players most.
    expect(a.regulars['dot']!).toBeGreaterThan(a.regulars['chad']!);
    expect(Math.min(...Object.values(a.regulars))).toBeGreaterThan(500);
  });

  it('older profiles catch up one background round per finished game', () => {
    const old = createProfile('Bo', 'bo-id', NOW);
    const raw = { profiles: [{ ...old, casino: undefined, stats: { ...old.stats, hearts: { ...old.stats.hearts, gamesPlayed: 12 } } }] };
    const p = normalizeProfilesFile(raw).profiles[0]!;
    expect(p.casino.catchUp).toBe(12);
    const synced = syncRegulars(p, ROSTER);
    expect(synced.casino.rounds).toBe(12);
    expect(synced.casino.catchUp).toBe(0);
    expect(syncRegulars(synced, ROSTER)).toBe(synced);
  });

  it('lists the leaderboard richest first, counting chips at the table', () => {
    const p = sitDown(fresh(), 'medium', ['gus'], NOW);
    const board = leaderboard(p, ROSTER);
    expect(board).toHaveLength(7);
    expect(board.find((r) => r.id === null)!.coins).toBe(500);
    expect(board.find((r) => r.id === 'gus')!.coins).toBe(500);
  });
});

describe('poker chips and KardCoins (spec 15 §6.3)', () => {
  it('moves coins to the table and back without creating or losing any', () => {
    let p = fresh();
    const total = allCoins(p);
    p = sitDown(p, 'medium', ['gus', 'dot', 'chad'], NOW);
    expect(p.coins).toBe(300);
    expect(p.casino.pokerTable).toEqual({ stakes: 'medium', you: 200, regulars: { gus: 200, dot: 200, chad: 200 } });
    expect(allCoins(p)).toBe(total);
    // The player wins 150 from Gus and Chad over some hands.
    p = saveTable(p, 350, { gus: 100, dot: 200, chad: 150 });
    expect(allCoins(p)).toBe(total);
    p = regularLeaves(p, 'chad');
    const r = seatRegular(p, 'bernie')!;
    p = r.profile;
    expect(r.chips).toBe(200);
    expect(allCoins(p)).toBe(total);
    const out = cashOut(p, { broughtIn: 200, handsPlayed: 10, handsWon: 4, biggestPot: 90, bestHand: { score: 5, name: 'Flush, Ace high' }, regularIds: ['gus', 'dot', 'chad', 'bernie'] }, ROSTER, NOW);
    expect(out.net).toBe(150);
    expect(out.profile.coins).toBe(650);
    expect(out.profile.casino.pokerTable).toBeNull();
    expect(out.profile.stats.fiveCardDraw).toMatchObject({ sessions: 1, handsPlayed: 10, handsWon: 4, netCoins: 150, bestSession: 150, biggestPot: 90 });
    expect(out.profile.ledger[0]).toMatchObject({ amount: 350, reason: 'Five-Card Draw: cashed out' });
  });

  it('buys in with the whole balance if it is below the buy-in, and refuses below the minimum', () => {
    const p = { ...fresh(), coins: 80 };
    expect(sitDown(p, 'low', [], NOW).casino.pokerTable!.you).toBe(80);
    expect(() => sitDown({ ...p, coins: 20 }, 'low', [], NOW)).toThrow();
    expect(() => sitDown(p, 'medium', [], NOW)).not.toThrow();
    expect(() => sitDown(p, 'high', [], NOW)).toThrow();
  });

  it('sells more chips from the balance', () => {
    let p = sitDown(fresh(), 'medium', ['gus'], NOW);
    p = saveTable(p, 0, { gus: 400 });
    const r = rebuy(p, NOW)!;
    expect(r.chips).toBe(200);
    expect(r.profile.coins).toBe(100);
    expect(rebuy({ ...r.profile, coins: 10 }, NOW)).toBeNull();
  });

  it('returns chips from a game the app closed in the middle of', () => {
    let p = sitDown(fresh(), 'medium', ['gus', 'dot'], NOW);
    const total = allCoins(p);
    p = saveTable(p, 260, { gus: 140, dot: 200 });
    const q = recoverTable(p, NOW);
    expect(q.casino.pokerTable).toBeNull();
    expect(q.coins).toBe(560);
    expect(q.casino.regulars['gus']).toBe(440);
    expect(allCoins(q)).toBe(total);
  });
});

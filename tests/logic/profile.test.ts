import { describe, expect, it } from 'vitest';
import {
  LEDGER_MAX,
  NAME_MAX,
  WELCOME_COINS,
  cleanName,
  createProfile,
  heartsPayout,
  heartsPlaces,
  normalizeProfilesFile,
  recordHeartsGame,
  winRate,
} from '../../src/logic/profile/profile.js';

const NOW = '2026-11-24T12:00:00.000Z';

describe('profiles', () => {
  it('creates a profile with the welcome bonus in the ledger', () => {
    const p = createProfile('  Mary   Ann ', 'id1', NOW);
    expect(p.name).toBe('Mary Ann');
    expect(p.coins).toBe(WELCOME_COINS);
    expect(p.ledger).toEqual([{ at: NOW, amount: 500, reason: 'Welcome bonus' }]);
    expect(p.stats.hearts.gamesPlayed).toBe(0);
  });

  it('rejects empty names and caps long ones', () => {
    expect(cleanName('   ')).toBeNull();
    expect(() => createProfile(' ', 'x', NOW)).toThrow();
    expect(cleanName('x'.repeat(50))).toHaveLength(NAME_MAX);
  });
});

describe('Hearts placing and payout (D-050)', () => {
  it('ranks lower scores first and shares tied places', () => {
    expect(heartsPlaces([40, 101, 12, 66])).toEqual([2, 4, 1, 3]);
    expect(heartsPlaces([30, 30, 10, 99])).toEqual([2, 2, 1, 4]);
  });

  it('pays placing × difficulty plus moon bonuses', () => {
    expect(heartsPayout(1, 'easy', 0).total).toBe(100);
    expect(heartsPayout(1, 'medium', 0).total).toBe(150);
    expect(heartsPayout(1, 'hard', 0).total).toBe(200);
    expect(heartsPayout(2, 'medium', 0).total).toBe(60);
    expect(heartsPayout(3, 'medium', 0).total).toBe(23); // 22.5 rounds up
    expect(heartsPayout(4, 'hard', 0).total).toBe(10);
    expect(heartsPayout(2, 'hard', 2).total).toBe(80 + 50);
  });
});

describe('recording a Hearts game', () => {
  it('updates stats, streaks, coins, and the ledger', () => {
    let p = createProfile('Ann', 'a', NOW);
    const win = { finalScores: [20, 104, 55, 70], handsPlayed: 9, moonsShot: 1, queensTaken: 2, difficulty: 'hard' as const };
    const r1 = recordHeartsGame(p, win, NOW);
    p = r1.profile;
    expect(r1.payout.total).toBe(200 + 25);
    expect(p.coins).toBe(500 + 225);
    expect(p.ledger[0]).toEqual({ at: NOW, amount: 225, reason: 'Hearts: 1st place (Hard) + 1 moon' });
    expect(p.stats.hearts).toMatchObject({ gamesPlayed: 1, gamesWon: 1, placings: [1, 0, 0, 0], handsPlayed: 9, moonsShot: 1, queensTaken: 2, bestScore: 20, worstScore: 20, currentWinStreak: 1, bestWinStreak: 1, coinsEarned: 225 });

    p = recordHeartsGame(p, { ...win, moonsShot: 0, finalScores: [20, 10, 30, 101] }, NOW).profile;
    p = recordHeartsGame(p, { ...win, moonsShot: 0, finalScores: [5, 10, 30, 101] }, NOW).profile;
    expect(p.stats.hearts).toMatchObject({ gamesPlayed: 3, gamesWon: 2, placings: [2, 1, 0, 0], currentWinStreak: 1, bestWinStreak: 1, bestScore: 5 });
    expect(winRate(p.stats.hearts)).toBeCloseTo(2 / 3);
  });

  it('never mutates its input and caps the ledger', () => {
    const p0 = createProfile('Ann', 'a', NOW);
    const frozen = JSON.stringify(p0);
    let p = p0;
    for (let i = 0; i < LEDGER_MAX + 10; i++) {
      p = recordHeartsGame(p, { finalScores: [1, 2, 3, 4], handsPlayed: 1, moonsShot: 0, queensTaken: 0, difficulty: 'easy' }, NOW).profile;
    }
    expect(JSON.stringify(p0)).toBe(frozen);
    expect(p.ledger).toHaveLength(LEDGER_MAX);
    expect(p.coins).toBe(500 + 100 * (LEDGER_MAX + 10));
  });
});

describe('loading profiles from disk', () => {
  it('repairs bad data instead of crashing', () => {
    expect(normalizeProfilesFile(null).profiles).toEqual([]);
    const f = normalizeProfilesFile({
      activeProfileId: 'missing',
      profiles: [{ id: 'a', name: 'Ann', coins: -5 }, { id: 'b', name: '' }, { name: 'no id' }, { id: 'c', name: 'Cy', coins: 12.7, stats: { hearts: { gamesWon: 3 } } }],
    });
    expect(f.profiles.map((p) => p.id)).toEqual(['a', 'c']);
    expect(f.activeProfileId).toBe('a');
    expect(f.profiles[0]!.coins).toBe(0);
    expect(f.profiles[1]!.coins).toBe(12);
    expect(f.profiles[1]!.stats.hearts.gamesWon).toBe(3);
    expect(f.profiles[1]!.stats.hearts.gamesPlayed).toBe(0);
  });
});

describe('Spades stats and payout (D-073)', () => {
  it('pays win or loss × difficulty plus Nil bonuses', async () => {
    const { spadesPayout } = await import('../../src/logic/profile/profile.js');
    expect(spadesPayout(true, 'easy', 0).total).toBe(80);
    expect(spadesPayout(true, 'medium', 1).total).toBe(145);
    expect(spadesPayout(false, 'hard', 0).total).toBe(20);
  });

  it('records a game, streaks, and a ledger entry', async () => {
    const { recordSpadesGame } = await import('../../src/logic/profile/profile.js');
    const p0 = createProfile('Ann', 'a', NOW);
    const g = { won: true, teamScore: 312, handsPlayed: 8, contractsBid: 8, contractsMade: 7, nilsBid: 1, nilsMade: 1, difficulty: 'medium' as const };
    const r1 = recordSpadesGame(p0, g, NOW);
    expect(r1.profile.stats.spades).toMatchObject({ gamesPlayed: 1, gamesWon: 1, currentWinStreak: 1, bestScore: 312, nilsMade: 1, coinsEarned: 145 });
    expect(r1.profile.coins).toBe(WELCOME_COINS + 145);
    expect(r1.profile.ledger[0]!.reason).toBe('Spades: won (Medium) + 1 Nil');
    const r2 = recordSpadesGame(r1.profile, { ...g, won: false, teamScore: 150, nilsMade: 0 }, NOW);
    expect(r2.profile.stats.spades).toMatchObject({ gamesPlayed: 2, gamesWon: 1, currentWinStreak: 0, bestWinStreak: 1, bestScore: 312 });
    expect(r2.profile.stats.hearts.gamesPlayed).toBe(0);
  });

  it('repairs profiles saved before Spades existed', () => {
    const p = createProfile('Old', 'o', NOW) as unknown as Record<string, unknown>;
    const old = { ...p, stats: { hearts: (p as { stats: { hearts: unknown } }).stats.hearts }, prefs: { hearts: { difficulty: 'hard' } } };
    const f = normalizeProfilesFile({ schemaVersion: 1, activeProfileId: 'o', profiles: [old] });
    expect(f.profiles[0]!.stats.spades.gamesPlayed).toBe(0);
    expect(f.profiles[0]!.prefs.spades).toEqual({ difficulty: 'medium', targetScore: 300, players: null });
    expect(f.profiles[0]!.prefs.hearts.difficulty).toBe('hard');
  });
});

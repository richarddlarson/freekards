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

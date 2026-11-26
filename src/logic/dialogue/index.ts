export * from './types.js';
export * from './director.js';
export * from './hearts-triggers.js';
export * from './spades-triggers.js';
export * from './rummy-triggers.js';
import { KNOWN_TRIGGERS } from './hearts-triggers.js';
import { SPADES_TRIGGERS } from './spades-triggers.js';
import { RUMMY_TRIGGERS } from './rummy-triggers.js';

/** Every trigger a character file may use, across all games (validated by tests). */
export const ALL_TRIGGERS: readonly string[] = [...KNOWN_TRIGGERS, ...SPADES_TRIGGERS, ...RUMMY_TRIGGERS];

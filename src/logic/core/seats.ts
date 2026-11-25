/** Seats for 4-player games (spec 10 §2): clockwise play order, South is always the human player. */
export const SEATS = [0, 1, 2, 3] as const;
export type Seat = (typeof SEATS)[number];
export const SEAT_NAMES: Readonly<Record<Seat, 'south' | 'west' | 'north' | 'east'>> = {
  0: 'south',
  1: 'west',
  2: 'north',
  3: 'east',
};
export const HUMAN_SEAT: Seat = 0;

/** The seat `steps` places clockwise from `seat`. */
export function nextSeat(seat: Seat, steps = 1): Seat {
  return ((((seat + steps) % 4) + 4) % 4) as Seat;
}

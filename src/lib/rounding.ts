import { DECK, type CardValue, type Results } from "./types";

export { DECK };

/**
 * Rounds the average to a whole number (.5 goes up), then moves up to the
 * next deck card if that number isn't on the deck:
 * 1.5 → 2, 2.4 → 2, 3.5 → 4 → 5, 5.5 → 6 → 8.
 */
export function roundToDeck(value: number): CardValue {
  const whole = Math.round(value);
  return DECK.find((card) => card >= whole) ?? DECK[DECK.length - 1];
}

export function isConsensus(votes: readonly CardValue[]): boolean {
  return votes.length >= 2 && votes.every((v) => v === votes[0]);
}

export function computeResults(votes: readonly CardValue[]): Results | null {
  if (votes.length === 0) return null;
  const distribution = Object.fromEntries(DECK.map((c) => [c, 0])) as Record<CardValue, number>;
  let sum = 0;
  for (const v of votes) {
    distribution[v] += 1;
    sum += v;
  }
  const mean = sum / votes.length;
  return {
    average: Math.round(mean * 100) / 100,
    rounded: roundToDeck(mean),
    distribution,
    voters: votes.length,
    consensus: isConsensus(votes),
  };
}

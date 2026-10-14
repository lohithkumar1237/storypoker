import { DECK, type CardValue, type Results } from "./types";

export { DECK };

/** Nearest deck card to `value`. An exact tie between two cards rounds up. */
export function roundToDeck(value: number): CardValue {
  let best: CardValue = DECK[0];
  let bestDistance = Infinity;
  for (const card of DECK) {
    const distance = Math.abs(card - value);
    // `<=` lets the later (larger) card win a tie.
    if (distance <= bestDistance) {
      best = card;
      bestDistance = distance;
    }
  }
  return best;
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

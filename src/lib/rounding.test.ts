import { describe, expect, it } from "vitest";
import { computeResults, isConsensus, roundToDeck } from "./rounding";

describe("roundToDeck", () => {
  it("returns exact deck values unchanged", () => {
    for (const card of [1, 2, 3, 5, 8] as const) expect(roundToDeck(card)).toBe(card);
  });

  it("rounds .5 and above up, below .5 down", () => {
    expect(roundToDeck(1.5)).toBe(2);
    expect(roundToDeck(1.49)).toBe(1);
    expect(roundToDeck(2.4)).toBe(2);
    expect(roundToDeck(2.5)).toBe(3);
  });

  it("moves up to the next card when the whole number isn't on the deck", () => {
    expect(roundToDeck(3.5)).toBe(5);
    expect(roundToDeck(4)).toBe(5);
    expect(roundToDeck(5.5)).toBe(8);
    expect(roundToDeck(7)).toBe(8);
  });

  it("stays on the lower card below .5", () => {
    expect(roundToDeck(3.4)).toBe(3);
    expect(roundToDeck(5.4)).toBe(5);
  });

  it("clamps values outside the deck", () => {
    expect(roundToDeck(0)).toBe(1);
    expect(roundToDeck(20)).toBe(8);
  });
});

describe("isConsensus", () => {
  it("needs at least two voters", () => {
    expect(isConsensus([])).toBe(false);
    expect(isConsensus([5])).toBe(false);
  });

  it("is true only when every vote matches", () => {
    expect(isConsensus([3, 3, 3])).toBe(true);
    expect(isConsensus([3, 3, 5])).toBe(false);
  });
});

describe("computeResults", () => {
  it("returns null with no votes", () => {
    expect(computeResults([])).toBeNull();
  });

  it("computes the average, rounded card and distribution", () => {
    const r = computeResults([1, 2, 3, 5, 8, 8]);
    expect(r).not.toBeNull();
    expect(r!.average).toBe(4.5);
    expect(r!.rounded).toBe(5);
    expect(r!.voters).toBe(6);
    expect(r!.distribution).toEqual({ 1: 1, 2: 1, 3: 1, 5: 1, 8: 2 });
    expect(r!.consensus).toBe(false);
  });

  it("rounds the average to two decimals for display", () => {
    expect(computeResults([1, 1, 2])!.average).toBe(1.33);
  });

  it("flags consensus", () => {
    const r = computeResults([5, 5]);
    expect(r!.consensus).toBe(true);
    expect(r!.rounded).toBe(5);
  });

  it("rounds a 3.5 average up to 5", () => {
    expect(computeResults([2, 5])!.rounded).toBe(5);
  });
});

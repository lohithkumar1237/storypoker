import { describe, expect, it } from "vitest";
import { buildRoomState, type RoomSnapshot } from "./view";

function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    id: "abcd1234",
    story: "Login page",
    revealed: false,
    members: [
      { id: "aaaaaa", name: "Ann", isAdmin: true, online: true, vote: 3 },
      { id: "bbbbbb", name: "Bob", isAdmin: false, online: false, vote: 8 },
      { id: "cccccc", name: "Cat", isAdmin: false, online: true, vote: null },
    ],
    ...overrides,
  };
}

describe("buildRoomState", () => {
  it("hides other people's votes before reveal", () => {
    const state = buildRoomState(room(), "aaaaaa");
    expect(state.participants.map((p) => p.vote)).toEqual([3, null, null]);
  });

  it("still reports who has voted before reveal", () => {
    const state = buildRoomState(room(), "cccccc");
    expect(state.participants.map((p) => p.hasVoted)).toEqual([true, true, false]);
    expect(state.participants.every((p) => p.vote === null)).toBe(true);
  });

  it("withholds results before reveal", () => {
    expect(buildRoomState(room(), "aaaaaa").results).toBeNull();
  });

  it("shows every vote and the results after reveal", () => {
    const state = buildRoomState(room({ revealed: true }), "cccccc");
    expect(state.participants.map((p) => p.vote)).toEqual([3, 8, null]);
    expect(state.results?.voters).toBe(2);
    expect(state.results?.average).toBe(5.5);
  });

  it("copies room fields", () => {
    const state = buildRoomState(room(), "aaaaaa");
    expect(state.roomId).toBe("abcd1234");
    expect(state.story).toBe("Login page");
    expect(state.participants[1]).toMatchObject({ name: "Bob", isAdmin: false, online: false });
  });

  it("never includes fields beyond the public participant shape", () => {
    const state = buildRoomState(room(), "aaaaaa");
    for (const p of state.participants) {
      expect(Object.keys(p).sort()).toEqual(["hasVoted", "id", "isAdmin", "name", "online", "vote"]);
    }
  });
});

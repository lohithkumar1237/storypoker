import { describe, expect, it } from "vitest";
import { cleanName, cleanTitle, parseClientMessage, parseServerMessage } from "./protocol";

const CLIENT = "client-123456";
const parse = (v: unknown) => parseClientMessage(JSON.stringify(v));

describe("parseClientMessage", () => {
  it("rejects non-JSON, non-objects and unknown types", () => {
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage("[1,2]")).toBeNull();
    expect(parseClientMessage(42)).toBeNull();
    expect(parse({ type: "HACK" })).toBeNull();
  });

  it("accepts CREATE and cleans the name", () => {
    expect(parse({ type: "CREATE", clientId: CLIENT, name: "  Ann   Lee " })).toEqual({
      type: "CREATE",
      clientId: CLIENT,
      name: "Ann Lee",
    });
  });

  it("rejects blank names", () => {
    expect(parse({ type: "CREATE", clientId: CLIENT, name: "   " })).toBeNull();
  });

  it("enforces client id length", () => {
    expect(parse({ type: "CREATE", clientId: "short", name: "Ann" })).toBeNull();
    expect(parse({ type: "CREATE", clientId: "x".repeat(65), name: "Ann" })).toBeNull();
    expect(parse({ type: "CREATE", clientId: "x".repeat(64), name: "Ann" })).not.toBeNull();
  });

  it("enforces the room id format on JOIN", () => {
    expect(parse({ type: "JOIN", roomId: "abcd1234", clientId: CLIENT, name: "Ann" })).not.toBeNull();
    expect(parse({ type: "JOIN", roomId: "ABCD1234", clientId: CLIENT, name: "Ann" })).toBeNull();
    expect(parse({ type: "JOIN", roomId: "abc", clientId: CLIENT, name: "Ann" })).toBeNull();
  });

  it("only accepts deck values for VOTE", () => {
    expect(parse({ type: "VOTE", value: 5 })).toEqual({ type: "VOTE", value: 5 });
    expect(parse({ type: "VOTE", value: 4 })).toBeNull();
    expect(parse({ type: "VOTE", value: "5" })).toBeNull();
  });

  it("caps story titles at 200 characters", () => {
    const msg = parse({ type: "SET_STORY", title: "a".repeat(300) });
    expect(msg).toEqual({ type: "SET_STORY", title: "a".repeat(200) });
  });

  it("accepts REVEAL, CLEAR and KICK", () => {
    expect(parse({ type: "REVEAL" })).toEqual({ type: "REVEAL" });
    expect(parse({ type: "CLEAR" })).toEqual({ type: "CLEAR" });
    expect(parse({ type: "KICK", participantId: "abc123" })).toEqual({ type: "KICK", participantId: "abc123" });
    expect(parse({ type: "KICK" })).toBeNull();
  });
});

describe("REACT", () => {
  it("accepts only the listed emoji", () => {
    expect(parse({ type: "REACT", participantId: "abc123", emoji: "🎉" })).toEqual({
      type: "REACT",
      participantId: "abc123",
      emoji: "🎉",
    });
    expect(parse({ type: "REACT", participantId: "abc123", emoji: "💩" })).toBeNull();
    expect(parse({ type: "REACT", participantId: "abc123", emoji: "<img src=x>" })).toBeNull();
    expect(parse({ type: "REACT", emoji: "🎉" })).toBeNull();
  });
});

describe("cleaning", () => {
  it("caps names at 30 characters", () => {
    expect(cleanName("b".repeat(40))).toHaveLength(30);
  });

  it("collapses whitespace in titles", () => {
    expect(cleanTitle("  As a\nuser\t  I want ")).toBe("As a user I want");
  });
});

describe("parseServerMessage", () => {
  it("parses known messages and drops the rest", () => {
    expect(parseServerMessage(JSON.stringify({ type: "CREATED", roomId: "abcd1234" }))).toEqual({
      type: "CREATED",
      roomId: "abcd1234",
    });
    expect(parseServerMessage(JSON.stringify({ type: "KICKED" }))).toEqual({ type: "KICKED" });
    expect(parseServerMessage(JSON.stringify({ type: "STATE_SYNC", selfId: "x" }))).toBeNull();
    expect(parseServerMessage("{")).toBeNull();
  });
});

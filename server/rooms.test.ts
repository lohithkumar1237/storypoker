import { beforeEach, describe, expect, it } from "vitest";
import type { ServerMessage } from "../src/lib/protocol";
import { IDLE_ROOM_MS, type RoomState } from "../src/lib/types";
import { RoomManager, type Connection } from "./rooms";

class FakeConn implements Connection {
  messages: ServerMessage[] = [];
  closed = false;
  send(msg: ServerMessage) {
    this.messages.push(msg);
  }
  close() {
    this.closed = true;
  }
  last<T extends ServerMessage["type"]>(type: T): Extract<ServerMessage, { type: T }> | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].type === type) return this.messages[i] as Extract<ServerMessage, { type: T }>;
    }
    return undefined;
  }
  state(): RoomState {
    const sync = this.last("STATE_SYNC");
    if (!sync) throw new Error("no STATE_SYNC received");
    return sync.state;
  }
  selfId(): string {
    return this.last("STATE_SYNC")!.selfId;
  }
}

const ADMIN = "admin-client-1";
const BOB = "bob-client-0001";
const CAT = "cat-client-0001";

let now: number;
let mgr: RoomManager;
let roomId: string;
let admin: FakeConn;

function join(clientId: string, name: string, conn = new FakeConn()) {
  mgr.handle(conn, { type: "JOIN", roomId, clientId, name });
  return conn;
}

beforeEach(() => {
  now = 1_000_000;
  let n = 0;
  mgr = new RoomManager({ now: () => now, newMemberId: () => `m${String(n++).padStart(5, "0")}` });
  admin = new FakeConn();
  mgr.handle(admin, { type: "CREATE", clientId: ADMIN, name: "Ann" });
  roomId = admin.last("CREATED")!.roomId;
});

describe("RoomManager", () => {
  it("creates a room with the creator as its admin", () => {
    expect(roomId).toMatch(/^[a-z0-9]{8}$/);
    const state = admin.state();
    expect(state.participants).toHaveLength(1);
    expect(state.participants[0]).toMatchObject({ name: "Ann", isAdmin: true, online: true });
  });

  it("replies NOT_FOUND for an unknown room", () => {
    const conn = new FakeConn();
    mgr.handle(conn, { type: "JOIN", roomId: "zzzzzzzz", clientId: BOB, name: "Bob" });
    expect(conn.messages).toEqual([{ type: "NOT_FOUND" }]);
  });

  it("adds joiners as non-admins and syncs everyone", () => {
    const bob = join(BOB, "Bob");
    expect(bob.state().participants.map((p) => [p.name, p.isAdmin])).toEqual([
      ["Ann", true],
      ["Bob", false],
    ]);
    expect(admin.state().participants).toHaveLength(2);
  });

  it("keeps votes secret until reveal and never broadcasts client ids", () => {
    const bob = join(BOB, "Bob");
    mgr.handle(bob, { type: "VOTE", value: 8 });
    const adminView = admin.state();
    expect(adminView.participants.find((p) => p.name === "Bob")).toMatchObject({ hasVoted: true, vote: null });
    expect(bob.state().participants.find((p) => p.name === "Bob")?.vote).toBe(8);
    const wire = JSON.stringify([...admin.messages, ...bob.messages]);
    expect(wire).not.toContain(BOB);
    expect(wire).not.toContain(ADMIN);
  });

  it("lets votes change until reveal, then ignores them until clear", () => {
    const bob = join(BOB, "Bob");
    mgr.handle(bob, { type: "VOTE", value: 2 });
    mgr.handle(bob, { type: "VOTE", value: 5 });
    mgr.handle(admin, { type: "REVEAL" });
    expect(admin.state().results?.average).toBe(5);

    mgr.handle(bob, { type: "VOTE", value: 1 });
    expect(admin.state().participants.find((p) => p.name === "Bob")?.vote).toBe(5);

    mgr.handle(admin, { type: "CLEAR" });
    expect(admin.state().revealed).toBe(false);
    expect(admin.state().participants.every((p) => !p.hasVoted)).toBe(true);
    mgr.handle(bob, { type: "VOTE", value: 1 });
    expect(bob.state().participants.find((p) => p.name === "Bob")?.vote).toBe(1);
  });

  it("silently ignores admin actions from non-admins", () => {
    const bob = join(BOB, "Bob");
    const cat = join(CAT, "Cat");
    mgr.handle(admin, { type: "VOTE", value: 3 });
    const before = bob.messages.length;
    mgr.handle(bob, { type: "REVEAL" });
    mgr.handle(bob, { type: "SET_STORY", title: "Hijack" });
    mgr.handle(bob, { type: "KICK", participantId: cat.selfId() });
    mgr.handle(bob, { type: "CLEAR" });
    expect(bob.messages.length).toBe(before);
    expect(admin.state()).toMatchObject({ revealed: false, story: "" });
    expect(admin.state().participants).toHaveLength(3);
  });

  it("does not reveal before anyone has voted", () => {
    join(BOB, "Bob");
    mgr.handle(admin, { type: "REVEAL" });
    expect(admin.state().revealed).toBe(false);
  });

  it("lets the admin set the story", () => {
    const bob = join(BOB, "Bob");
    mgr.handle(admin, { type: "SET_STORY", title: "Checkout flow" });
    expect(bob.state().story).toBe("Checkout flow");
  });

  it("rebinds a reconnect to the same seat, keeps the vote and closes the old socket", () => {
    const bob1 = join(BOB, "Bob");
    mgr.handle(bob1, { type: "VOTE", value: 3 });
    const id = bob1.selfId();

    const bob2 = join(BOB, "Bob");
    expect(bob1.closed).toBe(true);
    expect(bob2.selfId()).toBe(id);
    expect(bob2.state().participants).toHaveLength(2);
    expect(bob2.state().participants.find((p) => p.id === id)?.vote).toBe(3);

    // The retired socket's close event must not mark the seat offline.
    mgr.disconnect(bob1);
    expect(admin.state().participants.find((p) => p.id === id)?.online).toBe(true);
  });

  it("marks a disconnected member offline but keeps their seat", () => {
    const bob = join(BOB, "Bob");
    mgr.disconnect(bob);
    const p = admin.state().participants.find((x) => x.name === "Bob");
    expect(p?.online).toBe(false);
    join(BOB, "Bob");
    expect(admin.state().participants.find((x) => x.name === "Bob")?.online).toBe(true);
  });

  it("kicks a member, tells them, and refuses their client id afterwards", () => {
    const bob = join(BOB, "Bob");
    mgr.handle(admin, { type: "KICK", participantId: bob.selfId() });
    expect(bob.last("KICKED")).toBeDefined();
    expect(bob.closed).toBe(true);
    expect(admin.state().participants.map((p) => p.name)).toEqual(["Ann"]);

    const again = join(BOB, "Bob");
    expect(again.messages).toEqual([{ type: "KICKED" }]);
    expect(again.closed).toBe(true);
    expect(admin.state().participants).toHaveLength(1);
  });

  it("does not let the admin kick themselves", () => {
    mgr.handle(admin, { type: "KICK", participantId: admin.selfId() });
    expect(admin.last("KICKED")).toBeUndefined();
    expect(admin.state().participants).toHaveLength(1);
  });

  it("never grants admin to a joiner, and the admin keeps the seat on reconnect", () => {
    const bob = join(BOB, "Bob");
    expect(bob.state().participants.filter((p) => p.isAdmin).map((p) => p.name)).toEqual(["Ann"]);

    mgr.disconnect(admin);
    const admin2 = join(ADMIN, "Ann");
    expect(admin2.state().participants.find((p) => p.id === admin2.selfId())?.isAdmin).toBe(true);
  });

  it("relays a reaction to everyone connected without changing state", () => {
    const bob = join(BOB, "Bob");
    const cat = join(CAT, "Cat");
    const syncsBefore = cat.messages.filter((m) => m.type === "STATE_SYNC").length;
    mgr.handle(bob, { type: "REACT", participantId: admin.selfId(), emoji: "👍" });
    const expected = { type: "REACTION", participantId: admin.selfId(), fromId: bob.selfId(), emoji: "👍" };
    for (const conn of [admin, bob, cat]) expect(conn.last("REACTION")).toEqual(expected);
    expect(cat.messages.filter((m) => m.type === "STATE_SYNC").length).toBe(syncsBefore);
  });

  it("ignores reactions to unknown participants, from outsiders, and too fast in a row", () => {
    const bob = join(BOB, "Bob");
    mgr.handle(bob, { type: "REACT", participantId: "nobody", emoji: "👍" });
    mgr.handle(new FakeConn(), { type: "REACT", participantId: bob.selfId(), emoji: "👍" });
    expect(admin.last("REACTION")).toBeUndefined();

    mgr.handle(bob, { type: "REACT", participantId: admin.selfId(), emoji: "🔥" });
    mgr.handle(bob, { type: "REACT", participantId: admin.selfId(), emoji: "😂" });
    expect(admin.messages.filter((m) => m.type === "REACTION")).toHaveLength(1);
    now += 250;
    mgr.handle(bob, { type: "REACT", participantId: admin.selfId(), emoji: "😂" });
    expect(admin.messages.filter((m) => m.type === "REACTION")).toHaveLength(2);
  });

  it("never closes a room while anyone is connected", () => {
    join(BOB, "Bob");
    for (let i = 0; i < 5; i++) {
      now += IDLE_ROOM_MS;
      mgr.sweep();
    }
    expect(mgr.roomCount).toBe(1);
  });

  it("deletes a room after an hour with nobody connected", () => {
    const bob = join(BOB, "Bob");
    mgr.disconnect(admin);
    mgr.disconnect(bob);
    mgr.sweep();
    now += IDLE_ROOM_MS - 1;
    mgr.sweep();
    expect(mgr.roomCount).toBe(1);

    now += 1;
    mgr.sweep();
    expect(mgr.roomCount).toBe(0);
    expect(join(CAT, "Cat").messages).toEqual([{ type: "NOT_FOUND" }]);
  });

  it("restarts the idle clock when someone comes back", () => {
    mgr.disconnect(admin);
    mgr.sweep();
    now += IDLE_ROOM_MS - 1;
    join(ADMIN, "Ann");
    mgr.sweep();
    mgr.disconnect(admin);
    now += 1;
    mgr.sweep();
    expect(mgr.roomCount).toBe(1);
  });
});

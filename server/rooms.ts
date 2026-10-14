import { customAlphabet, nanoid } from "nanoid";
import type { ClientMessage, ServerMessage } from "../src/lib/protocol";
import { IDLE_ROOM_MS, REACTION_COOLDOWN_MS, type CardValue } from "../src/lib/types";
import { buildRoomState } from "../src/lib/view";

/** Anything that can carry server messages to one client. A WebSocket in production, a stub in tests. */
export interface Connection {
  send(msg: ServerMessage): void;
  close(): void;
}

interface Member {
  /** Public id, safe to broadcast. */
  id: string;
  /** Secret seat key. Never leaves the server. */
  clientId: string;
  name: string;
  vote: CardValue | null;
  conn: Connection | null;
  lastReactionAt: number;
}

interface Room {
  id: string;
  adminClientId: string;
  story: string;
  revealed: boolean;
  /** Keyed by client id, in join order. */
  members: Map<string, Member>;
  kicked: Set<string>;
  /** When the last connected member left, or null while anyone is connected. */
  emptySince: number | null;
}

interface Binding {
  roomId: string;
  clientId: string;
}

export interface RoomManagerOptions {
  now?: () => number;
  newRoomId?: () => string;
  newMemberId?: () => string;
}

const defaultRoomId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);
const defaultMemberId = () => nanoid(6);

/**
 * Owns every room and enforces all the rules. Transport-agnostic: callers
 * feed it validated messages and disconnects, and it replies through
 * `Connection`s.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly bindings = new Map<Connection, Binding>();
  private readonly now: () => number;
  private readonly newRoomId: () => string;
  private readonly newMemberId: () => string;

  constructor(options: RoomManagerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.newRoomId = options.newRoomId ?? defaultRoomId;
    this.newMemberId = options.newMemberId ?? defaultMemberId;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  handle(conn: Connection, msg: ClientMessage): void {
    switch (msg.type) {
      case "CREATE":
        return this.create(conn, msg.clientId, msg.name);
      case "JOIN":
        return this.join(conn, msg.roomId, msg.clientId, msg.name);
    }

    const ctx = this.context(conn);
    if (!ctx) return;
    const { room, member } = ctx;
    const isAdmin = member.clientId === room.adminClientId;

    switch (msg.type) {
      case "VOTE":
        if (room.revealed) return;
        member.vote = msg.value;
        break;
      case "REVEAL":
        if (!isAdmin || room.revealed || !hasVotes(room)) return;
        room.revealed = true;
        break;
      case "CLEAR":
        if (!isAdmin) return;
        for (const m of room.members.values()) m.vote = null;
        room.revealed = false;
        break;
      case "SET_STORY":
        if (!isAdmin) return;
        room.story = msg.title;
        break;
      case "REACT": {
        // Reactions are fleeting: relayed to everyone connected, never stored.
        const target = [...room.members.values()].find((m) => m.id === msg.participantId);
        const now = this.now();
        if (!target || now - member.lastReactionAt < REACTION_COOLDOWN_MS) return;
        member.lastReactionAt = now;
        for (const m of room.members.values()) {
          m.conn?.send({ type: "REACTION", participantId: target.id, fromId: member.id, emoji: msg.emoji });
        }
        return;
      }
      case "KICK": {
        if (!isAdmin) return;
        const target = [...room.members.values()].find((m) => m.id === msg.participantId);
        if (!target || target.clientId === room.adminClientId) return;
        room.members.delete(target.clientId);
        room.kicked.add(target.clientId);
        if (target.conn) {
          this.bindings.delete(target.conn);
          target.conn.send({ type: "KICKED" });
          target.conn.close();
        }
        break;
      }
    }
    this.broadcast(room);
  }

  disconnect(conn: Connection): void {
    const binding = this.bindings.get(conn);
    if (!binding) return;
    this.bindings.delete(conn);
    const room = this.rooms.get(binding.roomId);
    const member = room?.members.get(binding.clientId);
    if (room && member?.conn === conn) {
      member.conn = null;
      this.broadcast(room);
    }
  }

  /**
   * Deletes rooms nobody has been connected to for `IDLE_ROOM_MS`, so memory
   * doesn't fill with abandoned rooms. Called on a timer by the server.
   */
  sweep(): void {
    const now = this.now();
    for (const room of this.rooms.values()) {
      const anyoneConnected = [...room.members.values()].some((m) => m.conn !== null);
      if (anyoneConnected) room.emptySince = null;
      else if (room.emptySince === null) room.emptySince = now;
      else if (now - room.emptySince >= IDLE_ROOM_MS) this.rooms.delete(room.id);
    }
  }

  private create(conn: Connection, clientId: string, name: string): void {
    this.detach(conn);
    let id = this.newRoomId();
    while (this.rooms.has(id)) id = this.newRoomId();
    const room: Room = {
      id,
      adminClientId: clientId,
      story: "",
      revealed: false,
      members: new Map(),
      kicked: new Set(),
      emptySince: null,
    };
    room.members.set(clientId, { id: this.newMemberId(), clientId, name, vote: null, conn, lastReactionAt: 0 });
    this.rooms.set(id, room);
    this.bindings.set(conn, { roomId: id, clientId });
    conn.send({ type: "CREATED", roomId: id });
    this.broadcast(room);
  }

  private join(conn: Connection, roomId: string, clientId: string, name: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return conn.send({ type: "NOT_FOUND" });
    if (room.kicked.has(clientId)) {
      conn.send({ type: "KICKED" });
      return conn.close();
    }

    const current = this.bindings.get(conn);
    if (current && (current.roomId !== roomId || current.clientId !== clientId)) this.detach(conn);

    const existing = room.members.get(clientId);
    if (existing) {
      // Reconnect: same seat, same vote. Retire the older socket.
      if (existing.conn && existing.conn !== conn) {
        const old = existing.conn;
        this.bindings.delete(old);
        old.close();
      }
      existing.conn = conn;
      existing.name = name;
    } else {
      // New seats are never admin; only CREATE assigns the admin's client id.
      room.members.set(clientId, {
        id: this.uniqueMemberId(room),
        clientId,
        name,
        vote: null,
        conn,
        lastReactionAt: 0,
      });
    }
    this.bindings.set(conn, { roomId, clientId });
    this.broadcast(room);
  }

  private context(conn: Connection): { room: Room; member: Member } | null {
    const binding = this.bindings.get(conn);
    if (!binding) return null;
    const room = this.rooms.get(binding.roomId);
    const member = room?.members.get(binding.clientId);
    if (!room || !member) return null;
    return { room, member };
  }

  /** Unbinds a connection from whatever seat it holds, without closing it. */
  private detach(conn: Connection): void {
    const binding = this.bindings.get(conn);
    if (!binding) return;
    this.bindings.delete(conn);
    const room = this.rooms.get(binding.roomId);
    const member = room?.members.get(binding.clientId);
    if (room && member?.conn === conn) {
      member.conn = null;
      this.broadcast(room);
    }
  }

  private uniqueMemberId(room: Room): string {
    const taken = new Set([...room.members.values()].map((m) => m.id));
    let id = this.newMemberId();
    while (taken.has(id)) id = this.newMemberId();
    return id;
  }

  private broadcast(room: Room): void {
    const snapshot = {
      id: room.id,
      story: room.story,
      revealed: room.revealed,
      members: [...room.members.values()].map((m) => ({
        id: m.id,
        name: m.name,
        isAdmin: m.clientId === room.adminClientId,
        online: m.conn !== null,
        vote: m.vote,
      })),
    };
    for (const member of room.members.values()) {
      member.conn?.send({
        type: "STATE_SYNC",
        selfId: member.id,
        state: buildRoomState(snapshot, member.id),
      });
    }
  }
}

function hasVotes(room: Room): boolean {
  for (const m of room.members.values()) if (m.vote !== null) return true;
  return false;
}

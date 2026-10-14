import {
  CLIENT_ID_MAX,
  CLIENT_ID_MIN,
  DECK,
  NAME_MAX,
  REACTIONS,
  ROOM_ID_RE,
  TITLE_MAX,
  type CardValue,
  type Reaction,
  type RoomState,
} from "./types";

export type ClientMessage =
  | { type: "CREATE"; clientId: string; name: string }
  | { type: "JOIN"; roomId: string; clientId: string; name: string }
  | { type: "VOTE"; value: CardValue }
  | { type: "REVEAL" }
  | { type: "CLEAR" }
  | { type: "SET_STORY"; title: string }
  | { type: "KICK"; participantId: string }
  | { type: "REACT"; participantId: string; emoji: Reaction };

export type ServerMessage =
  | { type: "CREATED"; roomId: string }
  | { type: "STATE_SYNC"; selfId: string; state: RoomState }
  | { type: "REACTION"; participantId: string; fromId: string; emoji: Reaction }
  | { type: "KICKED" }
  | { type: "NOT_FOUND" }
  | { type: "ERROR"; message: string };

/** Collapses whitespace, trims, and caps length. Returns "" if nothing is left. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX).trim();
}

/** Same as `cleanName` with the longer title cap. An empty title is allowed. */
export function cleanTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX).trim();
}

type Obj = Record<string, unknown>;

function parseObject(raw: unknown): Obj | null {
  if (typeof raw !== "string") return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null;
  } catch {
    return null;
  }
}

const isString = (v: unknown): v is string => typeof v === "string";

export function isClientId(v: unknown): v is string {
  return (
    isString(v) && v.length >= CLIENT_ID_MIN && v.length <= CLIENT_ID_MAX && /^[\w-]+$/.test(v)
  );
}

export function isRoomId(v: unknown): v is string {
  return isString(v) && ROOM_ID_RE.test(v);
}

export function isCard(v: unknown): v is CardValue {
  return (DECK as readonly unknown[]).includes(v);
}

export function isReaction(v: unknown): v is Reaction {
  return (REACTIONS as readonly unknown[]).includes(v);
}

const isParticipantId = (v: unknown): v is string => isString(v) && v.length > 0 && v.length <= 32;

function validName(v: unknown): string | null {
  if (!isString(v)) return null;
  const name = cleanName(v);
  return name || null;
}

/** Validates and normalises an inbound client message. Returns null when malformed. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  const m = parseObject(raw);
  if (!m) return null;
  switch (m.type) {
    case "CREATE": {
      const name = validName(m.name);
      return isClientId(m.clientId) && name ? { type: "CREATE", clientId: m.clientId, name } : null;
    }
    case "JOIN": {
      const name = validName(m.name);
      return isRoomId(m.roomId) && isClientId(m.clientId) && name
        ? { type: "JOIN", roomId: m.roomId, clientId: m.clientId, name }
        : null;
    }
    case "VOTE":
      return isCard(m.value) ? { type: "VOTE", value: m.value } : null;
    case "REVEAL":
    case "CLEAR":
      return { type: m.type };
    case "SET_STORY":
      return isString(m.title) ? { type: "SET_STORY", title: cleanTitle(m.title) } : null;
    case "KICK":
      return isParticipantId(m.participantId) ? { type: "KICK", participantId: m.participantId } : null;
    case "REACT":
      return isParticipantId(m.participantId) && isReaction(m.emoji)
        ? { type: "REACT", participantId: m.participantId, emoji: m.emoji }
        : null;
    default:
      return null;
  }
}

/** Validates an inbound server message on the client. Shallow: the server is trusted. */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  const m = parseObject(raw);
  if (!m) return null;
  switch (m.type) {
    case "CREATED":
      return isRoomId(m.roomId) ? { type: "CREATED", roomId: m.roomId } : null;
    case "STATE_SYNC":
      return isString(m.selfId) && m.state !== null && typeof m.state === "object"
        ? { type: "STATE_SYNC", selfId: m.selfId, state: m.state as RoomState }
        : null;
    case "REACTION":
      return isString(m.participantId) && isString(m.fromId) && isReaction(m.emoji)
        ? { type: "REACTION", participantId: m.participantId, fromId: m.fromId, emoji: m.emoji }
        : null;
    case "KICKED":
    case "NOT_FOUND":
      return { type: m.type };
    case "ERROR":
      return isString(m.message) ? { type: "ERROR", message: m.message } : null;
    default:
      return null;
  }
}

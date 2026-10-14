export const DECK = [1, 2, 3, 5, 8] as const;
export type CardValue = (typeof DECK)[number];

/** A room with nobody connected for this long is deleted. */
export const IDLE_ROOM_MS = 60 * 60 * 2000;

export const NAME_MAX = 30;
export const TITLE_MAX = 200;
export const CLIENT_ID_MIN = 8;
export const CLIENT_ID_MAX = 64;
export const ROOM_ID_RE = /^[a-z0-9]{8}$/;
export const MAX_MESSAGE_BYTES = 16 * 1024;
/** Where the Socket.IO server listens. */
export const SOCKET_PATH = "/ws";

/** Reactions anyone can send to a participant's card. */
export const REACTIONS = ["👍", "🎉", "😂", "🤔", "🔥", "☕"] as const;
export type Reaction = (typeof REACTIONS)[number];
/** How long a reaction stays on the card. */
export const REACTION_SHOW_MS = 1_000;
/** Minimum gap between two reactions from the same member. */
export const REACTION_COOLDOWN_MS = 250;

export interface Participant {
  /** Public six-character id. Never the client id. */
  id: string;
  name: string;
  isAdmin: boolean;
  online: boolean;
  hasVoted: boolean;
  /** Visible to everyone after reveal; before that, only to its owner. */
  vote: CardValue | null;
}

export interface Results {
  average: number;
  rounded: CardValue;
  distribution: Record<CardValue, number>;
  voters: number;
  consensus: boolean;
}

/** One viewer's masked view of a room. */
export interface RoomState {
  roomId: string;
  story: string;
  revealed: boolean;
  participants: Participant[];
  results: Results | null;
}

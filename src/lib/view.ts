import { computeResults } from "./rounding";
import type { CardValue, Participant, RoomState } from "./types";

/** The parts of a server room that a view is built from. */
export interface RoomSnapshot {
  id: string;
  story: string;
  revealed: boolean;
  members: readonly {
    id: string;
    name: string;
    isAdmin: boolean;
    online: boolean;
    vote: CardValue | null;
  }[];
}

/**
 * Builds the state one viewer is allowed to see. Before reveal, every vote
 * except the viewer's own is withheld and results are null.
 */
export function buildRoomState(room: RoomSnapshot, viewerId: string): RoomState {
  const participants: Participant[] = room.members.map((m) => ({
    id: m.id,
    name: m.name,
    isAdmin: m.isAdmin,
    online: m.online,
    hasVoted: m.vote !== null,
    vote: room.revealed || m.id === viewerId ? m.vote : null,
  }));
  const votes = room.members.flatMap((m) => (m.vote === null ? [] : [m.vote]));
  return {
    roomId: room.id,
    story: room.story,
    revealed: room.revealed,
    participants,
    results: room.revealed ? computeResults(votes) : null,
  };
}

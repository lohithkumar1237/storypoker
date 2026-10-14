import { create } from "zustand";
import { REACTION_SHOW_MS, type Reaction, type RoomState } from "@/src/lib/types";

export interface ShownReaction {
  emoji: Reaction;
  /** Changes with every reaction, so a repeat restarts the animation. */
  key: number;
}

export type RoomStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "not_found"
  | "kicked";

interface RoomStore {
  state: RoomState | null;
  selfId: string | null;
  status: RoomStatus;
  error: string | null;
  /** The reaction currently on each participant's card, by participant id. */
  reactions: Record<string, ShownReaction>;

  reset(): void;
  applySync(selfId: string, state: RoomState): void;
  setStatus(status: RoomStatus): void;
  setError(error: string | null): void;
  showReaction(participantId: string, emoji: Reaction): void;
}

let reactionKey = 0;

const initial = {
  state: null,
  selfId: null,
  status: "connecting" as RoomStatus,
  error: null,
  reactions: {},
};

export const useRoomStore = create<RoomStore>()((set) => ({
  ...initial,
  reset: () => set(initial),
  applySync: (selfId, state) => set({ selfId, state, status: "live", error: null }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  showReaction: (participantId, emoji) => {
    const key = ++reactionKey;
    set((s) => ({ reactions: { ...s.reactions, [participantId]: { emoji, key } } }));
    setTimeout(() => {
      set((s) => {
        // A newer reaction on the same card keeps its own timer.
        if (s.reactions[participantId]?.key !== key) return s;
        const { [participantId]: _gone, ...rest } = s.reactions;
        return { reactions: rest };
      });
    }, REACTION_SHOW_MS);
  },
}));

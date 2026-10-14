"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Seat } from "@/src/lib/persist";
import { RoomSocket } from "@/src/lib/roomSocket";
import type { CardValue, Reaction } from "@/src/lib/types";
import { useRoomStore } from "@/src/store/roomStore";

/** Owns the `RoomSocket` for one room and exposes the room actions. */
export function useRoomConnection(roomId: string, seat: Seat) {
  const seatRef = useRef(seat);
  useEffect(() => {
    seatRef.current = seat;
  }, [seat]);

  // Created once per mount. The effect below starts and stops it, so
  // StrictMode's mount/unmount/mount leaves exactly one socket open.
  const [socket] = useState(() => {
    const store = useRoomStore.getState;
    return new RoomSocket(
      {
        hello: () => ({
          type: "JOIN",
          roomId,
          clientId: seatRef.current.clientId,
          name: seatRef.current.name,
        }),
      },
      {
        onMessage(msg) {
          switch (msg.type) {
            case "STATE_SYNC":
              store().applySync(msg.selfId, msg.state);
              break;
            case "REACTION":
              store().showReaction(msg.participantId, msg.emoji);
              break;
            case "KICKED":
              store().setStatus("kicked");
              break;
            case "NOT_FOUND":
              store().setStatus("not_found");
              break;
            case "ERROR":
              store().setError(msg.message);
              break;
          }
        },
        onStatus(status) {
          if (status !== "connecting") return;
          const current = store().status;
          if (current === "live") store().setStatus("reconnecting");
        },
        onGiveUp() {
          store().setStatus("not_found");
        },
      },
    );
  });

  useEffect(() => {
    useRoomStore.getState().reset();
    socket.start();
    return () => socket.stop();
  }, [socket]);

  const retry = useCallback(() => {
    const { status } = useRoomStore.getState();
    if (status === "kicked") return;
    socket.stop();
    useRoomStore.getState().reset();
    socket.start();
  }, [socket]);

  return useMemo(
    () => ({
      vote: (value: CardValue) => socket.send({ type: "VOTE", value }),
      reveal: () => socket.send({ type: "REVEAL" }),
      clear: () => socket.send({ type: "CLEAR" }),
      setStory: (title: string) => socket.send({ type: "SET_STORY", title }),
      kick: (participantId: string) => socket.send({ type: "KICK", participantId }),
      react: (participantId: string, emoji: Reaction) => socket.send({ type: "REACT", participantId, emoji }),
      retry,
    }),
    [socket, retry],
  );
}


"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { newClientId, recallName, saveSeat } from "@/src/lib/persist";
import { cleanName, parseServerMessage } from "@/src/lib/protocol";
import { openSocket } from "@/src/lib/roomSocket";
import { NAME_MAX } from "@/src/lib/types";

const CREATE_TIMEOUT_MS = 15_000;

/** Opens a one-off connection, sends CREATE, and resolves with the new room id. */
function createRoom(clientId: string, name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Socket.IO retries on its own until the timeout gives up.
    const socket = openSocket();
    const finish = () => {
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.disconnect();
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error("Couldn't reach the server. Please try again."));
    }, CREATE_TIMEOUT_MS);

    socket.on("connect", () => socket.emit("msg", JSON.stringify({ type: "CREATE", clientId, name })));
    socket.on("msg", (data: unknown) => {
      const msg = parseServerMessage(data);
      if (msg?.type === "CREATED") {
        // The room page reconnects with the same client id and takes over the seat.
        finish();
        resolve(msg.roomId);
      } else if (msg?.type === "ERROR") {
        finish();
        reject(new Error(msg.message));
      }
    });
  });
}

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setName(recallName()), []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const clean = cleanName(name);
    if (!clean) {
      setError("Please enter your name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const clientId = newClientId();
      const roomId = await createRoom(clientId, clean);
      saveSeat(roomId, { clientId, name: clean });
      router.push(`/room/${roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 pt-8 sm:pt-16">
      <header className="space-y-2 text-center">
        <div aria-hidden className="text-5xl">🃏</div>
        <h1 className="text-3xl font-bold tracking-tight">Story Poker</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Estimate together in real time. No sign-up needed.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
      >
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Your name</span>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            autoComplete="nickname"
            autoFocus
            placeholder="e.g. Sam"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating…" : "Create room"}
        </button>
      </form>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { loadSeat, newClientId, recallName, saveSeat, type Seat } from "@/src/lib/persist";
import { cleanName, isRoomId } from "@/src/lib/protocol";
import { NAME_MAX } from "@/src/lib/types";
import RoomScreen from "./RoomScreen";

/** Shows the name form, or the room once this tab has a seat. */
export default function RoomClient({ roomId }: { roomId: string }) {
  const [seat, setSeat] = useState<Seat | null>(() => loadSeat(roomId));

  if (!isRoomId(roomId)) {
    return (
      <div className="space-y-4 pt-16 text-center">
        <h1 className="text-2xl font-semibold">Can&apos;t find this room</h1>
        <p className="text-slate-600 dark:text-slate-400">That link doesn&apos;t look like a room link.</p>
        <Link href="/" className="btn-link">
          Start a new room
        </Link>
      </div>
    );
  }

  if (seat) return <RoomScreen roomId={roomId} seat={seat} />;

  return (
    <NameForm
      onSubmit={(name) => {
        const next = { clientId: newClientId(), name };
        saveSeat(roomId, next);
        setSeat(next);
      }}
    />
  );
}

function NameForm({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState(recallName);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = cleanName(name);
    if (!clean) return setError("Please enter your name.");
    onSubmit(clean);
  }

  return (
    <div className="mx-auto max-w-md space-y-6 pt-8 sm:pt-16">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Join the room</h1>
        <p className="text-slate-600 dark:text-slate-400">Pick a name your team will recognise.</p>
      </header>
      <form
        onSubmit={submit}
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
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full">
          Join
        </button>
      </form>
    </div>
  );
}

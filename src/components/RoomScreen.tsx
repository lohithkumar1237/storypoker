"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRoomConnection } from "@/src/hooks/useRoomConnection";
import type { Seat } from "@/src/lib/persist";
import { TITLE_MAX } from "@/src/lib/types";
import { useRoomStore } from "@/src/store/roomStore";
import CardRow from "./CardRow";
import PlayerTile from "./PlayerTile";
import ResultsPanel from "./ResultsPanel";

export default function RoomScreen({ roomId, seat }: { roomId: string; seat: Seat }) {
  const actions = useRoomConnection(roomId, seat);
  const state = useRoomStore((s) => s.state);
  const selfId = useRoomStore((s) => s.selfId);
  const status = useRoomStore((s) => s.status);
  const error = useRoomStore((s) => s.error);
  const reactions = useRoomStore((s) => s.reactions);

  if (status === "kicked") {
    return (
      <Notice title="You were removed from this room">
        <Link href="/" className="btn-primary">
          Start a new room
        </Link>
      </Notice>
    );
  }
  if (status === "not_found") {
    return (
      <Notice title="Can't find this room">
        <p className="text-slate-600 dark:text-slate-400">
          It may have closed after an hour with nobody in it, or the server restarted.
        </p>
        <div className="flex justify-center gap-3">
          <button type="button" className="btn-secondary" onClick={actions.retry}>
            Retry
          </button>
          <Link href="/" className="btn-primary">
            Start a new room
          </Link>
        </div>
      </Notice>
    );
  }
  if (!state || !selfId) {
    return <p className="pt-16 text-center text-slate-500">Connecting…</p>;
  }

  const me = state.participants.find((p) => p.id === selfId);
  const isAdmin = me?.isAdmin ?? false;
  const anyVotes = state.participants.some((p) => p.hasVoted);
  const voted = state.participants.filter((p) => p.hasVoted).length;

  return (
    <div className={isAdmin ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : ""}>
      <header className="flex items-center justify-between gap-2 sm:gap-3">
        <Link href="/" className="shrink-0 text-base font-bold tracking-tight sm:text-lg">
          🃏 Story Poker
        </Link>
        {isAdmin && <CopyInvite roomId={roomId} />}
      </header>

      {status === "reconnecting" && (
        <p role="status" className="mt-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          Connection lost. Reconnecting…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-900 dark:bg-red-900/40 dark:text-red-200">
          {error}
        </p>
      )}

      <section className="mt-6">
        {isAdmin ? (
          <StoryEditor story={state.story} onSave={actions.setStory} />
        ) : (
          <h1 className="text-xl font-semibold break-words sm:text-2xl">
            {state.story || <span className="text-slate-400">No story set yet</span>}
          </h1>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between text-sm text-slate-500">
          <h2 className="font-semibold tracking-wide uppercase">Participants</h2>
          <span>
            {voted} of {state.participants.length} voted
          </span>
        </div>
        {/* Phones: compact rows. Wider: card tiles, more columns as space allows. */}
        <ul className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
          {state.participants.map((p) => (
            <PlayerTile
              key={p.id}
              participant={p}
              isSelf={p.id === selfId}
              revealed={state.revealed}
              onKick={isAdmin && !p.isAdmin ? () => actions.kick(p.id) : undefined}
              reserveKickSpace={isAdmin}
              reaction={reactions[p.id]}
              onReact={(emoji) => actions.react(p.id, emoji)}
            />
          ))}
        </ul>
      </section>

      {state.revealed ? (
        <section className="mt-8">
          <ResultsPanel results={state.results} />
        </section>
      ) : (
        // On phones, pinned to the bottom of the screen so a long participant
        // list can't push it out of view (unless the screen is too short).
        // Wider screens keep it in the flow, so it never covers the tiles.
        <section
          className={`-mx-4 mt-6 bg-slate-50/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:mt-8 dark:bg-slate-900/90 max-sm:[@media(min-height:560px)]:sticky ${
            isAdmin ? "bottom-[calc(4.1rem+env(safe-area-inset-bottom))]" : "bottom-0"
          }`}
        >
          <h2 className="text-center text-xs font-semibold tracking-wide text-slate-500 uppercase sm:text-sm">
            Pick your estimate
          </h2>
          <CardRow selected={me?.vote ?? null} onSelect={actions.vote} disabled={status !== "live"} />
        </section>
      )}

      {isAdmin && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
          <div className="mx-auto flex max-w-4xl items-center justify-end gap-2 px-4 py-3 sm:gap-3">
            <span className="mr-auto hidden text-sm text-slate-500 min-[400px]:inline">You&apos;re the admin</span>
            <button type="button" className="btn-secondary" onClick={actions.clear}>
              Clear all
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={actions.reveal}
              disabled={state.revealed || !anyVotes}
            >
              Reveal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-4 pt-16 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

function CopyInvite({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    const url = `${location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copy this invite link:", url);
    }
  }

  return (
    <button type="button" className="btn-secondary shrink-0 px-3 py-1.5 text-sm" onClick={copy}>
      {copied ? (
        "Copied!"
      ) : (
        <>
          <span className="sm:hidden">Invite</span>
          <span className="hidden sm:inline">Copy invite link</span>
        </>
      )}
    </button>
  );
}

function StoryEditor({ story, onSave }: { story: string; onSave: (title: string) => void }) {
  const [draft, setDraft] = useState(story);
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);

  // Follow server updates unless the admin is mid-edit.
  useEffect(() => {
    if (!editing) setDraft(story);
  }, [story, editing]);

  function commit() {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(story);
      return;
    }
    if (draft.trim() !== story) onSave(draft);
  }

  return (
    <label className="block">
      <span className="sr-only">Story title</span>
      <input
        className="field text-lg font-semibold sm:text-xl"
        value={draft}
        maxLength={TITLE_MAX}
        placeholder="What are we estimating?"
        enterKeyHint="done"
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
      />
      <span className={`mt-1 block text-xs text-slate-500 ${editing ? "" : "invisible"}`}>
        Press Enter to set the story for everyone.
      </span>
    </label>
  );
}

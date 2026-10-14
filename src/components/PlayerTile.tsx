"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { REACTIONS, type Participant, type Reaction } from "@/src/lib/types";
import type { ShownReaction } from "@/src/store/roomStore";

const AVATAR_COLOURS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-teal-500",
  "bg-orange-500",
];

function avatarColour(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
}

interface Props {
  participant: Participant;
  isSelf: boolean;
  revealed: boolean;
  /** Set when the viewer is the admin and may remove this participant. */
  onKick?: () => void;
  /** Keep the kick button's space on phone rows, so cards line up in the admin's view. */
  reserveKickSpace?: boolean;
  /** The reaction to show on the card right now, if any. */
  reaction?: ShownReaction;
  onReact(emoji: Reaction): void;
}

const canHover = () => window.matchMedia("(hover: hover)").matches;

export default function PlayerTile({
  participant: p,
  isSelf,
  revealed,
  onKick,
  reserveKickSpace,
  reaction,
  onReact,
}: Props) {
  // Face up once revealed, or for your own card so you can see your pick.
  const faceUp = p.vote !== null && (revealed || isSelf);

  // The emoji picker opens on hover. Touch screens can't hover, so there a
  // tap on the tile toggles it, and a tap anywhere else closes it.
  const [pickerOpen, setPickerOpen] = useState(false);
  const tileRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e: PointerEvent) => {
      if (!tileRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [pickerOpen]);

  function react(e: MouseEvent<HTMLButtonElement>, emoji: Reaction) {
    e.stopPropagation();
    // Drop focus so focus-within doesn't hold the picker open after the mouse leaves.
    e.currentTarget.blur();
    setPickerOpen(false);
    onReact(emoji);
  }

  const badges = (p.isAdmin || !p.online) && (
    <>
      {p.isAdmin && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
          admin
        </span>
      )}
      {!p.online && <span className="text-slate-500">offline</span>}
    </>
  );
  const badgeText = "items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase";

  // Phones: a row (avatar, name, card, kick). From `sm`: a tile with the card on top.
  return (
    <li
      ref={tileRef}
      onClick={() => {
        if (!canHover()) setPickerOpen((open) => !open);
      }}
      className={[
        "group relative flex items-center gap-3 rounded-xl border bg-white px-3 py-2 shadow-sm hover:z-10 focus-within:z-10 sm:flex-col sm:gap-2 sm:p-3 dark:bg-slate-800/60",
        pickerOpen ? "z-10" : "",
        isSelf ? "border-indigo-400 dark:border-indigo-500" : "border-slate-200 dark:border-slate-700",
        p.online ? "" : "opacity-60",
      ].join(" ")}
    >
      <div
        role="toolbar"
        aria-label={`React to ${p.name}`}
        className={`absolute bottom-full left-1/2 -translate-x-1/2 pb-1.5 ${
          pickerOpen ? "flex" : "hidden group-focus-within:flex group-hover:flex"
        }`}
      >
        <div className="flex gap-0.5 rounded-full border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={(e) => react(e, emoji)}
              aria-label={`React ${emoji}`}
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 sm:h-7 sm:w-7 sm:text-lg dark:hover:bg-slate-700"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="relative order-2 h-12 w-9 shrink-0 perspective-normal sm:order-none sm:h-20 sm:w-14">
        {reaction && (
          <span
            key={reaction.key}
            aria-hidden
            className="reaction-pop pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-3xl sm:text-4xl"
          >
            {reaction.emoji}
          </span>
        )}
        <div
          className={[
            "relative h-full w-full transition-transform duration-500 transform-3d",
            faceUp ? "rotate-y-180" : "",
          ].join(" ")}
        >
          {/* Back: shows whether this person has voted. */}
          <div
            className={[
              "absolute inset-0 flex items-center justify-center rounded-md border-2 backface-hidden sm:rounded-lg",
              p.hasVoted
                ? "border-indigo-600 bg-[repeating-linear-gradient(45deg,var(--color-indigo-500)_0_6px,var(--color-indigo-600)_6px_12px)]"
                : "border-dashed border-slate-300 dark:border-slate-600",
            ].join(" ")}
          >
            {p.hasVoted && <span className="sr-only">Voted</span>}
          </div>
          {/* Front: the value. */}
          <div className="absolute inset-0 flex rotate-y-180 items-center justify-center rounded-md border-2 border-indigo-600 bg-white text-lg font-bold text-indigo-700 backface-hidden sm:rounded-lg sm:text-2xl dark:bg-slate-900 dark:text-indigo-300">
            {p.vote ?? ""}
          </div>
        </div>
      </div>

      <div className="order-1 flex min-w-0 flex-1 items-center gap-2.5 sm:order-none sm:w-full sm:flex-none sm:justify-center sm:gap-2">
        <span
          aria-hidden
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white sm:h-6 sm:w-6 sm:text-xs ${avatarColour(p.id)}`}
        >
          {p.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          {/* One truncated line in phone rows, up to two wrapped lines on tiles.
              Badges sit outside this span so long names can't hide them. */}
          <span
            className="block truncate text-sm font-medium sm:line-clamp-2 sm:text-center sm:break-words sm:whitespace-normal"
            title={p.name}
          >
            {p.name}
            {isSelf && <span className="text-slate-400"> (you)</span>}
          </span>
          {badges && <div className={`mt-0.5 flex sm:hidden ${badgeText}`}>{badges}</div>}
        </div>
      </div>
      <div className={`hidden h-4 sm:flex ${badgeText}`}>{badges}</div>

      {onKick && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onKick();
          }}
          aria-label={`Remove ${p.name}`}
          title={`Remove ${p.name}`}
          className="order-3 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 sm:absolute sm:top-1 sm:right-1 sm:mr-0 sm:h-7 sm:w-7 sm:text-base sm:opacity-60 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:hover:bg-red-950"
        >
          ×
        </button>
      )}
      {!onKick && reserveKickSpace && <span aria-hidden className="order-3 -mr-1 w-8 shrink-0 sm:hidden" />}
    </li>
  );
}

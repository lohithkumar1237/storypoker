"use client";

import { DECK, type CardValue } from "@/src/lib/types";

interface Props {
  selected: CardValue | null;
  disabled?: boolean;
  onSelect(value: CardValue): void;
}

/** The five deck cards. The selected one lifts with a springy overshoot. */
export default function CardRow({ selected, disabled, onSelect }: Props) {
  return (
    <div role="radiogroup" aria-label="Your estimate" className="mx-auto grid max-w-lg grid-cols-5 gap-2 pt-4 sm:max-w-md sm:gap-3">
      {DECK.map((value) => {
        const isSelected = value === selected;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onSelect(value)}
            className={[
              // Five equal columns, so the row never wraps on a narrow phone.
              "flex aspect-[3/4] w-full items-center justify-center rounded-xl border-2 text-xl font-bold shadow-sm touch-manipulation sm:text-2xl",
              "transition-[transform,box-shadow,background-color,border-color] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50",
              isSelected
                ? "-translate-y-3 border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                : "border-slate-300 bg-white text-slate-800 hover:-translate-y-1 hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
            ].join(" ")}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { DECK, type Results } from "@/src/lib/types";
import Confetti from "./Confetti";

const COUNT_UP_MS = 800;

function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const progress = Math.min((t - start) / COUNT_UP_MS, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

export default function ResultsPanel({ results }: { results: Results | null }) {
  if (!results) {
    return <p className="pt-6 text-center text-slate-500">No votes were cast.</p>;
  }
  return <ResultsBody results={results} />;
}

function ResultsBody({ results }: { results: Results }) {
  const average = useCountUp(results.average);
  const max = Math.max(...DECK.map((c) => results.distribution[c]), 1);

  return (
    <section
      aria-label="Results"
      className="mt-4 grid gap-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[auto_1fr] sm:p-6 dark:border-slate-700 dark:bg-slate-800/60"
    >
      {results.consensus && <Confetti />}

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:flex-col sm:flex-nowrap sm:gap-3">
        <div className="text-center">
          <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Average</div>
          <div className="text-4xl font-bold tabular-nums">{average.toFixed(1)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Estimate</div>
          <div className="mx-auto mt-1 flex h-20 w-14 items-center justify-center rounded-lg border-2 border-indigo-600 bg-indigo-600 text-3xl font-bold text-white shadow-md">
            {results.rounded}
          </div>
        </div>
        {results.consensus && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
            🎉 Consensus
          </span>
        )}
      </div>

      <ul className="space-y-2 self-center">
        {DECK.map((card) => {
          const count = results.distribution[card];
          return (
            <li key={card} className="grid grid-cols-[1.5rem_1fr_4rem] items-center gap-2 sm:grid-cols-[2rem_1fr_4.5rem] sm:gap-3 text-sm">
              <span className="text-right font-semibold">{card}</span>
              <span className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <span
                  className="block h-full rounded-full bg-indigo-500 transition-[width] duration-700 ease-out"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </span>
              <span className="text-slate-500 tabular-nums">
                {count} {count === 1 ? "vote" : "votes"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

const COLOURS = ["#6366f1", "#f43f5e", "#f59e0b", "#10b981", "#0ea5e9", "#a855f7"];
const PIECES = 48;

// Positions come from the index, not Math.random, so renders stay pure.
const pieces = Array.from({ length: PIECES }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i * 53) % 900,
  drift: ((i * 29) % 21) - 10,
  spin: 360 + ((i * 97) % 540),
  colour: COLOURS[i % COLOURS.length],
}));

/** One-shot confetti burst. Remount (e.g. with a new key) to play again. */
export default function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              backgroundColor: p.colour,
              animationDelay: `${p.delay}ms`,
              "--drift": `${p.drift}vw`,
              "--spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

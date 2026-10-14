"use client";

import { useEffect, useState } from "react";

/** The server's current time (local clock plus `offset`), ticking each second. */
export function useClock(offset: number): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const id = setInterval(() => setNow(Date.now() + offset), 1_000);
    return () => clearInterval(id);
  }, [offset]);
  return now;
}

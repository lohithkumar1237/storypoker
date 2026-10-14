import { nanoid } from "nanoid";

/** What this tab needs to reclaim its seat in a room after a refresh. */
export interface Seat {
  clientId: string;
  name: string;
}

const seatKey = (roomId: string) => `storypoker:seat:${roomId}`;
const NAME_KEY = "storypoker:name";

export function newClientId(): string {
  return nanoid(21);
}

// sessionStorage is per tab: a refresh keeps the seat, a new tab gets a new one.
export function loadSeat(roomId: string): Seat | null {
  try {
    const raw = sessionStorage.getItem(seatKey(roomId));
    if (!raw) return null;
    const seat = JSON.parse(raw) as Partial<Seat>;
    return typeof seat.clientId === "string" && typeof seat.name === "string"
      ? { clientId: seat.clientId, name: seat.name }
      : null;
  } catch {
    return null;
  }
}

export function saveSeat(roomId: string, seat: Seat): void {
  try {
    sessionStorage.setItem(seatKey(roomId), JSON.stringify(seat));
  } catch {
    // Storage blocked: the seat lasts until the tab is refreshed.
  }
  rememberName(seat.name);
}

export function clearSeat(roomId: string): void {
  try {
    sessionStorage.removeItem(seatKey(roomId));
  } catch {
    // ignore
  }
}

/** Last name used, to prefill forms. Convenience only. */
export function recallName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}

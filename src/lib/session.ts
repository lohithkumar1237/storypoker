import { SESSION_LENGTH_MS } from "./types";

export function sessionEndsAt(createdAt: number): number {
  return createdAt + SESSION_LENGTH_MS;
}

export function isExpired(createdAt: number, now: number): boolean {
  return now >= sessionEndsAt(createdAt);
}

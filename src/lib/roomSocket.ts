import { parseServerMessage, type ClientMessage, type ServerMessage } from "./protocol";

export type SocketStatus = "connecting" | "open" | "closed";

export interface RoomSocketHandlers {
  onMessage(msg: ServerMessage): void;
  onStatus(status: SocketStatus): void;
  /** Too many failed attempts before the first sync. */
  onGiveUp(): void;
}

export interface RoomSocketOptions {
  /** Sent on every open, so a reconnect rebinds the seat. */
  hello: () => ClientMessage;
  url?: string;
}

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 15_000;
const MAX_FAILURES_BEFORE_SYNC = 6;

export function socketUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

/**
 * A WebSocket that reconnects with exponential backoff (1 s doubling to 15 s)
 * and re-sends its hello on every open. Can be started again after `stop()`,
 * which keeps React StrictMode's double mount from leaving two sockets open.
 */
export class RoomSocket {
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private synced = false;
  private attempt = 0;
  private failures = 0;

  constructor(
    private readonly options: RoomSocketOptions,
    private readonly handlers: RoomSocketHandlers,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.synced = false;
    this.attempt = 0;
    this.failures = 0;
    this.connect();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      ws.close();
    }
    this.handlers.onStatus("closed");
  }

  send(msg: ClientMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  private connect(): void {
    if (!this.running) return;

    this.handlers.onStatus("connecting");
    const ws = new WebSocket(this.options.url ?? socketUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.handlers.onStatus("open");
      ws.send(JSON.stringify(this.options.hello()));
    };
    ws.onmessage = (event) => {
      const msg = parseServerMessage(event.data);
      if (!msg) return;
      if (msg.type === "STATE_SYNC") {
        this.synced = true;
        this.attempt = 0;
      }
      this.handlers.onMessage(msg);
      // These end the session; reconnecting would only repeat them.
      if (msg.type === "KICKED" || msg.type === "NOT_FOUND") this.stop();
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.scheduleReconnect();
    };
    ws.onerror = () => {
      // onclose follows and handles the retry.
    };
  }

  private scheduleReconnect(): void {
    if (!this.running) return;
    if (!this.synced) {
      this.failures += 1;
      if (this.failures >= MAX_FAILURES_BEFORE_SYNC) {
        this.stop();
        this.handlers.onGiveUp();
        return;
      }
    }
    this.handlers.onStatus("connecting");
    const delay = Math.min(BASE_DELAY_MS * 2 ** this.attempt, MAX_DELAY_MS);
    this.attempt += 1;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, delay);
  }
}

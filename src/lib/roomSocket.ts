import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";
import { parseServerMessage, type ClientMessage, type ServerMessage } from "./protocol";
import { SOCKET_PATH } from "./types";

export type SocketStatus = "connecting" | "open" | "closed";

export interface RoomSocketHandlers {
  onMessage(msg: ServerMessage): void;
  onStatus(status: SocketStatus): void;
  /** Too many failed attempts before the first sync. */
  onGiveUp(): void;
}

export interface RoomSocketOptions {
  /** Sent on every connect, so a reconnect rebinds the seat. */
  hello: () => ClientMessage;
}

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 15_000;
const MAX_FAILURES_BEFORE_SYNC = 6;

/**
 * Opens a Socket.IO connection to this site. It starts on HTTPS long-polling,
 * which corporate VPNs and proxies allow, and upgrades to a WebSocket only
 * where the network lets it. Messages travel as JSON strings on "msg".
 */
export function openSocket(options: Partial<ManagerOptions & SocketOptions> = {}): Socket {
  return io({ path: SOCKET_PATH, transports: ["polling", "websocket"], ...options });
}

/**
 * A connection that reconnects with exponential backoff (1 s doubling to
 * 15 s) and re-sends its hello on every connect. Can be started again after
 * `stop()`, which keeps React StrictMode's double mount from leaving two
 * connections open.
 */
export class RoomSocket {
  private socket: Socket | null = null;
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
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    this.handlers.onStatus("closed");
  }

  send(msg: ClientMessage): boolean {
    // Socket.IO would buffer while disconnected; drop instead, so a stale
    // action can't land after a reconnect.
    if (!this.socket?.connected) return false;
    this.socket.emit("msg", JSON.stringify(msg));
    return true;
  }

  private connect(): void {
    if (!this.running) return;

    this.handlers.onStatus("connecting");
    // Reconnects are driven by scheduleReconnect, so each attempt is a fresh socket.
    const socket = openSocket({ reconnection: false });
    this.socket = socket;

    socket.on("connect", () => {
      this.handlers.onStatus("open");
      socket.emit("msg", JSON.stringify(this.options.hello()));
    });
    socket.on("msg", (data: unknown) => {
      const msg = parseServerMessage(data);
      if (!msg) return;
      if (msg.type === "STATE_SYNC") {
        this.synced = true;
        this.attempt = 0;
      }
      this.handlers.onMessage(msg);
      // These end the session; reconnecting would only repeat them.
      if (msg.type === "KICKED" || msg.type === "NOT_FOUND") this.stop();
    });
    const retry = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      socket.removeAllListeners();
      socket.disconnect();
      this.scheduleReconnect();
    };
    socket.on("connect_error", retry);
    socket.on("disconnect", retry);
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

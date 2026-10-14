import { createServer } from "node:http";
import next from "next";
import { WebSocketServer, type WebSocket } from "ws";
import { RoomManager, type Connection } from "./server/rooms";
import { parseClientMessage } from "./src/lib/protocol";
import { MAX_MESSAGE_BYTES } from "./src/lib/types";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || (dev ? "localhost" : "0.0.0.0");

const SWEEP_MS = 5_000;
const HEARTBEAT_MS = 30_000;
const KEEP_ALIVE_MS = 10 * 60_000;

const app = next({ dev, hostname, port });
const handleRequest = app.getRequestHandler();

await app.prepare();
const handleNextUpgrade = app.getUpgradeHandler();

const rooms = new RoomManager();
const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
const alive = new WeakSet<WebSocket>();

const server = createServer((req, res) => {
  void handleRequest(req, res);
});

server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (pathname === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else {
    // Next's own upgrades, e.g. HMR in dev.
    void handleNextUpgrade(req, socket, head);
  }
});

wss.on("connection", (ws) => {
  const conn: Connection = {
    send(msg) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    },
    close() {
      ws.close();
    },
  };
  alive.add(ws);
  updateKeepAlive();

  ws.on("pong", () => alive.add(ws));
  ws.on("message", (data, isBinary) => {
    if (isBinary) return;
    const msg = parseClientMessage(data.toString());
    if (msg) rooms.handle(conn, msg);
  });
  ws.on("close", () => {
    rooms.disconnect(conn);
    updateKeepAlive();
  });
  ws.on("error", () => ws.terminate());
});

setInterval(() => rooms.sweep(), SWEEP_MS).unref();

// Drop sockets that stop answering pings, so their seats show as offline.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) {
      ws.terminate();
      continue;
    }
    alive.delete(ws);
    ws.ping();
  }
}, HEARTBEAT_MS).unref();

// Render's free plan sleeps after idle time. While anyone is connected, ping
// our own health endpoint so the process stays up.
const keepAliveBase = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
let keepAliveTimer: NodeJS.Timeout | null = null;

function updateKeepAlive() {
  if (!keepAliveBase) return;
  const connected = wss.clients.size > 0;
  if (connected && !keepAliveTimer) {
    const url = new URL("/api/health", keepAliveBase).toString();
    keepAliveTimer = setInterval(() => {
      fetch(url).catch((err: unknown) => console.warn("keep-alive ping failed:", err));
    }, KEEP_ALIVE_MS);
  } else if (!connected && keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

server.listen(port, hostname, () => {
  console.log(`> Story Poker ready on http://${hostname}:${port} (${dev ? "dev" : "production"})`);
});

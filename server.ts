import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { RoomManager, type Connection } from "./server/rooms";
import { parseClientMessage } from "./src/lib/protocol";
import { MAX_MESSAGE_BYTES, SOCKET_PATH } from "./src/lib/types";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || (dev ? "localhost" : "0.0.0.0");

const SWEEP_MS = 5_000;
const KEEP_ALIVE_MS = 10 * 60_000;

const app = next({ dev, hostname, port });
const handleRequest = app.getRequestHandler();

await app.prepare();
const handleNextUpgrade = app.getUpgradeHandler();

const rooms = new RoomManager();

const server = createServer((req, res) => {
  void handleRequest(req, res);
});

// Socket.IO starts every connection on plain HTTPS long-polling, which
// corporate VPNs and proxies let through, then upgrades to a WebSocket only
// where the network allows it. Its own pings drop dead connections.
const io = new SocketServer(server, {
  path: SOCKET_PATH,
  transports: ["polling", "websocket"],
  maxHttpBufferSize: MAX_MESSAGE_BYTES,
  serveClient: false,
  // Leave upgrades on other paths (Next's HMR in dev) to the handler below.
  destroyUpgrade: false,
});

server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (!pathname.startsWith(SOCKET_PATH)) void handleNextUpgrade(req, socket, head);
});

let connections = 0;

io.on("connection", (socket) => {
  const conn: Connection = {
    send(msg) {
      socket.emit("msg", JSON.stringify(msg));
    },
    close() {
      socket.disconnect(true);
    },
  };
  connections += 1;
  updateKeepAlive();

  socket.on("msg", (data: unknown) => {
    const msg = parseClientMessage(data);
    if (msg) rooms.handle(conn, msg);
  });
  socket.on("disconnect", () => {
    rooms.disconnect(conn);
    connections -= 1;
    updateKeepAlive();
  });
});

setInterval(() => rooms.sweep(), SWEEP_MS).unref();

// Render's free plan sleeps after idle time. While anyone is connected, ping
// our own health endpoint so the process stays up.
const keepAliveBase = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
let keepAliveTimer: NodeJS.Timeout | null = null;

function updateKeepAlive() {
  if (!keepAliveBase) return;
  const connected = connections > 0;
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

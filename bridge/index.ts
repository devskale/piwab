/**
 * PiWAB Bridge — Spawns `pi --mode rpc` and exposes it over WebSocket.
 *
 * Usage: npx tsx bridge/index.ts [--port 3210] [--cwd /path/to/project]
 */

import { spawn, type ChildProcess } from "child_process";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { readFileSync, watchFile, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
let port = 3210;
let cwd: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) port = parseInt(args[++i], 10);
  if (args[i] === "--cwd" && args[i + 1]) cwd = resolve(args[++i]);
}

// ---------------------------------------------------------------------------
// Serve the single-file web client
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
// When running via tsx, __dirname is bridge/; when built, it's dist/bridge/
const webDir = existsSync(join(__dirname, "..", "web"))
  ? join(__dirname, "..", "web")
  : join(__dirname, "..", "..", "web");
const htmlPath = join(webDir, "index.html");

// Livereload: inject a tiny SSE client into the HTML
const livereloadScript = `
<script>
(function(){
  var es = new EventSource("/__livereload");
  es.onmessage = function() { location.reload(); };
  es.onerror = function() { setTimeout(function(){ es = new EventSource("/__livereload"); }, 1000); };
})();
</script>`;

function readIndexHtml(): string {
  try {
    const html = readFileSync(htmlPath, "utf-8");
    return html.replace("</body>", livereloadScript + "\n</body>");
  } catch {
    console.error(`❌  web/index.html not found at ${htmlPath}`);
    process.exit(1);
  }
}

// Livereload SSE clients
const livereloadClients: Set<any> = new Set();

function notifyLivereload() {
  for (const res of livereloadClients) {
    res.write("data: reload\n\n");
  }
}

// Watch HTML file for changes (poll every 300ms)
watchFile(htmlPath, { interval: 300 }, () => {
  console.log("[bridge] web/index.html changed — notifying browser");
  notifyLivereload();
});

const httpServer = createServer((req, res) => {
  if (req.url === "/__livereload") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("");
    livereloadClients.add(res);
    req.on("close", () => livereloadClients.delete(res));
    return;
  }
  // Re-read on every request so edits are always fresh
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(readIndexHtml());
});

// ---------------------------------------------------------------------------
// JSONL reader — splits on \n only (pi RPC requirement)
// ---------------------------------------------------------------------------
function attachJsonlReader(
  stream: NodeJS.ReadableStream,
  onLine: (line: string) => void,
) {
  let buffer = "";

  stream.on("data", (chunk: Buffer | string) => {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf-8");
    while (true) {
      const idx = buffer.indexOf("\n");
      if (idx === -1) break;
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.length > 0) onLine(line);
    }
  });

  stream.on("end", () => {
    if (buffer.length > 0) onLine(buffer);
  });
}

// ---------------------------------------------------------------------------
// Spawn pi in RPC mode
// ---------------------------------------------------------------------------
function spawnPi(): ChildProcess {
  const piArgs = ["--mode", "rpc"];
  const piCmd = "pi";

  const child = spawn(piCmd, piArgs, {
    cwd: cwd || process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
    shell: true,
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString("utf-8").trim();
    if (msg) console.log(`[pi:stderr] ${msg}`);
  });

  child.on("error", (err: Error & { code?: string }) => {
    if (err.code === "ENOENT") {
      console.error(`❌  "pi" not found in PATH. Install pi first: https://github.com/mariozechner/pi`);
      process.exit(1);
    }
    console.error(`[pi] spawn error: ${err.message}`);
  });

  child.on("exit", (code, signal) => {
    console.log(`[pi] exited (code=${code}, signal=${signal})`);
  });

  return child;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server: httpServer });
wss.on("error", (err: any) => {
  if ((err as any).code === "EADDRINUSE") {
    console.error(`\n❌  Port ${port} is already in use. Kill it with: lsof -ti :${port} | xargs kill -9\n`);
    process.exit(1);
  }
});

let pi: ChildProcess | null = null;
let client: WebSocket | null = null;

function connectPi() {
  if (pi) {
    pi.kill();
    pi = null;
  }

  pi = spawnPi();
  console.log(`[bridge] pi spawned (pid=${pi.pid})`);

  // pi stdout → WebSocket client
  attachJsonlReader(pi.stdout!, (line) => {
    if (client?.readyState === WebSocket.OPEN) {
      client.send(line);
    }
  });
}

// On browser connect
wss.on("connection", (ws) => {
  if (client) {
    console.log("[bridge] replacing existing client");
    client.close();
  }
  client = ws;
  console.log("[bridge] client connected");

  // Ensure pi is running
  if (!pi || pi.exitCode !== null) {
    connectPi();
  }

  // Send current state so UI can hydrate
  pi!.stdin!.write(JSON.stringify({ type: "get_state" }) + "\n");

  // Browser → pi stdin
  ws.on("message", (data) => {
    if (pi?.stdin?.writable) {
      pi.stdin.write(data.toString() + "\n");
    }
  });

  ws.on("close", () => {
    console.log("[bridge] client disconnected");
    client = null;
  });

  ws.on("error", (err) => {
    console.error(`[bridge] ws error: ${err.message}`);
  });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[bridge] shutting down...");
  if (pi) pi.kill();
  if (client) client.close();
  wss.close();
  httpServer.close();
  process.exit(0);
});

httpServer.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌  Port ${port} is already in use. Kill it with: lsof -ti :${port} | xargs kill -9\n`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(port, () => {
  console.log(`\n🔗  PiWAB running at http://localhost:${port}\n`);
});

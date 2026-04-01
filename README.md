# PiWAB — Pi Web Agent Bridge

> The simplest way to control a [pi](https://github.com/nicolo-ribaudo/nicolo-nicolo) agent from a web browser.

PiWAB is a thin WebSocket bridge that connects a browser-based chat UI to a `pi` agent running in **RPC mode**. No heavy SDK in the browser, no server-side agent logic — just a WebSocket that speaks JSONL to `pi --mode rpc`.

**Think of it as: a chat window into a terminal agent that's already running on your machine.**

## Architecture

```
┌──────────────┐     WebSocket      ┌──────────────┐     stdin/stdout     ┌──────────┐
│  Browser     │ ◄═══════════════► │  Bridge      │ ◄════════════════► │ pi --rpc │
│  (HTML/JS)   │                    │  (Node/ws)   │   JSONL protocol   │          │
└──────────────┘                    └──────────────┘                    └──────────┘
```

The key insight: **pi already does everything** — tool execution, sessions, extensions, skills, auth. We don't reimplement any of that. We just connect a browser to an RPC process.

## Features

- **Streaming responses** — real-time text, tool calls, and thinking blocks
- **Tool call cards** — expandable cards showing tool name, arguments, streaming output, and results
- **Thinking blocks** — collapsible thinking/reasoning display
- **Abort & New Session** — stop the agent mid-stream or start fresh
- **Model selector** — switch models via footer or `/model` command
- **Thinking level** — cycle through thinking levels via footer or `/thinking`
- **Command palette** — type `/` to see built-in and extension commands
- **Session stats** — token usage and context usage in the footer
- **Auto-reconnect** — reconnects automatically if the connection drops
- **Zero build step** — the web client is a single HTML file, no bundler needed

## Quick Start

```bash
# Prerequisites: Node.js 18+, pi CLI installed and accessible

# Clone and install
git clone <repo-url> piwab
cd piwab
npm install

# Start the bridge (default port 3210)
npm run dev

# Open in browser
open http://localhost:3210
```

### Options

```bash
# Custom port
npx tsx bridge/index.ts --port 8080

# Set pi's working directory
npx tsx bridge/index.ts --cwd /path/to/project

# Combine
npx tsx bridge/index.ts --port 8080 --cwd ~/my-project
```

## Project Structure

```
piwab/
├── bridge/
│   └── index.ts          # WebSocket bridge — spawns pi --mode rpc, pipes JSONL
├── web/
│   └── index.html         # Single-file chat client (no build step)
├── package.json
├── tsconfig.json
├── PRD.md                 # Product requirements document
├── README.md
└── agents.md              # Agent instructions for pi
```

## Commands

Type `/` in the input to open the command palette:

| Command | Description |
|---------|-------------|
| `/model` | Select a different model |
| `/thinking` | Cycle thinking level (off → minimal → low → medium → high) |
| `/compact` | Compact conversation context |
| `/new` | Start a new session |
| `/export` | Export session to HTML |
| `/stats` | Show session statistics |

Extension and template commands from your pi configuration also appear in the palette.

## How It Works

1. **Bridge** (`bridge/index.ts`) starts an HTTP server and spawns `pi --mode rpc` as a child process
2. The HTTP server serves `web/index.html` and handles WebSocket connections
3. Browser ↔ WebSocket ↔ pi stdin/stdout using the JSONL protocol
4. All agent logic (tool execution, session management, auth) runs in the pi process — the bridge is just a pipe

## Development

```bash
# Run in development mode
npm run dev

# The bridge auto-restarts pi if it exits
# The web client is served as-is (no build step)
# Just refresh the browser after editing web/index.html
```

### Tech Stack

- **Bridge:** Node.js, TypeScript, `ws` (WebSocket library)
- **Web Client:** Vanilla HTML/CSS/JS, zero dependencies
- **Protocol:** JSONL over stdin/stdout (pi's built-in RPC mode)

## Roadmap

See [PRD.md](PRD.md) for the full roadmap.

- [x] **Phase 1** — Minimal viable bridge with streaming, tool calls, abort, new session
- [ ] **Phase 2** — State display, model selector, thinking toggle, better tool rendering, session history
- [ ] **Phase 3** — Extension UI dialogs, file attachments, command palette, multiple sessions/tabs
- [ ] **Phase 4** — Theme support, keyboard shortcuts, notifications, mobile-friendly, `npx piwab`

## License

MIT

# PiWAB — Pi Web Agent Bridge

> The simplest way to control a pi agent from a web browser.

## Status

**Phase 1 ✅ COMPLETE** — Minimal viable bridge with streaming, tool calls, abort, new session.

## Vision

A tiny web app that talks to a pi agent running in **RPC mode** via a thin WebSocket bridge. No heavy SDK in the browser, no server-side agent logic — just a WebSocket that speaks JSONL to `pi --mode rpc`.

**Think of it as: a chat window into a terminal agent that's already running on your machine.**

## Architecture

```
┌──────────────┐     WebSocket      ┌──────────────┐     stdin/stdout     ┌──────────┐
│  Browser     │ ◄═══════════════► │  Bridge      │ ◄════════════════► │ pi --rpc │
│  (HTML/JS)   │                    │  (Node/ws)   │   JSONL protocol   │          │
└──────────────┘                    └──────────────┘                    └──────────┘
```

### Why This Architecture?

| Approach | Complexity | Problem |
|----------|-----------|---------|
| Full browser agent (pi-web-ui) | High | Agent runs in browser, no filesystem/bash access |
| SDK embedded in Node server | Medium | Need to manage agent lifecycle, auth, sessions |
| **RPC subprocess + WebSocket bridge** | **Low** | Pi already has RPC mode. We just pipe it over WebSocket. |

The key insight: **pi already does everything** — tool execution, sessions, extensions, skills, auth. We don't need to reimplement any of that. We just need to **connect a browser to an RPC process**.

## File Structure

```
piwab/
├── bridge/
│   └── index.ts          # WebSocket bridge — spawns pi --mode rpc, pipes JSONL
├── web/
│   └── index.html         # Single-file chat client (no build step)
├── package.json
├── tsconfig.json
└── PRD.md
```

## Phase 1 ✅ — Minimal Viable Bridge

**Goal:** Type a message in a browser, see the agent's streamed response. That's it.

### What was built

#### Bridge (`bridge/index.ts` — ~130 lines)
- Spawns `pi --mode rpc` as a child process
- WebSocket server on port 3210 (configurable via `--port`)
- Serves `web/index.html` over HTTP on the same port
- Bidirectional JSONL pipe: browser ↔ WebSocket ↔ pi stdin/stdout
- Auto-reconnects pi process if it dies
- Supports `--cwd` flag to set pi's working directory
- Graceful shutdown on SIGINT

#### Web Client (`web/index.html` — single file, zero deps)
- Clean dark-theme chat interface
- Streaming text display with minimal markdown rendering (code blocks, bold, italic)
- Tool call cards: expandable, show tool name + args + streaming output + result
- Thinking blocks: collapsible
- Abort button → sends `{"type":"abort"}`
- New Session button → sends `{"type":"new_session"}`
- Status indicator: idle / streaming / disconnected
- Keyboard: Enter to send, Shift+Enter for newline
- Auto-resizing textarea

### Validated

| Test | Result |
|------|--------|
| WebSocket connection | ✅ Connects, receives events |
| `get_state` on connect | ✅ Model info displayed in header |
| Prompt → streaming text | ✅ 150 chars streamed correctly |
| Tool call execution (bash) | ✅ Ran `ls`, displayed output |
| Abort mid-stream | ✅ Agent stopped with `stopReason: "aborted"` |
| New session | ✅ Clears UI, resets agent |
| Auto-reconnect | ✅ Reconnects after disconnect |

### How to run

```bash
cd piwab
npm install
npm run dev        # or: npx tsx bridge/index.ts
# Open http://localhost:3210
```

## Phase 2 — Useful (Next)

Add the things that make it actually usable day-to-day:

- [ ] **State display** — model, thinking level, token usage in footer (poll `get_state` / `get_session_stats`)
- [ ] **Model selector** — dropdown from `get_available_models`, `set_model` command
- [ ] **Thinking level toggle** — off/low/medium/high via `set_thinking_level`
- [ ] **Better tool rendering** — syntax-highlighted bash output, file read previews, copy button
- [ ] **Multi-line input** — Shift+Enter (done), basic markdown preview
- [ ] **Session history** — sidebar with session list, resume via `switch_session`
- [ ] **Steering / follow-up** — queue messages while agent is running

## Phase 3 — Powerful

- [ ] **Extension UI support** — handle `extension_ui_request` dialogs (select, confirm, input, editor) as modals
- [ ] **File attachments** — drag & drop images, send via `images` field
- [ ] **Command palette** — type `/` to see `get_commands`, quick access to skills/templates
- [ ] **Thinking display** — collapsible thinking blocks with full content
- [ ] **Multiple sessions / tabs** — run multiple pi processes in parallel
- [ ] **Share / export** — `export_html`, GitHub gist via `/share`

## Phase 4 — Polished

- [ ] **Theme support** — dark/light matching pi's TUI themes
- [ ] **Keyboard shortcuts** — Ctrl+L model selector, Shift+Tab thinking cycle, Ctrl+K command palette
- [ ] **Notifications** — sound/visual when agent finishes
- [ ] **Mobile-friendly** — responsive layout
- [ ] **Config** — `~/.piwab.json` for defaults, CLI flags
- [ ] **Package as `npx piwab`** — one-command startup from anywhere

# Agent Instructions — PiWAB

This document provides context and guidelines for AI agents working on the PiWAB codebase.

## Project Overview

PiWAB (Pi Web Agent Bridge) is a thin WebSocket bridge that connects a browser-based chat UI to a `pi` CLI agent running in RPC mode. It is intentionally minimal — the bridge is just a pipe; all agent logic lives in pi.

## Architecture

- **Bridge** (`bridge/index.ts`): Node.js WebSocket server that spawns `pi --mode rpc`, serves the web client, and pipes JSONL between browser and pi process.
- **Web Client** (`web/index.html`): Single-file chat UI with zero build dependencies. Handles streaming text, tool call cards, thinking blocks, command palette, and footer status.
- **Protocol**: JSONL over stdin/stdout — each line is a JSON object with a `type` field.

## Key Conventions

### Bridge
- The bridge is a simple pipe — **no business logic** should live here
- JSONL parsing splits on `\n` only (per pi's RPC spec)
- Auto-reconnect: if pi dies, the bridge respawns it
- Only one browser client at a time (new connections replace old ones)
- CLI flags: `--port` (default 3210), `--cwd` (working directory for pi)

### Web Client
- **No build step** — everything lives in a single HTML file
- No framework — vanilla JS with direct DOM manipulation
- Dark theme with CSS custom properties in `:root`
- All RPC communication goes through the `sendRpc()` helper
- Events from pi are handled by the `handleEvent()` dispatcher
- RPC responses (e.g., `get_state`, `set_model`) are handled by `handleResponse()`

### RPC Message Types (pi → browser)
- `agent_start` / `agent_end` — stream lifecycle
- `message_start` / `message_update` / `message_end` — message lifecycle
- `tool_execution_start` / `tool_execution_update` / `tool_execution_end` — tool calls
- `response` — RPC command responses (has `command`, `success`, `data` fields)

### RPC Commands (browser → pi)
- `prompt` — send a user message
- `abort` — stop current generation
- `new_session` — clear and reset
- `get_state` — model, thinking level, etc.
- `set_model` / `get_available_models` — model management
- `set_thinking_level` / `cycle_thinking_level` — thinking config
- `get_commands` — list available slash commands
- `get_session_stats` — token usage, context usage
- `compact` — compact conversation context
- `export_html` — export session

## Development Workflow

1. `npm run dev` starts the bridge on port 3210
2. Open `http://localhost:3210` — the web client is served directly
3. Edit `web/index.html` and refresh the browser (no build step)
4. Edit `bridge/index.ts` and restart `npm run dev`

## Design Principles

- **Minimal bridge** — the bridge should be ~130 lines. If it's growing, something belongs in pi, not here.
- **Single-file UI** — the web client stays as one HTML file. No splitting into JS/CSS files unless the file becomes unwieldy (>2000 lines).
- **No frameworks** — keep the vanilla approach. No React, no Vue, no build tools.
- **pi does the work** — if a feature requires agent logic (file access, auth, session management), it should be handled by pi's RPC API, not reimplemented in the bridge.

## Common Tasks

### Adding a new RPC command
1. Add the command to the web client's `sendRpc()` calls
2. Handle the response in `handleResponse()` in `web/index.html`
3. No bridge changes needed — it's just a pipe

### Adding a new UI feature
1. Add HTML structure in `web/index.html`
2. Add CSS in the `<style>` block
3. Add JS logic in the `<script>` block
4. Wire up to RPC via `sendRpc()` / `handleEvent()` / `handleResponse()`

### Adding a CLI flag to the bridge
1. Parse the flag in the CLI args section of `bridge/index.ts`
2. Pass it to the relevant component (HTTP server, pi spawn, etc.)

## Files to Edit

| Change | File(s) |
|--------|---------|
| Bridge logic / pi spawning | `bridge/index.ts` |
| UI / chat interface | `web/index.html` |
| Dependencies | `package.json` |
| TypeScript config | `tsconfig.json` |
| Agent instructions (this file) | `agents.md` |
| Product requirements | `PRD.md` |

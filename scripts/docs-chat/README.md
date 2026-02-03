# Docs Chat Prototype

Minimal docs chatbot that reads source docs, builds a section index, and answers
questions from those excerpts via OpenAI.

## Build the index

```bash
pnpm docs:chat:index
```

This generates `scripts/docs-chat/search-index.json` from `docs/**/*.md`.

## Run the API

```bash
OPENAI_API_KEY=sk-... pnpm docs:chat:serve
```

Defaults to `http://localhost:3001`. Health check:

```bash
curl http://localhost:3001/health
```

## Mintlify widget

Mintlify loads any `.js` in the docs content directory on every page.
`docs/assets/docs-chat-widget.js` injects a floating “Ask Molty 🦞" button and
calls the API at:

```
window.DOCS_CHAT_API_URL || "http://localhost:3001"
```

To use a deployed API, set `window.DOCS_CHAT_API_URL` before the widget runs
(for example by adding another small `.js` file in `docs/assets/` that sets it).

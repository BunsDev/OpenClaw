# Desktop Use Plugin

Lightweight OpenClaw computer-use plugin. It is cross-platform safe: on macOS it
uses Peekaboo; on other platforms it returns an explicit unsupported result
instead of crashing.

## Tool

`desktop_use`

Actions:

- `permissions` — check Screen Recording / Accessibility status
- `see` — capture annotated UI map and screenshot
- `capture` — capture screen/window/frontmost image
- `click`, `type`, `press`, `scroll`, `focus` — basic interactive actions;
  require `confirm: true` after explicit approval

## Safety

- Uses `execFile`, not shell interpolation.
- Defaults to `--no-remote` local Peekaboo execution.
- Redacts typed text from tool result args.
- Interactive actions require `confirm: true`; inspect/capture actions do not.

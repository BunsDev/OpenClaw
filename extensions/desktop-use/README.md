# Desktop Use Plugin

Thin OpenClaw tool plugin for the external OpenCoven `coven-desktop-use` adapter.

The plugin intentionally does not own platform automation. It maps OpenClaw tool
calls to adapter CLI arguments and lets OpenClaw enforce tool policy / approval
gates.

## Tool

`desktop_use`

Actions:

- `permissions` — ask the adapter for desktop permission/backend status
- `see` — capture annotated UI map and screenshot
- `capture` — capture screen/window/frontmost image
- `click`, `type`, `press`, `scroll`, `focus` — basic interactive actions;
  require `confirm: true` after explicit approval

## Adapter

Default binary:

```bash
coven-desktop-use
```

Override for development:

```bash
COVEN_DESKTOP_USE_BIN=/path/to/coven-desktop-use
```

## Safety

- Uses `execFile`, not shell interpolation.
- Keeps platform-specific automation outside OpenClaw core.
- Redacts typed text from tool result args.
- Interactive actions require `confirm: true`; inspect/capture actions do not.

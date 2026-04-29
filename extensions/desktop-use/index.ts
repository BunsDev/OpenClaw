import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createDesktopUseTool } from "./src/tool.js";

export default definePluginEntry({
  id: "desktop-use",
  name: "Desktop Use",
  description:
    "Lightweight cross-platform-safe computer-use tools. Uses Peekaboo on macOS and returns graceful unsupported results elsewhere.",
  register(api) {
    api.registerTool(createDesktopUseTool(), { name: "desktop_use" });
  },
});

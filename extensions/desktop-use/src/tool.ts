import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Static, Type } from "typebox";

const execFileAsync = promisify(execFile);

const MAX_TEXT_BYTES = 10_000;
const MAX_PATH_BYTES = 2_048;
const DEFAULT_TIMEOUT_MS = 30_000;
const CAPTURE_TIMEOUT_MS = 45_000;

const CaptureMode = Type.Union([
  Type.Literal("screen"),
  Type.Literal("window"),
  Type.Literal("frontmost"),
  Type.Literal("auto"),
]);
const ImageFormat = Type.Union([Type.Literal("png"), Type.Literal("jpg")]);

const DesktopUseToolSchema = Type.Object(
  {
    action: Type.Union(
      [
        Type.Literal("permissions"),
        Type.Literal("see"),
        Type.Literal("capture"),
        Type.Literal("click"),
        Type.Literal("type"),
        Type.Literal("press"),
        Type.Literal("scroll"),
        Type.Literal("focus"),
      ],
      { description: "Desktop action to perform." },
    ),
    app: Type.Optional(Type.String({ description: "Target app name, bundle id, or PID:123." })),
    windowTitle: Type.Optional(Type.String({ description: "Partial target window title." })),
    windowId: Type.Optional(Type.Number({ description: "CoreGraphics window id." })),
    screenIndex: Type.Optional(Type.Number({ minimum: 0 })),
    mode: Type.Optional(CaptureMode),
    path: Type.Optional(Type.String({ description: "Output image path for capture/see." })),
    format: Type.Optional(ImageFormat),
    annotate: Type.Optional(
      Type.Boolean({ description: "Annotate UI elements for see. Default true." }),
    ),
    retina: Type.Optional(Type.Boolean({ description: "Capture at Retina resolution." })),
    analyze: Type.Optional(
      Type.String({ description: "Optional Peekaboo image/see analysis prompt." }),
    ),
    on: Type.Optional(
      Type.String({ description: "Peekaboo element id from desktop_use action=see, e.g. B1." }),
    ),
    query: Type.Optional(Type.String({ description: "Element text/query for click fallback." })),
    coords: Type.Optional(Type.String({ description: "Coordinate fallback in x,y form." })),
    double: Type.Optional(Type.Boolean()),
    right: Type.Optional(Type.Boolean()),
    text: Type.Optional(Type.String({ description: "Text for type action." })),
    clear: Type.Optional(Type.Boolean()),
    pressReturn: Type.Optional(Type.Boolean()),
    keys: Type.Optional(Type.Array(Type.String(), { description: "Keys for press action." })),
    direction: Type.Optional(
      Type.Union([
        Type.Literal("up"),
        Type.Literal("down"),
        Type.Literal("left"),
        Type.Literal("right"),
      ]),
    ),
    amount: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
    confirm: Type.Optional(
      Type.Boolean({
        description:
          "Required for interactive actions (click/type/press/scroll/focus) after user approval.",
      }),
    ),
    timeoutMs: Type.Optional(Type.Number({ minimum: 1000, maximum: 120000 })),
    noRemote: Type.Optional(
      Type.Boolean({ description: "Force local Peekaboo execution. Default true." }),
    ),
  },
  { additionalProperties: false },
);

type DesktopUseParams = Static<typeof DesktopUseToolSchema>;

type ToolResult = {
  content: [{ type: "text"; text: string }];
  details: unknown;
};

export function createDesktopUseTool() {
  return {
    name: "desktop_use",
    label: "Desktop Use",
    description:
      "Lightweight computer-use wrapper. On macOS it uses Peekaboo for permissions, annotated UI inspection, screenshots, and approved basic actions. On other platforms it returns unsupported gracefully.",
    parameters: DesktopUseToolSchema,
    async execute(_toolCallId: string, rawParams: unknown): Promise<ToolResult> {
      const params = normalizeParams(rawParams as DesktopUseParams);
      if (process.platform !== "darwin") {
        return jsonResult({
          supported: false,
          platform: process.platform,
          backend: "peekaboo",
          message:
            "desktop_use currently supports macOS via Peekaboo. This platform is unsupported.",
        });
      }

      if (params.action === "permissions") {
        return runPeekabooTool(["permissions"], params);
      }

      if (
        ["click", "type", "press", "scroll", "focus"].includes(params.action) &&
        params.confirm !== true
      ) {
        return jsonResult({
          ok: false,
          requiresConfirmation: true,
          action: params.action,
          message:
            "Interactive desktop actions require confirm:true after explicit user approval. Use permissions/see/capture freely first.",
        });
      }

      switch (params.action) {
        case "see":
          return runPeekabooTool(buildSeeArgs(params), params, CAPTURE_TIMEOUT_MS);
        case "capture":
          return runPeekabooTool(buildCaptureArgs(params), params, CAPTURE_TIMEOUT_MS);
        case "click":
          return runPeekabooTool(buildClickArgs(params), params);
        case "type":
          return runPeekabooTool(buildTypeArgs(params), params);
        case "press":
          return runPeekabooTool(buildPressArgs(params), params);
        case "scroll":
          return runPeekabooTool(buildScrollArgs(params), params);
        case "focus":
          return runPeekabooTool(buildFocusArgs(params), params);
        default:
          throw new ToolInputError(`Unsupported action: ${String(params.action)}`);
      }
    },
  };
}

function normalizeParams(params: DesktopUseParams): DesktopUseParams {
  if (!params || typeof params !== "object") {
    throw new ToolInputError("Parameters are required.");
  }
  if (!params.action) {
    throw new ToolInputError("action is required.");
  }
  for (const [label, value] of Object.entries(params)) {
    if (typeof value === "string") {
      assertMaxBytes(value, label, label === "text" ? MAX_TEXT_BYTES : MAX_PATH_BYTES);
    }
  }
  if (params.coords && !/^\d{1,5},\d{1,5}$/.test(params.coords.trim())) {
    throw new ToolInputError("coords must be in x,y form, for example 120,240.");
  }
  return params;
}

async function runPeekabooTool(
  args: string[],
  params: DesktopUseParams,
  fallbackTimeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ToolResult> {
  const timeout = params.timeoutMs ?? fallbackTimeoutMs;
  const finalArgs = [...args, "--json"];
  if (params.noRemote !== false) {
    finalArgs.push("--no-remote");
  }
  try {
    const { stdout, stderr } = await execFileAsync("peekaboo", finalArgs, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    const parsed = parseJsonOrText(stdout);
    return jsonResult({
      ok: true,
      supported: true,
      platform: process.platform,
      backend: "peekaboo",
      args: redactArgsForDetails(finalArgs),
      result: parsed,
      stderr: stderr ? String(stderr) : undefined,
    });
  } catch (err) {
    const error = err as Error & {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      code?: string | number;
    };
    return jsonResult({
      ok: false,
      supported: true,
      platform: process.platform,
      backend: "peekaboo",
      args: redactArgsForDetails(finalArgs),
      error: error.message,
      code: error.code,
      stdout: error.stdout ? String(error.stdout).slice(0, 4000) : undefined,
      stderr: error.stderr ? String(error.stderr).slice(0, 4000) : undefined,
    });
  }
}

function buildSeeArgs(params: DesktopUseParams): string[] {
  const args = ["see"];
  addCommonTargetArgs(args, params);
  if (params.mode && params.mode !== "auto") args.push("--mode", params.mode);
  if (typeof params.screenIndex === "number")
    args.push("--screen-index", String(params.screenIndex));
  if (params.annotate !== false) args.push("--annotate");
  args.push("--path", normalizeOutputPath(params.path, "desktop-see", "png"));
  if (params.analyze) args.push("--analyze", params.analyze);
  return args;
}

function buildCaptureArgs(params: DesktopUseParams): string[] {
  const format = params.format ?? "png";
  const args = ["image", "--mode", params.mode ?? "frontmost", "--format", format];
  addCommonTargetArgs(args, params);
  if (typeof params.screenIndex === "number")
    args.push("--screen-index", String(params.screenIndex));
  if (params.retina) args.push("--retina");
  args.push("--path", normalizeOutputPath(params.path, "desktop-capture", format));
  if (params.analyze) args.push("--analyze", params.analyze);
  return args;
}

function buildClickArgs(params: DesktopUseParams): string[] {
  const args = ["click"];
  if (params.query) args.push(params.query);
  if (params.on) args.push("--on", params.on);
  if (params.coords) args.push("--coords", params.coords);
  if (params.double) args.push("--double");
  if (params.right) args.push("--right");
  addCommonTargetArgs(args, params);
  if (!params.query && !params.on && !params.coords) {
    throw new ToolInputError("click requires on, query, or coords.");
  }
  return args;
}

function buildTypeArgs(params: DesktopUseParams): string[] {
  if (!params.text) throw new ToolInputError("type requires text.");
  const args = ["type", params.text];
  if (params.clear) args.push("--clear");
  if (params.pressReturn) args.push("--return");
  addCommonTargetArgs(args, params);
  return args;
}

function buildPressArgs(params: DesktopUseParams): string[] {
  if (!params.keys?.length) throw new ToolInputError("press requires keys.");
  const args = ["press", ...params.keys];
  addCommonTargetArgs(args, params);
  return args;
}

function buildScrollArgs(params: DesktopUseParams): string[] {
  if (!params.direction) throw new ToolInputError("scroll requires direction.");
  const args = ["scroll", "--direction", params.direction, "--amount", String(params.amount ?? 3)];
  addCommonTargetArgs(args, params);
  return args;
}

function buildFocusArgs(params: DesktopUseParams): string[] {
  if (params.windowId || params.windowTitle || params.app) {
    const args = ["window", "focus"];
    addCommonTargetArgs(args, params);
    return args;
  }
  throw new ToolInputError("focus requires app, windowTitle, or windowId.");
}

function addCommonTargetArgs(args: string[], params: DesktopUseParams): void {
  if (params.app) args.push("--app", params.app);
  if (params.windowTitle) args.push("--window-title", params.windowTitle);
  if (typeof params.windowId === "number") args.push("--window-id", String(params.windowId));
}

function normalizeOutputPath(
  value: string | undefined,
  prefix: string,
  format: "png" | "jpg",
): string {
  if (value?.trim()) return value.trim();
  return path.join(os.tmpdir(), `openclaw-${prefix}-${Date.now()}.${format}`);
}

function parseJsonOrText(stdout: string | Buffer): unknown {
  const text = String(stdout || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { text: text.slice(0, 8000) };
  }
}

function redactArgsForDetails(args: string[]): string[] {
  const redacted = [...args];
  const typeIndex = redacted.indexOf("type");
  if (typeIndex >= 0 && redacted[typeIndex + 1]) {
    redacted[typeIndex + 1] = `<${Buffer.byteLength(redacted[typeIndex + 1], "utf8")}-byte text>`;
  }
  return redacted;
}

function jsonResult(payload: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function assertMaxBytes(value: string, label: string, maxBytes: number): void {
  if (Buffer.byteLength(value, "utf8") > maxBytes) {
    throw new ToolInputError(`${label} exceeds maximum size (${maxBytes} bytes).`);
  }
}

class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}

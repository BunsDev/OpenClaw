#!/usr/bin/env node
/**
 * Build a search index from docs/*.md for the docs-chat prototype.
 * Usage: node build-index.mjs [--out search-index.json] [--docs path/to/docs] [--base-url https://docs.openclaw.ai]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const defaultDocsDir = path.join(root, "docs");

const args = process.argv.slice(2);
let outPath = path.join(__dirname, "search-index.json");
let docsDir = defaultDocsDir;
let baseUrl = "https://docs.openclaw.ai";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out" && args[i + 1]) {
    outPath = path.resolve(args[++i]);
  } else if (args[i] === "--docs" && args[i + 1]) {
    docsDir = path.resolve(args[++i]);
  } else if (args[i] === "--base-url" && args[i + 1]) {
    baseUrl = args[++i].replace(/\/$/, "");
  }
}

function stripFrontmatter(content) {
  if (!content.startsWith("---")) return content;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return content;
  return content.slice(end + 4);
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === ".i18n" ||
        entry.name === "zh-CN" ||
        entry.name.startsWith(".")
      ) {
        continue;
      }
      files.push(...walk(full));
    } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function extractChunks(filePath, content) {
  const chunks = [];
  const lines = content.split(/\r?\n/);
  let currentTitle = "";
  let currentLines = [];

  const flush = (title, body) => {
    const text = body.trim();
    if (!text) return;
    const rel = path.relative(docsDir, filePath).replace(/\\/g, "/");
    const urlPath = rel.replace(/\.mdx?$/, "").replace(/^\/+/, "");
    chunks.push({
      path: rel,
      title: title || path.basename(rel, path.extname(rel)),
      content: text,
      url: `${baseUrl}/${urlPath}`,
    });
  };

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      flush(currentTitle, currentLines.join("\n"));
      currentTitle = heading[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flush(currentTitle, currentLines.join("\n"));
  return chunks;
}

const allChunks = [];
for (const filePath of walk(docsDir)) {
  const raw = fs.readFileSync(filePath, "utf8");
  const body = stripFrontmatter(raw);
  allChunks.push(...extractChunks(filePath, body));
}

const index = {
  baseUrl,
  builtAt: new Date().toISOString(),
  chunks: allChunks,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(index, null, 0), "utf8");
console.error(`Wrote ${allChunks.length} chunks to ${outPath}`);

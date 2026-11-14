#!/usr/bin/env node
// Checks every pack in the marketplace against the Workshop's launch policy: content only.
//
// Lloom applies the same table before it installs a pack (POLICY in Lloom's
// src-tauri/src/services/workshop/mod.rs). policy-fixture.json, kept identical in both
// repositories, pins the cases both must classify alike; `--self-test` checks this copy.
//
//   node scripts/check-packs.mjs [--root <marketplace dir>]   check every pack
//   node scripts/check-packs.mjs --self-test                  check the table against the fixture
//
// Prints one line per violation and exits 1 when there is any. Lines starting "note:" are things a
// reviewer should read (frontmatter that grants tools or declares hooks); they do not fail.

import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MARKETPLACE_NAME = "lloom-workshop";

const POLICY = {
  allowedTopLevel: [".claude-plugin", "skills", "agents", "commands", "output-styles", "themes", "lloom", "README.md", "LICENSE"],
  refusedTopLevel: {
    hooks: "hooks run commands inside Claude Code",
    ".mcp.json": "MCP servers run programs",
    ".lsp.json": "language servers run programs",
    monitors: "monitors run shell commands in the background",
    workflows: "workflows are scripts",
    bin: "bin/ puts executables on the shell's PATH",
  },
  allowedManifestKeys: [
    "$schema", "name", "displayName", "version", "description", "author", "homepage", "repository", "license",
    "keywords", "metadata", "defaultEnabled", "documentationUrl", "supportUrl", "privacyPolicyUrl",
    "termsOfServiceUrl", "skills", "commands", "agents", "outputStyles", "themes", "experimental",
  ],
  refusedManifestKeys: {
    hooks: "declares hooks, which run commands",
    mcpServers: "declares MCP servers, which run programs",
    lspServers: "declares language servers, which run programs",
    monitors: "declares monitors, which run shell commands",
    workflows: "declares workflows, which are scripts",
    channels: "binds message channels to MCP servers",
    userConfig: "asks for settings only code components read",
    dependencies: "installs other plugins this check does not see",
    types: "belongs to mods, which run code",
  },
  allowedExperimentalKeys: ["themes"],
  componentPathKeys: ["skills", "commands", "agents", "outputStyles", "themes"],
  componentFolders: ["skills", "commands", "agents", "output-styles", "themes"],
  allowedEntryKeys: [
    "name", "source", "description", "version", "author", "category", "tags", "keywords", "displayName",
    "homepage", "repository", "license", "metadata", "strict", "defaultEnabled", "relevance",
  ],
  textExtensions: ["md", "json", "txt", "yml", "yaml"],
  bareFiles: ["LICENSE"],
  attentionKeys: ["allowed-tools", "allowedTools", "tools", "hooks", "permissionMode", "mcpServers"],
  maxFileBytes: 256 * 1024,
  maxPackBytes: 2 * 1024 * 1024,
  maxEntries: 1000,
  maxDepth: 8,
  // Lloom's session guidance rules (services/custom_guidance.rs).
  maxGuidanceChars: 4000,
  maxDescriptionChars: 500,
};

const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isSafeName = (s) => typeof s === "string" && /^[A-Za-z0-9._-]+$/.test(s);
const isPackName = (s) => isSafeName(s) && /^[A-Za-z0-9]/.test(s);

function extensionAllowed(name) {
  if (POLICY.bareFiles.includes(name)) return true;
  const dot = name.lastIndexOf(".");
  return dot > 0 && POLICY.textExtensions.includes(name.slice(dot + 1));
}

function topLevelRefusal(name) {
  if (POLICY.allowedTopLevel.includes(name)) return null;
  if (own(POLICY.refusedTopLevel, name)) return `${name} is refused: ${POLICY.refusedTopLevel[name]}`;
  return `${name} is not allowed at the top of a pack`;
}

function manifestKeyRefusal(key) {
  if (own(POLICY.refusedManifestKeys, key)) return `plugin.json key "${key}" is refused: it ${POLICY.refusedManifestKeys[key]}`;
  if (!POLICY.allowedManifestKeys.includes(key)) return `plugin.json key "${key}" is not one a content pack may set`;
  return null;
}

function componentPathRefusal(key, path) {
  const rest = typeof path === "string" && path.startsWith("./") ? path.slice(2) : null;
  const first = rest === null ? undefined : rest.split("/").filter((p) => p !== "")[0];
  const inside =
    rest !== null &&
    first !== undefined &&
    POLICY.componentFolders.includes(first) &&
    !rest.includes("\\") &&
    rest.split("/").every((p) => p !== ".." && p !== ".");
  return inside ? null : `plugin.json ${key} points at ${JSON.stringify(path)}, outside the pack's component folders`;
}

function componentPaths(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(componentPaths);
  // The `commands` object map: each command reads a `source` file or inline `content`.
  if (value && typeof value === "object") {
    return Object.values(value)
      .map((v) => (v && typeof v === "object" ? v.source : undefined))
      .filter((s) => typeof s === "string");
  }
  return [];
}

// Top-level frontmatter keys, read leniently: only to name components and flag keys.
function frontmatter(raw) {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return [];
  const out = [];
  for (const line of text.slice(4).split("\n")) {
    if (line.trimEnd() === "---") break;
    if (/^[ \t#-]/.test(line)) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    if (key && !key.includes(" ")) out.push([key, line.slice(i + 1).trim()]);
  }
  return out;
}

function unquote(s) {
  const t = s.trim();
  for (const q of ['"', "'"]) {
    if (t.length >= 2 && t.startsWith(q) && t.endsWith(q)) return t.slice(1, -1);
  }
  return t;
}

const clip = (s, max) => ([...s].length <= max ? s : `${[...s].slice(0, max).join("")}…`);

// ── Session guidance offers: the rules of Lloom's custom_guidance.rs ────────────────────────

const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/u;
const ANY_CONTROL = /[\u0000-\u001F\u007F-\u009F]/u;
const BIDI = /[؜‎‏‪-‮⁦-⁩]/u;

// Windows passes guidance through a PowerShell 5.1 command line that quotes an argument only when
// some whitespace follows an even number of `"`.
function survivesPowershellQuoting(text) {
  let quotes = 0;
  let hasWhitespace = false;
  for (const c of text) {
    if (c === '"') quotes += 1;
    else if (/\s/u.test(c)) {
      if (quotes % 2 === 0) return true;
      hasWhitespace = true;
    }
  }
  return !hasWhitespace && quotes % 2 === 0;
}

function checkGuidanceText(text) {
  if (text.trim() === "") return "Guidance text is empty";
  const n = [...text].length;
  if (n > POLICY.maxGuidanceChars) {
    return `Guidance text is ${n.toLocaleString("en-US")} characters; the limit is ${POLICY.maxGuidanceChars.toLocaleString("en-US")}`;
  }
  const bad = [...text].find((c) => CONTROL.test(c) || BIDI.test(c));
  if (bad) {
    const code = bad.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
    return `Guidance text contains the control character U+${code}; only line breaks and tabs are allowed`;
  }
  if (!survivesPowershellQuoting(text)) return "Guidance text needs a space outside double quotes";
  return null;
}

function parseFields(front) {
  const lines = front.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const fields = new Map();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    i += 1;
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    if (/^[ \t]/.test(line)) throw new Error(`frontmatter line ${JSON.stringify(trimmed)} is indented under nothing`);
    const colon = line.indexOf(":");
    if (colon < 0) throw new Error(`frontmatter line ${JSON.stringify(trimmed)} is not \`key: value\``);
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    let parsed;
    if (value === "") {
      const items = [];
      while (i < lines.length && /^[ \t]/.test(lines[i])) {
        const item = lines[i].trim();
        i += 1;
        if (item === "") continue;
        if (!item.startsWith("-")) throw new Error(`${key}: expected a \`- item\` line, found ${JSON.stringify(item)}`);
        items.push(unquote(item.slice(1)));
      }
      parsed = items;
    } else if (value.startsWith("[")) {
      if (!value.endsWith("]")) throw new Error(`${key}: the list is not closed with ]`);
      parsed = value.slice(1, -1).split(",").map(unquote).filter((s) => s !== "");
    } else {
      parsed = unquote(value);
    }
    if (fields.has(key)) throw new Error(`${key} is set twice`);
    fields.set(key, parsed);
  }
  return fields;
}

// Every rule Lloom applies to `lloom/guidance/<stem>.md` except model support, which changes
// between Lloom releases. Returns the description, or throws with the reason.
function parseOffer(raw, stem) {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) throw new Error("the file does not open with a --- frontmatter block");
  const rest = text.slice(4);
  let offset = 0;
  let front = null;
  let body = "";
  for (const line of rest.split(/(?<=\n)/)) {
    if (line.trimEnd() === "---") {
      front = rest.slice(0, offset);
      body = rest.slice(offset + line.length);
      break;
    }
    offset += line.length;
  }
  if (front === null) throw new Error("the frontmatter block is not closed with ---");
  const fields = parseFields(front);
  const scalar = (key) => {
    const v = fields.get(key);
    if (Array.isArray(v)) throw new Error(`${key} must be a single value`);
    return v;
  };
  const name = scalar("name");
  if (name === undefined) throw new Error("frontmatter has no name");
  if (name !== stem) throw new Error(`name ${JSON.stringify(name)} does not match the file name ${JSON.stringify(stem)}.md`);
  const rawDescription = scalar("description");
  if (rawDescription === undefined) throw new Error("frontmatter has no description");
  const description = rawDescription.trim();
  if ([...description].length > POLICY.maxDescriptionChars) throw new Error(`description is longer than ${POLICY.maxDescriptionChars} characters`);
  if (ANY_CONTROL.test(description) || BIDI.test(description)) throw new Error("description must be one line without control characters");
  if (description === "") throw new Error("description is empty");
  const why = checkGuidanceText(body.replace(/^\n+/, "").trimEnd());
  if (why) throw new Error(why);
  return description;
}

// ── One pack ──────────────────────────────────────────────────────────────────────────────

function walk(dir, prefix, depth, w, out) {
  let names;
  try {
    names = readdirSync(dir).sort();
  } catch (e) {
    out.violations.push(`${prefix}: cannot be listed: ${e.message}`);
    return;
  }
  for (const name of names) {
    if (w.stopped) return;
    w.entries += 1;
    if (w.entries > POLICY.maxEntries) {
      out.violations.push(`the pack holds more than ${POLICY.maxEntries} files and folders`);
      w.stopped = true;
      return;
    }
    const rel = `${prefix}${name}`;
    if (depth === 0) {
      const why = topLevelRefusal(name);
      if (why) {
        out.violations.push(why);
        continue;
      }
    }
    if (!isSafeName(name)) {
      out.violations.push(`${rel}: names may use only letters, digits, '.', '_' and '-'`);
      continue;
    }
    const path = join(dir, name);
    const st = lstatSync(path);
    if (st.isSymbolicLink()) {
      out.violations.push(`${rel} is a symlink`);
    } else if (st.isDirectory()) {
      if (depth + 1 >= POLICY.maxDepth) out.violations.push(`${rel} nests deeper than ${POLICY.maxDepth} levels`);
      else walk(path, `${rel}/`, depth + 1, w, out);
    } else if (st.isFile()) {
      if (!extensionAllowed(name)) out.violations.push(`${rel}: only .md, .json, .txt, .yml and .yaml files are allowed`);
      if (st.size > POLICY.maxFileBytes) out.violations.push(`${rel} is over the ${POLICY.maxFileBytes / 1024} KB file limit`);
      w.total += st.size;
      w.files.push({ rel, path, size: st.size });
    } else {
      out.violations.push(`${rel} is not a regular file or folder`);
    }
  }
}

const readSmall = (f) => (f.size > POLICY.maxFileBytes ? null : readFileSync(f.path, "utf8"));

function checkManifest(dir, expectedName, out) {
  const path = join(dir, ".claude-plugin", "plugin.json");
  let manifest;
  try {
    const st = lstatSync(path);
    if (!st.isFile() || st.size > POLICY.maxFileBytes) {
      out.violations.push(".claude-plugin/plugin.json is not a readable file under the size limit");
      return;
    }
  } catch {
    out.violations.push("the pack has no .claude-plugin/plugin.json");
    return;
  }
  try {
    manifest = JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
  } catch (e) {
    out.violations.push(`.claude-plugin/plugin.json is not valid JSON: ${e.message}`);
    return;
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    out.violations.push(".claude-plugin/plugin.json is not a JSON object");
    return;
  }
  if (typeof manifest.name !== "string") out.violations.push("plugin.json has no name");
  else if (manifest.name !== expectedName) {
    out.violations.push(`plugin.json name ${JSON.stringify(manifest.name)} differs from the pack folder and marketplace entry ${JSON.stringify(expectedName)}`);
  }
  out.version = typeof manifest.version === "string" ? manifest.version : null;
  if (!out.version || out.version.trim() === "") out.violations.push("plugin.json has no version");

  for (const [key, value] of Object.entries(manifest)) {
    const why = manifestKeyRefusal(key);
    if (why) {
      out.violations.push(why);
      continue;
    }
    if (POLICY.componentPathKeys.includes(key)) {
      for (const p of componentPaths(value)) {
        const bad = componentPathRefusal(key, p);
        if (bad) out.violations.push(bad);
      }
    }
    if (key === "experimental" && value && typeof value === "object") {
      for (const [sub, subValue] of Object.entries(value)) {
        if (!POLICY.allowedExperimentalKeys.includes(sub)) {
          out.violations.push(`plugin.json key "experimental.${sub}" is not one a content pack may set`);
          continue;
        }
        for (const p of componentPaths(subValue)) {
          const bad = componentPathRefusal(`experimental.${sub}`, p);
          if (bad) out.violations.push(bad);
        }
      }
    }
  }
}

function flagAttention(f, raw, out) {
  for (const [key, value] of frontmatter(raw)) {
    if (POLICY.attentionKeys.includes(key)) out.attention.push(`${f.rel}: ${key}: ${clip(value, 80)}`);
  }
  if (raw.includes("!`")) out.attention.push(`${f.rel}: runs a shell command when it loads (!\`…\`)`);
}

const frontmatterName = (raw) => {
  const hit = frontmatter(raw).find(([k]) => k === "name");
  const v = hit ? unquote(hit[1]) : "";
  return v === "" ? null : v;
};

function componentName(rel, last) {
  const stem = rel.replace(/\.(md|json)$/, "");
  const parts = stem.split("/");
  if (last) parts[parts.length - 1] = last;
  return parts.join(":");
}

function collectContents(dir, files, out) {
  const under = (folder, ext) => files.filter((f) => f.rel.startsWith(`${folder}/`) && f.rel.endsWith(ext));
  let skillNames = [];
  try {
    skillNames = readdirSync(join(dir, "skills")).filter(isSafeName).sort();
  } catch {
    // No skills folder.
  }
  for (const name of skillNames) {
    const f = files.find((x) => x.rel === `skills/${name}/SKILL.md`);
    if (!f) {
      out.violations.push(`skills/${name} is not a skill folder with a SKILL.md`);
      continue;
    }
    const raw = readSmall(f) ?? "";
    flagAttention(f, raw, out);
    out.contents.skills.push(frontmatterName(raw) ?? name);
  }
  for (const f of under("agents", ".md")) {
    const raw = readSmall(f) ?? "";
    flagAttention(f, raw, out);
    out.contents.agents.push(componentName(f.rel.slice("agents/".length), frontmatterName(raw)));
  }
  for (const f of under("commands", ".md")) {
    flagAttention(f, readSmall(f) ?? "", out);
    out.contents.commands.push(componentName(f.rel.slice("commands/".length), null));
  }
  for (const f of under("output-styles", ".md")) {
    out.contents.outputStyles.push(componentName(f.rel.slice("output-styles/".length), frontmatterName(readSmall(f) ?? "")));
  }
  for (const f of under("themes", ".json")) {
    try {
      const v = JSON.parse(readSmall(f) ?? "");
      out.contents.themes.push(typeof v?.name === "string" ? v.name : componentName(f.rel.slice("themes/".length), null));
    } catch {
      out.violations.push(`${f.rel} is not valid JSON`);
    }
  }
  for (const f of files.filter((x) => x.rel.startsWith("lloom/guidance/"))) {
    const tail = f.rel.slice("lloom/guidance/".length);
    if (!tail.endsWith(".md") || tail.includes("/")) continue;
    const stem = tail.slice(0, -3);
    try {
      const raw = readSmall(f);
      if (raw === null) throw new Error("cannot be read");
      out.contents.guidance.push({ name: stem, description: parseOffer(raw, stem) });
    } catch (e) {
      out.violations.push(`${f.rel}: ${e.message}`);
    }
  }
}

function inspectPack(dir, expectedName) {
  const out = {
    version: null,
    contents: { skills: [], agents: [], commands: [], outputStyles: [], themes: [], guidance: [] },
    violations: [],
    attention: [],
  };
  const w = { files: [], entries: 0, total: 0, stopped: false };
  walk(dir, "", 0, w, out);
  if (w.total > POLICY.maxPackBytes) out.violations.push(`the pack is over the ${POLICY.maxPackBytes / (1024 * 1024)} MB limit`);
  checkManifest(dir, expectedName, out);
  collectContents(dir, w.files, out);
  return out;
}

// ── The marketplace ───────────────────────────────────────────────────────────────────────

function checkMarketplace(root) {
  const problems = [];
  const notes = [];
  let market;
  try {
    market = JSON.parse(readFileSync(join(root, ".claude-plugin", "marketplace.json"), "utf8").replace(/^﻿/, ""));
  } catch (e) {
    return { problems: [`.claude-plugin/marketplace.json: ${e.message}`], notes, packs: 0 };
  }
  if (market.name !== MARKETPLACE_NAME) problems.push(`marketplace.json: name must be "${MARKETPLACE_NAME}"`);
  if (typeof market.owner?.name !== "string" || market.owner.name.trim() === "") problems.push("marketplace.json: owner.name is required");
  if (own(market, "allowCrossMarketplaceDependenciesOn")) {
    problems.push("marketplace.json: allowCrossMarketplaceDependenciesOn is refused: packs do not depend on other marketplaces");
  }
  const entries = Array.isArray(market.plugins) ? market.plugins : [];
  if (!Array.isArray(market.plugins)) problems.push("marketplace.json: plugins must be a list");

  const seen = new Set();
  for (const [i, entry] of entries.entries()) {
    const name = entry?.name;
    const label = isPackName(name) ? `plugins/${name}` : `plugins[${i}]`;
    if (!isPackName(name)) {
      problems.push(`${label}: marketplace entry name ${JSON.stringify(name)} is not a safe pack name`);
      continue;
    }
    if (seen.has(name)) problems.push(`${label}: listed twice in marketplace.json`);
    seen.add(name);
    const expected = `./plugins/${name}`;
    if (entry.source !== expected) {
      problems.push(`${label}: source must be "${expected}"; the entry has ${JSON.stringify(entry.source)}`);
      continue;
    }
    for (const key of Object.keys(entry)) {
      if (!POLICY.allowedEntryKeys.includes(key)) {
        problems.push(`${label}: marketplace entry key "${key}" is not allowed: a pack declares its components in its own plugin.json`);
      }
    }
    const dir = join(root, "plugins", name);
    let st;
    try {
      st = lstatSync(dir);
    } catch {
      problems.push(`${label}: the folder does not exist`);
      continue;
    }
    if (st.isSymbolicLink() || !st.isDirectory()) {
      problems.push(`${label}: must be a folder, not a symlink or file`);
      continue;
    }
    const result = inspectPack(dir, name);
    if (typeof entry.version === "string" && result.version !== null && entry.version !== result.version) {
      problems.push(`${label}: the entry's version "${entry.version}" differs from plugin.json's "${result.version}"`);
    }
    for (const v of result.violations) problems.push(`${label}: ${v}`);
    for (const a of result.attention) notes.push(`note: ${label}/${a}`);
  }

  try {
    if (lstatSync(join(root, "plugins")).isSymbolicLink()) problems.push("plugins/ must be a folder, not a symlink");
    for (const name of readdirSync(join(root, "plugins"))) {
      if (!seen.has(name)) problems.push(`plugins/${name}: not listed in marketplace.json`);
    }
  } catch {
    // No plugins folder: every listed entry already reported its missing folder.
  }
  return { problems, notes, packs: seen.size };
}

// ── Self-test against the shared fixture ──────────────────────────────────────────────────

function selfTest(fixturePath) {
  const fx = JSON.parse(readFileSync(fixturePath, "utf8"));
  const failures = [];
  const expect = (ok, what) => {
    if (!ok) failures.push(what);
  };
  const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  expect(sameList(fx.allowedTopLevel, POLICY.allowedTopLevel), "allowedTopLevel differs from POLICY");
  for (const n of fx.refusedTopLevel) expect(topLevelRefusal(n) !== null, `top-level ${n} should be refused`);
  for (const k of fx.allowedManifestKeys) expect(manifestKeyRefusal(k) === null, `manifest key ${k} should be allowed`);
  for (const k of fx.refusedManifestKeys) expect(manifestKeyRefusal(k) !== null, `manifest key ${k} should be refused`);
  expect(sameList(fx.allowedExperimentalKeys, POLICY.allowedExperimentalKeys), "allowedExperimentalKeys differs from POLICY");
  expect(sameList(fx.allowedEntryKeys, POLICY.allowedEntryKeys), "allowedEntryKeys differs from POLICY");
  for (const n of fx.allowedFileNames) expect(extensionAllowed(n), `file ${n} should be allowed`);
  for (const n of fx.refusedFileNames) expect(!extensionAllowed(n), `file ${n} should be refused`);
  for (const n of fx.unsafeNames) expect(!isSafeName(n), `name ${JSON.stringify(n)} should be unsafe`);
  for (const p of fx.allowedComponentPaths) expect(componentPathRefusal("skills", p) === null, `component path ${p} should be allowed`);
  for (const p of fx.refusedComponentPaths) expect(componentPathRefusal("skills", p) !== null, `component path ${p} should be refused`);
  for (const k of fx.attentionKeys) expect(POLICY.attentionKeys.includes(k), `attention key ${k} missing`);
  expect(fx.limits.maxFileBytes === POLICY.maxFileBytes, "maxFileBytes differs");
  expect(fx.limits.maxPackBytes === POLICY.maxPackBytes, "maxPackBytes differs");
  expect(fx.limits.maxEntries === POLICY.maxEntries, "maxEntries differs");
  expect(fx.limits.maxDepth === POLICY.maxDepth, "maxDepth differs");
  expect(fx.limits.maxGuidanceChars === POLICY.maxGuidanceChars, "maxGuidanceChars differs");
  return failures;
}

function main(argv) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  if (argv.includes("--self-test")) {
    const failures = selfTest(join(scriptDir, "policy-fixture.json"));
    for (const f of failures) console.log(`self-test: ${f}`);
    console.log(failures.length === 0 ? "self-test passed" : `self-test failed: ${failures.length}`);
    return failures.length === 0 ? 0 : 1;
  }
  const at = argv.indexOf("--root");
  const root = at >= 0 && argv[at + 1] ? resolve(argv[at + 1]) : resolve(scriptDir, "..");
  const { problems, notes, packs } = checkMarketplace(root);
  for (const n of notes) console.log(n);
  for (const p of problems) console.log(p);
  console.log(`${packs} pack${packs === 1 ? "" : "s"} checked, ${problems.length} violation${problems.length === 1 ? "" : "s"}`);
  return problems.length === 0 ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));

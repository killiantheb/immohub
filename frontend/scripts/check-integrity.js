#!/usr/bin/env node
/**
 * check-integrity.js — Althy codebase integrity checker.
 *
 * Checks:
 *   A. Broken internal links (href, router.push/replace)
 *   B. Mute buttons (no onClick, type="submit", type="reset", or disabled)
 *   C. Hardcoded hex colors outside allowed files (warning)
 *   D. Local color constants (const S = {...}, const ORANGE = ...) (warning)
 *   E. Backend endpoints returning fake success with TODO nearby
 *
 * Usage:
 *   node scripts/check-integrity.js           # warnings for C/D, errors for A/B/E
 *   node scripts/check-integrity.js --strict  # everything is an error
 *   node scripts/check-integrity.js --json    # JSON output
 *   node scripts/check-integrity.js --fix     # (future) auto-fix some issues
 *
 * Exit codes: 0 = pass, 1 = errors found
 */

const fs = require("fs");
const path = require("path");

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const JSON_OUT = args.includes("--json");
const VERBOSE = args.includes("--verbose");

// ── Paths ────────────────────────────────────────────────────────────────────

const FRONTEND = path.resolve(__dirname, "..");
const ROOT = path.resolve(FRONTEND, "..");
const SRC = path.join(FRONTEND, "src");
const APP_DIR = path.join(SRC, "app");
const BACKEND_ROUTERS = path.join(ROOT, "backend", "app", "routers");
const BACKEND_TASKS = path.join(ROOT, "backend", "app", "tasks");

// ── Colors ───────────────────────────────────────────────────────────────────

const isTTY = process.stdout.isTTY && !JSON_OUT;
const c = {
  red: (s) => (isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s) => (isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (isTTY ? `\x1b[33m${s}\x1b[0m` : s),
  cyan: (s) => (isTTY ? `\x1b[36m${s}\x1b[0m` : s),
  dim: (s) => (isTTY ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s) => (isTTY ? `\x1b[1m${s}\x1b[0m` : s),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function walkDir(dir, ext, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkDir(full, ext, results);
    } else if (entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function readLines(filePath) {
  return fs.readFileSync(filePath, "utf-8").split("\n");
}

function relPath(abs) {
  return path.relative(ROOT, abs).replace(/\\/g, "/");
}

// ── A. Route checking ────────────────────────────────────────────────────────

function discoverRoutes() {
  const pages = walkDir(APP_DIR, "page.tsx");
  const routes = new Set();

  for (const p of pages) {
    // Convert file path to route
    let route = path
      .relative(APP_DIR, path.dirname(p))
      .replace(/\\/g, "/")
      .replace(/\(([^)]+)\)\/?/g, "") // strip route groups like (dashboard), (auth)
      .replace(/\/+/g, "/")
      .replace(/^\/|\/$/g, "");

    route = "/" + (route || "");
    // Normalize: /app/app/ → /app/ (the app dir is at src/app/app/)
    // Actually the route for src/app/app/(dashboard)/biens/page.tsx is /app/biens
    // src/app/page.tsx → /
    // src/app/app/(dashboard)/biens/page.tsx → /app/biens
    // src/app/(auth)/login/page.tsx → /login

    routes.add(route);
  }

  return routes;
}

function normalizeRoute(route) {
  // Remove query params and hash
  return route.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
}

function routeMatches(href, routes) {
  const normalized = normalizeRoute(href);
  if (routes.has(normalized)) return true;

  // Check dynamic segments: /app/biens/[id] should match /app/biens/xxx
  for (const route of routes) {
    if (!route.includes("[")) continue;
    const pattern = route.replace(/\[([^\]]+)\]/g, "[^/]+");
    const re = new RegExp(`^${pattern}$`);
    if (re.test(normalized)) return true;
  }

  return false;
}

function checkRoutes() {
  const issues = [];
  const routes = discoverRoutes();
  const tsxFiles = walkDir(SRC, ".tsx");

  // Patterns to find internal links
  const hrefRe = /href=["'](\/[^"'{}$`]+)["']/g;
  const pushRe = /router\.(push|replace)\(["'](\/[^"'{}$`]+)["']/g;

  // Also catch template literals with static paths
  const pushTemplateRe = /router\.(push|replace)\(`(\/[^`{}$]+)`/g;

  for (const file of tsxFiles) {
    const lines = readLines(file);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      for (const re of [hrefRe, pushRe, pushTemplateRe]) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(line)) !== null) {
          const href = match[re === hrefRe ? 1 : 2];
          // Skip external and anchor links
          if (href.startsWith("/api/") || href.startsWith("/#")) continue;
          // Skip _next internal
          if (href.startsWith("/_next/")) continue;

          // Only check /app/* routes and known public routes
          if (!routeMatches(href, routes)) {
            issues.push({
              file: relPath(file),
              line: lineNum,
              href,
              message: `Broken link: ${href}`,
            });
          }
        }
      }
    }
  }

  return issues;
}

// ── B. Mute buttons ─────────────────────────────────────────────────────────

function checkButtons() {
  const issues = [];
  const tsxFiles = walkDir(SRC, ".tsx");

  for (const file of tsxFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");

    // Find <button that spans possibly multiple lines
    // We'll use a simple state machine approach
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/<button\b/.test(line)) continue;

      // Collect the full button opening tag (may span multiple lines)
      let tagContent = line;
      let j = i;
      // Keep reading until we find > that closes the opening tag
      while (!/>/.test(tagContent.slice(tagContent.indexOf("<button"))) && j < i + 10) {
        j++;
        if (j < lines.length) tagContent += " " + lines[j];
      }

      // Extract just the opening tag
      const btnStart = tagContent.indexOf("<button");
      const btnEnd = tagContent.indexOf(">", btnStart);
      if (btnEnd === -1) continue;
      const tag = tagContent.slice(btnStart, btnEnd + 1);

      // Check for action attributes
      const hasOnClick = /onClick\s*[={]/.test(tag);
      const hasSubmit = /type\s*=\s*["']submit["']/.test(tag);
      const hasReset = /type\s*=\s*["']reset["']/.test(tag);
      const hasDisabled = /disabled\s*[={]/.test(tag) || /disabled\s*>/.test(tag);
      // type="button" with onClick is fine, type="button" alone is also intentional
      const hasTypeButton = /type\s*=\s*["']button["']/.test(tag);

      if (!hasOnClick && !hasSubmit && !hasReset && !hasDisabled && !hasTypeButton) {
        // Get some context for the label
        const labelMatch = tagContent.slice(btnEnd + 1).match(/^([^<]{0,80})/);
        const label = (labelMatch ? labelMatch[1] : "").trim().slice(0, 60);

        issues.push({
          file: relPath(file),
          line: i + 1,
          label: label || "(no text content)",
          message: `Mute button: no onClick, type="submit/reset/button", or disabled`,
        });
      }
    }
  }

  return issues;
}

// ── C. Hardcoded hex colors ──────────────────────────────────────────────────

const HEX_ALLOWED_PATHS = [
  "components/map/",
  "app/globals.css",
  "lib/design-tokens",
  "components/landing/LandingHeroMap",
  // page.tsx landing has ORANGE_HEX for Mapbox
];

// Known hex values that are OK (CSS var definitions, Tailwind defaults)
const HEX_ALLOWLIST = new Set([
  // Google OAuth SVG colors
  "#4285F4", "#34A853", "#FBBC05", "#EA4335",
]);

function checkHexColors() {
  const issues = [];
  const tsxFiles = walkDir(SRC, ".tsx");
  const hexRe = /#([0-9A-Fa-f]{6})\b/g;

  for (const file of tsxFiles) {
    const rel = relPath(file);
    // Skip allowed paths
    if (HEX_ALLOWED_PATHS.some((p) => rel.includes(p))) continue;

    const lines = readLines(file);
    for (let i = 0; i < lines.length; i++) {
      hexRe.lastIndex = 0;
      let match;
      while ((match = hexRe.exec(lines[i])) !== null) {
        const hex = "#" + match[1].toUpperCase();

        // Skip allowlisted
        if (HEX_ALLOWLIST.has(hex)) continue;

        // Skip if in a comment
        const before = lines[i].slice(0, match.index);
        if (before.includes("//") || before.includes("/*")) continue;

        // Skip Mapbox ORANGE_HEX constant declarations
        if (/const\s+ORANGE_HEX/.test(lines[i])) continue;

        issues.push({
          file: rel,
          line: i + 1,
          hex,
          message: `Hardcoded hex: ${hex}`,
        });
      }
    }
  }

  return issues;
}

// ── D. Local color constants ─────────────────────────────────────────────────

const COLOR_CONST_ALLOWED = [
  "components/map/",
  "lib/design-tokens",
  "app/globals.css",
  "app/page.tsx", // ORANGE_HEX for Mapbox landing
];

// Structural S blocks that are OK (CSSProperties, not color maps)
const S_BLOCK_ALLOWED = [
  "DashboardSidebar.tsx",
  "AgendaContent.tsx",
  "MessagerieContent.tsx",
  "WhatsAppContent.tsx",
];

function checkColorConstants() {
  const issues = [];
  const tsxFiles = walkDir(SRC, ".tsx");

  const constSRe = /^.*const\s+S\s*=\s*\{/;
  const colorConstRe = /const\s+(ORANGE|DARK|MUTED|BG|LIGHT|PRIMARY|TEXT_COLOR|BORDER_COLOR)\s*=/;

  for (const file of tsxFiles) {
    const rel = relPath(file);
    const basename = path.basename(file);

    if (COLOR_CONST_ALLOWED.some((p) => rel.includes(p))) continue;

    const lines = readLines(file);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check const S = { ... }
      if (constSRe.test(line) && !S_BLOCK_ALLOWED.includes(basename)) {
        issues.push({
          file: rel,
          line: i + 1,
          message: `Local color map: const S = { ... } — use C from @/lib/design-tokens`,
        });
      }

      // Check const ORANGE = ... etc
      if (colorConstRe.test(line)) {
        issues.push({
          file: rel,
          line: i + 1,
          message: `Color constant: ${line.trim().slice(0, 60)} — use C from @/lib/design-tokens`,
        });
      }
    }
  }

  return issues;
}

// ── E. Backend fake success ──────────────────────────────────────────────────

function checkBackendFakeSuccess() {
  const issues = [];
  const dirs = [BACKEND_ROUTERS, BACKEND_TASKS];

  for (const dir of dirs) {
    const pyFiles = walkDir(dir, ".py");
    for (const file of pyFiles) {
      const lines = readLines(file);
      const totalLines = lines.length;

      for (let i = 0; i < totalLines; i++) {
        const line = lines[i];

        // Look for TODO/FIXME/HACK near a return with status/success/sent
        if (!/\b(TODO|FIXME|HACK|STUB)\b/i.test(line)) continue;

        // Check surrounding lines (5 above, 5 below) for suspicious returns
        const start = Math.max(0, i - 5);
        const end = Math.min(totalLines - 1, i + 5);
        const window = lines.slice(start, end + 1).join("\n");

        if (/return\s*.*["'](status|success|sent|ok)["']/i.test(window) ||
            /["']status["']\s*:\s*["'](sent|ok|success)["']/i.test(window) ||
            /\bstatus\b.*=.*["'](sent|ok|success)["']/i.test(window)) {
          issues.push({
            file: relPath(file),
            line: i + 1,
            message: `Potential fake success: TODO near return with status "sent/ok/success"`,
            context: line.trim().slice(0, 80),
          });
        }
      }
    }
  }

  return issues;
}

// ── Reporter ─────────────────────────────────────────────────────────────────

function runAllChecks() {
  const results = {
    A: { name: "Broken links", level: "error", issues: checkRoutes() },
    B: { name: "Mute buttons", level: "error", issues: checkButtons() },
    C: { name: "Hardcoded hex", level: STRICT ? "error" : "warning", issues: checkHexColors() },
    D: { name: "Color constants", level: STRICT ? "error" : "warning", issues: checkColorConstants() },
    E: { name: "Backend fake success", level: "error", issues: checkBackendFakeSuccess() },
  };

  return results;
}

function printReport(results) {
  if (JSON_OUT) {
    const output = {};
    for (const [key, check] of Object.entries(results)) {
      output[key] = {
        name: check.name,
        level: check.level,
        count: check.issues.length,
        issues: check.issues,
      };
    }
    output.summary = {
      errors: Object.values(results)
        .filter((r) => r.level === "error")
        .reduce((sum, r) => sum + r.issues.length, 0),
      warnings: Object.values(results)
        .filter((r) => r.level === "warning")
        .reduce((sum, r) => sum + r.issues.length, 0),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log("");
  console.log(c.bold("  ALTHY — Integrity Check"));
  console.log(c.dim("  " + new Date().toISOString().slice(0, 19)));
  console.log("");

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const [key, check] of Object.entries(results)) {
    const count = check.issues.length;
    const isError = check.level === "error";

    if (count === 0) {
      console.log(`  ${c.green("PASS")}  ${key}. ${check.name}`);
    } else if (isError) {
      console.log(`  ${c.red("FAIL")}  ${key}. ${check.name} — ${count} error(s)`);
      totalErrors += count;
    } else {
      console.log(`  ${c.yellow("WARN")}  ${key}. ${check.name} — ${count} warning(s)`);
      totalWarnings += count;
    }

    if (count > 0 && (VERBOSE || count <= 20)) {
      for (const issue of check.issues) {
        const loc = `${issue.file}:${issue.line}`;
        const icon = isError ? c.red("  x") : c.yellow("  !");
        console.log(`${icon} ${c.dim(loc)} ${issue.message}`);
      }
    } else if (count > 20 && !VERBOSE) {
      // Show first 10 and last 5
      for (const issue of check.issues.slice(0, 10)) {
        const loc = `${issue.file}:${issue.line}`;
        const icon = isError ? c.red("  x") : c.yellow("  !");
        console.log(`${icon} ${c.dim(loc)} ${issue.message}`);
      }
      console.log(c.dim(`    ... ${count - 15} more (use --verbose to see all)`));
      for (const issue of check.issues.slice(-5)) {
        const loc = `${issue.file}:${issue.line}`;
        const icon = isError ? c.red("  x") : c.yellow("  !");
        console.log(`${icon} ${c.dim(loc)} ${issue.message}`);
      }
    }
    console.log("");
  }

  // Summary
  console.log(c.bold("  Summary"));
  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(`  ${c.green("All checks passed.")}`);
  } else {
    if (totalErrors > 0) console.log(`  ${c.red(`${totalErrors} error(s)`)}`);
    if (totalWarnings > 0) console.log(`  ${c.yellow(`${totalWarnings} warning(s)`)}`);
  }
  console.log("");

  return totalErrors;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const results = runAllChecks();
const errors = printReport(results);
process.exit(errors > 0 ? 1 : 0);

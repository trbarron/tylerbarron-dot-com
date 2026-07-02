// Fast-fail validation for Camel Up Cup bot submissions.
//
// This is a UX courtesy, not the security boundary: the tournament Lambda
// re-validates with a real Python AST walk (Camel_Up_Cup_2K18
// lambda/sandbox.py) before executing anything. Keep ALLOWED_IMPORTS in sync
// with that file.

export const MAX_BOT_FILE_BYTES = 64 * 1024;

export const BOT_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{2,23}$/;

export const ALLOWED_IMPORTS = new Set([
  "math", "random", "itertools", "functools", "collections", "heapq",
  "bisect", "statistics", "operator", "copy", "time", "hashlib", "uuid",
  "dataclasses", "enum", "typing", "string", "array", "decimal", "fractions",
  "camelup", "playerinterface",
]);

const BANNED_CALL_RE = /\b(exec|eval|compile|open|input|breakpoint|__import__|globals|locals|vars)\s*\(/;
const DUNDER_ATTR_RE = /\.\s*__\w+__/;

export function validateBotName(name: unknown): string | null {
  if (typeof name !== "string" || !BOT_NAME_RE.test(name)) {
    return "Bot name must be 3–24 characters: letters, digits, underscores, starting with a letter.";
  }
  return null;
}

export function validateAuthor(author: unknown): string | null {
  if (typeof author !== "string" || author.trim().length === 0 || author.length > 40) {
    return "Author name is required (max 40 characters).";
  }
  return null;
}

/** Returns a list of problems (empty = passes the fast checks). */
export function validateBotCode(code: unknown): string[] {
  if (typeof code !== "string" || code.trim().length === 0) {
    return ["Bot file is empty."];
  }
  if (new TextEncoder().encode(code).length > MAX_BOT_FILE_BYTES) {
    return [`Bot file is too large (max ${MAX_BOT_FILE_BYTES / 1024} KB).`];
  }

  const errors: string[] = [];

  for (const match of code.matchAll(/^[ \t]*(?:import[ \t]+([\w., \t]+)|from[ \t]+([\w.]+)[ \t]+import)/gm)) {
    const modules = match[1] ? match[1].split(",") : [match[2]];
    for (const mod of modules) {
      const root = mod.trim().split(/[ \t]/)[0].split(".")[0];
      if (root && !ALLOWED_IMPORTS.has(root)) {
        errors.push(`Import of '${root}' is not allowed. Bots are stdlib-compute only.`);
      }
    }
  }

  if (BANNED_CALL_RE.test(code)) {
    errors.push("Calls to exec/eval/open/__import__ and similar are not allowed.");
  }
  if (DUNDER_ATTR_RE.test(code)) {
    errors.push("Dunder attribute access (like .__globals__) is not allowed.");
  }
  if (!/^[ \t]*class[ \t]+\w+/m.test(code) || !/def[ \t]+move[ \t]*\(/.test(code)) {
    errors.push("The file must define a class with a move(player, gamestate) method.");
  }

  return errors;
}

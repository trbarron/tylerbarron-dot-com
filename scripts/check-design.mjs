#!/usr/bin/env node
/**
 * CI guard: the DESIGN.md rules that a class name can break.
 *
 *   radius   no rounded corners (rounded-full is fine: dots, spinners, radios)
 *   shadow   no box shadows; depth comes from borders
 *   italic   no italic text
 *   color    no hues in the UI layer: the palette is black, white and grays
 *   font     font-neo / font-mono, never Tailwind's font-sans
 *
 * It reads every string literal in app/ (class names live in className="…",
 * template literals and class constants alike) and flags those tokens,
 * with or without variants (hover:shadow-lg, md:rounded).
 *
 * A deliberate exception carries a comment naming the rule and why:
 *   - `design-allow: color — <why>` on the line, or the line above, allows that line;
 *   - `design-allow-file: color — <why>` anywhere allows the rule for the whole file.
 * Game displays that need color (board arrows, ready dots) are the usual case.
 *
 * Dependency-free on purpose so CI can run it without `npm ci`.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const appDir = path.join(root, 'app');

const HUES = 'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const RULES = {
  radius:
    /^rounded(?:-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|[tblrse]|tl|tr|bl|br|ss|se|es|ee)(?:-(?:xs|sm|md|lg|xl|2xl|3xl|4xl))?)?$/,
  shadow: /^shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl|inner|\[.*\]))?$/,
  italic: /^italic$/,
  color: new RegExp(
    `^(?:bg|text|border(?:-[trblxyse])?|ring|outline|fill|stroke|from|via|to|accent|divide|decoration|caret|placeholder)-(?:${HUES})-\\d{2,3}(?:\\/\\d+)?$|^bg-(?:gradient|linear|radial|conic)-`,
  ),
  font: /^font-sans$/,
};

/** Every .ts/.tsx file under app/. */
function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/**
 * The string literals in a file, with the line each token sits on. A small
 * scanner rather than a regex, so quotes inside comments and the other kind
 * of quote inside a string don't derail it.
 */
function stringTokens(source) {
  const tokens = [];
  let line = 1;
  let i = 0;
  const push = (text, startLine) => {
    let l = startLine;
    for (const part of text.split(/(\s+)/)) {
      if (/^\s+$/.test(part)) l += (part.match(/\n/g) ?? []).length;
      else if (part) tokens.push({ token: part, line: l });
    }
  };
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '\n') {
      line++;
      i++;
    } else if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      line += (source.slice(i, stop).match(/\n/g) ?? []).length;
      i = stop;
    } else if (c === '"' || c === "'" || c === '`') {
      const startLine = line;
      let j = i + 1;
      let text = '';
      while (j < source.length && source[j] !== c) {
        if (source[j] === '\\') {
          text += source[j + 1] ?? '';
          j += 2;
          continue;
        }
        // A template literal's ${…} is code: scan it for its own strings
        // (`${on ? 'bg-black' : 'bg-white'}`) and keep it out of this one.
        if (c === '`' && source[j] === '$' && source[j + 1] === '{') {
          let depth = 1;
          const exprStart = j + 2;
          j += 2;
          while (j < source.length && depth > 0) {
            if (source[j] === '{') depth++;
            else if (source[j] === '}') depth--;
            j++;
          }
          const expr = source.slice(exprStart, j - 1);
          const exprLine = startLine + (text.match(/\n/g) ?? []).length;
          for (const t of stringTokens(expr)) tokens.push({ token: t.token, line: exprLine + t.line - 1 });
          text += ' ' + '\n'.repeat((expr.match(/\n/g) ?? []).length);
          continue;
        }
        text += source[j];
        j++;
      }
      push(text, startLine);
      line += (text.match(/\n/g) ?? []).length;
      i = j + 1;
    } else {
      i++;
    }
  }
  return tokens;
}

/** The utility itself, without variants: `md:hover:rounded-lg` → `rounded-lg`. */
function utility(token) {
  // Variants end at the last colon outside brackets.
  let depth = 0;
  let cut = -1;
  for (let k = 0; k < token.length; k++) {
    if (token[k] === '[') depth++;
    else if (token[k] === ']') depth--;
    else if (token[k] === ':' && depth === 0) cut = k;
  }
  return token.slice(cut + 1).replace(/^!|!$/g, '');
}

const failures = [];
for (const file of sourceFiles(appDir)) {
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split('\n');
  const fileAllows = new Set(
    [...source.matchAll(/design-allow-file:\s*([a-z, ]+)/g)].flatMap((m) => m[1].split(/[ ,]+/)),
  );
  const lineAllows = (n, rule) =>
    [lines[n - 1], lines[n - 2]].some((l) => l && new RegExp(`design-allow:[^\\n]*\\b${rule}\\b`).test(l));

  for (const { token, line } of stringTokens(source)) {
    const u = utility(token);
    for (const [rule, pattern] of Object.entries(RULES)) {
      if (!pattern.test(u) || fileAllows.has(rule) || lineAllows(line, rule)) continue;
      failures.push(`${path.relative(root, file)}:${line}  ${rule}: ${token}`);
    }
  }
}

if (failures.length) {
  console.error(`✗ ${failures.length} class(es) break DESIGN.md:\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    '\nFix them, or mark a deliberate exception with a `design-allow: <rule> — <why>` comment' +
      ' (that line or the one above) or `design-allow-file: <rule> — <why>` (the whole file).',
  );
  process.exit(1);
}
console.log('✓ No classes break DESIGN.md (radius, shadow, italic, color, font).');

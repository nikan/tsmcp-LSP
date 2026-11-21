#!/usr/bin/env node
// Fails if any locale is missing keys (or has empty values) compared to the source locale.
// Usage: node scripts/check-i18n.mjs <locales-dir> <source-locale>
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [dir = 'apps/web/src/locales', source = 'en'] = process.argv.slice(2);

if (!existsSync(dir)) {
  console.log(`check-i18n: ${dir} not found, skipping.`);
  process.exit(0);
}

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? flatten(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]],
  );

const load = (file) => new Map(flatten(JSON.parse(readFileSync(join(dir, file), 'utf8'))));

const sourceFile = `${source}.json`;
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
if (!files.includes(sourceFile)) {
  console.error(`check-i18n: source locale ${sourceFile} not found in ${dir}`);
  process.exit(1);
}

const base = load(sourceFile);
let failed = false;

for (const file of files.filter((f) => f !== sourceFile)) {
  const keys = load(file);
  const missing = [...base.keys()].filter((k) => !keys.has(k) || keys.get(k) === '');
  const extra = [...keys.keys()].filter((k) => !base.has(k));
  if (missing.length) {
    failed = true;
    console.error(`✖ ${file}: ${missing.length} missing/empty\n  ${missing.join('\n  ')}`);
  }
  if (extra.length) {
    console.warn(
      `⚠ ${file}: ${extra.length} not in ${sourceFile} (remove or add to source)\n  ${extra.join('\n  ')}`,
    );
  }
  if (!missing.length && !extra.length) console.log(`✔ ${file}`);
}

process.exit(failed ? 1 : 0);

#!/usr/bin/env node
/**
 * Deterministic gate: every locale must key-match `src/i18n/en`, the source of truth.
 * Fails on missing files, missing/extra keys, and placeholder mismatches.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i18nDir = resolve(root, 'src/i18n');
const sourceLocale = 'en';

const flattenLeaves = (object, prefix = '') =>
  Object.entries(object).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? flattenLeaves(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]]
  );

const placeholders = (value) =>
  typeof value === 'string'
    ? [...new Set([...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]))].sort().join(',')
    : '';

const jsonFiles = (dir) =>
  readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort();
const locales = readdirSync(i18nDir)
  .filter((name) => statSync(join(i18nDir, name)).isDirectory() && name !== sourceLocale)
  .sort();

const sourceFiles = jsonFiles(join(i18nDir, sourceLocale));
const problems = [];

for (const locale of locales) {
  for (const file of sourceFiles) {
    const localePath = join(i18nDir, locale, file);
    if (!existsSync(localePath)) {
      problems.push(`${locale}/${file}: file missing`);
      continue;
    }

    const source = new Map(
      flattenLeaves(JSON.parse(readFileSync(join(i18nDir, sourceLocale, file), 'utf8')))
    );
    const target = new Map(flattenLeaves(JSON.parse(readFileSync(localePath, 'utf8'))));

    for (const key of source.keys()) {
      if (!target.has(key)) {
        problems.push(`${locale}/${file}: missing key ${key}`);
        continue;
      }
      if (placeholders(source.get(key)) !== placeholders(target.get(key))) {
        problems.push(
          `${locale}/${file}: placeholder mismatch on ${key} (en: ${placeholders(source.get(key))}, ${locale}: ${placeholders(target.get(key))})`
        );
      }
    }
    for (const key of target.keys()) {
      if (!source.has(key))
        problems.push(`${locale}/${file}: extra key ${key} (stale? remove or re-add to en)`);
    }
  }
  for (const file of jsonFiles(join(i18nDir, locale))) {
    if (!sourceFiles.includes(file))
      problems.push(`${locale}/${file}: no en counterpart (stale file?)`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  console.error(`✗ i18n parity: ${problems.length} problem(s) against en`);
  process.exit(1);
}

console.log(
  `✓ i18n parity: ${locales.length} locale(s) × ${sourceFiles.length} namespace(s) in sync with en`
);

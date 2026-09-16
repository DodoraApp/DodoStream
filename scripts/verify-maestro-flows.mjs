#!/usr/bin/env node
/**
 * Deterministic gate: `.maestro` flow references must resolve.
 * Validates the `flows:` globs in config.yaml, every `runFlow:` target (inline and
 * nested `path:` form), and that no flow file on disk is orphaned from the globs.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const maestroDir = resolve(root, '.maestro');
const flowsDir = join(maestroDir, 'flows');

const problems = [];

const config = readFileSync(join(maestroDir, 'config.yaml'), 'utf8');
if (!/^flows:\s*$/m.test(config)) {
  console.error('✗ .maestro/config.yaml has no flows: section');
  process.exit(1);
}

const afterFlows = config.slice(config.search(/^flows:\s*$/m));
const globs = [];
for (const line of afterFlows.split('\n').slice(1)) {
  const item = line.match(/^\s*-\s*(\S+)\s*$/);
  if (item) {
    globs.push(item[1]);
    continue;
  }
  if (line.trim() && !line.trim().startsWith('#')) break;
}

const globToRegExp = (pattern) =>
  new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\\\]]/g, '\\$&')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.')}$`
  );

const flowFiles = readdirSync(flowsDir).filter((file) => /\.ya?ml$/.test(file));
const declared = new Set();
for (const glob of globs) {
  const matcher = globToRegExp(glob);
  for (const file of flowFiles) {
    const rel = relative(maestroDir, join(flowsDir, file));
    if (matcher.test(rel)) declared.add(rel);
  }
}
for (const file of flowFiles) {
  const rel = relative(maestroDir, join(flowsDir, file));
  if (!declared.has(rel))
    problems.push(`${rel}: on disk but not matched by any config.yaml flows glob`);
}
if (declared.size === 0) problems.push('config.yaml flows globs match no flow files');

const resolveTarget = (fromFile, target) => {
  const cleaned = target.replace(/^['"]|['"]$/g, '');
  if (cleaned.startsWith('~')) return null;
  return cleaned.startsWith('/')
    ? join(maestroDir, cleaned)
    : resolve(dirname(join(maestroDir, fromFile)), cleaned);
};

for (const file of [...declared].sort()) {
  const lines = readFileSync(join(maestroDir, file), 'utf8').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const inline = lines[index].match(/^\s*-\s*runFlow:\s*(\S+)\s*$/);
    if (inline) {
      const target = resolveTarget(file, inline[1]);
      if (target && !existsSync(target))
        problems.push(`${file}: runFlow target not found: ${inline[1]}`);
      continue;
    }
    if (!/^\s*-\s*runFlow:\s*$/.test(lines[index])) continue;
    const indent = lines[index].indexOf('-');
    let childIndent = -1;
    for (let next = index + 1; next < lines.length; next += 1) {
      const column = lines[next].search(/\S/);
      if (column === -1) continue;
      if (column <= indent) break;
      if (childIndent === -1) childIndent = column;
      if (column !== childIndent) continue;
      const path = lines[next].match(/^\s*path:\s*(\S+)\s*$/);
      if (path) {
        const target = resolveTarget(file, path[1]);
        if (target && !existsSync(target))
          problems.push(`${file}: runFlow path not found: ${path[1]}`);
        break;
      }
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  console.error(`✗ Maestro flow integrity: ${problems.length} problem(s)`);
  process.exit(1);
}

console.log(`✓ Maestro flow integrity: ${declared.size} flow(s), all runFlow references resolve`);

#!/usr/bin/env node
/**
 * Build-time script to generate the What's New registry from markdown files.
 * Matches the pattern in scripts/embed-web-ui.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const sourceDir = resolve(root, 'src/constants/whats-new');
const outputFile = resolve(sourceDir, '_registry.ts');

/**
 * Parse a filename to extract id, version, and slug.
 * Pattern: NNNN-vX.Y.Z-slug.md
 */
function parseFilename(filename) {
  const name = basename(filename, extname(filename));
  const match = name.match(/^(\d{4})-(v[\d.]+)-(.+)$/);
  if (!match) {
    console.warn(`⚠️ Skipping ${filename} — does not match pattern NNNN-vX.Y.Z-slug.md`);
    return null;
  }
  return {
    id: match[1],
    version: match[2],
    slug: match[3],
    filename: name,
  };
}

/**
 * Extract the first H1 heading from markdown content.
 */
function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

/**
 * Find the image file for a given markdown file.
 * Priority: .webp > .png > .jpg
 */
function findImageFile(basePath) {
  const extensions = ['.webp', '.png', '.jpg'];
  for (const ext of extensions) {
    const imagePath = `${basePath}${ext}`;
    if (existsSync(resolve(sourceDir, imagePath))) {
      return imagePath;
    }
  }
  return null;
}

// Main generation logic
function generate() {
  // Ensure directory exists
  if (!existsSync(sourceDir)) {
    console.error(`❌ Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  // Read all .md files
  const files = readdirSync(sourceDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort();

  const entries = [];
  const seenIds = new Set();

  for (const file of files) {
    const parsed = parseFilename(file);
    if (!parsed) continue;

    const { id, version, filename } = parsed;
    if (seenIds.has(id)) {
      console.warn(`⚠️ Duplicate ID ${id} in ${file} — skipping (first occurrence wins)`);
      continue;
    }
    seenIds.add(id);
    const content = readFileSync(resolve(sourceDir, file), 'utf-8');
    const title = extractTitle(content);
    // Strip the first H1 (the title) — it's rendered as the entry header, not the body
    const body = content.replace(/^#\s+.+$/m, '').trim();
    const imageFile = findImageFile(filename);

    const entry = {
      id,
      version,
      title,
      body,
      image: imageFile,
    };

    entries.push(entry);
  }

  // Generate TypeScript output
  const imports = `// AUTO-GENERATED — do not edit. Run pnpm generate-whats-new to regenerate.

import type { WhatsNewEntry } from '@/types/whats-new';\n`;

  const entriesArray = entries
    .map((entry) => {
      const imageLine = entry.image ? `    image: require('./${entry.image}'),` : '    // no image';

      return `  {
    id: '${entry.id}',
    version: '${entry.version}',
    title: '${entry.title.replace(/'/g, "\\'")}',
    body: \`${entry.body.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`,
${imageLine}
  }`;
    })
    .join(',\n');

  const output = `${imports}
export const whatsNewEntries: WhatsNewEntry[] = [
${entriesArray}
];
`;

  writeFileSync(outputFile, output, 'utf-8');
  console.log(
    `✓ Generated What's New registry with ${entries.length} entries → ${outputFile.replace(root + '/', '')}`
  );
}

generate();

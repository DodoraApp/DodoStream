#!/usr/bin/env node
/**
 * Scaffold script to create a new What's New entry.
 * Usage: pnpm new-whats-new "v2.0.0" "Feature Name"
 */
import { writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const sourceDir = resolve(root, 'src/constants/whats-new');

/**
 * Convert a feature name to a URL-friendly slug.
 */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Get the next available ID (4-digit number).
 */
function getNextId() {
  if (!existsSync(sourceDir)) {
    return '0001';
  }

  const files = readdirSync(sourceDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => f.match(/^(\d{4})/)?.[1])
    .filter(Boolean)
    .sort();

  if (files.length === 0) {
    return '0001';
  }

  const lastId = parseInt(files[files.length - 1], 10);
  return String(lastId + 1).padStart(4, '0');
}

// Main scaffolding logic
function scaffold() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: pnpm new-whats-new "vX.Y.Z" "Feature Name"');
    console.error('Example: pnpm new-whats-new "v2.0.0" "New Player Engine"');
    process.exit(1);
  }

  const version = args[0];
  const featureName = args[1];

  // Validate version format
  if (!/^v?\d+\.\d+\.\d+$/.test(version)) {
    console.error(`❌ Invalid version format: ${version}`);
    console.error('Expected format: vX.Y.Z (e.g., v2.0.0)');
    process.exit(1);
  }

  // Normalize version to start with 'v'
  const normalizedVersion = version.startsWith('v') ? version : `v${version}`;

  const slug = slugify(featureName);
  if (!slug) {
    console.error('❌ Could not derive a slug from the feature name');
    process.exit(1);
  }
  const id = getNextId();
  const filename = `${id}-${normalizedVersion}-${slug}.md`;
  const filepath = resolve(sourceDir, filename);

  // Ensure directory exists
  if (!existsSync(sourceDir)) {
    mkdirSync(sourceDir, { recursive: true });
  }

  // Check for conflicts
  if (existsSync(filepath)) {
    console.error(`❌ File already exists: ${filepath}`);
    process.exit(1);
  }

  // Create template content
  const template = `# ${featureName}

Describe the new feature here. You can use markdown:

- **Bold text** for emphasis
- *Italic text* for style
- [Links](https://example.com) for references
- Lists for structure

## How to Use

Explain how users can access or use this feature.

## Notes

Any additional notes or known limitations.
`;

  writeFileSync(filepath, template, 'utf-8');

  console.log(`✓ Created What's New entry: ${filename}`);
  console.log(`  Location: src/constants/whats-new/${filename}`);
  console.log(`  ID: ${id}`);
  console.log(`  Version: ${normalizedVersion}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Edit the markdown file to add your content');
  console.log(`  2. Optionally add an image: ${id}-${normalizedVersion}-${slug}.png`);
  console.log('  3. Run: pnpm generate-whats-new');
}

scaffold();

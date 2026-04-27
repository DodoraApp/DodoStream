#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const html = readFileSync(resolve(root, 'remote-ui/dist/index.html'), 'utf-8');
const escaped = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const output = `// AUTO-GENERATED — do not edit. Run pnpm build:ui to regenerate.\nexport const WEB_UI_HTML = \`${escaped}\`;\n`;

writeFileSync(resolve(root, 'src/api/local-server/web-ui.ts'), output, 'utf-8');
console.log('✓ Embedded web UI into src/api/local-server/web-ui.ts');

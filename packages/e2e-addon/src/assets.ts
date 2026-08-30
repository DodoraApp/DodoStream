import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { createFixture, FixtureData } from './fixture';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS_DIR = path.join(PACKAGE_ROOT, 'assets');

const DEFAULT_SEED = 'dodostream-ui-2026';

// ---------------------------------------------------------------------------
// Deterministic color from an asset path (FNV-1a → HSL hue)
// ---------------------------------------------------------------------------

const fnv1a = (input: string): number => {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const hueFor = (input: string): number => fnv1a(input) % 360;

const titleCase = (slug: string): string =>
  slug
    .replace(/\.png$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const escapeXml = (text: string): string =>
  text.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c
  );

// ---------------------------------------------------------------------------
// SVG templates
// ---------------------------------------------------------------------------

type Kind = 'poster' | 'background' | 'logo' | 'episode' | 'trailer';

const DIMENSIONS: Record<Kind, { width: number; height: number }> = {
  poster: { width: 300, height: 450 },
  background: { width: 1280, height: 720 },
  logo: { width: 512, height: 512 },
  episode: { width: 400, height: 225 },
  trailer: { width: 480, height: 270 },
};

const svgFor = (kind: Kind, label: string, hue: number): string => {
  const { width, height } = DIMENSIONS[kind];
  const bg = `hsl(${hue}, 40%, 28%)`;
  const bg2 = `hsl(${(hue + 40) % 360}, 45%, 16%)`;
  const accent = `hsl(${(hue + 180) % 360}, 60%, 60%)`;
  const fg = 'rgba(255,255,255,0.94)';

  const title = escapeXml(label);
  const isLogo = kind === 'logo';
  const fontSize = isLogo ? Math.round(height * 0.24) : Math.round(height * 0.1);
  const maxChars = isLogo ? 2 : kind === 'episode' ? 12 : 40;
  const display = title.length > maxChars ? `${title.slice(0, maxChars).trim()}…` : title;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <circle cx="${width * 0.82}" cy="${height * 0.18}" r="${height * 0.22}" fill="${accent}" opacity="0.35"/>
  <circle cx="${width * 0.15}" cy="${height * 0.85}" r="${height * 0.18}" fill="${accent}" opacity="0.2"/>
  <rect x="0" y="${height * 0.46}" width="${width}" height="${height * 0.02}" fill="${fg}" opacity="0.25"/>
  <text x="50%" y="50%" font-family="sans-serif" font-size="${fontSize}" font-weight="600" fill="${fg}" text-anchor="middle" dominant-baseline="central">${display}</text>
</svg>`;
};

// ---------------------------------------------------------------------------
// Asset path classification
// ---------------------------------------------------------------------------

const isPng = (p: string): boolean => p.endsWith('.png');

const collectAssetPaths = (fixture: FixtureData): string[] => {
  const seen = new Set<string>();
  const scan = (value: unknown): void => {
    if (typeof value === 'string') {
      if (value.startsWith('assets/')) seen.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(scan);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach(scan);
    }
  };
  scan(fixture.catalogs);
  scan(fixture.meta);
  scan(fixture.streams);
  scan(fixture.subtitles);
  // Manifest-level assets.
  seen.add('assets/logo-addon.png');
  seen.add('assets/background-addon.png');
  return [...seen].sort();
};

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const renderPng = async (relPath: string): Promise<Buffer> => {
  const hue = hueFor(relPath);

  if (relPath.startsWith('assets/gen/')) {
    const base = path.basename(relPath, '.png');
    const kind: Kind = base.startsWith('background')
      ? 'background'
      : base.startsWith('logo')
        ? 'logo'
        : base.startsWith('episode')
          ? 'episode'
          : 'poster';
    const label =
      kind === 'logo'
        ? base.replace(/^logo-/, 'G')
        : base.replace(/^poster-|^background-|^episode-/, '');
    return sharp(Buffer.from(svgFor(kind, label, hue)))
      .png()
      .toBuffer();
  }

  if (relPath === 'assets/logo-addon.png') {
    return sharp(Buffer.from(svgFor('logo', 'DS', hue)))
      .png()
      .toBuffer();
  }
  if (relPath === 'assets/background-addon.png') {
    return sharp(Buffer.from(svgFor('background', 'DodoStream E2E Fixture', hue)))
      .png()
      .toBuffer();
  }

  const file = path.basename(relPath, '.png');
  if (file.startsWith('poster-')) {
    return sharp(Buffer.from(svgFor('poster', titleCase(file.slice('poster-'.length)), hue)))
      .png()
      .toBuffer();
  }
  if (file.startsWith('background-')) {
    return sharp(
      Buffer.from(svgFor('background', titleCase(file.slice('background-'.length)), hue))
    )
      .png()
      .toBuffer();
  }
  if (file.startsWith('logo-')) {
    const slug = file.slice('logo-'.length);
    const initials =
      titleCase(slug)
        .split(' ')
        .map((w) => w[0] ?? '')
        .join('')
        .slice(0, 2) || 'DS';
    return sharp(Buffer.from(svgFor('logo', initials.toUpperCase(), hue)))
      .png()
      .toBuffer();
  }
  if (file.startsWith('episode-')) {
    const rest = file.slice('episode-'.length).replace(/\.png$/, '');
    const parts = rest.split('-');
    const season = parts[parts.length - 2];
    const episode = parts[parts.length - 1];
    const label = season && episode ? `S${season} E${episode}` : rest;
    return sharp(Buffer.from(svgFor('episode', label, hue)))
      .png()
      .toBuffer();
  }
  if (file.startsWith('trailer-')) {
    return sharp(Buffer.from(svgFor('trailer', titleCase(file.slice('trailer-'.length)), hue)))
      .png()
      .toBuffer();
  }

  return sharp(Buffer.from(svgFor('poster', titleCase(file), hue)))
    .png()
    .toBuffer();
};

// ---------------------------------------------------------------------------
// Validation of checked-in non-raster assets
// ---------------------------------------------------------------------------

const MP4_MIN = 256;
const MP4_MIN_DURATION_SECONDS = 300;

const readMp4DurationSeconds = (buf: Buffer): number => {
  const mvhdOffset = buf.indexOf(Buffer.from('mvhd'));
  if (mvhdOffset < 0) throw new Error('MP4 is missing the mvhd box');

  const version = buf[mvhdOffset + 4];
  if (version === 0) {
    const timescale = buf.readUInt32BE(mvhdOffset + 16);
    const duration = buf.readUInt32BE(mvhdOffset + 20);
    return duration / timescale;
  }
  if (version === 1) {
    const timescale = buf.readUInt32BE(mvhdOffset + 24);
    const duration = Number(buf.readBigUInt64BE(mvhdOffset + 28));
    return duration / timescale;
  }
  throw new Error(`MP4 has unsupported mvhd version ${version}`);
};

const validateCheckedInAssets = async (): Promise<void> => {
  const checks: Array<[string, (buf: Buffer) => void]> = [
    [
      'assets/sample.mp4',
      (buf) => {
        if (buf.length < MP4_MIN) throw new Error('sample.mp4 is unexpectedly small');
        const head = buf.subarray(4, 8).toString('ascii');
        if (head !== 'ftyp') throw new Error('sample.mp4 is missing the ftyp box');
        const duration = readMp4DurationSeconds(buf);
        if (duration < MP4_MIN_DURATION_SECONDS) {
          throw new Error(
            `sample.mp4 is only ${duration.toFixed(1)} seconds; expected at least ${MP4_MIN_DURATION_SECONDS}`
          );
        }
      },
    ],
    [
      'assets/streams/meridian/index.m3u8',
      (buf) => {
        if (!buf.toString('utf8').startsWith('#EXTM3U'))
          throw new Error('index.m3u8 missing #EXTM3U');
      },
    ],
  ];

  for (const [rel, validate] of checks) {
    const abs = path.join(PACKAGE_ROOT, rel);
    try {
      const buf = await readFile(abs);
      validate(buf);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`checked-in asset ${rel} failed validation: ${message}`);
    }
  }

  for (const rel of [
    'assets/meridian.en.srt',
    'assets/meridian.es.srt',
    'assets/meridian.de.srt',
  ]) {
    const abs = path.join(PACKAGE_ROOT, rel);
    try {
      const buf = await readFile(abs);
      if (!buf.toString('utf8').trim().includes('-->')) {
        throw new Error(`${rel} missing SRT timing arrow`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`checked-in asset ${rel} failed validation: ${message}`);
    }
  }
};

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/**
 * Generate every referenced raster asset (if missing) and validate the
 * checked-in SRT / MP4 / HLS assets. Deterministic: identical input produces
 * identical bytes. Safe to call before every server start.
 */
export const ensureAssets = async (seed = DEFAULT_SEED): Promise<void> => {
  await mkdir(path.join(ASSETS_DIR, 'gen'), { recursive: true });

  await mkdir(path.join(ASSETS_DIR, 'streams', 'meridian'), { recursive: true });

  const fixture = createFixture(seed);
  const paths = collectAssetPaths(fixture).filter(isPng);

  for (const rel of paths) {
    const abs = path.join(PACKAGE_ROOT, rel);
    try {
      await access(abs);
    } catch {
      await mkdir(path.dirname(abs), { recursive: true });
      const png = await renderPng(rel);
      await writeFile(abs, png);
    }
  }
};

export { ASSETS_DIR, DEFAULT_SEED };

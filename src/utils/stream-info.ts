import type { Stream } from '@/types/stremio';

/**
 * Reads quality details from what an addon provides for a stream. Addons
 * describe them in free text spread over name, title and description, so
 * every value here is a best effort and may be undefined.
 */

/** Vertical resolutions a stream can have, highest first. */
export const STREAM_RESOLUTIONS = ['2160p', '1440p', '1080p', '720p', '480p'] as const;
export type StreamResolution = (typeof STREAM_RESOLUTIONS)[number];

// Decimal units, so sizes match what addons display ("5.26 GB").
const BYTES_PER_UNIT = 1000;
export const BYTES_PER_GB = BYTES_PER_UNIT ** 3;

const RESOLUTION_PATTERNS: readonly [StreamResolution, RegExp][] = [
  ['2160p', /\b(2160p|4k|uhd)\b/i],
  ['1440p', /\b(1440p|2k|qhd)\b/i],
  ['1080p', /\b(1080p|fhd)\b/i],
  ['720p', /\b720p\b/i],
  ['480p', /\b(480p|576p|sd)\b/i],
];

/** Names shown for resolutions that are better known by another name. */
const RESOLUTION_LABELS: Partial<Record<StreamResolution, string>> = { '2160p': '4K' };

const SIZE_PATTERN = /(\d+(?:[.,]\d+)?)\s*(tb|gb|mb|kb|tib|gib|mib|kib)\b/i;
const SIZE_UNIT_EXPONENT: Record<string, number> = { k: 1, m: 2, g: 3, t: 4 };

/** Flag emojis are pairs of regional indicator symbols. */
const FLAG_PATTERN = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
const REGIONAL_INDICATOR_A = 0x1f1e6;
const LATIN_A = 0x41;

/** Language names addons write out, mapped to the country code of their flag. */
const LANGUAGE_WORDS: readonly [string, RegExp][] = [
  ['GB', /\b(english|eng)\b/i],
  ['DE', /\b(german|deutsch|ger)\b/i],
  ['FR', /\b(french|fran[cç]ais)\b/i],
  ['ES', /\b(spanish|espa[nñ]ol)\b/i],
  ['IT', /\b(italian|italiano)\b/i],
  ['PT', /\b(portuguese|portugu[eê]s)\b/i],
  ['MULTI', /\b(multi|dual[ .-]?audio)\b/i],
];

/** English is shown with either flag; treat them as the same language. */
const FLAG_ALIASES: Record<string, string> = { US: 'GB' };

const getStreamText = (stream: Stream): string =>
  [stream.name, stream.title, stream.description].filter(Boolean).join('\n');

/** Resolution an addon states for the stream, or undefined when it states none. */
export const getStreamResolution = (stream: Stream): StreamResolution | undefined => {
  const text = getStreamText(stream);
  return RESOLUTION_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0];
};

/** Display name of a resolution, e.g. "4K" for 2160p. */
export const getResolutionLabel = (resolution: StreamResolution): string =>
  RESOLUTION_LABELS[resolution] ?? resolution;

/** File size in bytes from the addon hint or its description, or undefined when unknown. */
export const getStreamSizeBytes = (stream: Stream): number | undefined => {
  const hinted = (stream.behaviorHints as { videoSize?: unknown } | undefined)?.videoSize;
  if (typeof hinted === 'number' && hinted > 0) return hinted;

  const match = SIZE_PATTERN.exec(getStreamText(stream));
  if (!match) return undefined;

  const value = Number.parseFloat(match[1].replace(',', '.'));
  const exponent = SIZE_UNIT_EXPONENT[match[2][0].toLowerCase()];
  if (!Number.isFinite(value) || value <= 0 || !exponent) return undefined;

  return value * BYTES_PER_UNIT ** exponent;
};

/**
 * Audio languages an addon states, as sorted country codes of their flags
 * (plus "MULTI"). Empty when the addon states none.
 */
export const getStreamLanguages = (stream: Stream): string[] => {
  const text = getStreamText(stream);
  const languages = new Set<string>();

  for (const flag of text.match(FLAG_PATTERN) ?? []) {
    const code = [...flag]
      .map((symbol) =>
        String.fromCharCode((symbol.codePointAt(0) ?? 0) - REGIONAL_INDICATOR_A + LATIN_A)
      )
      .join('');
    languages.add(FLAG_ALIASES[code] ?? code);
  }

  for (const [code, pattern] of LANGUAGE_WORDS) {
    if (pattern.test(text)) languages.add(code);
  }

  return [...languages].sort();
};

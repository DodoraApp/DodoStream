import { TextTrack, TextTrackSource, SubtitleCue } from '@/types/player';
import { AddonSubtitle } from '@/types/stremio';
import {
    normalizeLanguageCode,
    getPreferredLanguageCodes,
    getLanguageDisplayName,
} from '@/utils/languages';
import { createDebugLogger } from '@/utils/debug';
import { SUBTITLE_FETCH_TIMEOUT_MS } from '@/constants/subtitles';

const debug = createDebugLogger('Subtitles');

/**
 * Intermediate structure for sorting tracks within a language group
 */
interface TrackWithSortKey extends TextTrack {
    sortKey: string;
}

/**
 * Converts an AddonSubtitle to a TextTrack.
 * Maps Stremio SDK fields (id, url, lang) to our internal TextTrack structure.
 */
function mapAddonSubtitleToTextTrack(subtitle: AddonSubtitle): TextTrack {
    const addonName = subtitle.addonName ?? subtitle.addonId ?? 'Addon';

    return {
        source: 'addon' as TextTrackSource,
        index: -1, // Will be assigned after sorting
        title: addonName, // Clean title - just the addon name
        language: subtitle.lang,
        uri: subtitle.url,
        addonId: subtitle.addonId,
        addonName: addonName,
        playerIndex: undefined,
    };
}

/**
 * Converts a video-source TextTrack to ensure it has the correct source field.
 */
function ensureVideoSource(track: TextTrack): TextTrack {
    return {
        ...track,
        source: 'video' as TextTrackSource,
    };
}

/**
 * Groups tracks by normalized language code.
 */
function groupTracksByLanguage(tracks: TextTrack[]): Map<string | null, TextTrack[]> {
    const groups = new Map<string | null, TextTrack[]>();

    for (const track of tracks) {
        const code = normalizeLanguageCode(track.language) ?? null;
        const existing = groups.get(code);
        if (existing) {
            existing.push(track);
        } else {
            groups.set(code, [track]);
        }
    }

    return groups;
}

/**
 * Orders language group keys: preferred languages first (in order), then remaining alphabetically.
 */
function getOrderedLanguageKeys(
    groups: Map<string | null, TextTrack[]>,
    preferredSubtitleLanguages?: string[]
): (string | null)[] {
    const preferredCodes = getPreferredLanguageCodes(preferredSubtitleLanguages);
    const preferredKeys: (string | null)[] = [];

    // Add preferred languages in order (if they exist in groups)
    for (const code of preferredCodes) {
        const normalized = normalizeLanguageCode(code) ?? code ?? null;
        if (groups.has(normalized) && !preferredKeys.includes(normalized)) {
            preferredKeys.push(normalized);
        }
    }

    // Get remaining keys and sort alphabetically by display name
    const remainingKeys = Array.from(groups.keys()).filter((k) => !preferredKeys.includes(k));
    remainingKeys.sort((a, b) => {
        const nameA = getLanguageDisplayName(a ?? '') ?? a ?? 'Unknown';
        const nameB = getLanguageDisplayName(b ?? '') ?? b ?? 'Unknown';
        return nameA.localeCompare(nameB);
    });

    debug('orderedLanguageKeys', {
        preferredCodes,
        preferredKeys,
        remainingKeys,
    });

    return [...preferredKeys, ...remainingKeys];
}

/**
 * Sorts tracks within a group: addon tracks first (by addonName, then title),
 * then video tracks (by title).
 */
function sortTracksWithinGroup(tracks: TextTrack[]): TextTrack[] {
    const withSortKeys: TrackWithSortKey[] = tracks.map((track) => ({
        ...track,
        sortKey:
            track.source === 'addon'
                ? `0_${track.addonName ?? ''}_${track.title ?? ''}`
                : `1_${track.title ?? ''}`,
    }));

    withSortKeys.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // Remove sortKey from result
    return withSortKeys.map(({ sortKey: _sortKey, ...track }) => track);
}

/**
 * Combine video subtitles and addon subtitles according to project rules:
 * - Group by language
 * - Preferred languages first (in order), then remaining alphabetically
 * - Within each group: addon tracks first (sorted by addonName/title), then video tracks
 * - Assign sequential combined indices
 *
 * @param videoSubs - Subtitles from the video player (in-stream)
 * @param addonSubs - Subtitles from Stremio addons
 * @param preferredSubtitleLanguages - User's preferred subtitle language codes
 * @returns Combined and sorted TextTrack array with sequential indices
 */
export function combineSubtitles(
    videoSubs: TextTrack[] | undefined,
    addonSubs: AddonSubtitle[] | undefined,
    preferredSubtitleLanguages?: string[]
): TextTrack[] {
    debug('combineSubtitles:start', {
        videoSubsCount: videoSubs?.length ?? 0,
        addonSubsCount: addonSubs?.length ?? 0,
        preferredLanguages: preferredSubtitleLanguages,
    });

    // Convert addon subtitles to TextTrack format
    const mappedAddonTracks = (addonSubs ?? []).map(mapAddonSubtitleToTextTrack);

    // Ensure video subtitles have correct source field
    const mappedVideoTracks = (videoSubs ?? []).map(ensureVideoSource);

    // Combine all tracks
    const allTracks = [...mappedAddonTracks, ...mappedVideoTracks];

    // Deduplicate by URI - keep first occurrence (addon tracks come first, so they're preferred)
    const seenUrls = new Set<string>();
    const deduplicatedTracks = allTracks.filter((track) => {
        if (!track.uri) return true; // Keep video tracks without URI
        if (seenUrls.has(track.uri)) {
            debug('deduplicateTrack', { uri: track.uri.substring(0, 50), title: track.title });
            return false;
        }
        seenUrls.add(track.uri);
        return true;
    });

    if (deduplicatedTracks.length === 0) {
        debug('combineSubtitles:empty');
        return [];
    }

    debug('combineSubtitles:deduplicated', {
        before: allTracks.length,
        after: deduplicatedTracks.length,
        removed: allTracks.length - deduplicatedTracks.length,
    });

    // Group by language
    const groups = groupTracksByLanguage(deduplicatedTracks);

    // Get ordered language keys
    const orderedKeys = getOrderedLanguageKeys(groups, preferredSubtitleLanguages);

    // Build final sorted array
    const result: TextTrack[] = [];

    for (const key of orderedKeys) {
        const group = groups.get(key);
        if (group) {
            const sortedGroup = sortTracksWithinGroup(group);
            result.push(...sortedGroup);
        }
    }

    // Assign sequential indices
    result.forEach((track, idx) => {
        track.index = idx;
    });

    debug('combineSubtitles:result', {
        totalCount: result.length,
        addonCount: result.filter((t) => t.source === 'addon').length,
        videoCount: result.filter((t) => t.source === 'video').length,
        languages: [...new Set(result.map((t) => t.language))],
    });

    return result;
}

/**
 * Builds a display label for a subtitle track.
 * Format: "Source | Language" or just "Language" for video tracks without custom title
 */
export function buildSubtitleLabel(track: TextTrack): string {
    const langCode = normalizeLanguageCode(track.language);
    const langLabel = langCode ? (getLanguageDisplayName(langCode) ?? langCode) : 'Unknown';

    if (track.source === 'addon') {
        // For addon tracks, show addon name followed by language
        const addonName = track.addonName ?? track.title ?? 'Addon';
        return `${addonName} | ${langLabel}`;
    }

    // For video tracks, show title if available, otherwise just language
    if (track.title && track.title !== track.language) {
        return `${track.title} | ${langLabel}`;
    }
    return langLabel;
}

// ============================================================================
// Subtitle Parsing and Fetching
// Thank you to @Dreadfxl for the initial implementation!
// ============================================================================

/**
 * Parse time string in format HH:MM:SS,mmm (SRT) or HH:MM:SS.mmm (VTT)
 * Returns time in seconds
 */
function parseTimeString(timeStr: string): number {
    // Handle both comma and period as decimal separator
    const normalizedTime = timeStr.replace(',', '.');
    const parts = normalizedTime.split(':');
    if (parts.length !== 3) return 0;

    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseFloat(parts[2]) || 0;

    return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Strips HTML-style formatting tags from subtitle text.
 * Keeps the plain text content.
 */
function stripHtmlTags(text: string): string {
    return text
        // Remove position tags like {\an8}
        .replace(/\{\\an[1-9]\}/gi, '')
        // Remove HTML tags like <i>, </i>, <b>, <font color="...">
        .replace(/<\/?[^>]+(>|$)/g, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Detect subtitle format from content or URL
 */
function detectSubtitleFormat(content: string, url?: string): 'srt' | 'vtt' {
    // Check URL extension first
    if (url) {
        const urlLower = url.toLowerCase();
        if (urlLower.includes('.vtt') || urlLower.includes('webvtt')) return 'vtt';
        if (urlLower.includes('.srt')) return 'srt';
    }

    // Check content patterns
    const trimmedContent = content.trim();
    if (trimmedContent.startsWith('WEBVTT')) return 'vtt';

    // VTT uses period for milliseconds, SRT uses comma
    if (/\d{2}:\d{2}:\d{2}\.\d{3}/.test(trimmedContent)) return 'vtt';

    // Default to SRT (most common format)
    return 'srt';
}

/**
 * Parse SRT subtitle format
 */
function parseSRT(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];

    // Normalize line endings and split by double newlines
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const blocks = normalizedContent.split(/\n\s*\n/).filter((block) => block.trim().length > 0);

    let cueIndex = 0;

    for (const block of blocks) {
        const lines = block
            .trim()
            .split('\n')
            .filter((line) => line.trim());
        if (lines.length < 2) continue;

        // Find the timing line (contains -->)
        let timingLineIndex = -1;
        for (let i = 0; i < Math.min(3, lines.length); i++) {
            if (lines[i].includes('-->')) {
                timingLineIndex = i;
                break;
            }
        }

        if (timingLineIndex === -1) continue;

        const timingLine = lines[timingLineIndex];
        const timeParts = timingLine.split('-->');
        if (timeParts.length !== 2) continue;

        const startTime = parseTimeString(timeParts[0].trim());
        const endTime = parseTimeString(timeParts[1].trim().split(' ')[0]); // Handle position after timestamp

        // Get text lines (after timing line, filter out cue numbers)
        const textLines = lines
            .slice(timingLineIndex + 1)
            .filter((line) => !line.match(/^\d+$/) && line.trim());

        const rawText = textLines.join('\n').trim();
        if (!rawText) continue;

        const text = stripHtmlTags(rawText);

        cues.push({
            index: cueIndex++,
            startTime,
            endTime,
            text,
        });
    }

    debug('parseSRT', { cueCount: cues.length });
    return cues;
}

/**
 * Parse WebVTT subtitle format
 */
function parseVTT(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];

    // Remove WEBVTT header and normalize line endings
    const normalizedContent = content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/^WEBVTT[^\n]*\n/, '')
        .trim();

    // Split by double newlines
    const blocks = normalizedContent.split(/\n\s*\n/).filter((block) => block.trim().length > 0);

    let cueIndex = 0;

    for (const block of blocks) {
        const lines = block
            .trim()
            .split('\n')
            .filter((line) => line.trim());
        if (lines.length < 1) continue;

        // Skip NOTE blocks
        if (lines[0].startsWith('NOTE')) continue;

        // Find timing line
        let timingLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('-->')) {
                timingLineIndex = i;
                break;
            }
        }

        if (timingLineIndex === -1) continue;

        const timingLine = lines[timingLineIndex];
        const timeParts = timingLine.split('-->');
        if (timeParts.length !== 2) continue;

        const startTime = parseTimeString(timeParts[0].trim());
        const endTime = parseTimeString(timeParts[1].trim().split(' ')[0]); // Handle cue settings

        // Get text lines (after timing line)
        const textLines = lines.slice(timingLineIndex + 1).filter((line) => line.trim());

        const rawText = textLines.join('\n').trim();
        if (!rawText) continue;

        const text = stripHtmlTags(rawText);

        cues.push({
            index: cueIndex++,
            startTime,
            endTime,
            text,
        });
    }

    debug('parseVTT', { cueCount: cues.length });
    return cues;
}

/**
 * Auto-detect format and parse subtitle content
 */
export function parseSubtitles(content: string, url?: string): SubtitleCue[] {
    if (!content || !content.trim()) {
        debug('parseSubtitles:empty');
        return [];
    }

    const format = detectSubtitleFormat(content, url);
    debug('parseSubtitles', { format, contentLength: content.length });

    return format === 'vtt' ? parseVTT(content) : parseSRT(content);
}

/**
 * Fetch subtitle content from a URL with timeout
 */
export async function fetchSubtitleContent(url: string): Promise<string> {
    debug('fetchSubtitleContent:start', { url: url.substring(0, 80) });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SUBTITLE_FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Failed to fetch subtitles: ${response.status}`);
        }

        const text = await response.text();
        debug('fetchSubtitleContent:success', { contentLength: text.length });
        return text;
    } catch (error) {
        clearTimeout(timeoutId);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        debug('fetchSubtitleContent:error', { error: errorMessage });
        throw error;
    }
}

/**
 * Fetch and parse subtitles from a URL
 * Returns parsed cues or throws an error
 */
export async function loadSubtitles(url: string): Promise<SubtitleCue[]> {
    const content = await fetchSubtitleContent(url);
    return parseSubtitles(content, url);
}

/**
 * Find the current subtitle cue based on playback time using binary search.
 * Optimized for frequent calls during video playback.
 * Returns the cue that should be displayed at the given time, or null if none.
 */
export function findCurrentCue(
    cues: SubtitleCue[],
    currentTime: number
): SubtitleCue | null {
    if (!cues.length) return null;

    // Binary search to find a cue that might contain currentTime
    let left = 0;
    let right = cues.length - 1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const cue = cues[mid];

        if (currentTime < cue.startTime) {
            // Current time is before this cue
            right = mid - 1;
        } else if (currentTime > cue.endTime) {
            // Current time is after this cue
            left = mid + 1;
        } else {
            // Current time is within this cue's range
            return cue;
        }
    }

    return null;
}


import { combineSubtitles, parseSubtitles, findCurrentCue } from '../subtitles';
import type { TextTrack, SubtitleCue } from '@/types/player';
import type { AddonSubtitle } from '@/types/stremio';

describe('combineSubtitles', () => {
    const createVideoSubtitle = (
        index: number,
        language: string,
        title?: string
    ): TextTrack => ({
        source: 'video',
        index,
        title: title ?? `Video ${language.toUpperCase()}`,
        language,
        playerIndex: index,
    });

    const createAddonSubtitle = (
        id: string,
        lang: string,
        url: string,
        addonId?: string,
        addonName?: string
    ): AddonSubtitle => ({
        id,
        lang,
        url,
        addonId,
        addonName,
    });

    it('returns empty array when no subtitles provided', () => {
        const result = combineSubtitles(undefined, undefined, undefined);
        expect(result).toEqual([]);
    });

    it('handles only video subtitles', () => {
        const videoSubs: TextTrack[] = [
            createVideoSubtitle(0, 'en'),
            createVideoSubtitle(1, 'de'),
        ];

        const result = combineSubtitles(videoSubs, undefined, undefined);

        expect(result).toHaveLength(2);
        expect(result.every((t) => t.source === 'video')).toBe(true);
    });

    it('handles only addon subtitles', () => {
        const addonSubs: AddonSubtitle[] = [
            createAddonSubtitle('s1', 'en', 'http://example.com/en.srt', 'addon1', 'Addon One'),
            createAddonSubtitle('s2', 'de', 'http://example.com/de.srt', 'addon2', 'Addon Two'),
        ];

        const result = combineSubtitles(undefined, addonSubs, undefined);

        expect(result).toHaveLength(2);
        expect(result.every((t) => t.source === 'addon')).toBe(true);
        expect(result.every((t) => t.uri !== undefined)).toBe(true);
    });

    it('groups subtitles by language with preferred languages first', () => {
        const videoSubs: TextTrack[] = [
            createVideoSubtitle(0, 'en'),
            createVideoSubtitle(1, 'es'),
        ];

        const addonSubs: AddonSubtitle[] = [
            createAddonSubtitle('s1', 'en', 'http://a1/en.srt', 'addon1', 'Addon EN'),
            createAddonSubtitle('s2', 'de', 'http://a2/de.srt', 'addon2', 'Addon DE'),
            createAddonSubtitle('s3', 'fr', 'http://a3/fr.srt', 'addon3', 'Addon FR'),
        ];

        const result = combineSubtitles(videoSubs, addonSubs, ['de', 'en']);

        // German should be first (first preferred), then English (second preferred)
        const languages = result.map((t) => t.language);
        const deIndex = languages.indexOf('de');
        const enIndexFirst = languages.indexOf('en');

        expect(deIndex).toBeLessThan(enIndexFirst);

        // French and Spanish should come after preferred languages
        const frIndex = languages.indexOf('fr');
        const esIndex = languages.indexOf('es');
        expect(frIndex).toBeGreaterThan(enIndexFirst);
        expect(esIndex).toBeGreaterThan(enIndexFirst);
    });

    it('sorts addon subtitles before video subtitles within same language group', () => {
        const videoSubs: TextTrack[] = [createVideoSubtitle(0, 'en', 'Video English')];
        const addonSubs: AddonSubtitle[] = [
            createAddonSubtitle('s1', 'en', 'http://a1/en.srt', 'addon1', 'Addon One'),
            createAddonSubtitle('s2', 'en', 'http://a2/en2.srt', 'addon2', 'Addon Two'),
        ];

        const result = combineSubtitles(videoSubs, addonSubs, ['en']);
        const enGroup = result.filter((t) => t.language === 'en');

        // Addon tracks should come first
        expect(enGroup[0].source).toBe('addon');
        expect(enGroup[1].source).toBe('addon');
        expect(enGroup[2].source).toBe('video');
    });

    it('assigns sequential unique indices starting from 0', () => {
        const videoSubs: TextTrack[] = [
            createVideoSubtitle(5, 'en'), // Original index doesn't matter
            createVideoSubtitle(10, 'de'),
        ];

        const addonSubs: AddonSubtitle[] = [
            createAddonSubtitle('s1', 'fr', 'http://a1/fr.srt', 'addon1'),
        ];

        const result = combineSubtitles(videoSubs, addonSubs, []);

        const indices = result.map((t) => t.index);
        expect(indices).toEqual([0, 1, 2]);
        expect(new Set(indices).size).toBe(indices.length); // All unique
    });

    it('sorts non-preferred languages alphabetically by display name', () => {
        const addonSubs: AddonSubtitle[] = [
            createAddonSubtitle('s1', 'es', 'http://a1/es.srt', 'addon1', 'Spanish'),
            createAddonSubtitle('s2', 'fr', 'http://a2/fr.srt', 'addon2', 'French'),
            createAddonSubtitle('s3', 'de', 'http://a3/de.srt', 'addon3', 'German'),
        ];

        const result = combineSubtitles(undefined, addonSubs, []); // No preferred languages

        // Languages should be sorted: French, German, Spanish (alphabetically)
        const languages = result.map((t) => t.language);
        expect(languages).toEqual(['fr', 'de', 'es']); // French, German, Spanish by display name
    });

    it('sorts addon tracks by addonName then title within a language group', () => {
        const addonSubs: AddonSubtitle[] = [
            createAddonSubtitle('z-track', 'en', 'http://a1/en.srt', 'z-addon', 'Z Addon'),
            createAddonSubtitle('a-track', 'en', 'http://a2/en.srt', 'a-addon', 'A Addon'),
            createAddonSubtitle('b-track', 'en', 'http://a3/en.srt', 'a-addon', 'A Addon'),
        ];

        const result = combineSubtitles(undefined, addonSubs, ['en']);

        // Should be sorted by addonName first (A Addon before Z Addon)
        // Within same addon, sorted by title
        expect(result[0].addonName).toBe('A Addon');
        expect(result[1].addonName).toBe('A Addon');
        expect(result[2].addonName).toBe('Z Addon');

        // Title is now just the addon name for cleaner display
        expect(result[0].title).toBe('A Addon');
        expect(result[1].title).toBe('A Addon');
        expect(result[2].title).toBe('Z Addon');
    });

    it('creates clean titles for addon subtitles using addon name', () => {
        const addonSubs: AddonSubtitle[] = [
            createAddonSubtitle('subtitle-id-123', 'en', 'http://example.com/en.srt', 'my.addon', 'My Addon'),
        ];

        const result = combineSubtitles(undefined, addonSubs, []);

        // Title is now just the addon name (cleaner format)
        expect(result[0].title).toBe('My Addon');
    });

    it('preserves addon metadata on converted tracks', () => {
        const addonSubs: AddonSubtitle[] = [
            createAddonSubtitle('s1', 'en', 'http://example.com/en.srt', 'test.addon', 'Test Addon'),
        ];

        const result = combineSubtitles(undefined, addonSubs, []);

        expect(result[0].addonId).toBe('test.addon');
        expect(result[0].addonName).toBe('Test Addon');
        expect(result[0].uri).toBe('http://example.com/en.srt');
    });

    it('deduplicates tracks with the same URL', () => {
        const addonSubs: AddonSubtitle[] = [
            createAddonSubtitle('s1', 'en', 'http://example.com/shared.srt', 'addon1', 'Addon One'),
            createAddonSubtitle('s2', 'en', 'http://example.com/shared.srt', 'addon2', 'Addon Two'), // Duplicate URL
            createAddonSubtitle('s3', 'en', 'http://example.com/unique.srt', 'addon3', 'Addon Three'),
        ];

        const result = combineSubtitles(undefined, addonSubs, []);

        // Should only have 2 tracks (duplicate removed)
        expect(result).toHaveLength(2);
        // First occurrence (Addon One) should be kept
        expect(result[0].addonName).toBe('Addon One');
        expect(result[0].uri).toBe('http://example.com/shared.srt');
        // Unique track should also be present
        expect(result[1].addonName).toBe('Addon Three');
        expect(result[1].uri).toBe('http://example.com/unique.srt');
    });

    it('keeps video tracks without URI when deduplicating', () => {
        const videoSubs: TextTrack[] = [createVideoSubtitle(0, 'en')];
        const addonSubs: AddonSubtitle[] = [
            createAddonSubtitle('s1', 'en', 'http://example.com/en.srt', 'addon1', 'Addon One'),
        ];

        const result = combineSubtitles(videoSubs, addonSubs, []);

        // Both should be present - video track has no URI so not deduplicated
        expect(result).toHaveLength(2);
    });
});

describe('parseSubtitles', () => {
    it('returns empty array for empty content', () => {
        expect(parseSubtitles('')).toEqual([]);
        expect(parseSubtitles('   ')).toEqual([]);
    });

    it('parses simple SRT format', () => {
        const srtContent = `1
00:00:01,000 --> 00:00:04,000
Hello, world!

2
00:00:05,500 --> 00:00:08,500
This is a test subtitle.`;

        const result = parseSubtitles(srtContent);

        expect(result).toHaveLength(2);
        expect(result[0].startTime).toBe(1);
        expect(result[0].endTime).toBe(4);
        expect(result[0].text).toBe('Hello, world!');
        expect(result[1].startTime).toBe(5.5);
        expect(result[1].endTime).toBe(8.5);
        expect(result[1].text).toBe('This is a test subtitle.');
    });

    it('parses SRT with HTML formatting tags', () => {
        const srtContent = `1
00:00:01,000 --> 00:00:04,000
<i>Italic text</i> and <b>bold text</b>`;

        const result = parseSubtitles(srtContent);

        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('Italic text and bold text');
    });

    it('parses SRT with position tags', () => {
        const srtContent = `1
00:00:01,000 --> 00:00:04,000
{\\an8}Top center text`;

        const result = parseSubtitles(srtContent);

        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('Top center text');
    });

    it('parses simple WebVTT format', () => {
        const vttContent = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello, world!

00:00:05.500 --> 00:00:08.500
This is a test subtitle.`;

        const result = parseSubtitles(vttContent);

        expect(result).toHaveLength(2);
        expect(result[0].startTime).toBe(1);
        expect(result[0].endTime).toBe(4);
        expect(result[0].text).toBe('Hello, world!');
    });

    it('detects format from URL extension', () => {
        const content = `1
00:00:01,000 --> 00:00:04,000
Test`;

        const result = parseSubtitles(content, 'http://example.com/subtitle.srt');
        expect(result).toHaveLength(1);
    });

    it('handles multi-line subtitles', () => {
        const srtContent = `1
00:00:01,000 --> 00:00:04,000
Line one
Line two
Line three`;

        const result = parseSubtitles(srtContent);

        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('Line one Line two Line three');
    });

    it('handles Windows line endings', () => {
        const srtContent = "1\r\n00:00:01,000 --> 00:00:04,000\r\nHello\r\n\r\n2\r\n00:00:05,000 --> 00:00:08,000\r\nWorld";

        const result = parseSubtitles(srtContent);

        expect(result).toHaveLength(2);
        expect(result[0].text).toBe('Hello');
        expect(result[1].text).toBe('World');
    });
});

describe('findCurrentCue', () => {
    const cues: SubtitleCue[] = [
        { index: 0, startTime: 1, endTime: 4, text: 'First' },
        { index: 1, startTime: 5, endTime: 8, text: 'Second' },
        { index: 2, startTime: 10, endTime: 12, text: 'Third' },
    ];

    it('returns null for empty cues array', () => {
        expect(findCurrentCue([], 5)).toBeNull();
    });

    it('returns null when time is before first cue', () => {
        expect(findCurrentCue(cues, 0.5)).toBeNull();
    });

    it('returns null when time is between cues', () => {
        expect(findCurrentCue(cues, 4.5)).toBeNull();
    });

    it('returns correct cue when time is within range', () => {
        const result = findCurrentCue(cues, 2);
        expect(result).not.toBeNull();
        expect(result?.text).toBe('First');
    });

    it('returns cue at exact start time', () => {
        const result = findCurrentCue(cues, 5);
        expect(result).not.toBeNull();
        expect(result?.text).toBe('Second');
    });

    it('returns cue at exact end time', () => {
        const result = findCurrentCue(cues, 8);
        expect(result).not.toBeNull();
        expect(result?.text).toBe('Second');
    });

    it('returns null when time is after last cue', () => {
        expect(findCurrentCue(cues, 15)).toBeNull();
    });
});

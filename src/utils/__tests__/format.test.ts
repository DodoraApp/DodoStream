import {
    formatSeasonEpisodeLabel,
    formatEpisodeTitle,
    formatEpisodeCardTitle,
    formatEpisodeListTitle,
    formatPlayerTitle,
    formatReleaseDate,
    formatReleaseYear,
    formatReleaseInfo,
    formatRuntime,
    formatDescription,
} from '@/utils/format';

describe('format utils', () => {
    describe('formatSeasonEpisodeLabel', () => {
        it('formats season and episode', () => {
            expect(formatSeasonEpisodeLabel({ season: 1, episode: 2 })).toBe('S1E2');
            expect(formatSeasonEpisodeLabel({ season: 10, episode: 25 })).toBe('S10E25');
        });

        it('formats season only', () => {
            expect(formatSeasonEpisodeLabel({ season: 3 })).toBe('S3');
        });

        it('formats episode only', () => {
            expect(formatSeasonEpisodeLabel({ episode: 5 })).toBe('E5');
        });

        it('returns undefined for empty or null input', () => {
            expect(formatSeasonEpisodeLabel(null)).toBeUndefined();
            expect(formatSeasonEpisodeLabel(undefined)).toBeUndefined();
            expect(formatSeasonEpisodeLabel({})).toBeUndefined();
        });
    });

    describe('formatEpisodeTitle', () => {
        it('prefers title over name', () => {
            expect(formatEpisodeTitle({ title: 'The Title', name: 'The Name' })).toBe('The Title');
        });

        it('falls back to name when title is missing', () => {
            expect(formatEpisodeTitle({ name: 'Episode Name' })).toBe('Episode Name');
        });

        it('returns undefined for empty or null input', () => {
            expect(formatEpisodeTitle(null)).toBeUndefined();
            expect(formatEpisodeTitle(undefined)).toBeUndefined();
            expect(formatEpisodeTitle({})).toBeUndefined();
        });
    });

    describe('formatEpisodeCardTitle', () => {
        it('formats label and title', () => {
            expect(formatEpisodeCardTitle({ season: 1, episode: 2, title: 'Pilot' })).toBe('S1E2: Pilot');
        });

        it('formats label only when no title', () => {
            expect(formatEpisodeCardTitle({ season: 1, episode: 2 })).toBe('S1E2');
        });

        it('returns title only when no season/episode', () => {
            expect(formatEpisodeCardTitle({ title: 'Special Episode' })).toBe('Special Episode');
        });

        it('returns undefined for null/undefined/empty input', () => {
            expect(formatEpisodeCardTitle(null)).toBeUndefined();
            expect(formatEpisodeCardTitle(undefined)).toBeUndefined();
            expect(formatEpisodeCardTitle({})).toBeUndefined();
        });
    });

    describe('formatEpisodeListTitle', () => {
        it('formats episode number and title', () => {
            expect(formatEpisodeListTitle({ episode: 5, title: 'Episode Title' })).toBe('5. Episode Title');
        });

        it('uses name when title is missing', () => {
            expect(formatEpisodeListTitle({ episode: 3, name: 'Episode Name' })).toBe('3. Episode Name');
        });

        it('uses ? for missing episode number', () => {
            expect(formatEpisodeListTitle({ title: 'Special' })).toBe('?. Special');
        });

        it('uses Unknown for missing title/name', () => {
            expect(formatEpisodeListTitle({ episode: 1 })).toBe('1. Unknown');
        });

        it('handles undefined/null input', () => {
            expect(formatEpisodeListTitle(undefined)).toBe('?. Unknown');
            expect(formatEpisodeListTitle(null)).toBe('?. Unknown');
        });
    });

    describe('formatPlayerTitle', () => {
        it('formats movie title (no video)', () => {
            expect(formatPlayerTitle({ name: 'Inception' })).toBe('Inception');
            expect(formatPlayerTitle({ name: 'Inception' }, null)).toBe('Inception');
        });

        it('formats series with episode info', () => {
            expect(formatPlayerTitle({ name: 'Breaking Bad' }, { season: 1, episode: 1, title: 'Pilot' })).toBe(
                'Breaking Bad S1E1: Pilot'
            );
        });

        it('formats series without episode title', () => {
            expect(formatPlayerTitle({ name: 'The Office' }, { season: 2, episode: 3 })).toBe('The Office S2E3');
        });

        it('returns undefined for missing meta name', () => {
            expect(formatPlayerTitle(null)).toBeUndefined();
            expect(formatPlayerTitle(undefined)).toBeUndefined();
            expect(formatPlayerTitle({})).toBeUndefined();
        });
    });

    describe('formatReleaseDate', () => {
        it('formats valid date string', () => {
            const result = formatReleaseDate('2023-05-15');
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });

        it('handles ISO date strings', () => {
            const result = formatReleaseDate('2023-05-15T00:00:00.000Z');
            expect(result).toBeDefined();
        });

        it('returns undefined for invalid date', () => {
            expect(formatReleaseDate('not-a-date')).toBeUndefined();
        });

        it('returns undefined for null/undefined', () => {
            expect(formatReleaseDate(null)).toBeUndefined();
            expect(formatReleaseDate(undefined)).toBeUndefined();
        });
    });

    describe('formatReleaseYear', () => {
        it('extracts year from date string', () => {
            expect(formatReleaseYear('2023-05-15')).toBe('2023');
            expect(formatReleaseYear('1999-12-31')).toBe('1999');
        });

        it('handles ISO date strings', () => {
            expect(formatReleaseYear('2023-05-15T00:00:00.000Z')).toBe('2023');
        });

        it('returns undefined for invalid date', () => {
            expect(formatReleaseYear('invalid')).toBeUndefined();
        });

        it('returns undefined for null/undefined', () => {
            expect(formatReleaseYear(null)).toBeUndefined();
            expect(formatReleaseYear(undefined)).toBeUndefined();
        });
    });

    describe('formatReleaseInfo', () => {
        it('prefers meta releaseInfo when present', () => {
            expect(formatReleaseInfo({ releaseInfo: '2023-2024', released: '2023-01-01' })).toBe('2023-2024');
        });

        it('trims releaseInfo whitespace', () => {
            expect(formatReleaseInfo({ releaseInfo: '  2023  ' })).toBe('2023');
        });

        it('falls back to video released year', () => {
            expect(formatReleaseInfo({}, { released: '2022-06-15' })).toBe('2022');
        });

        it('falls back to meta released year', () => {
            expect(formatReleaseInfo({ released: '2021-03-20' })).toBe('2021');
        });

        it('returns undefined when no info available', () => {
            expect(formatReleaseInfo(null)).toBeUndefined();
            expect(formatReleaseInfo(undefined)).toBeUndefined();
            expect(formatReleaseInfo({})).toBeUndefined();
        });
    });

    describe('formatRuntime', () => {
        it('prefers video runtime', () => {
            expect(formatRuntime({ runtime: '60 min' }, { runtime: '45 min' } as never)).toBe('45 min');
        });

        it('falls back to meta runtime', () => {
            expect(formatRuntime({ runtime: '120 min' })).toBe('120 min');
        });

        it('trims whitespace', () => {
            expect(formatRuntime({ runtime: '  90 min  ' })).toBe('90 min');
        });

        it('returns undefined for empty runtime', () => {
            expect(formatRuntime({ runtime: '   ' })).toBeUndefined();
        });

        it('returns undefined for null/undefined', () => {
            expect(formatRuntime(null)).toBeUndefined();
            expect(formatRuntime(undefined)).toBeUndefined();
        });
    });

    describe('formatDescription', () => {
        it('prefers video overview', () => {
            expect(
                formatDescription({ description: 'Meta description' }, { overview: 'Video overview' } as never)
            ).toBe('Video overview');
        });

        it('falls back to meta description', () => {
            expect(formatDescription({ description: 'A great movie about...' })).toBe('A great movie about...');
        });

        it('trims whitespace', () => {
            expect(formatDescription({ description: '  Trimmed  ' })).toBe('Trimmed');
        });

        it('returns undefined for empty description', () => {
            expect(formatDescription({ description: '   ' })).toBeUndefined();
        });

        it('returns undefined for null/undefined', () => {
            expect(formatDescription(null)).toBeUndefined();
            expect(formatDescription(undefined)).toBeUndefined();
        });
    });
});

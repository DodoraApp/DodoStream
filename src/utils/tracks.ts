import { AudioTrack } from '@/types/player';
import { getPreferredLanguageCodes, normalizeLanguageCode } from '@/utils/languages';

/**
 * Item structure for audio/video track picker.
 */
export interface TrackPickerItem {
    label: string;
    value: number;
    groupId: string | null;
}

/**
 * Sorts audio tracks by user language preference.
 *
 * Tracks are ordered by:
 * 1. Preferred language priority (lower index = higher priority)
 * 2. Original order within same language
 *
 * @param audioTracks - Array of audio tracks from the player
 * @param preferredLanguages - User's preferred language codes (optional)
 * @returns Sorted array of picker items
 */
export const sortAudioTracksByPreference = (
    audioTracks: AudioTrack[],
    preferredLanguages?: string[]
): TrackPickerItem[] => {
    const preferredCodes = getPreferredLanguageCodes(preferredLanguages);
    const preferredIndexByLang = new Map<string, number>();
    preferredCodes.forEach((code, idx) => preferredIndexByLang.set(code, idx));

    return audioTracks
        .map((track, originalIndex) => {
            const languageCode = normalizeLanguageCode(track.language);
            const preferredIndex =
                languageCode && preferredIndexByLang.has(languageCode)
                    ? (preferredIndexByLang.get(languageCode) as number)
                    : Number.POSITIVE_INFINITY;
            return {
                preferredIndex,
                originalIndex,
                item: {
                    label: track.title || track.language || `Track ${track.index + 1}`,
                    value: track.index,
                    groupId: languageCode ?? null,
                } satisfies TrackPickerItem,
            };
        })
        .sort((a, b) => {
            if (a.preferredIndex !== b.preferredIndex) return a.preferredIndex - b.preferredIndex;
            return a.originalIndex - b.originalIndex;
        })
        .map((x) => x.item);
};

/**
 * Get badge text for audio/subtitle track (2-letter language code).
 */
export const getTrackBadge = (language?: string): string | undefined => {
    if (!language) return undefined;
    return normalizeLanguageCode(language)?.toUpperCase() ?? language.substring(0, 2).toUpperCase();
};

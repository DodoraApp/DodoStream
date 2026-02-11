import * as Localization from 'expo-localization';
import { uniqNormalizedStrings } from '@/utils/array';
import iso639Data from '../../assets/data/iso639.json';

/**
 * Language entry from iso639.json
 */
export interface LanguageEntry {
    /** ISO 639-1 (2-letter) code */
    code: string;
    /** ISO 639-2/3 (3-letter) codes (may include bibliographic alternatives) */
    code3: string[];
    /** Native language name */
    name: string;
    /** Flag emoji */
    flag: string;
    /** English name of the language */
    englishName: string;
}

/** All supported languages from iso639.json */
export const LANGUAGES: LanguageEntry[] = iso639Data as LanguageEntry[];

/** Map from 2-letter code to language entry */
const CODE_TO_LANGUAGE = new Map<string, LanguageEntry>(
    LANGUAGES.map((lang) => [lang.code.toLowerCase(), lang])
);

/** Map from 3-letter code to 2-letter code */
const CODE3_TO_CODE = new Map<string, string>(
    LANGUAGES.flatMap((lang) => lang.code3.map((code3) => [code3.toLowerCase(), lang.code.toLowerCase()]))
);

/** Map from 2-letter code to English name (for fallback display) */
const CODE_TO_ENGLISH_NAME = new Map<string, string>(
    LANGUAGES.map((lang) => [lang.code.toLowerCase().split('-')[0]!, lang.englishName])
);

/**
 * Gets the full language entry for a given language code.
 * Supports both ISO 639-1 (2-letter) and ISO 639-2/3 (3-letter) codes.
 */
export const getLanguageEntry = (languageCode: string): LanguageEntry | undefined => {
    const normalizedCode = normalizeLanguageCode(languageCode);
    if (!normalizedCode) return undefined;
    return CODE_TO_LANGUAGE.get(normalizedCode);
};

export const getDevicePreferredLanguageCodes = (): string[] => {
    try {
        const locales = Localization.getLocales();
        const codes = locales
            .map((l) => l.languageCode)
            .filter((code): code is string => typeof code === 'string');
        const unique = uniqNormalizedStrings(codes);
        if (unique.length > 0) return unique;
    } catch {
        // ignore
    }

    try {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale;
        const primary = locale.split('-')[0]?.toLowerCase();
        if (primary) return uniqNormalizedStrings([primary, 'en']);
    } catch {
        // ignore
    }

    return ['en'];
};

/**
 * Normalizes a language code to ISO 639-1 (2-letter) format.
 * Handles ISO 639-2/3 (3-letter) codes by mapping them to 2-letter equivalents.
 */
export const normalizeLanguageCode = (language?: string): string | undefined => {
    const trimmed = language?.trim();
    if (!trimmed) return undefined;

    const basePart = trimmed.split(/[-_]/)[0]?.toLowerCase();
    if (!basePart) return undefined;

    // If it's already a 2-letter code, return it
    if (basePart.length === 2) {
        return basePart;
    }

    // Try to map 3-letter code to 2-letter code
    if (basePart.length === 3) {
        const mapped = CODE3_TO_CODE.get(basePart);
        if (mapped) return mapped;
    }

    // Return original if no mapping found
    return basePart;
};

export const getPreferredLanguageCodes = (preferred?: string[]): string[] => {
    const normalizedPreferred = preferred ? uniqNormalizedStrings(preferred) : [];
    if (normalizedPreferred.length > 0) return normalizedPreferred;
    return getDevicePreferredLanguageCodes();
};

/**
 * Gets a human-readable display name for a language code.
 * Supports both ISO 639-1 (2-letter) and ISO 639-2/3 (3-letter) codes.
 * Prepared for future i18n integration with react-i18next.
 */
export const getLanguageDisplayName = (languageCode: string): string => {
    // Normalize to 2-letter code first
    const code = normalizeLanguageCode(languageCode) ?? languageCode.toLowerCase();

    // Try Intl.DisplayNames first (best for localized names)
    try {
        const displayLocale = getDevicePreferredLanguageCodes()[0] ?? 'en';
        const DisplayNames = (Intl as any)?.DisplayNames;
        if (DisplayNames) {
            const displayNames = new DisplayNames(displayLocale, { type: 'language' });
            const name = displayNames.of(code);
            if (typeof name === 'string' && name.trim().length > 0 && name !== code) {
                return name;
            }
        }
    } catch {
        // ignore - Intl.DisplayNames not available or failed
    }

    // Fallback: check our curated English name from iso639.json
    const englishName = CODE_TO_ENGLISH_NAME.get(code);
    if (englishName) return englishName;

    // Last resort: return the original code (may be 3-letter if unmapped)
    return languageCode;
};

export const findBestTrackByLanguage = <T extends { language?: string; selected?: boolean }>(
    tracks: T[],
    preferredLanguageCodes: string[]
): T | undefined => {
    // First check if there's a selected track with a preferred language
    const selectedTrack = tracks.find((track) => track.selected === true);
    if (selectedTrack) {
        const normalizedLanguage = normalizeLanguageCode(selectedTrack.language);
        if (normalizedLanguage && preferredLanguageCodes.includes(normalizedLanguage)) {
            return selectedTrack;
        }
    }

    // Fall back to finding the first track matching preferred languages
    for (const preferred of preferredLanguageCodes) {
        const match = tracks.find((track) => normalizeLanguageCode(track.language) === preferred);
        if (match) return match;
    }
    return undefined;
};

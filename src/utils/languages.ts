import * as Localization from 'expo-localization';
import { uniqNormalizedStrings } from '@/utils/array';

// Lightweight English fallbacks for common ISO 639-1 (2-letter) codes
const LANGUAGE_NAMES_EN: Record<string, string> = {
    en: 'English',
    de: 'German',
    fr: 'French',
    es: 'Spanish',
    it: 'Italian',
    pt: 'Portuguese',
    nl: 'Dutch',
    sv: 'Swedish',
    no: 'Norwegian',
    da: 'Danish',
    fi: 'Finnish',
    pl: 'Polish',
    cs: 'Czech',
    sk: 'Slovak',
    hu: 'Hungarian',
    ro: 'Romanian',
    bg: 'Bulgarian',
    el: 'Greek',
    tr: 'Turkish',
    ru: 'Russian',
    uk: 'Ukrainian',
    ar: 'Arabic',
    he: 'Hebrew',
    hi: 'Hindi',
    th: 'Thai',
    vi: 'Vietnamese',
    id: 'Indonesian',
    ms: 'Malay',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
};

/**
 * ISO 639-2/3 (3-letter) to ISO 639-1 (2-letter) code mapping.
 * This covers common subtitle language codes that use 3-letter format.
 * Prepared for future i18n integration with react-i18next.
 */
const ISO_639_3_TO_1: Record<string, string> = {
    // Common subtitle languages (ISO 639-2/B bibliographic codes)
    eng: 'en',
    deu: 'de',
    ger: 'de', // Alternative for German
    fra: 'fr',
    fre: 'fr', // Alternative for French
    spa: 'es',
    ita: 'it',
    por: 'pt',
    nld: 'nl',
    dut: 'nl', // Alternative for Dutch
    swe: 'sv',
    nor: 'no',
    dan: 'da',
    fin: 'fi',
    pol: 'pl',
    ces: 'cs',
    cze: 'cs', // Alternative for Czech
    slk: 'sk',
    slo: 'sk', // Alternative for Slovak
    hun: 'hu',
    ron: 'ro',
    rum: 'ro', // Alternative for Romanian
    bul: 'bg',
    ell: 'el',
    gre: 'el', // Alternative for Greek
    tur: 'tr',
    rus: 'ru',
    ukr: 'uk',
    ara: 'ar',
    heb: 'he',
    hin: 'hi',
    tha: 'th',
    vie: 'vi',
    ind: 'id',
    msa: 'ms',
    may: 'ms', // Alternative for Malay
    jpn: 'ja',
    kor: 'ko',
    zho: 'zh',
    chi: 'zh', // Alternative for Chinese
    // Additional common subtitle languages
    ben: 'bn', // Bengali
    tam: 'ta', // Tamil
    tel: 'te', // Telugu
    mar: 'mr', // Marathi
    urd: 'ur', // Urdu
    pan: 'pa', // Punjabi
    guj: 'gu', // Gujarati
    kan: 'kn', // Kannada
    mal: 'ml', // Malayalam
    ori: 'or', // Oriya
    asm: 'as', // Assamese
    nep: 'ne', // Nepali
    sin: 'si', // Sinhala
    mya: 'my', // Burmese
    khm: 'km', // Khmer
    lao: 'lo', // Lao
    fil: 'tl', // Filipino/Tagalog
    cat: 'ca', // Catalan
    eus: 'eu', // Basque
    baq: 'eu', // Alternative for Basque
    glg: 'gl', // Galician
    hrv: 'hr', // Croatian
    srp: 'sr', // Serbian
    slv: 'sl', // Slovenian
    bos: 'bs', // Bosnian
    mkd: 'mk', // Macedonian
    mac: 'mk', // Alternative for Macedonian
    sqi: 'sq', // Albanian
    alb: 'sq', // Alternative for Albanian
    lav: 'lv', // Latvian
    lit: 'lt', // Lithuanian
    est: 'et', // Estonian
    isl: 'is', // Icelandic
    ice: 'is', // Alternative for Icelandic
    fas: 'fa', // Persian/Farsi
    per: 'fa', // Alternative for Persian
    pus: 'ps', // Pashto
    kur: 'ku', // Kurdish
    hye: 'hy', // Armenian
    arm: 'hy', // Alternative for Armenian
    kat: 'ka', // Georgian
    geo: 'ka', // Alternative for Georgian
    aze: 'az', // Azerbaijani
    kaz: 'kk', // Kazakh
    uzb: 'uz', // Uzbek
    tgk: 'tg', // Tajik
    mon: 'mn', // Mongolian
    afr: 'af', // Afrikaans
    swa: 'sw', // Swahili
    amh: 'am', // Amharic
    hau: 'ha', // Hausa
    yor: 'yo', // Yoruba
    ibo: 'ig', // Igbo
    zul: 'zu', // Zulu
    xho: 'xh', // Xhosa
};

/**
 * Extended language names for 2-letter codes not in the main list.
 * Prepared for future i18n integration with react-i18next.
 */
const EXTENDED_LANGUAGE_NAMES_EN: Record<string, string> = {
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
    mr: 'Marathi',
    ur: 'Urdu',
    pa: 'Punjabi',
    gu: 'Gujarati',
    kn: 'Kannada',
    ml: 'Malayalam',
    or: 'Oriya',
    as: 'Assamese',
    ne: 'Nepali',
    si: 'Sinhala',
    my: 'Burmese',
    km: 'Khmer',
    lo: 'Lao',
    tl: 'Filipino',
    ca: 'Catalan',
    eu: 'Basque',
    gl: 'Galician',
    hr: 'Croatian',
    sr: 'Serbian',
    sl: 'Slovenian',
    bs: 'Bosnian',
    mk: 'Macedonian',
    sq: 'Albanian',
    lv: 'Latvian',
    lt: 'Lithuanian',
    et: 'Estonian',
    is: 'Icelandic',
    fa: 'Persian',
    ps: 'Pashto',
    ku: 'Kurdish',
    hy: 'Armenian',
    ka: 'Georgian',
    az: 'Azerbaijani',
    kk: 'Kazakh',
    uz: 'Uzbek',
    tg: 'Tajik',
    mn: 'Mongolian',
    af: 'Afrikaans',
    sw: 'Swahili',
    am: 'Amharic',
    ha: 'Hausa',
    yo: 'Yoruba',
    ig: 'Igbo',
    zu: 'Zulu',
    xh: 'Xhosa',
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
        const mapped = ISO_639_3_TO_1[basePart];
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

    // Fallback: check our curated English name lists
    const mainName = LANGUAGE_NAMES_EN[code];
    if (mainName) return mainName;

    const extendedName = EXTENDED_LANGUAGE_NAMES_EN[code];
    if (extendedName) return extendedName;

    // Last resort: return the original code (may be 3-letter if unmapped)
    return languageCode;
};

export const findBestTrackByLanguage = <T extends { language?: string }>(
    tracks: T[],
    preferredLanguageCodes: string[]
): T | undefined => {
    for (const preferred of preferredLanguageCodes) {
        const match = tracks.find((track) => normalizeLanguageCode(track.language) === preferred);
        if (match) return match;
    }
    return undefined;
};

import { LANGUAGES } from '@/utils/languages';

/**
 * Common language codes derived from iso639.json.
 * These are languages that don't have regional variants (no dash in code).
 */
export const COMMON_LANGUAGE_CODES: string[] = LANGUAGES
    .filter((lang) => !lang.code.includes('-'))
    .map((lang) => lang.code);

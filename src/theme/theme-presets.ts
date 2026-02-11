import type { Theme } from './theme';

export interface ThemePreset {
    id: string;
    name: string;
    /** Partial color overrides - merged with base theme */
    colors: Partial<Theme['colors']>;
}

/**
 * Colorful theme presets for the streaming application.
 * Each preset defines partial color overrides that get merged with the base theme.
 */
export const THEME_PRESETS: ThemePreset[] = [
    // === Dark Themes ===
    {
        id: 'default',
        name: 'Emerald',
        colors: {},
    },
    {
        id: 'ocean',
        name: 'Ocean',
        colors: {
            primaryBackground: '#0EA5E9',
            focusBackgroundPrimary: '#38BDF8',
            textLink: '#0EA5E9',
        },
    },
    {
        id: 'violet',
        name: 'Violet',
        colors: {
            primaryBackground: '#8B5CF6',
            focusBackgroundPrimary: '#A78BFA',
            textLink: '#8B5CF6',
        },
    },
    {
        id: 'rose',
        name: 'Rose',
        colors: {
            primaryBackground: '#F43F5E',
            focusBackgroundPrimary: '#FB7185',
            textLink: '#F43F5E',
        },
    },
    {
        id: 'amber',
        name: 'Amber',
        colors: {
            primaryBackground: '#F59E0B',
            focusBackgroundPrimary: '#FBBF24',
            textLink: '#F59E0B',
        },
    },
    {
        id: 'teal',
        name: 'Teal',
        colors: {
            primaryBackground: '#14B8A6',
            focusBackgroundPrimary: '#2DD4BF',
            textLink: '#14B8A6',
        },
    },
    {
        id: 'crimson',
        name: 'Crimson',
        colors: {
            primaryBackground: '#DC2626',
            focusBackgroundPrimary: '#EF4444',
            textLink: '#DC2626',
        },
    },
    {
        id: 'indigo',
        name: 'Indigo',
        colors: {
            primaryBackground: '#6366F1',
            focusBackgroundPrimary: '#818CF8',
            textLink: '#6366F1',
        },
    },
    {
        id: 'lime',
        name: 'Lime',
        colors: {
            primaryBackground: '#84CC16',
            focusBackgroundPrimary: '#A3E635',
            textLink: '#84CC16',
        },
    },
    {
        id: 'fuchsia',
        name: 'Fuchsia',
        colors: {
            primaryBackground: '#D946EF',
            focusBackgroundPrimary: '#E879F9',
            textLink: '#D946EF',
        },
    },
    {
        id: 'cyan',
        name: 'Cyan',
        colors: {
            primaryBackground: '#06B6D4',
            focusBackgroundPrimary: '#22D3EE',
            textLink: '#06B6D4',
        },
    },
    {
        id: 'slate',
        name: 'Slate',
        colors: {
            primaryBackground: '#64748B',
            focusBackgroundPrimary: '#94A3B8',
            textLink: '#94A3B8',
        },
    },
    // === Crazy Themes ===
    {
        id: 'neon-nights',
        name: 'Neon Nights',
        colors: {
            mainBackground: '#0D001A',
            cardBackground: '#1A0033',
            cardBorder: '#FF00FF',
            primaryBackground: '#FF00FF',
            focusBackgroundPrimary: '#00FFFF',
            focusBackground: '#330066',
            textLink: '#FF00FF',
            textSecondary: '#FF69B4',
        },
    },
    {
        id: 'synthwave',
        name: 'Synthwave',
        colors: {
            mainBackground: '#1A1A2E',
            cardBackground: '#16213E',
            cardBorder: '#E94560',
            primaryBackground: '#E94560',
            focusBackgroundPrimary: '#FF6B9D',
            focusBackground: '#0F3460',
            textLink: '#E94560',
            textSecondary: '#A855F7',
        },
    },
    {
        id: 'matrix',
        name: 'Matrix',
        colors: {
            mainBackground: '#000000',
            cardBackground: '#001100',
            cardBorder: '#00FF00',
            primaryBackground: '#00FF00',
            focusBackgroundPrimary: '#00CC00',
            focusBackground: '#002200',
            textPrimary: '#00FF00',
            textSecondary: '#009900',
            textLink: '#00FF00',
        },
    },
    {
        id: 'vaporwave',
        name: 'Vaporwave',
        colors: {
            mainBackground: '#2D1B4E',
            cardBackground: '#3D2963',
            cardBorder: '#FF71CE',
            primaryBackground: '#01CDFE',
            focusBackgroundPrimary: '#FF71CE',
            focusBackground: '#4D3973',
            textLink: '#01CDFE',
            textSecondary: '#B967FF',
        },
    },
    {
        id: 'sunset-blaze',
        name: 'Sunset Blaze',
        colors: {
            mainBackground: '#1F1135',
            cardBackground: '#2D1B4E',
            cardBorder: '#FF6B35',
            primaryBackground: '#FF6B35',
            focusBackgroundPrimary: '#FFD93D',
            focusBackground: '#3D2963',
            textLink: '#FF6B35',
            textSecondary: '#FF8E53',
        },
    },
    {
        id: 'arctic-aurora',
        name: 'Arctic Aurora',
        colors: {
            mainBackground: '#0B132B',
            cardBackground: '#1C2541',
            cardBorder: '#5BC0BE',
            primaryBackground: '#3A506B',
            focusBackgroundPrimary: '#5BC0BE',
            focusBackground: '#1C2541',
            textLink: '#6FFFE9',
            textSecondary: '#5BC0BE',
        },
    },
];

/** Default theme preset ID */
export const DEFAULT_THEME_PRESET_ID = 'default';

/** Default scaling factor */
export const DEFAULT_SCALING_FACTOR = 0.8;

/** Min/max scaling factor bounds */
export const SCALING_FACTOR_MIN = 0.4;
export const SCALING_FACTOR_MAX = 2.0;
export const SCALING_FACTOR_STEP = 0.05;

/**
 * Get a theme preset by ID, falls back to default
 */
export const getThemePreset = (id: string): ThemePreset => {
    return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
};

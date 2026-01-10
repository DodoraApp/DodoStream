/**
 * Subtitle display and loading constants
 */
import type {
    SubtitleStyle,
    SubtitleStylePreset,
    SubtitleStylePresetConfig,
    SubtitleFontFamily,
} from '@/types/subtitles';

// Maximum lines for subtitle text
export const SUBTITLE_MAX_LINES = 3;

// Subtitle loading
export const SUBTITLE_FETCH_TIMEOUT_MS = 15_000;

// Line height multiplier
export const SUBTITLE_LINE_HEIGHT_MULTIPLIER = 1.4;

// Padding ratio relative to font size
export const SUBTITLE_PADDING_RATIO = {
    horizontal: 0.5, // 50% of font size
    vertical: 0.2, // 20% of font size
};

// Reference resolution for scaling (1080p)
export const SUBTITLE_REFERENCE_HEIGHT = 1080;

/**
 * Available font family options for the picker
 */
export const SUBTITLE_FONT_FAMILIES: { value: SubtitleFontFamily; label: string }[] = [
    { value: 'System', label: 'System Default' },
    { value: 'Serif', label: 'Serif' },
    { value: 'Monospace', label: 'Monospace' },
    { value: 'Outfit_600SemiBold', label: 'Outfit' },
    { value: 'Poppins_400Regular', label: 'Poppins' },
];

/**
 * Font size range for subtitle customization
 */
export const SUBTITLE_FONT_SIZE_MIN = 24;
export const SUBTITLE_FONT_SIZE_MAX = 120;
export const SUBTITLE_FONT_SIZE_STEP = 2;

/**
 * Position range (percentage from bottom)
 */
export const SUBTITLE_POSITION_MIN = 2;
export const SUBTITLE_POSITION_MAX = 75;
export const SUBTITLE_POSITION_STEP = 1;

/**
 * Subtitle sync/delay constants
 */
export const SUBTITLE_DELAY_MIN = -10; // seconds
export const SUBTITLE_DELAY_MAX = 10; // seconds
export const SUBTITLE_DELAY_STEP = 0.1; // 100ms increments

/**
 * Cue preview constants (for sync panel)
 */
export const SUBTITLE_CUE_PREVIEW_COUNT = 5; // total cues shown (2 above, current, 2 below)
export const SUBTITLE_CUE_PREVIEW_FADE_LEVELS = [0.3, 0.6, 1, 0.6, 0.3]; // opacity for each cue

/**
 * Classic subtitle style - clean white text without background
 * The standard look for most streaming services and Blu-rays
 */
export const SUBTITLE_STYLE_CLASSIC: SubtitleStyle = {
    fontFamily: 'System',
    fontSize: 48,
    fontColor: '#FFFFFF',
    fontOpacity: 1,
    backgroundColor: '#000000',
    backgroundOpacity: 0,
    bottomPosition: 8,
};

/**
 * High contrast style - yellow on black for accessibility
 * Follows WCAG accessibility guidelines for maximum readability
 */
export const SUBTITLE_STYLE_HIGH_CONTRAST: SubtitleStyle = {
    fontFamily: 'System',
    fontSize: 48,
    fontColor: '#FFFF00',
    fontOpacity: 1,
    backgroundColor: '#000000',
    backgroundOpacity: 0.85,
    bottomPosition: 10,
};

/**
 * Cinema style - elegant theater-like subtitles
 * Inspired by premium theatrical subtitle presentation with no background
 */
export const SUBTITLE_STYLE_CINEMA: SubtitleStyle = {
    fontFamily: 'Serif',
    fontSize: 48,
    fontColor: '#FFFEF2', // Warm white, like film projector light
    fontOpacity: 0.95,
    backgroundColor: '#000000',
    backgroundOpacity: 0,
    bottomPosition: 6,
};

/**
 * Minimal style - small and unobtrusive
 * For users who prefer subtle subtitles that don't distract from the video
 */
export const SUBTITLE_STYLE_MINIMAL: SubtitleStyle = {
    fontFamily: 'System',
    fontSize: 40,
    fontColor: '#FFFFFF',
    fontOpacity: 0.9,
    backgroundColor: '#000000',
    backgroundOpacity: 0,
    bottomPosition: 4,
};

/**
 * Retro style - classic VHS/DVD era subtitle look with background box
 * Nostalgic styling reminiscent of older home video releases
 */
export const SUBTITLE_STYLE_RETRO: SubtitleStyle = {
    fontFamily: 'Monospace',
    fontSize: 36,
    fontColor: '#FFFACD', // Lemon chiffon / old CRT warmth
    fontOpacity: 1,
    backgroundColor: '#000000',
    backgroundOpacity: 0.7,
    bottomPosition: 12,
};

/**
 * Default subtitle style (uses classic preset)
 */
export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = SUBTITLE_STYLE_CLASSIC;

/**
 * All available presets with metadata
 */
export const SUBTITLE_STYLE_PRESETS: SubtitleStylePresetConfig[] = [
    {
        id: 'classic',
        label: 'Classic',
        description: 'Standard white text',
        style: SUBTITLE_STYLE_CLASSIC,
    },
    {
        id: 'highContrast',
        label: 'High Contrast',
        description: 'Yellow on black for accessibility',
        style: SUBTITLE_STYLE_HIGH_CONTRAST,
    },
    {
        id: 'cinema',
        label: 'Cinema',
        description: 'Elegant theater-like appearance',
        style: SUBTITLE_STYLE_CINEMA,
    },
    {
        id: 'minimal',
        label: 'Minimal',
        description: 'Clean and unobtrusive',
        style: SUBTITLE_STYLE_MINIMAL,
    },
    {
        id: 'retro',
        label: 'Retro',
        description: 'Classic VHS/DVD style with monospace text and lemon chiffon box',
        style: SUBTITLE_STYLE_RETRO,
    },
];

/**
 * Get a preset by ID
 */
export const getSubtitleStylePreset = (
    presetId: SubtitleStylePreset
): SubtitleStylePresetConfig | undefined => {
    return SUBTITLE_STYLE_PRESETS.find((p) => p.id === presetId);
};

/**
 * Common subtitle colors for the color picker
 */
export const SUBTITLE_COMMON_COLORS = [
    '#FFFFFF', // White
    '#FFFF00', // Yellow
    '#00FFFF', // Cyan
    '#00FF00', // Green
    '#FF00FF', // Magenta
    '#FF0000', // Red
    '#FFA500', // Orange
    '#FFD700', // Gold
    '#FFFACD', // Lemon chiffon
    '#000000', // Black
    '#333333', // Dark gray
    '#666666', // Gray
];

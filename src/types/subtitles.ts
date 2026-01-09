/**
 * Subtitle style customization types
 */

/**
 * Available font families for subtitles.
 * Uses system fonts for cross-platform compatibility.
 */
export type SubtitleFontFamily =
    | 'System' // System default sans-serif
    | 'Serif' // System serif font
    | 'Monospace' // System monospace font
    | 'Outfit_600SemiBold' // App's custom Outfit font
    | 'Poppins_400Regular'; // App's custom Poppins font

/**
 * Subtitle style configuration object.
 * All properties are required to ensure consistent rendering.
 */
export interface SubtitleStyle {
    /** Font family name */
    fontFamily: SubtitleFontFamily;
    /** Font size in pixels (scaled relative to 1080p) */
    fontSize: number;
    /** Font color in hex format (e.g., '#FFFFFF') */
    fontColor: string;
    /** Font opacity (0-1) */
    fontOpacity: number;
    /** Background color in hex format */
    backgroundColor: string;
    /** Background opacity (0-1) */
    backgroundOpacity: number;
    /** Position from bottom of screen in percentage (2-75) */
    bottomPosition: number;
}

/**
 * Named subtitle style presets
 */
export type SubtitleStylePreset =
    | 'classic'
    | 'highContrast'
    | 'cinema'
    | 'minimal'
    | 'retro';

/**
 * Preset configuration with name and style
 */
export interface SubtitleStylePresetConfig {
    id: SubtitleStylePreset;
    label: string;
    description: string;
    style: SubtitleStyle;
}

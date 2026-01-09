import { Platform } from 'react-native';
import {
    SUBTITLE_LINE_HEIGHT_MULTIPLIER,
    SUBTITLE_PADDING_RATIO,
    SUBTITLE_REFERENCE_HEIGHT,
} from '@/constants/subtitles';
import type { SubtitleFontFamily, SubtitleStyle } from '@/types/subtitles';

const clamp = (value: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, value));
};

export const opacityToHex = (opacity: number): string => {
    const clamped = clamp(opacity, 0, 1);
    return Math.round(clamped * 255)
        .toString(16)
        .padStart(2, '0');
};

export const applyOpacityToHexColor = (color: string, opacity: number): string => {
    return `${color}${opacityToHex(opacity)}`;
};

export const getSubtitleFontFamily = (family: SubtitleFontFamily): string | undefined => {
    switch (family) {
        case 'System':
            return undefined;
        case 'Serif':
            return Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
        case 'Monospace':
            return Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
        default:
            return family;
    }
};

export interface ComputedSubtitleStyle {
    raw: SubtitleStyle;
    fontSize: number;
    lineHeight: number;
    paddingHorizontal: number;
    paddingVertical: number;
    fontFamily: string | undefined;
    fontColorWithOpacity: string;
    backgroundColorWithOpacity: string;
    bottomOffset: number;
}

export const computeSubtitleStyle = (
    style: SubtitleStyle,
    containerHeight: number
): ComputedSubtitleStyle => {
    const scaleFactor = containerHeight / SUBTITLE_REFERENCE_HEIGHT;

    const fontSize = style.fontSize * scaleFactor;
    const lineHeight = fontSize * SUBTITLE_LINE_HEIGHT_MULTIPLIER;

    const paddingHorizontal = fontSize * SUBTITLE_PADDING_RATIO.horizontal;
    const paddingVertical = fontSize * SUBTITLE_PADDING_RATIO.vertical;

    const bottomOffset = (style.bottomPosition / 100) * containerHeight;

    const fontColorWithOpacity = applyOpacityToHexColor(style.fontColor, style.fontOpacity);
    const backgroundColorWithOpacity =
        style.backgroundOpacity > 0
            ? applyOpacityToHexColor(style.backgroundColor, style.backgroundOpacity)
            : 'transparent';

    return {
        raw: style,
        fontSize,
        lineHeight,
        paddingHorizontal,
        paddingVertical,
        fontFamily: getSubtitleFontFamily(style.fontFamily),
        fontColorWithOpacity,
        backgroundColorWithOpacity,
        bottomOffset,
    };
};

export const areSubtitleStylesEqual = (a: SubtitleStyle, b: SubtitleStyle): boolean => {
    return (
        a.fontFamily === b.fontFamily &&
        a.fontSize === b.fontSize &&
        a.fontColor === b.fontColor &&
        a.fontOpacity === b.fontOpacity &&
        a.backgroundColor === b.backgroundColor &&
        a.backgroundOpacity === b.backgroundOpacity &&
        a.bottomPosition === b.bottomPosition
    );
};

import { useMemo } from 'react';
import { Dimensions } from 'react-native';
import { useProfileStore } from '@/store/profile.store';
import { useProfileSettingsStore } from '@/store/profile-settings.store';
import {
    DEFAULT_SUBTITLE_STYLE,
    SUBTITLE_PADDING_RATIO,
    SUBTITLE_REFERENCE_HEIGHT,
} from '@/constants/subtitles';
import type { SubtitleStyle } from '@/types/subtitles';
import {
    computeSubtitleStyle,
    type ComputedSubtitleStyle,
} from '@/utils/subtitle-style';

/**
 * Computed subtitle style values scaled to a container height.
 */

/**
 * Hook to get the current subtitle style from profile settings.
 * Returns the raw SubtitleStyle object.
 */
export const useSubtitleStyle = (): SubtitleStyle => {
    const activeProfileId = useProfileStore((state) => state.activeProfileId);
    const subtitleStyle = useProfileSettingsStore((state) =>
        activeProfileId
            ? (state.byProfile[activeProfileId]?.subtitleStyle ?? DEFAULT_SUBTITLE_STYLE)
            : DEFAULT_SUBTITLE_STYLE
    );

    return subtitleStyle;
};

/**
 * Hook to get computed subtitle style values scaled to a container height.
 * Use this for rendering subtitles on screen.
 *
 * @param containerHeight - The height of the container (e.g., video player height)
 */
export const useComputedSubtitleStyle = (containerHeight: number): ComputedSubtitleStyle => {
    const style = useSubtitleStyle();

    return useMemo(() => {
        return computeSubtitleStyle(style, containerHeight);
    }, [style, containerHeight]);
};

/**
 * Get native player subtitle style for react-native-video.
 * Returns style props compatible with the Video component's SubtitleStyle.
 * Scales font size based on actual screen height relative to 1080p reference.
 */
export const useNativeSubtitleStyle = () => {
    const style = useSubtitleStyle();

    return useMemo(() => {
        const screenHeight = Dimensions.get('window').height;
        // Scale font size based on screen height relative to 1080p reference
        const scaleFactor = screenHeight / SUBTITLE_REFERENCE_HEIGHT;
        const scaledFontSize = style.fontSize * scaleFactor;

        return {
            fontSize: scaledFontSize,
            paddingTop: scaledFontSize * SUBTITLE_PADDING_RATIO.vertical,
            // Convert percentage bottomPosition into pixels using actual screen height
            paddingBottom: (style.bottomPosition / 100) * screenHeight,
            paddingLeft: scaledFontSize * SUBTITLE_PADDING_RATIO.horizontal,
            paddingRight: scaledFontSize * SUBTITLE_PADDING_RATIO.horizontal,
            opacity: style.fontOpacity,
            subtitlesFollowVideo: true,
        };
    }, [style.fontSize, style.fontOpacity, style.bottomPosition]);
};

import { useMemo } from 'react';
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
 */
export const useNativeSubtitleStyle = () => {
    const style = useSubtitleStyle();

    console.log("Style", style)

    return useMemo(
        () => ({
            fontSize: style.fontSize,
            paddingTop: style.fontSize * SUBTITLE_PADDING_RATIO.vertical,
            // Convert percentage bottomPosition into pixels using the 1080p reference height.
            paddingBottom: (style.bottomPosition / 100) * SUBTITLE_REFERENCE_HEIGHT,
            paddingLeft: style.fontSize * SUBTITLE_PADDING_RATIO.horizontal,
            paddingRight: style.fontSize * SUBTITLE_PADDING_RATIO.horizontal,
            opacity: style.fontOpacity,
            subtitlesFollowVideo: true,
        }),
        [style.fontSize, style.fontOpacity, style.bottomPosition]
    );
};

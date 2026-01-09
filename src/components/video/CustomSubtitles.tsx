import React, { memo, useRef } from 'react';
import { StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Box, Text } from '@/theme/theme';
import { findCurrentCue } from '@/utils/subtitles';
import { useSubtitleCues } from '@/hooks/useSubtitleCues';
import { useDebugLogger } from '@/utils/debug';
import { useComputedSubtitleStyle } from '@/hooks/useSubtitleStyle';
import { SUBTITLE_MAX_LINES } from '@/constants/subtitles';

interface CustomSubtitlesProps {
  /** URL to the subtitle file */
  url: string;
  /** Current playback time in seconds */
  currentTime: number;
}

interface SubtitleDisplayProps {
  text: string;
  containerHeight: number;
}

/**
 * Inner component that renders the subtitle text.
 * Uses the computed subtitle style from the hook.
 */
const SubtitleDisplay = memo<SubtitleDisplayProps>(({ text, containerHeight }) => {
  const computedStyle = useComputedSubtitleStyle(containerHeight);

  return (
    <Box
      style={[
        styles.container,
        { bottom: computedStyle.bottomOffset + (Platform.OS === 'ios' ? 20 : 0) },
      ]}
      paddingHorizontal="l"
      pointerEvents="none">
      <Box
        borderRadius="m"
        style={[
          styles.textContainer,
          {
            backgroundColor: computedStyle.backgroundColorWithOpacity,
            paddingHorizontal: computedStyle.paddingHorizontal,
            paddingVertical: computedStyle.paddingVertical,
          },
        ]}>
        <Text
          style={[
            styles.subtitleText,
            {
              fontSize: computedStyle.fontSize,
              lineHeight: computedStyle.lineHeight,
              fontFamily: computedStyle.fontFamily,
              color: computedStyle.fontColorWithOpacity,
            },
          ]}
          numberOfLines={SUBTITLE_MAX_LINES}>
          {text}
        </Text>
      </Box>
    </Box>
  );
});

SubtitleDisplay.displayName = 'SubtitleDisplay';

/**
 * Displays custom subtitles on top of the video player.
 * Uses binary search for efficient cue lookup.
 * Applies subtitle style from profile settings via useComputedSubtitleStyle hook.
 */
export const CustomSubtitles = memo<CustomSubtitlesProps>(({ url, currentTime }) => {
  const debug = useDebugLogger('CustomSubtitles');
  const lastCueIndexRef = useRef<number>(-1);
  const { height: windowHeight } = useWindowDimensions();

  const { data: cues = [], isLoading, isError } = useSubtitleCues(url);

  // Don't render while loading, on error, or if no cues
  if (isLoading || isError || cues.length === 0) {
    return null;
  }

  // Find current cue using binary search (O(log n))
  const currentCue = findCurrentCue(cues, currentTime);

  // Log cue changes for debugging (not on every render)
  if (currentCue?.index !== lastCueIndexRef.current) {
    lastCueIndexRef.current = currentCue?.index ?? -1;
    if (currentCue) {
      debug('showCue', {
        index: currentCue.index,
        time: currentTime.toFixed(1),
        text: currentCue.text.substring(0, 40),
      });
    }
  }

  if (!currentCue) {
    return null;
  }

  return <SubtitleDisplay text={currentCue.text} containerHeight={windowHeight} />;
});

CustomSubtitles.displayName = 'CustomSubtitles';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  textContainer: {
    maxWidth: '90%',
  },
  subtitleText: {
    textAlign: 'center',
  },
});

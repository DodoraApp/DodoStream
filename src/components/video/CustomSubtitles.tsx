import React, { memo, useRef } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { Box, Text } from '@/theme/theme';
import { findCurrentCue } from '@/utils/subtitles';
import { useSubtitleCues } from '@/hooks/useSubtitleCues';
import { useDebugLogger } from '@/utils/debug';
import {
  SUBTITLE_FONT_SIZE,
  SUBTITLE_FONT_FAMILY,
  SUBTITLE_TEXT_COLOR,
  SUBTITLE_TEXT_SHADOW_COLOR,
  SUBTITLE_TEXT_SHADOW_RADIUS,
  SUBTITLE_TEXT_SHADOW_OFFSET,
  SUBTITLE_BACKGROUND_COLOR,
  SUBTITLE_CONTAINER_BOTTOM_MARGIN,
  SUBTITLE_MAX_LINES,
  SUBTITLE_LINE_HEIGHT_MULTIPLIER,
} from '@/constants/subtitles';

interface CustomSubtitlesProps {
  /** URL to the subtitle file */
  url: string;
  /** Current playback time in seconds */
  currentTime: number;
}

/**
 * Inner component that renders the subtitle text.
 * Separated to allow memoization of the outer query component.
 */
const SubtitleDisplay = memo<{ text: string }>(({ text }) => {
  return (
    <Box
      style={[
        styles.container,
        { bottom: SUBTITLE_CONTAINER_BOTTOM_MARGIN + (Platform.OS === 'ios' ? 20 : 0) },
      ]}
      paddingHorizontal="l"
      pointerEvents="none">
      <Box
        paddingHorizontal="m"
        paddingVertical="s"
        borderRadius="m"
        style={[
          styles.textContainer,
          {
            backgroundColor: SUBTITLE_BACKGROUND_COLOR,
          },
        ]}>
        <Text
          style={[
            styles.subtitleText,
            {
              fontSize: SUBTITLE_FONT_SIZE,
              lineHeight: SUBTITLE_FONT_SIZE * SUBTITLE_LINE_HEIGHT_MULTIPLIER,
              fontFamily: SUBTITLE_FONT_FAMILY,
              color: SUBTITLE_TEXT_COLOR,
              textShadowColor: SUBTITLE_TEXT_SHADOW_COLOR,
              textShadowRadius: SUBTITLE_TEXT_SHADOW_RADIUS,
              textShadowOffset: SUBTITLE_TEXT_SHADOW_OFFSET,
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
 */
export const CustomSubtitles = memo<CustomSubtitlesProps>(({ url, currentTime }) => {
  const debug = useDebugLogger('CustomSubtitles');
  const lastCueIndexRef = useRef<number>(-1);

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

  return <SubtitleDisplay text={currentCue.text} />;
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

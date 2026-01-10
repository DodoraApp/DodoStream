import React, { FC, memo, useMemo, useRef, useEffect } from 'react';
import { Box, Text } from '@/theme/theme';
import type { SubtitleCue } from '@/types/player';
import {
  SUBTITLE_CUE_PREVIEW_COUNT,
  SUBTITLE_CUE_PREVIEW_FADE_LEVELS,
} from '@/constants/subtitles';

interface SubtitleCuePreviewProps {
  /** All parsed subtitle cues */
  cues: SubtitleCue[];
  /** Current playback time in seconds (with delay applied) */
  adjustedTime: number;
}

interface CueItemProps {
  cue: SubtitleCue | null;
  opacity: number;
  isActive: boolean;
}

const CueItem = memo<CueItemProps>(({ cue, opacity, isActive }) => {
  if (!cue) {
    return (
      <Box height={32} justifyContent="center" opacity={opacity}>
        <Text variant="body" color="textSecondary" numberOfLines={1}>
          —
        </Text>
      </Box>
    );
  }

  return (
    <Box height={32} justifyContent="center" opacity={opacity}>
      <Text
        variant="body"
        color="mainForeground"
        numberOfLines={1}
        style={{ fontSize: 16, fontWeight: isActive ? '600' : '400' }}>
        {cue.text}
      </Text>
    </Box>
  );
});

CueItem.displayName = 'CueItem';

/**
 * Find the current cue index by scanning from a starting position.
 * Much more efficient than binary search when called frequently with incrementing time.
 */
function findCurrentCueIndexFrom(
  cues: SubtitleCue[],
  adjustedTime: number,
  startIndex: number
): number {
  if (cues.length === 0) return -1;

  // Clamp start index to valid range
  let index = Math.max(0, Math.min(startIndex, cues.length - 1));

  // If time went backwards significantly, search backwards
  while (index > 0 && adjustedTime < cues[index].startTime) {
    index--;
  }

  // Search forward to find current or next cue
  while (index < cues.length - 1) {
    const cue = cues[index];
    const nextCue = cues[index + 1];

    // If we're within this cue, return it
    if (adjustedTime >= cue.startTime && adjustedTime <= cue.endTime) {
      return index;
    }

    // If we're between this cue and the next, stay on current
    if (adjustedTime > cue.endTime && adjustedTime < nextCue.startTime) {
      return index;
    }

    // If next cue hasn't started yet, stay here
    if (adjustedTime < nextCue.startTime) {
      return index;
    }

    index++;
  }

  return index;
}

/**
 * Displays a preview of subtitle cues with the current one highlighted.
 * Shows surrounding cues with fading opacity to give context.
 */
export const SubtitleCuePreview: FC<SubtitleCuePreviewProps> = memo(({ cues, adjustedTime }) => {
  const halfCount = Math.floor(SUBTITLE_CUE_PREVIEW_COUNT / 2);
  const lastIndexRef = useRef(0);

  // Reset index when cues change
  useEffect(() => {
    lastIndexRef.current = 0;
  }, [cues]);

  const currentIndex = useMemo(() => {
    const index = findCurrentCueIndexFrom(cues, adjustedTime, lastIndexRef.current);
    lastIndexRef.current = index >= 0 ? index : 0;
    return index;
  }, [cues, adjustedTime]);

  const visibleCues = useMemo(() => {
    const items: { cue: SubtitleCue | null; opacity: number; isActive: boolean }[] = [];

    for (let i = 0; i < SUBTITLE_CUE_PREVIEW_COUNT; i++) {
      const offset = i - halfCount;
      const cueIndex = currentIndex + offset;
      const cue = cueIndex >= 0 && cueIndex < cues.length ? cues[cueIndex] : null;
      const isActive = offset === 0 && cue !== null;

      // Check if this is the currently active cue (time is within its range)
      const isWithinCue =
        cue !== null && adjustedTime >= cue.startTime && adjustedTime <= cue.endTime;

      items.push({
        cue,
        opacity: SUBTITLE_CUE_PREVIEW_FADE_LEVELS[i] ?? 0.3,
        isActive: isActive && isWithinCue,
      });
    }

    return items;
  }, [cues, currentIndex, adjustedTime, halfCount]);

  if (cues.length === 0) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" padding="m">
        <Text variant="bodySmall" color="textSecondary">
          No subtitles loaded
        </Text>
      </Box>
    );
  }

  return (
    <Box flex={1} justifyContent="center" gap="xs">
      {visibleCues.map((item, index) => (
        <CueItem
          key={item.cue?.index ?? `empty-${index}`}
          cue={item.cue}
          opacity={item.opacity}
          isActive={item.isActive}
        />
      ))}
    </Box>
  );
});

SubtitleCuePreview.displayName = 'SubtitleCuePreview';

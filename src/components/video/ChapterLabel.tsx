import { FC, memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  findNodeHandle,
  HWEvent,
  LayoutChangeEvent,
  Platform,
  TVFocusGuideView,
  useTVEventHandler,
  View,
} from 'react-native';

import { useTheme } from '@shopify/restyle';
import { MotiView } from 'moti';

import { Focusable } from '@/components/basic/Focusable';
import { PLAYER_CHAPTER_CONNECTOR_SLIDE_MS } from '@/constants/ui';
import { Box, Text, Theme } from '@/theme/theme';
import type { ChapterType, VideoChapter } from '@/types/player';

interface ChapterLabelsProps {
  chapters: VideoChapter[];
  currentTime: number;
  duration: number;
  /** Node handle of the seek bar; pressing down from any label returns there. */
  nextFocusDownId?: number | null;
  /** Reports the node handle of the active chapter's label — the up-focus target from the bar. */
  onActiveLabelNodeHandle?: (handle: number | null) => void;
  onChapterPress?: (chapter: VideoChapter) => void;
  onChapterNavigate?: (direction: 'left' | 'right', chapter: VideoChapter) => void;
}

const getChapterFallbackKey = (type?: ChapterType): string => {
  switch (String(type)) {
    case 'INTRO':
      return 'chapter_intro';
    case 'CREDITS':
      return 'chapter_credits';
    case 'RECAP':
      return 'chapter_recap';
    case 'PREVIEW':
      return 'chapter_preview';
    default:
      return 'chapter_unknown';
  }
};

const getChapterLabel = (chapter: VideoChapter, translate: (key: string) => string): string => {
  const title = chapter.title?.trim();
  return title || translate(getChapterFallbackKey(chapter.type));
};

const isValidChapter = (chapter: VideoChapter, duration: number): boolean =>
  Number.isFinite(chapter.startTime) &&
  Number.isFinite(chapter.endTime) &&
  chapter.startTime >= 0 &&
  chapter.endTime > chapter.startTime &&
  chapter.startTime < duration;

const findActiveChapterIndex = (chapters: VideoChapter[], currentTime: number): number => {
  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index];
    const isLast = index === chapters.length - 1;
    if (
      currentTime >= chapter.startTime &&
      (currentTime < chapter.endTime || (isLast && currentTime <= chapter.endTime))
    ) {
      return index;
    }
  }
  return -1;
};

/**
 * One label per chapter, anchored at the start of its chapter's segment.
 *
 * Every label sits on a chip; the active chapter's chip is brighter and owns the
 * connector line that drops to the chapter's gap on the seek bar below.
 *
 * On TV every label is focusable: select seeks to the chapter start and down
 * returns to the bar. Pressing up from the bar always lands on the ACTIVE
 * chapter's label (its node handle is reported via onActiveLabelNodeHandle).
 * While a label is focused, left/right jumps to the previous/next chapter
 * relative to the playhead instead of moving focus horizontally, and TV focus
 * follows the jump so the highlight stays on the active chapter's label.
 */
export const ChapterLabels: FC<ChapterLabelsProps> = memo(
  ({
    chapters,
    currentTime,
    duration,
    nextFocusDownId,
    onActiveLabelNodeHandle,
    onChapterPress,
    onChapterNavigate,
  }) => {
    const { t } = useTranslation('player');
    const theme = useTheme<Theme>();

    const isLabelFocusedRef = useRef(false);
    const activeChapterRef = useRef<VideoChapter | null>(null);
    const labelHandlesRef = useRef<Record<number, number | null>>({});
    const labelNodesRef = useRef<Record<number, View | null>>({});
    const lastReportedHandleRef = useRef<number | null>(null);
    // Width of the alignment frame below. It must match the seek bar track's
    // geometry exactly: this row lives inside the same padded container as the
    // seek bar and adds the track's own horizontal inset. It is measured so the
    // connector can slide in pixels.
    const [frameWidth, setFrameWidth] = useState(0);
    const handleFrameLayout = useCallback((event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      setFrameWidth((previous) => (previous === width ? previous : width));
    }, []);

    // Chip widths keyed by chapter index, so the connector can center under the
    // active chip regardless of its text length.
    const [chipWidths, setChipWidths] = useState<Record<number, number>>({});
    const handleChipLayout = useCallback(
      (index: number) => (event: LayoutChangeEvent) => {
        const width = event.nativeEvent.layout.width;
        setChipWidths((previous) =>
          previous[index] === width ? previous : { ...previous, [index]: width }
        );
      },
      []
    );
    // Set while a chapter jump triggered from a focused label awaits the seek:
    // once playback reports the new position, TV focus moves to the new active
    // label so the highlight follows the jump.
    const pendingFocusFollowRef = useRef(false);

    // Horizontal presses while any label is focused jump between chapters relative
    // to the playhead, so repeated presses keep advancing even though focus stays
    // on the originally focused label.
    const handleTVEvent = useCallback(
      (event: HWEvent) => {
        if (!Platform.isTV || !isLabelFocusedRef.current || !onChapterNavigate) return;
        if (event.eventType === 'left' || event.eventType === 'right') {
          const chapter = activeChapterRef.current;
          if (chapter) {
            pendingFocusFollowRef.current = true;
            onChapterNavigate(event.eventType, chapter);
          }
        }
      },
      [onChapterNavigate]
    );

    useTVEventHandler(handleTVEvent);

    const handleLabelRef = useCallback((index: number, node: View | null) => {
      labelHandlesRef.current[index] = node ? findNodeHandle(node) : null;
      labelNodesRef.current[index] = node;
    }, []);

    const validChapters = duration > 0 ? chapters.filter((c) => isValidChapter(c, duration)) : [];
    const activeIndex = findActiveChapterIndex(validChapters, currentTime);

    // Report the active label's node handle whenever it changes so the seek bar can
    // target it on focus up. Ref callbacks run before layout effects, so the handle
    // of the active label is already recorded here.
    useLayoutEffect(() => {
      const handle = activeIndex >= 0 ? (labelHandlesRef.current[activeIndex] ?? null) : null;
      if (handle === lastReportedHandleRef.current) return;
      lastReportedHandleRef.current = handle;
      onActiveLabelNodeHandle?.(handle);
    });

    // Consume a pending chapter jump: once the playhead reports the new chapter,
    // move TV focus to that label. Without this the focus engine keeps focus on
    // the previously focused label, so the highlight lags one jump behind.
    useLayoutEffect(() => {
      if (!pendingFocusFollowRef.current) return;
      if (activeIndex < 0) {
        pendingFocusFollowRef.current = false;
        return;
      }
      const focusable = labelNodesRef.current[activeIndex] as
        (View & { requestTVFocus?: () => void }) | null;
      if (!focusable?.requestTVFocus) return;
      pendingFocusFollowRef.current = false;
      focusable.requestTVFocus();
    });

    if (activeIndex < 0) {
      // No chapter represents the playhead: the labels disappear and TV focus has
      // moved elsewhere, so drop the tracked state.
      isLabelFocusedRef.current = false;
      activeChapterRef.current = null;
      return null;
    }

    const activeChapter = validChapters[activeIndex];
    activeChapterRef.current = activeChapter;

    // Connector geometry, all derived from theme tokens. The connector runs from
    // the chip's bottom edge (flush with the row bottom) down to the track's top
    // edge: the seek bar's upper breathing room minus the row's negative bottom
    // margin that pulls the labels slightly toward the bar.
    const connectorWidth = theme.spacing.xs / 2; // matches the chapter gap width on the bar
    const connectorDrop =
      theme.sizes.inputHeight / 2 - theme.sizes.progressBarHeight / 2 - theme.spacing.xs;
    const connectorHeight = connectorDrop;
    const activeChipWidth = chipWidths[activeIndex] ?? 0;
    const chipLeft = (activeChapter.startTime / duration) * frameWidth + theme.spacing.xs;
    const connectorX = chipLeft + activeChipWidth / 2 - connectorWidth / 2;

    return (
      <Box
        pointerEvents="box-none"
        style={{
          paddingHorizontal: theme.spacing.s,
          // Pull the labels slightly into the seek bar's upper breathing room.
          marginBottom: -theme.spacing.xs,
        }}>
        <Box
          pointerEvents="box-none"
          position="relative"
          height={theme.sizes.iconMedium + theme.spacing.xs}
          onLayout={handleFrameLayout}>
          {validChapters.map((chapter, index) => {
            const isActive = index === activeIndex;
            const left = (chapter.startTime / duration) * 100;
            const width =
              ((Math.min(chapter.endTime, duration) - chapter.startTime) / duration) * 100;
            const chapterKey = `${chapter.startTime}-${chapter.endTime}-${String(chapter.type)}`;

            return (
              <Box
                key={chapterKey}
                testID={`chapter-label-${index}`}
                pointerEvents="box-none"
                position="absolute"
                bottom={0}
                left={`${left}%`}
                width={`${width}%`}
                alignItems="flex-start">
                <TVFocusGuideView trapFocusLeft trapFocusRight>
                  <Focusable
                    testID={isActive ? 'chapter-label-active' : undefined}
                    variant="background"
                    nextFocusDownId={nextFocusDownId}
                    onRef={(node) => handleLabelRef(index, node)}
                    style={{
                      maxWidth: '100%',
                      marginLeft: theme.spacing.xs,
                      paddingHorizontal: theme.spacing.s,
                      paddingVertical: theme.spacing.xs,
                      borderRadius: theme.borderRadii.l,
                      backgroundColor: isActive
                        ? theme.colors.secondaryBackground
                        : theme.colors.semiTransparentBackground,
                    }}
                    onLayout={handleChipLayout(index)}
                    onPress={() => onChapterPress?.(chapter)}
                    onFocusChange={(focused) => {
                      isLabelFocusedRef.current = focused;
                    }}>
                    {({ isFocused }) => (
                      <Text
                        variant="caption"
                        color={isFocused || isActive ? 'mainForeground' : 'textSecondary'}
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {getChapterLabel(chapter, t)}
                      </Text>
                    )}
                  </Focusable>
                </TVFocusGuideView>
              </Box>
            );
          })}
          {/* Connector from the active chip down to the chapter's gap on the bar */}
          {frameWidth > 0 && activeChipWidth > 0 && (
            <MotiView
              pointerEvents="none"
              from={{ translateX: connectorX }}
              animate={{ translateX: connectorX }}
              transition={{ type: 'timing', duration: PLAYER_CHAPTER_CONNECTOR_SLIDE_MS }}
              style={{
                position: 'absolute',
                bottom: -connectorDrop,
                left: 0,
                width: connectorWidth,
                height: connectorHeight,
                backgroundColor: theme.colors.secondaryBackground,
              }}
            />
          )}
        </Box>
      </Box>
    );
  }
);

ChapterLabels.displayName = 'ChapterLabels';

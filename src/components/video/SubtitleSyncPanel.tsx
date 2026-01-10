import React, { FC, memo, useCallback } from 'react';
import { Box, Text, Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { Ionicons } from '@expo/vector-icons';
import { SliderInput } from '@/components/basic/SliderInput';
import { SubtitleCuePreview } from '@/components/video/SubtitleCuePreview';
import type { TextTrack } from '@/types/player';
import { useSubtitleCues } from '@/hooks/useSubtitleCues';
import { SUBTITLE_DELAY_MIN, SUBTITLE_DELAY_MAX, SUBTITLE_DELAY_STEP } from '@/constants/subtitles';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';

interface SubtitleSyncPanelProps {
  /** Currently selected subtitle track (used to load cues) */
  selectedTrack?: TextTrack;
  /** Current playback time in seconds */
  currentTime: number;
  /** Current subtitle delay in seconds */
  delay: number;
  /** Callback when delay changes */
  onDelayChange: (delay: number) => void;
}

/**
 * Format delay value for display.
 * Shows sign for clarity: +1.5s, -0.5s, 0s
 */
const formatDelay = (value: number): string => {
  if (value === 0) return '0';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
};

/**
 * Panel for syncing custom subtitles with video playback.
 * Contains a delay slider and a preview of nearby subtitle cues.
 */
export const SubtitleSyncPanel: FC<SubtitleSyncPanelProps> = memo(
  ({ selectedTrack, currentTime, delay, onDelayChange }) => {
    const theme = useTheme<Theme>();
    const { isPlatformTV } = useResponsiveLayout();
    const adjustedTime = currentTime - delay;

    // Only load cues for addon subtitles
    const subtitleUrl = selectedTrack?.source === 'addon' ? selectedTrack.uri : undefined;
    const { data: cues = [] } = useSubtitleCues(subtitleUrl);

    const isSyncEnabled = selectedTrack?.source === 'addon';

    const handleDelayChange = useCallback(
      (newDelay: number) => {
        // Round to avoid floating point issues
        const rounded = Math.round(newDelay * 10) / 10;
        onDelayChange(rounded);
      },
      [onDelayChange]
    );

    return (
      <Box flex={1} gap="m">
        {/* Header */}
        <Box flexDirection="row" alignItems="center" gap="s" marginBottom="s">
          <Ionicons name="sync" size={24} color={theme.colors.mainForeground} />
          <Text variant="body" style={{ fontSize: 18, fontWeight: '600' }}>
            Subtitle Sync
          </Text>
        </Box>

        {isSyncEnabled ? (
          <>
            {/* Delay Slider */}
            <SliderInput
              value={delay}
              onValueChange={handleDelayChange}
              minimumValue={SUBTITLE_DELAY_MIN}
              maximumValue={SUBTITLE_DELAY_MAX}
              step={SUBTITLE_DELAY_STEP}
              showButtons={!isPlatformTV}
              label="Delay"
              unit="s"
              formatValue={formatDelay}
            />

            {/* Cue Preview */}
            {cues.length > 0 && (
              <Box flex={1} minHeight={150}>
                <SubtitleCuePreview cues={cues} adjustedTime={adjustedTime} />
              </Box>
            )}
          </>
        ) : (
          <Box flex={1} justifyContent="center" alignItems="center" padding="l">
            <Text variant="bodySmall" color="textSecondary" textAlign="center">
              Select an addon subtitle to enable syncing
            </Text>
          </Box>
        )}
      </Box>
    );
  }
);

SubtitleSyncPanel.displayName = 'SubtitleSyncPanel';

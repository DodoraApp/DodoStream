import { FC, memo } from 'react';
import { Box, Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { Button } from '@/components/basic/Button';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { IntroData } from '@/types/introdb';

interface SkipIntroButtonProps {
  /** Intro data from IntroDB */
  introData: IntroData;
  /** Current playback time in seconds */
  currentTime: number;
  /** Called when the skip button is pressed */
  onSkipIntro: () => void;
}

/**
 * Skip Intro button for the video player.
 *
 * Shows when currentTime is within the intro's start/end range.
 * Positioned absolute bottom-right within its parent container.
 */
export const SkipIntroButton: FC<SkipIntroButtonProps> = memo(
  ({ introData, currentTime, onSkipIntro }) => {
    const theme = useTheme<Theme>();

    // Convert times to seconds for comparison
    const introStartSec = introData.start_ms / 1000;
    const introEndSec = introData.end_ms / 1000;

    // Check if we're within the intro time range
    const isWithinIntro = currentTime >= introStartSec && currentTime < introEndSec;

    if (!isWithinIntro) {
      return null;
    }

    return (
      <Box
        position="absolute"
        bottom={theme.spacing.m}
        right={theme.spacing.m}
        pointerEvents="box-none">
        <Button
          title="Skip Intro"
          icon="skip-forward"
          iconComponent={MaterialCommunityIcons}
          variant="secondary"
          onPress={onSkipIntro}
          hasTVPreferredFocus
        />
      </Box>
    );
  }
);

SkipIntroButton.displayName = 'SkipIntroButton';

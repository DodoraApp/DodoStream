import { FC, memo } from 'react';
import { useTranslation } from 'react-i18next';

import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons/static';
import { useTheme } from '@shopify/restyle';

import { Button } from '@/components/basic/Button';
import { Box, Theme } from '@/theme/theme';
import type { SkipTarget } from '@/types/player';

interface SkipChapterButtonProps {
  target: SkipTarget;
  /** Current playback time in seconds */
  currentTime: number;
  /** Called when the skip button is pressed */
  onSkip: () => void;
  /** Whether this button should claim preferred TV focus. */
  hasTVPreferredFocus?: boolean;
}
/**
 * Generic skip button for skippable chapter types.
 *
 * The button is shown only while playback is within the target chapter range.
 */
export const SkipChapterButton: FC<SkipChapterButtonProps> = memo(
  ({ target, currentTime, onSkip, hasTVPreferredFocus = true }) => {
    const { t } = useTranslation('player');
    const theme = useTheme<Theme>();

    const isWithinTarget = currentTime >= target.startTime && currentTime < target.endTime;

    if (!isWithinTarget) {
      return null;
    }

    return (
      <Box
        position="absolute"
        bottom={theme.spacing.m}
        right={theme.spacing.m}
        pointerEvents="box-none">
        <Button
          title={t(target.type === 'CREDITS' ? 'skip_credits' : 'skip_intro')}
          icon="skip-forward"
          iconComponent={MaterialCommunityIcons}
          variant="secondary"
          onPress={onSkip}
          hasTVPreferredFocus={hasTVPreferredFocus}
        />
      </Box>
    );
  }
);

SkipChapterButton.displayName = 'SkipChapterButton';

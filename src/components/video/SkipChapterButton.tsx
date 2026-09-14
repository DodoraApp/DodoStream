import { FC, memo } from 'react';
import { useTranslation } from 'react-i18next';

import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons/static';

import { Button } from '@/components/basic/Button';
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

/** Generic skip button for skippable chapter types (intro/credits). */
export const SkipChapterButton: FC<SkipChapterButtonProps> = memo(
  ({ target, currentTime, onSkip, hasTVPreferredFocus = true }) => {
    const { t } = useTranslation('player');

    const isWithinTarget = currentTime >= target.startTime && currentTime < target.endTime;

    if (!isWithinTarget) {
      return null;
    }

    return (
      <Button
        title={t(target.type === 'CREDITS' ? 'skip_credits' : 'skip_intro')}
        icon="skip-forward"
        iconComponent={MaterialCommunityIcons}
        variant="secondary"
        onPress={onSkip}
        hasTVPreferredFocus={hasTVPreferredFocus}
      />
    );
  }
);

SkipChapterButton.displayName = 'SkipChapterButton';

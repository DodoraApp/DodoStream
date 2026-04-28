import { FC, memo } from 'react';

import { Box } from '@/theme/theme';

interface ProgressBarProps {
  /** Progress value between 0 and 1 */
  progress: number;
  /** Height of the progress bar in pixels (default: 6) */
  height?: number;
  testID?: string;
}

/**
 * A reusable progress bar component.
 *
 * @example
 * <ProgressBar progress={0.5} />
 *
 * @example
 * <ProgressBar progress={watchProgress} height={4} />
 */
export const ProgressBar: FC<ProgressBarProps> = memo(({ progress, height = 6, testID }) => {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <Box testID={testID} height={height} backgroundColor="cardBorder" overflow="hidden">
      <Box
        height={height}
        backgroundColor="primaryBackground"
        style={{ width: `${Math.round(clampedProgress * 100)}%` }}
      />
    </Box>
  );
});

ProgressBar.displayName = 'ProgressBar';

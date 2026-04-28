import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@shopify/restyle';
import { MotiView } from 'moti';

import { ANIMATION_SKELETON_PULSE_DURATION_MS } from '@/constants/ui';
import type { Theme } from '@/theme/theme';

export interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: keyof Theme['borderRadii'];
  style?: StyleProp<ViewStyle>;
}

export const Skeleton = memo(({ width, height, borderRadius = 'm', style }: SkeletonProps) => {
  const theme = useTheme<Theme>();

  return (
    <MotiView
      from={{ opacity: 0.35 }}
      animate={{ opacity: 0.9 }}
      transition={{
        type: 'timing',
        duration: ANIMATION_SKELETON_PULSE_DURATION_MS,
        loop: true,
        repeatReverse: true,
      }}
      style={[
        {
          width,
          height,
          borderRadius: theme.borderRadii[borderRadius],
          backgroundColor: theme.colors.cardBackground,
        },
        style,
      ]}
    />
  );
});
Skeleton.displayName = 'Skeleton';

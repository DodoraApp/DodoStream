import { FC, memo, PropsWithChildren } from 'react';
import { ViewStyle } from 'react-native';

import { MotiView } from 'moti';

import { ANIMATION_FADE_IN_MS } from '@/constants/ui';

interface FadeInProps {
  delay?: number;
  duration?: number;
  fromTranslateY?: number;
  style?: ViewStyle;
}

const FadeIn: FC<PropsWithChildren<FadeInProps>> = memo(
  ({ children, delay = 0, duration, fromTranslateY = 8, style }) => {
    const effectiveDuration = duration ?? ANIMATION_FADE_IN_MS ?? 300;

    return (
      <MotiView
        from={{ opacity: 0, translateY: fromTranslateY }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: effectiveDuration, delay }}
        style={style}>
        {children}
      </MotiView>
    );
  }
);

FadeIn.displayName = 'FadeIn';
export default FadeIn;

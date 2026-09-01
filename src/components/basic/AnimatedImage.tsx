import { memo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Image, ImageProps } from 'expo-image';
import { MotiView } from 'moti';

import { ANIMATION_FADE_IN_MS } from '@/constants/ui';

type ContentFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';

export interface AnimatedImageProps extends Omit<ImageProps, 'contentFit'> {
  durationMs?: number;
  /** expo-image contentFit; defaults to cover to preserve the previous default */
  contentFit?: ContentFit;
}

export const AnimatedImage = memo(
  ({
    durationMs = ANIMATION_FADE_IN_MS,
    onLoadEnd,
    style,
    contentFit = 'cover',
    ...props
  }: AnimatedImageProps) => {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 1 : 0 }}
        transition={{ type: 'timing', duration: durationMs }}
        style={style ?? styles.fill}>
        <Image
          {...props}
          contentFit={contentFit}
          style={StyleSheet.compose(styles.fill, style)}
          onLoadEnd={() => {
            setIsLoaded(true);
            onLoadEnd?.();
          }}
        />
      </MotiView>
    );
  }
);

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
  },
});

AnimatedImage.displayName = 'AnimatedImage';

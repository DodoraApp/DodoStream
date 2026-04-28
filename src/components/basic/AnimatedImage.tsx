import { memo, useState } from 'react';
import { StyleSheet } from 'react-native';

import type { FastImageProps, ResizeMode } from '@d11/react-native-fast-image';
import FastImage from '@d11/react-native-fast-image';
import { MotiView } from 'moti';

import { ANIMATION_FADE_IN_MS } from '@/constants/ui';

type ContentFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';

const contentFitToResizeMode = (contentFit: ContentFit): ResizeMode => {
  switch (contentFit) {
    case 'contain':
    case 'scale-down':
      return 'contain';
    case 'cover':
      return 'cover';
    case 'fill':
      return 'stretch';
    case 'none':
      return 'center';
  }
};

export interface AnimatedImageProps extends Omit<FastImageProps, 'resizeMode'> {
  durationMs?: number;
  /** expo-image compatible prop; mapped to FastImage's resizeMode internally */
  contentFit?: ContentFit;
}

export const AnimatedImage = memo(
  ({
    durationMs = ANIMATION_FADE_IN_MS,
    onLoadEnd,
    style,
    contentFit,
    ...props
  }: AnimatedImageProps) => {
    const [isLoaded, setIsLoaded] = useState(false);

    const resizeMode = contentFit ? contentFitToResizeMode(contentFit) : undefined;

    return (
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 1 : 0 }}
        transition={{ type: 'timing', duration: durationMs }}
        style={style ?? styles.fill}>
        <FastImage
          {...props}
          resizeMode={resizeMode}
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

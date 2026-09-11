import { memo } from 'react';

import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme } from '@shopify/restyle';
import { MotiView } from 'moti';

import { PLAYING_INDICATOR_INITIAL_SCALE, TV_FOCUS_ANIMATION_MS } from '@/constants/ui';
import { Box, Theme } from '@/theme/theme';

export interface PlayingIndicatorProps {
  placement?: 'absolute-top-left' | 'absolute-top-right' | 'inline';
}

/** A compact animated play marker for the currently playing list item. */
export const PlayingIndicator = memo<PlayingIndicatorProps>(
  ({ placement = 'absolute-top-left' }) => {
    const theme = useTheme<Theme>();
    const isInline = placement === 'inline';
    const isRightAligned = placement === 'absolute-top-right';

    return (
      <MotiView
        from={{
          opacity: 0,
          translateY: theme.spacing.xs,
          scale: PLAYING_INDICATOR_INITIAL_SCALE,
        }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{ type: 'timing', duration: TV_FOCUS_ANIMATION_MS }}
        style={
          isInline
            ? undefined
            : {
                position: 'absolute',
                top: theme.spacing.s,
                [isRightAligned ? 'right' : 'left']: theme.spacing.s,
                zIndex: 1,
              }
        }>
        <Box
          backgroundColor="primaryBackground"
          borderRadius="full"
          padding="xs"
          alignItems="center"
          justifyContent="center">
          <Ionicons
            name="play"
            size={theme.sizes.iconSmall}
            color={theme.colors.primaryForeground}
          />
        </Box>
      </MotiView>
    );
  }
);

PlayingIndicator.displayName = 'PlayingIndicator';

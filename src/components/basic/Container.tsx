import { FC, PropsWithChildren } from 'react';
import { useWindowDimensions } from 'react-native';
import { type Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@shopify/restyle';

import { Box, type Theme } from '@/theme/theme';

interface ContainerProps {
  disablePadding?: boolean;
  safeAreaEdges?: Edge[];
  /** Keep vertical safe-area insets when the landscape screen has no header. */
  preserveVerticalInsetsInLandscape?: boolean;
  /** Avoid duplicating the screen-edge inset after a sidebar. */
  ignoreLeftInsetInLandscape?: boolean;
}
export const Container: FC<PropsWithChildren<ContainerProps>> = ({
  children,
  disablePadding,
  safeAreaEdges,
  preserveVerticalInsetsInLandscape = false,
  ignoreLeftInsetInLandscape = false,
}) => {
  const theme = useTheme<Theme>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height;

  // SafeAreaView does not consistently re-apply horizontal edges after
  // Android rotates. Apply the same insets used by modal surfaces directly.
  const landscapeInsetStyle = isLandscape
    ? {
        paddingLeft: ignoreLeftInsetInLandscape
          ? disablePadding
            ? 0
            : theme.spacing.m
          : (disablePadding ? 0 : theme.spacing.m) + insets.left,
        paddingRight: (disablePadding ? 0 : theme.spacing.m) + insets.right,
        paddingTop: preserveVerticalInsetsInLandscape ? insets.top : undefined,
        paddingBottom: preserveVerticalInsetsInLandscape ? insets.bottom : undefined,
      }
    : undefined;
  return (
    <SafeAreaView
      edges={isLandscape ? [] : safeAreaEdges}
      style={{ flex: 1, backgroundColor: theme.colors.mainBackground }}>
      <Box
        flex={1}
        backgroundColor="mainBackground"
        paddingHorizontal={disablePadding ? undefined : 'm'}
        style={landscapeInsetStyle}>
        {children}
      </Box>
    </SafeAreaView>
  );
};

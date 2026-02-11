import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@shopify/restyle';
import { Box, type Theme } from '@/theme/theme';
import { FC, PropsWithChildren } from 'react';

interface ContainerProps {
  disablePadding?: boolean;
  safeAreaEdges?: Edge[];
}

export const Container: FC<PropsWithChildren<ContainerProps>> = ({
  children,
  disablePadding,
  safeAreaEdges,
}) => {
  const theme = useTheme<Theme>();

  return (
    <SafeAreaView
      edges={safeAreaEdges}
      style={{ flex: 1, backgroundColor: theme.colors.mainBackground }}>
      <Box
        flex={1}
        backgroundColor="mainBackground"
        paddingHorizontal={disablePadding ? undefined : 'm'}>
        {children}
      </Box>
    </SafeAreaView>
  );
};

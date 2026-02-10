import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import theme, { Box } from '@/theme/theme';
import { FC, PropsWithChildren, useMemo } from 'react';

interface ContainerProps {
  disablePadding?: boolean;
  safeAreaEdges?: Edge[];
}

export const Container: FC<PropsWithChildren<ContainerProps>> = ({
  children,
  disablePadding,
  safeAreaEdges,
}) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // In landscape, always include left and right safe area edges
  // to account for notches, punch-holes, and rounded corners
  const edges = useMemo<Edge[] | undefined>(() => {
    if (!safeAreaEdges) {
      if (isLandscape) return ['left', 'right'];
      return undefined;
    }
    if (!isLandscape) return safeAreaEdges;

    const edgeSet = new Set(safeAreaEdges);
    edgeSet.add('left');
    edgeSet.add('right');
    return Array.from(edgeSet) as Edge[];
  }, [safeAreaEdges, isLandscape]);

  return (
    <SafeAreaView
      edges={edges}
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

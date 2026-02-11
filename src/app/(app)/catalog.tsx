import { memo, useCallback, useMemo } from 'react';
import { ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '@shopify/restyle';
import { Container } from '@/components/basic/Container';
import { Box, Text, type Theme } from '@/theme/theme';
import { MediaCard } from '@/components/media/MediaCard';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { useInfiniteCatalog } from '@/api/stremio';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import type { MetaPreview } from '@/types/stremio';
import { TV_DRAW_DISTANCE, MOBILE_DRAW_DISTANCE } from '@/constants/ui';
import { calculateMediaGridColumns } from '@/utils/layout';

// ============================================================================
// Types
// ============================================================================

// ============================================================================
// Grid Item Component
// ============================================================================

interface CatalogGridItemProps {
  media: MetaPreview;
  onPress: (media: MetaPreview) => void;
  hasTVPreferredFocus?: boolean;
}

const CatalogGridItem = memo(
  ({ media, onPress, hasTVPreferredFocus = false }: CatalogGridItemProps) => {
    return (
      <Box flex={1} alignItems="center" paddingBottom="m">
        <MediaCard media={media} onPress={onPress} hasTVPreferredFocus={hasTVPreferredFocus} />
      </Box>
    );
  }
);

CatalogGridItem.displayName = 'CatalogGridItem';

// ============================================================================
// Footer Component
// ============================================================================

interface ListFooterProps {
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
}

const ListFooter = memo(({ isFetchingNextPage, hasNextPage }: ListFooterProps) => {
  const theme = useTheme<Theme>();

  if (!isFetchingNextPage && !hasNextPage) {
    return null;
  }

  return (
    <Box padding="l" alignItems="center" justifyContent="center">
      {isFetchingNextPage && (
        <ActivityIndicator size="small" color={theme.colors.primaryBackground} />
      )}
    </Box>
  );
});

ListFooter.displayName = 'ListFooter';

// ============================================================================
// Main Component
// ============================================================================

export default function CatalogPage() {
  const theme = useTheme<Theme>();
  const { width } = useWindowDimensions();
  const { navigateToDetails } = useMediaNavigation();

  // Get route params
  const { manifestUrl, catalogType, catalogId, catalogName } = useLocalSearchParams<{
    manifestUrl?: string;
    catalogType?: string;
    catalogId?: string;
    catalogName?: string;
  }>();

  // Fetch catalog with infinite scroll
  const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteCatalog(
      manifestUrl ?? '',
      catalogType ?? '',
      catalogId ?? '',
      !!manifestUrl && !!catalogType && !!catalogId
    );

  // Calculate number of columns based on available width and card size
  const numColumns = useMemo(() => calculateMediaGridColumns(width, theme), [width, theme]);

  // Flatten all pages into a single array
  const allMetas = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.metas);
  }, [data?.pages]);

  // Handle media press
  const handleMediaPress = useCallback(
    (media: MetaPreview) => {
      navigateToDetails(media.id, media.type);
    },
    [navigateToDetails]
  );

  // Handle end reached for infinite scroll
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Key extractor
  const keyExtractor = useCallback((item: MetaPreview, index: number) => `${item.id}_${index}`, []);

  // Render item
  const renderItem = useCallback(
    ({ item, index }: { item: MetaPreview; index: number }) => (
      <CatalogGridItem
        media={item}
        onPress={handleMediaPress}
        hasTVPreferredFocus={Platform.isTV && index === 0}
      />
    ),
    [handleMediaPress]
  );

  // Render footer
  const renderFooter = useCallback(
    () => <ListFooter isFetchingNextPage={isFetchingNextPage} hasNextPage={hasNextPage ?? false} />,
    [isFetchingNextPage, hasNextPage]
  );

  // Display title
  const displayTitle = catalogName || catalogId || 'Catalog';

  // Loading state
  if (isLoading) {
    return (
      <Container safeAreaEdges={['left', 'right', 'top']}>
        <Stack.Screen options={{ title: displayTitle }} />
        <Box flex={1} justifyContent="center" alignItems="center">
          <LoadingIndicator />
        </Box>
      </Container>
    );
  }

  // Error state
  if (isError) {
    return (
      <Container safeAreaEdges={['left', 'right', 'top']}>
        <Stack.Screen options={{ title: displayTitle }} />
        <Box flex={1} justifyContent="center" alignItems="center" padding="m">
          <Text variant="body" color="textSecondary" textAlign="center">
            Failed to load catalog. Please try again.
          </Text>
        </Box>
      </Container>
    );
  }

  // Empty state
  if (allMetas.length === 0) {
    return (
      <Container safeAreaEdges={['left', 'right', 'top']}>
        <Stack.Screen options={{ title: displayTitle }} />
        <Box flex={1} justifyContent="center" alignItems="center" padding="m">
          <Text variant="body" color="textSecondary" textAlign="center">
            No items found in this catalog.
          </Text>
        </Box>
      </Container>
    );
  }

  return (
    <Container disablePadding safeAreaEdges={['left', 'right', 'top']}>
      <Stack.Screen options={{ title: displayTitle }} />
      <Box flex={1} paddingHorizontal="m">
        <FlashList
          data={allMetas}
          numColumns={numColumns}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          drawDistance={Platform.isTV ? TV_DRAW_DISTANCE : MOBILE_DRAW_DISTANCE}
          contentContainerStyle={{
            paddingTop: theme.spacing.m,
            paddingBottom: theme.spacing.xl,
          }}
        />
      </Box>
    </Container>
  );
}

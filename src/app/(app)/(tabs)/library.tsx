import { Container } from '@/components/basic/Container';
import { PageHeader } from '@/components/basic/PageHeader';
import { TagFilters } from '@/components/basic/TagFilters';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@shopify/restyle';
import { Box, Text, Theme } from '@/theme/theme';
import { LegendList } from '@legendapp/list/react-native';
import { memo, useCallback, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { ContentType } from '@/types/stremio';
import { useMyList } from '@/hooks/useMyListDb';
import { useWatchedMetaSummaries } from '@/hooks/useWatchHistoryDb';
import type { DbMyListItem, DbWatchedMetaSummary } from '@/db';
import { MediaCard } from '@/components/media/MediaCard';
import { HistoryCard } from '@/components/media/HistoryCard';
import { CardListSkeleton } from '@/components/basic/CardListSkeleton';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { useMeta } from '@/api/stremio/hooks';
import { calculateMediaGridColumns } from '@/utils/layout';
import { TV_DRAW_DISTANCE, MOBILE_DRAW_DISTANCE } from '@/constants/ui';
import { NO_POSTER_PORTRAIT } from '@/constants/images';

// ============================================================================
// Types
// ============================================================================

type LibraryTab = 'my-list' | 'history';

// ============================================================================
// My List Card Component
// ============================================================================

interface MyListEntryCardProps {
  entry: DbMyListItem;
  onPress: (id: string, type: ContentType) => void;
  hasTVPreferredFocus?: boolean;
}

const MyListEntryCard = memo(
  ({ entry, onPress, hasTVPreferredFocus = false }: MyListEntryCardProps) => {
    const { t } = useTranslation('media');
    const theme = useTheme<Theme>();
    const isMissingMeta = !entry.metaName;
    const { data: resolvedMeta } = useMeta(entry.type, entry.id, isMissingMeta);

    const displayName = entry.metaName ?? resolvedMeta?.name;
    const displayImage = entry.imageUrl ?? resolvedMeta?.poster;

    const handlePress = useCallback(() => {
      onPress(entry.id, entry.type);
    }, [onPress, entry.id, entry.type]);

    // Show placeholder if meta_cache hasn't been populated yet (first launch)
    if (!displayName) {
      return (
        <Box
          width={theme.cardSizes.media.width}
          height={theme.cardSizes.media.height}
          justifyContent="center"
          alignItems="center"
          backgroundColor="cardBackground"
          borderRadius="l">
          <Text variant="caption" color="textSecondary">
            {t('unavailable')}
          </Text>
        </Box>
      );
    }

    return (
      <MediaCard
        media={{
          id: entry.id,
          type: entry.type,
          name: displayName ?? '',
          poster: displayImage ?? NO_POSTER_PORTRAIT,
          background: displayImage,
        }}
        onPress={handlePress}
        hasTVPreferredFocus={hasTVPreferredFocus}
      />
    );
  }
);

MyListEntryCard.displayName = 'MyListEntryCard';

// ============================================================================
// My List Tab Component
// ============================================================================

interface MyListTabProps {
  numColumns: number;
}

const MyListTab = memo(({ numColumns }: MyListTabProps) => {
  const { t } = useTranslation('media');
  const theme = useTheme<Theme>();
  const { navigateToDetails } = useMediaNavigation();
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useMyList();

  const flatData = useMemo(() => data?.pages.flat() ?? [], [data]);

  const handlePress = useCallback(
    (id: string, type: ContentType) => {
      navigateToDetails(id, type);
    },
    [navigateToDetails]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: DbMyListItem; index: number }) => (
      <Box flex={1} alignItems="center" paddingBottom="m">
        <MyListEntryCard
          entry={item}
          onPress={handlePress}
          hasTVPreferredFocus={Platform.isTV && index === 0}
        />
      </Box>
    ),
    [handlePress]
  );

  const keyExtractor = useCallback((item: DbMyListItem) => `${item.type}:${item.id}`, []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <Box paddingVertical="l" alignItems="center">
        <LoadingIndicator size="small" />
      </Box>
    );
  }, [isFetchingNextPage]);

  if (isLoading) {
    return (
      <CardListSkeleton
        horizontal={false}
        count={numColumns * 3}
        cardWidth={theme.cardSizes.media.width}
        cardHeight={theme.cardSizes.media.height}
        numColumns={numColumns}
        withLabel
      />
    );
  }

  if (flatData.length === 0) {
    return (
      <Text variant="body" color="textSecondary">
        {t('my_list_empty')}
      </Text>
    );
  }

  return (
    <LegendList
      data={flatData}
      numColumns={numColumns}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      drawDistance={Platform.isTV ? TV_DRAW_DISTANCE : MOBILE_DRAW_DISTANCE}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}
      ListFooterComponent={renderFooter}
      contentContainerStyle={{
        paddingTop: theme.spacing.s,
        paddingBottom: theme.spacing.xl,
      }}
    />
  );
});

MyListTab.displayName = 'MyListTab';

// ============================================================================
// History Tab Component
// ============================================================================

interface HistoryTabProps {
  numColumns: number;
}

const HistoryTab = memo(({ numColumns }: HistoryTabProps) => {
  const { t } = useTranslation('media');
  const theme = useTheme<Theme>();
  const { navigateToDetails } = useMediaNavigation();

  // Only load history data when this component is mounted (lazy loading).
  // Uses infinite query to paginate (100 items/page) and avoid loading thousands of items
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useWatchedMetaSummaries();

  const flatData = useMemo(() => data?.pages.flat() ?? [], [data]);

  const handlePress = useCallback(
    (metaId: string, type: ContentType) => {
      navigateToDetails(metaId, type);
    },
    [navigateToDetails]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: DbWatchedMetaSummary; index: number }) => (
      <Box flex={1} alignItems="center" paddingBottom="m">
        <HistoryCard
          entry={item}
          onPress={handlePress}
          hasTVPreferredFocus={Platform.isTV && index === 0}
        />
      </Box>
    ),
    [handlePress]
  );

  const keyExtractor = useCallback((item: DbWatchedMetaSummary) => item.id, []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <Box paddingVertical="l" alignItems="center">
        <LoadingIndicator size="small" />
      </Box>
    );
  }, [isFetchingNextPage]);

  if (isLoading) {
    return (
      <CardListSkeleton
        horizontal={false}
        count={numColumns * 3}
        cardWidth={theme.cardSizes.media.width}
        cardHeight={theme.cardSizes.media.height}
        numColumns={numColumns}
        withLabel
      />
    );
  }

  if (flatData.length === 0) {
    return (
      <Text variant="body" color="textSecondary">
        {t('history_empty')}
      </Text>
    );
  }

  return (
    <LegendList
      data={flatData}
      numColumns={numColumns}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      drawDistance={Platform.isTV ? TV_DRAW_DISTANCE : MOBILE_DRAW_DISTANCE}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}
      ListFooterComponent={renderFooter}
      contentContainerStyle={{
        paddingTop: theme.spacing.s,
        paddingBottom: theme.spacing.xl,
      }}
    />
  );
});

HistoryTab.displayName = 'HistoryTab';

// ============================================================================
// Main Component
// ============================================================================
export default function Library() {
  const { t } = useTranslation('media');
  const theme = useTheme<Theme>();
  const { width } = useWindowDimensions();

  // Support deep linking to a specific tab via ?tab=history (initial state only)
  const { tab: paramsTab } = useLocalSearchParams<{ tab?: string }>();
  const [selectedTab, setSelectedTab] = useState<LibraryTab>(
    paramsTab === 'history' ? 'history' : 'my-list'
  );

  const LIBRARY_TABS = useMemo(
    () => [
      { id: 'my-list' as const, label: t('my_list') },
      { id: 'history' as const, label: t('history') },
    ],
    [t]
  );

  // Calculate grid columns
  const numColumns = useMemo(() => calculateMediaGridColumns(width, theme), [width, theme]);

  const handleTabChange = useCallback((id: string | null) => {
    if (id === 'my-list' || id === 'history') {
      setSelectedTab(id);
    }
  }, []);

  return (
    <Container>
      <Box paddingHorizontal="s" paddingTop="m" gap="m">
        <PageHeader title={t('library_title')} />
        <TagFilters
          options={LIBRARY_TABS}
          selectedId={selectedTab}
          onSelectId={handleTabChange}
          includeAllOption={false}
          size="large"
        />
      </Box>

      <Box flex={1} paddingHorizontal="s" paddingTop="m">
        {/* Lazy load tabs - only render the selected one */}
        {selectedTab === 'my-list' ? (
          <MyListTab numColumns={numColumns} />
        ) : (
          <HistoryTab numColumns={numColumns} />
        )}
      </Box>
    </Container>
  );
}

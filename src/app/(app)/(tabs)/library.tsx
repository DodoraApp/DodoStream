import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, useWindowDimensions } from 'react-native';

import { LegendList } from '@legendapp/list/react-native';
import { useTheme } from '@shopify/restyle';
import { useLocalSearchParams } from 'expo-router';

import { useMeta } from '@/api/stremio/hooks';
import { CardListSkeleton } from '@/components/basic/CardListSkeleton';
import { Container } from '@/components/basic/Container';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { PageHeader } from '@/components/basic/PageHeader';
import { PickerModal } from '@/components/basic/PickerModal';
import { TagFilters } from '@/components/basic/TagFilters';
import { HistoryCard } from '@/components/media/HistoryCard';
import { MediaCard } from '@/components/media/MediaCard';
import { NO_POSTER_PORTRAIT } from '@/constants/images';
import { MOBILE_DRAW_DISTANCE, TV_DRAW_DISTANCE } from '@/constants/ui';
import type { DbMyListItem, DbWatchedMetaSummary } from '@/db';
import { useMediaDetailsActions } from '@/hooks/useMediaDetailsActions';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { useMyList } from '@/hooks/useMyListDb';
import { useWatchedMetaSummaries } from '@/hooks/useWatchHistoryDb';
import { Box, Text, Theme } from '@/theme/theme';
import type { ContentType } from '@/types/stremio';
import { calculateMediaGridColumns } from '@/utils/layout';
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

  // Long-press context menu for history cards
  const [activeEntry, setActiveEntry] = useState<DbWatchedMetaSummary | null>(null);
  const mediaActions = useMediaDetailsActions({
    metaId: activeEntry?.id ?? '',
    type: activeEntry?.type ?? 'movie',
    metaName: activeEntry?.metaName ?? '',
    targetVideoId: activeEntry?.latestItem?.videoId,
    targetDurationSeconds: activeEntry?.latestItem?.durationSeconds,
  });
  const { openActions: openMediaActions } = mediaActions;

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

  const handleLongPress = useCallback(
    (entry: DbWatchedMetaSummary) => {
      setActiveEntry(entry);
      openMediaActions();
    },
    [openMediaActions]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: DbWatchedMetaSummary; index: number }) => (
      <Box flex={1} alignItems="center" paddingBottom="m">
        <HistoryCard
          entry={item}
          onPress={handlePress}
          onLongPress={handleLongPress}
          hasTVPreferredFocus={Platform.isTV && index === 0}
        />
      </Box>
    ),
    [handlePress, handleLongPress]
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
    <>
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
      <PickerModal
        visible={mediaActions.isVisible}
        onClose={mediaActions.closeActions}
        label={activeEntry?.metaName ?? ''}
        items={mediaActions.items}
        onValueChange={mediaActions.handleAction}
      />
    </>
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
      <Box paddingHorizontal="s" gap="m">
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

import { Container } from '@/components/basic/Container';
import { PageHeader } from '@/components/basic/PageHeader';
import { TagFilters } from '@/components/basic/TagFilters';
import { useTheme } from '@shopify/restyle';
import { Box, Text, Theme } from '@/theme/theme';
import { FlashList } from '@shopify/flash-list';
import { memo, useCallback, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMyListStore, type MyListItem } from '@/store/my-list.store';
import { useWatchHistoryStore, type WatchedMetaSummary } from '@/store/watch-history.store';
import { MediaCard } from '@/components/media/MediaCard';
import { HistoryCard } from '@/components/media/HistoryCard';
import type { MetaPreview } from '@/types/stremio';
import { useMeta } from '@/api/stremio';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { calculateMediaGridColumns } from '@/utils/layout';
import { TV_DRAW_DISTANCE, MOBILE_DRAW_DISTANCE } from '@/constants/ui';

// ============================================================================
// Types
// ============================================================================

type LibraryTab = 'my-list' | 'history';

const LIBRARY_TABS = [
  { id: 'my-list' as const, label: 'My List' },
  { id: 'history' as const, label: 'History' },
];

// ============================================================================
// My List Card Component
// ============================================================================

interface MyListEntryCardProps {
  entry: MyListItem;
  onPress: (media: MetaPreview) => void;
  hasTVPreferredFocus?: boolean;
}

const MyListEntryCard = memo(
  ({ entry, onPress, hasTVPreferredFocus = false }: MyListEntryCardProps) => {
    const theme = useTheme<Theme>();
    const { data: meta, isLoading } = useMeta(entry.type, entry.id);

    if (isLoading) {
      return (
        <Box
          width={theme.cardSizes.media.width}
          height={theme.cardSizes.media.height}
          justifyContent="center"
          alignItems="center"
          backgroundColor="cardBackground"
          borderRadius="l">
          <LoadingIndicator type="simple" size="small" />
        </Box>
      );
    }

    if (!meta) {
      return (
        <Box
          width={theme.cardSizes.media.width}
          height={theme.cardSizes.media.height}
          justifyContent="center"
          alignItems="center"
          backgroundColor="cardBackground"
          borderRadius="l">
          <Text variant="caption" color="textSecondary">
            Unavailable
          </Text>
        </Box>
      );
    }

    return (
      <MediaCard
        media={{
          id: meta.id,
          type: meta.type ?? entry.type,
          name: meta.name,
          poster: meta.poster,
          background: meta.background,
        }}
        onPress={onPress}
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
  const theme = useTheme<Theme>();
  const { navigateToDetails } = useMediaNavigation();
  const data = useMyListStore((state) => state.getActiveList());

  const handlePress = useCallback(
    (media: MetaPreview) => {
      navigateToDetails(media.id, media.type);
    },
    [navigateToDetails]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: MyListItem; index: number }) => (
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

  const keyExtractor = useCallback((item: MyListItem) => `${item.type}:${item.id}`, []);

  if (data.length === 0) {
    return (
      <Text variant="body" color="textSecondary">
        Your saved content will appear here
      </Text>
    );
  }

  return (
    <FlashList
      data={data}
      numColumns={numColumns}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      drawDistance={Platform.isTV ? TV_DRAW_DISTANCE : MOBILE_DRAW_DISTANCE}
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
  const theme = useTheme<Theme>();
  const { navigateToDetails } = useMediaNavigation();

  // Only load history data when this component is mounted (lazy loading)
  const data = useWatchHistoryStore((state) => state.getAllWatchedMetas());

  const handlePress = useCallback(
    (metaId: string, type: string) => {
      navigateToDetails(metaId, type as 'movie' | 'series');
    },
    [navigateToDetails]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: WatchedMetaSummary; index: number }) => (
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

  const keyExtractor = useCallback((item: WatchedMetaSummary) => item.id, []);

  if (data.length === 0) {
    return (
      <Text variant="body" color="textSecondary">
        Your watch history will appear here
      </Text>
    );
  }

  return (
    <FlashList
      data={data}
      numColumns={numColumns}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      drawDistance={Platform.isTV ? TV_DRAW_DISTANCE : MOBILE_DRAW_DISTANCE}
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
  const theme = useTheme<Theme>();
  const { width } = useWindowDimensions();

  // Support deep linking to a specific tab via ?tab=history (initial state only)
  const { tab: paramsTab } = useLocalSearchParams<{ tab?: string }>();
  const [selectedTab, setSelectedTab] = useState<LibraryTab>(
    paramsTab === 'history' ? 'history' : 'my-list'
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
        <PageHeader title="Library" />
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

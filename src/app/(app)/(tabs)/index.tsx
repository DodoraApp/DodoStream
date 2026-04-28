import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, TVFocusGuideView, useWindowDimensions } from 'react-native';

import { LegendList } from '@legendapp/list/react-native';
import { useTheme } from '@shopify/restyle';
import type { Href } from 'expo-router';
import type { TFunction } from 'i18next';
import { MotiView } from 'moti';

import { Container } from '@/components/basic/Container';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { PickerModal } from '@/components/basic/PickerModal';
import { TagFilters, TagOption } from '@/components/basic/TagFilters';
import { CatalogSection } from '@/components/media/CatalogSection';
import { CatalogSectionHeader } from '@/components/media/CatalogSectionHeader';
import { ContinueWatchingItem } from '@/components/media/ContinueWatchingItem';
import { ContinueWatchingListSkeleton } from '@/components/media/ContinueWatchingListSkeleton';
import { HeroSection } from '@/components/media/HeroSection';
import { MediaList } from '@/components/media/MediaList';
import { NO_POSTER_PORTRAIT } from '@/constants/images';
import {
  ANIMATION_FADE_IN_MS,
  HOME_PRIORITY_BUFFER_ROWS,
  MOBILE_DRAW_DISTANCE,
  MOBILE_HORIZONTAL_DRAW_DISTANCE,
  TV_DRAW_DISTANCE,
  TV_HORIZONTAL_DRAW_DISTANCE,
} from '@/constants/ui';
import { ContinueWatchingEntry, useContinueWatching } from '@/hooks/useContinueWatching';
import { useContinueWatchingActions } from '@/hooks/useContinueWatchingActions';
import { type PriorityCatalogEntry, useHomePriorityLoading } from '@/hooks/useHomePriorityLoading';
import { HomeScrollProvider, useHomeScroll } from '@/hooks/useHomeScroll';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { useMyList } from '@/hooks/useMyListDb';
import { type SyncProviderBadge, useSyncProviderBadges } from '@/hooks/useSyncProviderBadges';
import { useAddonStore } from '@/store/addon.store';
import { useHomeStore } from '@/store/home.store';
import { useProfileStore } from '@/store/profile.store';
import { Box, Text, type Theme } from '@/theme/theme';
import { MetaPreview } from '@/types/stremio';
import {
  getContinueWatchingSectionHeight,
  getMediaSectionHeight,
  getSectionHeaderHeight,
  getVisibleCatalogCount,
} from '@/utils/layout';

// ============================================================================
// Types
// ============================================================================

interface CatalogSectionData {
  manifestUrl: string;
  catalogType: string;
  catalogId: string;
}

/** Section header item */
interface SectionHeaderItem {
  kind: 'section-header';
  sectionKey: string;
  title: string;
  type?: string;
  /** Explicit icon name - takes priority over type-derived icon */
  icon?: string;
  /** Generic link destination */
  linkTo?: Href;
  /** Catalog data for navigation - only present for addon catalog headers */
  catalogData?: {
    manifestUrl: string;
    catalogType: string;
    catalogId: string;
  };
  syncBadges?: SyncProviderBadge[];
}

/** Continue watching row item */
interface ContinueWatchingRowItem {
  kind: 'continue-watching-row';
  sectionKey: string;
  continueWatching: ContinueWatchingEntry[];
  isLoading: boolean;
}

/** Catalog row item */
interface CatalogRowItem {
  kind: 'catalog-row';
  sectionKey: string;
  /** Ordinal position among catalog rows; used to determine priority load order */
  catalogIndex: number;
  catalog: CatalogSectionData;
}

/** My list row item */
interface MyListRowItem {
  kind: 'my-list-row';
  sectionKey: string;
}

/** Union type for all home list items */
type HomeListItem = SectionHeaderItem | ContinueWatchingRowItem | MyListRowItem | CatalogRowItem;

// ============================================================================
// Main Component
// ============================================================================

export default function Home() {
  return (
    <HomeScrollProvider>
      <HomeContent />
    </HomeScrollProvider>
  );
}

const HomeContent = () => {
  const { t } = useTranslation('media');
  const { navigateToDetails } = useMediaNavigation();
  const addons = useAddonStore((state) => state.addons);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const orderedAddons = useAddonStore((state) =>
    state.getOrderedAddonsList(activeProfileId ?? undefined)
  );
  const configsByProfile = useAddonStore((state) => state.configsByProfile);
  const hasAddons = useAddonStore((state) => state.hasAddons());
  const { heroEnabled, heroCatalogSources, continueWatchingEnabled, myListEnabled } = useHomeStore(
    (state) => ({
      heroEnabled: state.getActiveSettings().heroEnabled,
      heroCatalogSources: state.getActiveSettings().heroCatalogSources,
      continueWatchingEnabled: state.getActiveSettings().continueWatchingEnabled,
      myListEnabled: state.getActiveSettings().myListEnabled,
    })
  );
  const continueWatching = useContinueWatching();
  const continueWatchingData = continueWatching.data;
  const continueWatchingLoading = continueWatching.isLoading;
  const continueWatchingActions = useContinueWatchingActions();
  const syncBadges = useSyncProviderBadges();
  const myList = useMyList();
  const { scrollToSection, listRef } = useHomeScroll();
  const theme = useTheme<Theme>();
  const { height: screenHeight } = useWindowDimensions();
  // Whether the continue watching section will be visible
  const hasContinueWatching =
    continueWatchingEnabled && (continueWatchingLoading || continueWatchingData.length > 0);

  // Whether the My List section will be visible
  const hasMyList =
    myListEnabled && (myList.isLoading || (myList.data?.pages.flat().length ?? 0) > 0);

  // Number of catalog rows that fit above the fold — these load before the list is shown
  const priorityCatalogCount = useMemo(
    () =>
      getVisibleCatalogCount(
        screenHeight,
        theme,
        heroEnabled,
        hasContinueWatching,
        hasMyList,
        HOME_PRIORITY_BUFFER_ROWS
      ),
    [screenHeight, theme, heroEnabled, hasContinueWatching, hasMyList]
  );

  // Resolve hero catalog source addonIds → { manifestUrl, type, id } for the priority hook
  const resolvedHeroSources = useMemo<PriorityCatalogEntry[]>(
    () =>
      heroEnabled
        ? heroCatalogSources
            .map((source) => {
              const addon = addons[source.addonId];
              if (!addon) return null;
              return {
                manifestUrl: addon.manifestUrl,
                type: source.catalogType,
                id: source.catalogId,
              };
            })
            .filter((s): s is PriorityCatalogEntry => s !== null)
        : [],
    [heroEnabled, heroCatalogSources, addons]
  );

  const listData = useMemo(() => {
    // Catalog sections from addons — track position so renderItem knows priority order
    let catalogIndex = 0;
    const addonSections: HomeListItem[] = orderedAddons
      .filter(
        (addon) =>
          configsByProfile[activeProfileId ?? '']?.[addon.id]?.isActive &&
          configsByProfile[activeProfileId ?? '']?.[addon.id]?.useCatalogsOnHome
      )
      .flatMap((addon) =>
        (addon.manifest.catalogs || []).flatMap((catalog) => {
          const sectionKey = `${addon.manifestUrl}-${catalog.type}-${catalog.id}`;
          const currentCatalogIndex = catalogIndex++;
          return [
            {
              kind: 'section-header' as const,
              sectionKey,
              title: catalog.name,
              type: catalog.type,
              catalogData: {
                manifestUrl: addon.manifestUrl,
                catalogType: catalog.type,
                catalogId: catalog.id,
              },
            },
            {
              kind: 'catalog-row' as const,
              sectionKey,
              catalogIndex: currentCatalogIndex,
              catalog: {
                manifestUrl: addon.manifestUrl,
                catalogType: catalog.type,
                catalogId: catalog.id,
              },
            },
          ];
        })
      );

    const continueWatchingSections: HomeListItem[] = [];

    // Continue watching section: show when enabled and (loading or has data)
    if (continueWatchingEnabled && (continueWatchingLoading || continueWatchingData.length > 0)) {
      const sectionKey = 'continue-watching';
      continueWatchingSections.push({
        kind: 'section-header',
        sectionKey,
        title: t('continue_watching'),
        icon: 'time-outline',
        linkTo: { pathname: '/library', params: { tab: 'history' } },
        syncBadges,
      });
      continueWatchingSections.push({
        kind: 'continue-watching-row',
        sectionKey,
        continueWatching: continueWatchingData,
        isLoading: continueWatchingLoading,
      });
    }

    const myListSections: HomeListItem[] = [];
    if (hasMyList) {
      const sectionKey = 'my-list';
      myListSections.push({
        kind: 'section-header',
        sectionKey,
        title: t('my_list'),
        icon: 'bookmark-outline',
        linkTo: { pathname: '/library', params: { tab: 'my-list' } },
      });
      myListSections.push({
        kind: 'my-list-row',
        sectionKey,
      });
    }

    return [...continueWatchingSections, ...myListSections, ...addonSections];
  }, [
    orderedAddons,
    continueWatchingLoading,
    continueWatchingData,
    configsByProfile,
    activeProfileId,
    syncBadges,
    continueWatchingEnabled,
    hasMyList,
    t,
  ]);

  // Priority catalogs are the first N catalog rows visible on screen
  const priorityCatalogs = useMemo<PriorityCatalogEntry[]>(
    () =>
      listData
        .filter((item): item is CatalogRowItem => item.kind === 'catalog-row')
        .slice(0, priorityCatalogCount)
        .map((item) => ({
          manifestUrl: item.catalog.manifestUrl,
          type: item.catalog.catalogType,
          id: item.catalog.catalogId,
        })),
    [listData, priorityCatalogCount]
  );

  const { isPriorityReady } = useHomePriorityLoading(priorityCatalogs, resolvedHeroSources);

  const keyExtractor = useCallback((item: HomeListItem, index: number): string => {
    return `${item.kind}-${item.sectionKey}-${index}`;
  }, []);

  const getItemType = useCallback((item: HomeListItem): string => item.kind, []);

  const getEstimatedItemSize = useCallback(
    (item: HomeListItem) => {
      switch (item.kind) {
        case 'section-header':
          return getSectionHeaderHeight(theme);
        case 'continue-watching-row':
          return getContinueWatchingSectionHeight(theme);
        case 'my-list-row':
          return getMediaSectionHeight(theme);
        case 'catalog-row':
          return getMediaSectionHeight(theme);
        default:
          return getMediaSectionHeight(theme);
      }
    },
    [theme]
  );

  const handleMediaPress = useCallback(
    (media: Pick<MetaPreview, 'id' | 'type'>) => {
      navigateToDetails(media.id, media.type);
    },
    [navigateToDetails]
  );

  const handleSectionFocused = useCallback(
    (sectionIndex: number) => {
      scrollToSection(sectionIndex);
    },
    [scrollToSection]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: HomeListItem; index: number }) => {
      switch (item.kind) {
        case 'section-header':
          return (
            <CatalogSectionHeader
              title={item.title}
              type={item.type}
              icon={item.icon as any}
              linkTo={item.linkTo}
              catalogData={item.catalogData}
              syncBadges={item.syncBadges}
              onFocused={() => handleSectionFocused(index + 1)}
            />
          );

        case 'continue-watching-row':
          return (
            <ContinueWatchingSectionRow
              continueWatching={item.continueWatching}
              isLoading={item.isLoading}
              sectionKey={item.sectionKey}
              onSectionFocused={() => handleSectionFocused(index)}
              onLongPressEntry={(entry) => continueWatchingActions.openActions(entry)}
            />
          );

        case 'my-list-row':
          return (
            <MyListSectionRow
              onMediaPress={handleMediaPress}
              onSectionFocused={() => handleSectionFocused(index)}
            />
          );

        case 'catalog-row':
          return (
            <CatalogSection
              manifestUrl={item.catalog.manifestUrl}
              catalogType={item.catalog.catalogType}
              catalogId={item.catalog.catalogId}
              onMediaPress={handleMediaPress}
              onSectionFocused={() => handleSectionFocused(index)}
              enabled={isPriorityReady || item.catalogIndex < priorityCatalogCount}
            />
          );

        default:
          return null;
      }
    },
    [
      continueWatchingActions,
      handleMediaPress,
      handleSectionFocused,
      isPriorityReady,
      priorityCatalogCount,
    ]
  );

  return (
    <Container disablePadding safeAreaEdges={['left', 'right', 'top']}>
      {hasAddons && !isPriorityReady ? (
        <Box flex={1} justifyContent="center" alignItems="center">
          <LoadingIndicator />
        </Box>
      ) : (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: ANIMATION_FADE_IN_MS }}
          style={{ flex: 1 }}>
          <LegendList<HomeListItem>
            ref={listRef}
            data={hasAddons ? listData : []}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemType={getItemType}
            getEstimatedItemSize={getEstimatedItemSize}
            style={{ flex: 1 }}
            ListHeaderComponent={
              heroEnabled ? <HeroSection hasTVPreferredFocus={Platform.isTV} /> : null
            }
            recycleItems={false}
            maintainVisibleContentPosition={false}
            drawDistance={Platform.isTV ? TV_DRAW_DISTANCE : MOBILE_DRAW_DISTANCE}
            ListEmptyComponent={
              !hasAddons ? (
                <Box
                  backgroundColor="cardBackground"
                  padding="l"
                  borderRadius="xl"
                  margin="m"
                  borderWidth={1}
                  borderColor="cardBorder">
                  <Text variant="subheader">{t('no_addons_title')}</Text>
                </Box>
              ) : (
                <Box
                  backgroundColor="cardBackground"
                  padding="l"
                  borderRadius="xl"
                  margin="m"
                  borderWidth={1}
                  borderColor="cardBorder">
                  <Text variant="subheader">{t('no_catalogs_title')}</Text>
                </Box>
              )
            }
            showsVerticalScrollIndicator={false}
          />
        </MotiView>
      )}

      <PickerModal
        visible={continueWatchingActions.isVisible}
        onClose={continueWatchingActions.closeActions}
        label={continueWatchingActions.label}
        items={continueWatchingActions.items}
        onValueChange={continueWatchingActions.handleAction}
      />
    </Container>
  );
};

// ============================================================================
// Continue Watching Row Component
// ============================================================================

interface ContinueWatchingSectionRowProps {
  sectionKey: string;
  continueWatching: ContinueWatchingEntry[];
  isLoading: boolean;
  onSectionFocused: (sectionKey: string) => void;
  onLongPressEntry: (entry: ContinueWatchingEntry) => void;
  hasTVPreferredFocus?: boolean;
}

const ContinueWatchingSectionRow = memo(
  ({
    sectionKey,
    continueWatching,
    isLoading,
    onSectionFocused,
    onLongPressEntry,
    hasTVPreferredFocus = false,
  }: ContinueWatchingSectionRowProps) => {
    const theme = useTheme<Theme>();
    const isTV = Platform.isTV;

    const handleItemFocused = useCallback(() => {
      onSectionFocused(sectionKey);
    }, [onSectionFocused, sectionKey]);

    const gap = theme.spacing.s + theme.spacing.xs;
    const itemSize = theme.cardSizes.continueWatching.width + gap;
    const listHeight = getContinueWatchingSectionHeight(theme);

    const getFixedItemSize = useCallback(() => itemSize, [itemSize]);

    const keyExtractor = useCallback((item: ContinueWatchingEntry) => item.key, []);

    const renderItem = useCallback(
      ({ item, index }: { item: ContinueWatchingEntry; index: number }) => (
        <ContinueWatchingItem
          entry={item}
          hasTVPreferredFocus={Boolean(hasTVPreferredFocus && isTV && index === 0)}
          onFocused={handleItemFocused}
          onLongPress={onLongPressEntry}
        />
      ),
      [hasTVPreferredFocus, isTV, handleItemFocused, onLongPressEntry]
    );

    if (isLoading) {
      return <ContinueWatchingListSkeleton />;
    }

    return (
      <TVFocusGuideView autoFocus trapFocusRight>
        <LegendList
          data={continueWatching}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          nestedScrollEnabled
          recycleItems
          getFixedItemSize={getFixedItemSize}
          drawDistance={
            Platform.isTV ? TV_HORIZONTAL_DRAW_DISTANCE : MOBILE_HORIZONTAL_DRAW_DISTANCE
          }
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.m,
            paddingVertical: theme.spacing.s,
          }}
          style={{ height: listHeight }}
        />
      </TVFocusGuideView>
    );
  }
);

ContinueWatchingSectionRow.displayName = 'ContinueWatchingSectionRow';

// ============================================================================
// My List Row Component
// ============================================================================

interface MyListSectionRowProps {
  onMediaPress: (media: Pick<MetaPreview, 'id' | 'type'>) => void;
  onSectionFocused: () => void;
}

const getMyListFilters = (t: TFunction): TagOption[] => [
  { id: 'movie', label: t('media:movies') },
  { id: 'series', label: t('media:shows') },
];

const MyListSectionRow = memo(({ onMediaPress, onSectionFocused }: MyListSectionRowProps) => {
  const { t } = useTranslation();
  const { data, isLoading } = useMyList();
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  const flatData = useMemo(() => data?.pages.flat() ?? [], [data]);

  const filteredData = useMemo(() => {
    if (!selectedFilter) return flatData;
    if (selectedFilter === 'movie') {
      return flatData.filter((item) => item.type === 'movie');
    }
    if (selectedFilter === 'series') {
      return flatData.filter((item) => item.type === 'series' || item.type === 'tv');
    }
    return flatData;
  }, [flatData, selectedFilter]);

  // Map to MetaPreview and limit to 20 items
  const mappedData = useMemo<MetaPreview[]>(
    () =>
      filteredData.slice(0, 20).map((item) => ({
        id: item.id,
        type: item.type,
        name: item.metaName ?? '',
        poster: item.imageUrl ?? NO_POSTER_PORTRAIT,
      })),
    [filteredData]
  );

  if (isLoading) {
    return <ContinueWatchingListSkeleton />;
  }

  if (flatData.length === 0) {
    return null;
  }

  return (
    <Box gap="s">
      <Box paddingHorizontal="m">
        <TagFilters
          options={getMyListFilters(t)}
          selectedId={selectedFilter}
          onSelectId={setSelectedFilter}
          includeAllOption
          allLabel={t('media:all')}
        />
      </Box>
      <MediaList
        data={mappedData}
        onMediaPress={onMediaPress as any}
        onItemFocused={onSectionFocused}
      />
    </Box>
  );
});

MyListSectionRow.displayName = 'MyListSectionRow';

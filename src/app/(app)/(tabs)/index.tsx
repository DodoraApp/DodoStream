import { Container } from '@/components/basic/Container';
import { Platform, TVFocusGuideView, useWindowDimensions } from 'react-native';
import { useTheme } from '@shopify/restyle';
import { Box, Text, type Theme } from '@/theme/theme';
import { useAddonStore } from '@/store/addon.store';
import { useMemo, useCallback, memo } from 'react';
import { HomeScrollProvider, useHomeScroll } from '@/hooks/useHomeScroll';
import { MetaPreview } from '@/types/stremio';
import { LegendList } from '@legendapp/list/react-native';
import { MotiView } from 'moti';
import { useContinueWatching, ContinueWatchingEntry } from '@/hooks/useContinueWatching';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { ContinueWatchingItem } from '@/components/media/ContinueWatchingItem';
import { ContinueWatchingListSkeleton } from '@/components/media/ContinueWatchingListSkeleton';
import { CatalogSectionHeader } from '@/components/media/CatalogSectionHeader';
import { CatalogSection } from '@/components/media/CatalogSection';
import { PickerModal } from '@/components/basic/PickerModal';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { useContinueWatchingActions } from '@/hooks/useContinueWatchingActions';
import { HeroSection } from '@/components/media/HeroSection';
import { useHomeStore } from '@/store/home.store';
import { useHomePriorityLoading, type PriorityCatalogEntry } from '@/hooks/useHomePriorityLoading';
import {
  TV_DRAW_DISTANCE,
  MOBILE_DRAW_DISTANCE,
  TV_HORIZONTAL_DRAW_DISTANCE,
  MOBILE_HORIZONTAL_DRAW_DISTANCE,
  HOME_PRIORITY_BUFFER_ROWS,
  ANIMATION_FADE_IN_MS,
} from '@/constants/ui';
import {
  getMediaSectionHeight,
  getContinueWatchingSectionHeight,
  getSectionHeaderHeight,
  getVisibleCatalogCount,
} from '@/utils/layout';

import type { Href } from 'expo-router';

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

/** Union type for all home list items */
type HomeListItem = SectionHeaderItem | ContinueWatchingRowItem | CatalogRowItem;

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
  const { navigateToDetails } = useMediaNavigation();
  const addons = useAddonStore((state) => state.addons);
  const hasAddons = useAddonStore((state) => state.hasAddons());
  const { heroEnabled, heroCatalogSources } = useHomeStore((state) => ({
    heroEnabled: state.getActiveSettings().heroEnabled,
    heroCatalogSources: state.getActiveSettings().heroCatalogSources,
  }));
  const continueWatching = useContinueWatching();
  const continueWatchingData = continueWatching.data;
  const continueWatchingLoading = continueWatching.isLoading;
  const continueWatchingActions = useContinueWatchingActions();
  const { scrollToSection, listRef } = useHomeScroll();
  const theme = useTheme<Theme>();
  const { height: screenHeight } = useWindowDimensions();

  // Whether the continue watching section will be visible
  const hasContinueWatching = continueWatchingLoading || continueWatchingData.length > 0;

  // Number of catalog rows that fit above the fold — these load before the list is shown
  const priorityCatalogCount = useMemo(
    () =>
      getVisibleCatalogCount(
        screenHeight,
        theme,
        heroEnabled,
        hasContinueWatching,
        HOME_PRIORITY_BUFFER_ROWS
      ),
    [screenHeight, theme, heroEnabled, hasContinueWatching]
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
    const addonSections: HomeListItem[] = Object.values(addons)
      .filter((addon) => addon.useCatalogsOnHome)
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

    // Continue watching section: show when loading or when there is data
    if (continueWatchingLoading || continueWatchingData.length > 0) {
      const sectionKey = 'continue-watching';
      continueWatchingSections.push({
        kind: 'section-header',
        sectionKey,
        title: 'Continue Watching',
        icon: 'time-outline',
        linkTo: { pathname: '/library', params: { tab: 'history' } },
      });
      continueWatchingSections.push({
        kind: 'continue-watching-row',
        sectionKey,
        continueWatching: continueWatchingData,
        isLoading: continueWatchingLoading,
      });
    }

    return [...continueWatchingSections, ...addonSections];
  }, [addons, continueWatchingData, continueWatchingLoading]);

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
                  <Text variant="subheader" marginBottom="s">
                    Add sources to build your home feed
                  </Text>
                  <Text variant="bodySmall" color="textSecondary">
                    No addons installed. Go to Settings to install addons.
                  </Text>
                </Box>
              ) : (
                <Box
                  backgroundColor="cardBackground"
                  padding="l"
                  borderRadius="xl"
                  margin="m"
                  borderWidth={1}
                  borderColor="cardBorder">
                  <Text variant="subheader" marginBottom="s">
                    Your feed is ready for more content
                  </Text>
                  <Text variant="bodySmall" color="textSecondary">
                    No catalogs available.
                  </Text>
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

import { Container } from '@/components/basic/Container';
import { Platform, TVFocusGuideView } from 'react-native';
import { useTheme } from '@shopify/restyle';
import { Box, Text, type Theme } from '@/theme/theme';
import { useAddonStore } from '@/store/addon.store';
import { useMemo, useCallback, memo } from 'react';
import { HomeScrollProvider, useHomeScroll } from '@/hooks/useHomeScroll';
import { MetaPreview } from '@/types/stremio';
import { FlashList } from '@shopify/flash-list';
import { HorizontalSpacer } from '@/components/basic/Spacer';
import { useContinueWatching, ContinueWatchingEntry } from '@/hooks/useContinueWatching';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { ContinueWatchingItem } from '@/components/media/ContinueWatchingItem';
import { CatalogSectionHeader } from '@/components/media/CatalogSectionHeader';
import { CatalogSection } from '@/components/media/CatalogSection';
import { PickerModal } from '@/components/basic/PickerModal';
import { useContinueWatchingActions } from '@/hooks/useContinueWatchingActions';
import { HeroSection } from '@/components/media/HeroSection';
import { useHomeStore } from '@/store/home.store';
import { TV_DRAW_DISTANCE, MOBILE_DRAW_DISTANCE } from '@/constants/ui';
import type { Href } from 'expo-router';

// ============================================================================
// Types
// ============================================================================

interface CatalogSectionData {
  manifestUrl: string;
  catalogType: string;
  catalogId: string;
  catalogName: string;
}

/** Section header item */
interface SectionHeaderItem {
  kind: 'section-header';
  sectionKey: string;
  title: string;
  type?: string;
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
}

/** Catalog row item */
interface CatalogRowItem {
  kind: 'catalog-row';
  sectionKey: string;
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
  const heroEnabled = useHomeStore((state) => state.getActiveSettings().heroEnabled);
  const continueWatching = useContinueWatching();
  const continueWatchingActions = useContinueWatchingActions();
  const { scrollToSection, flashListRef } = useHomeScroll();

  const listData = useMemo(() => {
    // Catalog sections from addons
    const addonSections: HomeListItem[] = Object.values(addons)
      .filter((addon) => addon.useCatalogsOnHome)
      .flatMap((addon) =>
        (addon.manifest.catalogs || []).flatMap((catalog) => {
          const sectionKey = `${addon.manifestUrl}-${catalog.type}-${catalog.id}`;
          return [
            {
              kind: 'section-header',
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
              kind: 'catalog-row',
              sectionKey,
              catalog: {
                manifestUrl: addon.manifestUrl,
                catalogType: catalog.type,
                catalogId: catalog.id,
                catalogName: catalog.name,
              },
            },
          ];
        })
      );

    const continueWatchingSections: HomeListItem[] = [];

    // Continue watching section
    if (continueWatching.length > 0) {
      const sectionKey = 'continue-watching';
      continueWatchingSections.push({
        kind: 'section-header',
        sectionKey,
        title: 'Continue Watching',
        linkTo: { pathname: '/library', params: { tab: 'history' } },
      });
      continueWatchingSections.push({
        kind: 'continue-watching-row',
        sectionKey,
      });
    }

    return [...continueWatchingSections, ...addonSections];
  }, [addons, continueWatching.length]);

  const keyExtractor = useCallback((item: HomeListItem, index: number): string => {
    return `${item.kind}-${item.sectionKey}-${index}`;
  }, []);

  const getItemType = useCallback((item: HomeListItem): string => item.kind, []);

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
              linkTo={item.linkTo}
              catalogData={item.catalogData}
              onFocused={() => handleSectionFocused(index + 1)}
            />
          );

        case 'continue-watching-row':
          return (
            <ContinueWatchingSectionRow
              continueWatching={continueWatching}
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
              catalogName={item.catalog.catalogName}
              onMediaPress={handleMediaPress}
              onSectionFocused={() => handleSectionFocused(index)}
            />
          );

        default:
          return null;
      }
    },
    [continueWatching, continueWatchingActions, handleMediaPress, handleSectionFocused]
  );

  return (
    <Container disablePadding safeAreaEdges={['left', 'right', 'top']}>
      <FlashList<HomeListItem>
        ref={flashListRef}
        data={hasAddons ? listData : []}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        ListHeaderComponent={
          heroEnabled ? <HeroSection hasTVPreferredFocus={Platform.isTV} /> : null
        }
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
        drawDistance={Platform.isTV ? TV_DRAW_DISTANCE : MOBILE_DRAW_DISTANCE}
        ListEmptyComponent={
          !hasAddons ? (
            <Box backgroundColor="cardBackground" padding="m" borderRadius="m" margin="m">
              <Text variant="body" color="textSecondary">
                No addons installed. Go to Settings to install addons.
              </Text>
            </Box>
          ) : (
            <Box backgroundColor="cardBackground" padding="m" borderRadius="m" margin="m">
              <Text variant="body" color="textSecondary">
                No catalogs available.
              </Text>
            </Box>
          )
        }
        showsVerticalScrollIndicator={false}
      />

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
  onSectionFocused: (sectionKey: string) => void;
  onLongPressEntry: (entry: ContinueWatchingEntry) => void;
  hasTVPreferredFocus?: boolean;
}

const ContinueWatchingSectionRow = memo(
  ({
    sectionKey,
    continueWatching,
    onSectionFocused,
    onLongPressEntry,
    hasTVPreferredFocus = false,
  }: ContinueWatchingSectionRowProps) => {
    const theme = useTheme<Theme>();
    const isTV = Platform.isTV;

    const handleItemFocused = useCallback(() => {
      onSectionFocused(sectionKey);
    }, [onSectionFocused, sectionKey]);

    return (
      <TVFocusGuideView autoFocus trapFocusRight>
        <FlashList
          horizontal
          data={continueWatching}
          keyExtractor={(item) => item.key}
          nestedScrollEnabled
          renderItem={({ item, index }) => (
            <ContinueWatchingItem
              entry={item}
              hasTVPreferredFocus={Boolean(hasTVPreferredFocus && isTV && index === 0)}
              onFocused={handleItemFocused}
              onLongPress={onLongPressEntry}
            />
          )}
          showsHorizontalScrollIndicator={false}
          ItemSeparatorComponent={HorizontalSpacer}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.m,
            paddingVertical: theme.spacing.s,
          }}
          drawDistance={isTV ? TV_DRAW_DISTANCE : MOBILE_DRAW_DISTANCE}
        />
      </TVFocusGuideView>
    );
  }
);

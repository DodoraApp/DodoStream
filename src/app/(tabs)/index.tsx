import { Container } from '@/components/basic/Container';
import { SearchInput } from '@/components/basic/SearchInput';
import { PageHeader } from '@/components/basic/PageHeader';
import { Platform, SectionList } from 'react-native';
import theme, { Box, Text } from '@/theme/theme';
import { useAddonStore } from '@/store/addon.store';
import { useMemo, useCallback, memo, useRef, useState } from 'react';
import { MetaPreview } from '@/types/stremio';
import { FlashList } from '@shopify/flash-list';
import { HorizontalSpacer } from '@/components/basic/Spacer';
import { useContinueWatching, ContinueWatchingEntry } from '@/hooks/useContinueWatching';
import { CONTINUE_WATCHING_PAGE_SIZE } from '@/constants/media';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { ContinueWatchingItem } from '@/components/media/ContinueWatchingItem';
import { CatalogSectionHeader } from '@/components/media/CatalogSectionHeader';
import { CatalogSection } from '@/components/media/CatalogSection';

interface CatalogSectionData {
  manifestUrl: string;
  catalogType: string;
  catalogId: string;
  catalogName: string;
}

interface SectionModel {
  key: string;
  title: string;
  type?: string;
  data: HomeSectionItemData[];
}

type HomeSectionItemData =
  | { kind: 'continue-watching' }
  | { kind: 'catalog'; item: CatalogSectionData };

export default function Home() {
  const { navigateToDetails } = useMediaNavigation();
  const isTV = Platform.isTV;

  const sectionListRef = useRef<SectionList<HomeSectionItemData, SectionModel>>(null);
  const lastScrolledSectionKeyRef = useRef<string | null>(null);

  const addons = useAddonStore((state) => state.addons);
  const hasAddons = useAddonStore((state) => state.hasAddons);
  const continueWatching = useContinueWatching();
  const [visibleContinueWatchingCount, setVisibleContinueWatchingCount] = useState<number>(
    CONTINUE_WATCHING_PAGE_SIZE
  );

  const hasAnyAddons = hasAddons();

  const continueWatchingVisible = useMemo(() => {
    return continueWatching.slice(0, visibleContinueWatchingCount);
  }, [continueWatching, visibleContinueWatchingCount]);

  const handleContinueWatchingEndReached = useCallback(() => {
    setVisibleContinueWatchingCount((prev: number) => {
      const next = prev + CONTINUE_WATCHING_PAGE_SIZE;
      return Math.min(next, continueWatching.length);
    });
  }, [continueWatching.length]);

  const handleMediaPress = useCallback(
    (media: Pick<MetaPreview, 'id' | 'type'>) => {
      navigateToDetails(media.id, media.type);
    },
    [navigateToDetails]
  );

  const hasContinueWatching = continueWatching.length > 0;

  // Transform continue-watching + addons into sections for SectionList
  const sections: SectionModel[] = useMemo(() => {
    const catalogSections: SectionModel[] = Object.values(addons)
      .filter((addon) => addon.useCatalogsOnHome)
      .flatMap((addon) => {
        const catalogs = addon.manifest.catalogs || [];
        return catalogs.map((catalog) => ({
          key: `${addon.manifestUrl}-${catalog.type}-${catalog.id}`,
          title: catalog.name,
          type: catalog.type,
          data: [
            {
              kind: 'catalog' as const,
              item: {
                manifestUrl: addon.manifestUrl,
                catalogType: catalog.type,
                catalogId: catalog.id,
                catalogName: catalog.name,
              },
            },
          ],
        }));
      });

    const continueWatchingSection: SectionModel[] = hasContinueWatching
      ? [
          {
            key: 'continue-watching',
            title: 'Continue Watching',
            data: [{ kind: 'continue-watching' as const }],
          },
        ]
      : [];

    return [...continueWatchingSection, ...catalogSections];
  }, [addons, hasContinueWatching]);

  const sectionIndexByKey = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    sections.forEach((section, index) => {
      map[section.key] = index;
    });
    return map;
  }, [sections]);

  const handleSectionFocused = useCallback(
    (sectionKey: string) => {
      if (!isTV) return;

      if (lastScrolledSectionKeyRef.current === sectionKey) return;
      lastScrolledSectionKeyRef.current = sectionKey;

      const sectionIndex = sectionIndexByKey[sectionKey];
      if (sectionIndex === undefined) return;

      sectionListRef.current?.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        viewPosition: 0,
        viewOffset: 0,
        animated: true,
      });
    },
    [isTV, sectionIndexByKey]
  );

  const renderSectionItem = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: HomeSectionItemData;
      index: number;
      section: SectionModel;
    }) => {
      if (item.kind === 'continue-watching') {
        return (
          <ContinueWatchingSectionRow
            sectionKey={section.key}
            continueWatchingVisible={continueWatchingVisible}
            onEndReached={handleContinueWatchingEndReached}
            onSectionFocused={handleSectionFocused}
            hasTVPreferredFocus={isTV}
          />
        );
      }

      const sectionIndex = sectionIndexByKey[section.key] ?? 0;

      return (
        <CatalogSection
          manifestUrl={item.item.manifestUrl}
          catalogType={item.item.catalogType}
          catalogId={item.item.catalogId}
          catalogName={item.item.catalogName}
          onMediaPress={handleMediaPress}
          hasTVPreferredFocus={isTV && !hasContinueWatching && sectionIndex === 0 && index === 0}
          sectionKey={section.key}
          onSectionFocused={handleSectionFocused}
        />
      );
    },
    [
      continueWatchingVisible,
      handleContinueWatchingEndReached,
      handleMediaPress,
      handleSectionFocused,
      hasContinueWatching,
      isTV,
      sectionIndexByKey,
    ]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionModel }) => (
      <CatalogSectionHeader title={section.title} type={section.type} />
    ),
    []
  );

  return (
    <Container disablePadding safeAreaEdges={['left', 'right', 'top']}>
      <SectionList<HomeSectionItemData, SectionModel>
        ref={sectionListRef}
        sections={hasAnyAddons ? sections : []}
        keyExtractor={(item, index) => {
          if (item.kind === 'continue-watching') return `continue-watching-${index}`;
          return `${item.item.manifestUrl}-${item.item.catalogId}-${index}`;
        }}
        ListHeaderComponent={<HomeHeader />}
        ListEmptyComponent={
          !hasAnyAddons ? (
            <Box backgroundColor="cardBackground" padding="m" borderRadius="m" margin="m">
              <Text variant="body" color="textSecondary">
                No addons installed. Go to Settings to install addons.
              </Text>
            </Box>
          ) : null
        }
        renderItem={renderSectionItem}
        renderSectionHeader={renderSectionHeader}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        windowSize={5}
        snapToInterval={isTV ? undefined : 1}
        snapToAlignment={isTV ? undefined : 'start'}
        decelerationRate={isTV ? undefined : 'fast'}
        showsVerticalScrollIndicator={false}
      />
    </Container>
  );
}

const HomeHeader = memo(() => {
  return (
    <Box gap="m" paddingTop="m">
      <Box marginHorizontal="m">
        <PageHeader title="Home" rightElement={<SearchInput placeholder="Search..." />} />
      </Box>
    </Box>
  );
});

interface ContinueWatchingSectionRowProps {
  sectionKey: string;
  continueWatchingVisible: ContinueWatchingEntry[];
  onEndReached: () => void;
  onSectionFocused: (sectionKey: string) => void;
  hasTVPreferredFocus?: boolean;
}

const ContinueWatchingSectionRow = memo(
  ({
    sectionKey,
    continueWatchingVisible,
    onEndReached,
    onSectionFocused,
    hasTVPreferredFocus = false,
  }: ContinueWatchingSectionRowProps) => {
    const isTV = Platform.isTV;

    return (
      <FlashList
        horizontal
        data={continueWatchingVisible}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index }) => (
          <ContinueWatchingItem
            entry={item}
            hasTVPreferredFocus={Boolean(hasTVPreferredFocus && isTV && index === 0)}
            onFocused={() => onSectionFocused(sectionKey)}
          />
        )}
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={HorizontalSpacer}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.m,
          paddingVertical: theme.spacing.s,
        }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
      />
    );
  }
);

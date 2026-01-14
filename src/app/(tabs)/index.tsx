import { Container } from '@/components/basic/Container';
import { Platform, SectionList, View } from 'react-native';
import theme, { Box, Text } from '@/theme/theme';
import { useAddonStore } from '@/store/addon.store';
import { useMemo, useCallback, memo, useRef, useState, useEffect } from 'react';
import { HomeScrollProvider, useHomeScroll } from '@/hooks/useHomeScroll';
import { MetaPreview } from '@/types/stremio';
import { FlashList } from '@shopify/flash-list';
import { HorizontalSpacer } from '@/components/basic/Spacer';
import { useContinueWatching, ContinueWatchingEntry } from '@/hooks/useContinueWatching';
import { CONTINUE_WATCHING_PAGE_SIZE } from '@/constants/media';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { ContinueWatchingItem } from '@/components/media/ContinueWatchingItem';
import { CatalogSectionHeader } from '@/components/media/CatalogSectionHeader';
import { CatalogSection } from '@/components/media/CatalogSection';
import { PickerModal } from '@/components/basic/PickerModal';
import { useContinueWatchingActions } from '@/hooks/useContinueWatchingActions';
import { HeroSection } from '@/components/media/HeroSection';
import { useHomeStore } from '@/store/home.store';

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
  return (
    <HomeScrollProvider>
      <HomeContent />
    </HomeScrollProvider>
  );
}

function HomeContent() {
  const { navigateToDetails } = useMediaNavigation();
  const isTV = Platform.isTV;

  const { scrollToSection, sectionListRef, setSectionIndexMap } = useHomeScroll();

  const addons = useAddonStore((state) => state.addons);
  const hasAddons = useAddonStore((state) => state.hasAddons);
  const heroEnabled = useHomeStore((state) => state.getActiveSettings().heroEnabled);
  const continueWatching = useContinueWatching();
  const [visibleContinueWatchingCount, setVisibleContinueWatchingCount] = useState<number>(
    CONTINUE_WATCHING_PAGE_SIZE
  );

  const continueWatchingActions = useContinueWatchingActions();

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

  useEffect(() => {
    setSectionIndexMap(sectionIndexByKey);
  }, [sectionIndexByKey, setSectionIndexMap]);

  const handleSectionFocused = useCallback(
    (sectionKey: string) => {
      scrollToSection(sectionKey);
    },
    [scrollToSection]
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
            onLongPressEntry={continueWatchingActions.openActions}
          />
        );
      }

      return (
        <CatalogSection
          manifestUrl={item.item.manifestUrl}
          catalogType={item.item.catalogType}
          catalogId={item.item.catalogId}
          catalogName={item.item.catalogName}
          onMediaPress={handleMediaPress}
          sectionKey={section.key}
          onSectionFocused={handleSectionFocused}
        />
      );
    },
    [
      continueWatchingActions.openActions,
      continueWatchingVisible,
      handleContinueWatchingEndReached,
      handleMediaPress,
      handleSectionFocused,
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
        ListHeaderComponent={heroEnabled ? <HeroSection hasTVPreferredFocus={isTV} /> : null}
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

      <PickerModal
        visible={continueWatchingActions.isVisible}
        onClose={continueWatchingActions.closeActions}
        label={continueWatchingActions.label}
        items={continueWatchingActions.items}
        onValueChange={continueWatchingActions.handleAction}
      />
    </Container>
  );
}

interface ContinueWatchingSectionRowProps {
  sectionKey: string;
  continueWatchingVisible: ContinueWatchingEntry[];
  onEndReached: () => void;
  onSectionFocused: (sectionKey: string) => void;
  onLongPressEntry: (entry: ContinueWatchingEntry) => void;
  hasTVPreferredFocus?: boolean;
}

const ContinueWatchingSectionRow = memo(
  ({
    sectionKey,
    continueWatchingVisible,
    onEndReached,
    onSectionFocused,
    onLongPressEntry,
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
            onLongPress={onLongPressEntry}
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

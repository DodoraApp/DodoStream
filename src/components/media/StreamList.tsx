import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TVFocusGuideView } from 'react-native';

import { LegendList } from '@legendapp/list/react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme } from '@shopify/restyle';

import { useStreams } from '@/api/stremio';
import FadeIn from '@/components/basic/FadeIn';
import { Focusable } from '@/components/basic/Focusable';
import { LoadingQuery } from '@/components/basic/LoadingQuery';
import { HorizontalSpacer, VerticalSpacer } from '@/components/basic/Spacer';
import { TagFilters, TagOption } from '@/components/basic/TagFilters';
import { StreamListSkeleton } from '@/components/media/StreamListSkeleton';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { Box, Text, type Theme } from '@/theme/theme';
import type { ContentType, Stream } from '@/types/stremio';
import { createDebugLogger } from '@/utils/debug';
import { getFocusableBackgroundColor } from '@/utils/focus-colors';
import { getStreamStableId, isStreamAvailable, isStreamSelected } from '@/utils/stream';

const debug = createDebugLogger('StreamList');
type AddonOption = TagOption;

export interface StreamListProps {
  type: ContentType;
  id: string;
  videoId?: string;
  title?: string;
  /** Background image URL for player loading screen. */
  backgroundImage?: string;
  /** Logo image URL for player loading screen. */
  logoImage?: string;
  /** Optional override for stream selection behavior. When provided, overrides the default navigation. */
  onSelectOverride?: (stream: Stream) => void;
  /** Stable ID of the currently playing stream for active-state rendering. */
  selectedStreamId?: string;
  /** URL of the currently playing stream for autoplay sessions without an ID. */
  selectedStreamUrl?: string;
  /** Whether the list focus guide should request its first focusable item. */
  autoFocus?: boolean;
  /** When true, the list sizes to its content and centers vertically (overlay usage). */
  centered?: boolean;
  /** Defaults to the platform layout. Player rails force a vertical list. */
  layout?: 'auto' | 'horizontal' | 'vertical';
}

interface StreamListItemProps {
  stream: Stream;
  horizontal: boolean;
  onSelect: (stream: Stream) => void;
  selectedStreamId?: string;
  selectedStreamUrl?: string;
}

const StreamListItem = memo(
  ({ stream, horizontal, onSelect, selectedStreamId, selectedStreamUrl }: StreamListItemProps) => {
    const { t } = useTranslation('media');
    const theme = useTheme<Theme>();
    const available = isStreamAvailable(stream);

    const isSelected = isStreamSelected(stream, selectedStreamId, selectedStreamUrl);
    const recyclingKey = getStreamStableId(stream);
    const handleFocusChange = useCallback(
      (focused: boolean) => {
        debug('streamFocusChange', {
          focused,
          isSelected,
          recyclingKey,
          selectedStreamId,
          selectedStreamUrl,
        });
      },
      [isSelected, recyclingKey, selectedStreamId, selectedStreamUrl]
    );

    const showCountry =
      !!stream.behaviorHints?.countryWhitelist && stream.behaviorHints.countryWhitelist.length > 0;

    return (
      <Focusable
        onPress={() => onSelect(stream)}
        onFocusChange={handleFocusChange}
        disabled={!available}
        recyclingKey={recyclingKey}
        hasTVPreferredFocus={isSelected}
        testID={`stream-${getStreamStableId(stream)}`}
        focusedStyle={{ borderRadius: theme.borderRadii.m }}>
        {({ isFocused }) => (
          <Box
            backgroundColor={getFocusableBackgroundColor({ isFocused })}
            padding="m"
            borderRadius="m"
            gap="xs"
            width={horizontal ? theme.cardSizes.stream.width : '100%'}
            position="relative"
            opacity={available ? 1 : 0.5}>
            {isSelected && (
              <Box
                position="absolute"
                left={0}
                top={0}
                bottom={0}
                width={theme.spacing.xs}
                backgroundColor="primaryBackground"
                borderTopLeftRadius="m"
                borderBottomLeftRadius="m"
              />
            )}
            <Box flexDirection="row" justifyContent="space-between" alignItems="center">
              <Box flex={1} flexDirection="row" alignItems="center" gap="s">
                {(stream.name || stream.title) && (
                  <Text variant="cardTitle" flex={1}>
                    {stream.title ?? stream.name}
                  </Text>
                )}
              </Box>
              <Box flexDirection="row" alignItems="center" gap="s">
                {available && (
                  <Ionicons
                    name="chevron-forward"
                    size={theme.sizes.iconSmall}
                    color={isSelected ? theme.colors.primaryForeground : theme.colors.textSecondary}
                  />
                )}
              </Box>
            </Box>

            <Box>
              {stream.description ? (
                <Text variant="bodySmall" color="textSecondary" overflow="visible">
                  {stream.description}
                </Text>
              ) : null}
            </Box>

            <Box justifyContent="center">
              {showCountry ? (
                <Box flexDirection="row" alignItems="center" gap="xs">
                  <Ionicons
                    name="location"
                    size={theme.sizes.iconSmall}
                    color={theme.colors.textSecondary}
                  />
                  <Text variant="caption" color="textSecondary" numberOfLines={1}>
                    {t('available_in', {
                      countries: stream.behaviorHints!.countryWhitelist!.join(', ').toUpperCase(),
                    })}
                  </Text>
                </Box>
              ) : null}
            </Box>

            {!stream.url && stream.externalUrl && (
              <Text variant="caption" color="textSecondary">
                {stream.externalUrl}
              </Text>
            )}
          </Box>
        )}
      </Focusable>
    );
  }
);

interface StreamListInnerProps {
  streamList: Stream[];
  isHorizontal: boolean;
  selectedStreamId?: string;
  selectedStreamUrl?: string;
  handleSelectStream: (stream: Stream) => void;
  centered?: boolean;
  autoFocus: boolean;
}

const StreamListInner = memo(
  ({
    streamList,
    isHorizontal,
    handleSelectStream,
    selectedStreamId,
    selectedStreamUrl,
    centered = false,
    autoFocus,
  }: StreamListInnerProps) => {
    const { t } = useTranslation('media');
    const renderItem = useCallback(
      ({ item }: { item: Stream }) => (
        <StreamListItem
          stream={item}
          onSelect={handleSelectStream}
          horizontal={isHorizontal}
          selectedStreamId={selectedStreamId}
          selectedStreamUrl={selectedStreamUrl}
        />
      ),
      [handleSelectStream, isHorizontal, selectedStreamId, selectedStreamUrl]
    );

    const keyExtractor = useCallback((item: Stream) => getStreamStableId(item), []);
    const initialScrollIndex = useMemo(() => {
      const index = streamList.findIndex((stream) =>
        isStreamSelected(stream, selectedStreamId, selectedStreamUrl)
      );
      return index >= 0 ? index : undefined;
    }, [selectedStreamId, selectedStreamUrl, streamList]);
    useEffect(() => {
      debug('streamListFocusState', {
        count: streamList.length,
        initialScrollIndex,
        isHorizontal,
        selectedStreamId,
        selectedStreamUrl,
      });
    }, [initialScrollIndex, isHorizontal, selectedStreamId, selectedStreamUrl, streamList.length]);

    return (
      <Box gap="s" paddingTop="s" justifyContent="center" flex={1}>
        <Text variant="bodySmall" color="textSecondary">
          {t('streams_available', { count: streamList.length })}
        </Text>

        <TVFocusGuideView autoFocus={autoFocus}>
          <LegendList
            data={streamList}
            horizontal={isHorizontal}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialScrollIndex}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={isHorizontal ? HorizontalSpacer : VerticalSpacer}
            renderItem={renderItem}
            // ScrollView grows by default (flexGrow: 1), which pins content to the
            // top; in centered mode it must size to content so centering applies.
            style={centered ? { flexGrow: 0, flexShrink: 1 } : undefined}
          />
        </TVFocusGuideView>
      </Box>
    );
  }
);
export const StreamList = memo(
  ({
    type,
    id,
    videoId,
    title,
    backgroundImage,
    logoImage,
    onSelectOverride,
    selectedStreamId,
    selectedStreamUrl,
    centered = false,
    layout = 'auto',
    autoFocus = true,
  }: StreamListProps) => {
    const { t } = useTranslation('media');
    const { data: streams, isLoading, isError, allResults, addons } = useStreams(type, id, videoId);
    const [selectedAddonId, setSelectedAddonId] = useState<string | null>(null);
    const { openStreamFromStream } = useMediaNavigation();
    const { isTVLayout } = useResponsiveLayout();
    const isHorizontal = layout === 'auto' ? isTVLayout : layout === 'horizontal';

    const handleSelectStream = useCallback(
      (stream: Stream) => {
        const streamId = getStreamStableId(stream);
        const available = isStreamAvailable(stream);
        debug('streamPressed', {
          streamId,
          available,
          hasUrl: Boolean(stream.url),
          hasExternalUrl: Boolean(stream.externalUrl),
          hasYoutubeId: Boolean(stream.ytId),
          selectedStreamId,
          selectedStreamUrl,
          hasOverride: Boolean(onSelectOverride),
        });
        if (!available) return;

        if (onSelectOverride) {
          onSelectOverride(stream);
          return;
        }

        openStreamFromStream({
          metaId: id,
          videoId,
          type,
          title,
          backgroundImage,
          logoImage,
          stream,
          navigation: 'push',
        });
      },
      [
        backgroundImage,
        id,
        logoImage,
        onSelectOverride,
        openStreamFromStream,
        selectedStreamId,
        selectedStreamUrl,
        title,
        type,
        videoId,
      ]
    );

    const resultByManifestUrl = useMemo(() => {
      const map = new Map<string, (typeof allResults)[number] | undefined>();
      addons.forEach((addon, index) => {
        map.set(addon.manifestUrl, allResults[index]);
      });
      return map;
    }, [addons, allResults]);

    const addonOptions = useMemo<AddonOption[]>(() => {
      return [...addons]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((addon) => ({
          id: addon.id,
          label: addon.name,
          isLoading: resultByManifestUrl.get(addon.manifestUrl)?.isLoading ?? false,
        }));
    }, [addons, resultByManifestUrl]);

    const hasAnyAddonFinishedLoading = useMemo(() => {
      if (allResults.length === 0) return true;
      return allResults.some((result) => !result.isLoading);
    }, [allResults]);

    const haveAllAddonsFinishedLoading = useMemo(() => {
      if (allResults.length === 0) return false;
      return allResults.every((result) => !result.isLoading);
    }, [allResults]);

    const filteredStreams = useMemo(() => {
      if (!streams) return streams;
      if (!selectedAddonId) return streams;
      return streams.filter((s) => (s.addonId ?? 'unknown') === selectedAddonId);
    }, [streams, selectedAddonId]);
    useEffect(() => {
      const selectedStream = streams?.find((stream) =>
        isStreamSelected(stream, selectedStreamId, selectedStreamUrl)
      );
      debug('streamListProps', {
        id,
        videoId,
        selectedStreamId,
        selectedStreamUrl,
        streamIdentitySamples: streams?.map((stream) => ({
          stableId: getStreamStableId(stream),
          addonId: stream.addonId,
          url: stream.url,
          infoHash: stream.infoHash,
          title: stream.title ?? stream.name,
        })),
        matchedStreamId: selectedStream ? getStreamStableId(selectedStream) : undefined,
        selectedAddonId,
        isTVLayout,
      });
    }, [id, isTVLayout, selectedAddonId, selectedStreamId, selectedStreamUrl, streams, videoId]);
    return (
      <Box gap="s" flex={1}>
        <FadeIn>
          <TagFilters
            options={addonOptions}
            selectedId={selectedAddonId}
            onSelectId={setSelectedAddonId}
            includeAllOption
            allLabel={t('all')}
            allHasTVPreferredFocus={!selectedStreamId && !selectedStreamUrl}
            allTestID="stream-filter-all"
          />
        </FadeIn>

        <LoadingQuery
          isLoading={isLoading && !hasAnyAddonFinishedLoading}
          isError={isError}
          data={filteredStreams}
          loadingMessage={t('finding_streams')}
          loadingComponent={<StreamListSkeleton />}
          errorMessage={t('failed_load_streams')}
          emptyMessage={t('no_streams')}
          isEmpty={(data) => haveAllAddonsFinishedLoading && data.length === 0}>
          {(streamList) => (
            <StreamListInner
              streamList={streamList}
              isHorizontal={isHorizontal}
              handleSelectStream={handleSelectStream}
              selectedStreamId={selectedStreamId}
              selectedStreamUrl={selectedStreamUrl}
              centered={centered}
              autoFocus={autoFocus}
            />
          )}
        </LoadingQuery>
      </Box>
    );
  }
);

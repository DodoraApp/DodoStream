import { memo, useCallback, useMemo, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import theme, { Box, Text } from '@/theme/theme';

import { useStreams } from '@/api/stremio';
import { LoadingQuery } from '@/components/basic/LoadingQuery';
import { StreamListSkeleton } from '@/components/media/StreamListSkeleton';
import type { ContentType, Stream } from '@/types/stremio';
import { Focusable } from '@/components/basic/Focusable';
import { getStreamStableId } from '@/utils/stream';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import FadeIn from '@/components/basic/FadeIn';
import { HorizontalSpacer, VerticalSpacer } from '@/components/basic/Spacer';
import { TagFilters, TagOption } from '@/components/basic/TagFilters';

interface AddonOption {
  id: string;
  name: string;
  isLoading: boolean;
}

interface StreamListProps {
  type: ContentType;
  id: string;
  videoId?: string;
  title?: string;
}

const isStreamAvailable = (stream: Stream): boolean => {
  return !!(stream.url || stream.externalUrl || stream.ytId);
};

interface StreamListItemProps {
  stream: Stream;
  horizontal: boolean;
  onSelect: (stream: Stream) => void;
}

const StreamListItem = memo(({ stream, horizontal, onSelect }: StreamListItemProps) => {
  const available = isStreamAvailable(stream);

  const recyclingKey = getStreamStableId(stream);

  const showCountry =
    !!stream.behaviorHints?.countryWhitelist && stream.behaviorHints.countryWhitelist.length > 0;

  return (
    <Focusable
      onPress={() => onSelect(stream)}
      disabled={!available}
      recyclingKey={recyclingKey}
      focusStyle={{ borderRadius: theme.borderRadii.m }}>
      {({ isFocused }) => (
        <Box
          backgroundColor={isFocused ? 'focusBackground' : 'cardBackground'}
          padding="m"
          borderRadius="m"
          gap="xs"
          width={horizontal ? theme.cardSizes.stream.width : '100%'}
          opacity={available ? 1 : 0.5}>
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Box flex={1} flexDirection="row" alignItems="center" gap="s">
              {(stream.name || stream.title) && (
                <Text variant="cardTitle" flex={1}>
                  {stream.title ?? stream.name}
                </Text>
              )}
            </Box>
            {available && (
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            )}
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
                <Ionicons name="location" size={14} color={theme.colors.textSecondary} />
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  Available in: {stream.behaviorHints!.countryWhitelist!.join(', ').toUpperCase()}
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
});

export const StreamList = memo(({ type, id, videoId, title }: StreamListProps) => {
  const { data: streams, isLoading, isError, allResults, addons } = useStreams(type, id, videoId);
  const [selectedAddonId, setSelectedAddonId] = useState<string | null>(null);
  const { openStreamFromStream } = useMediaNavigation();
  const { isPlatformTV } = useResponsiveLayout();
  const isHorizontal = isPlatformTV;

  const handleSelectStream = useCallback(
    (stream: Stream) => {
      if (!isStreamAvailable(stream)) return;

      openStreamFromStream({
        metaId: id,
        videoId,
        type,
        title,
        stream,
        navigation: 'push',
      });
    },
    [id, openStreamFromStream, title, type, videoId]
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
        name: addon.name,
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

  return (
    <Box gap="s">
      <FadeIn>
        <TagFilters
          options={
            addonOptions.map((o) => ({
              id: o.id,
              label: o.name,
              isLoading: o.isLoading,
            })) as TagOption[]
          }
          selectedId={selectedAddonId}
          onSelectId={setSelectedAddonId}
          includeAllOption
          allLabel="All"
        />
      </FadeIn>

      <LoadingQuery
        isLoading={isLoading && !hasAnyAddonFinishedLoading}
        isError={isError}
        data={filteredStreams}
        loadingMessage="Finding streams..."
        loadingComponent={<StreamListSkeleton />}
        errorMessage="Failed to load streams"
        emptyMessage="No streams available for this content"
        isEmpty={(data) => haveAllAddonsFinishedLoading && data.length === 0}>
        {(streamList) => (
          <Box gap="s">
            <Text variant="bodySmall" color="textSecondary">
              {streamList.length} stream(s) available
            </Text>

            <FlashList
              data={streamList}
              horizontal={isHorizontal}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) =>
                `${item.addonId}-${item.infoHash}-${item.ytId}-${index}`
              }
              ItemSeparatorComponent={() =>
                isHorizontal ? <HorizontalSpacer /> : <VerticalSpacer />
              }
              renderItem={({ item }) => (
                <StreamListItem
                  stream={item}
                  onSelect={handleSelectStream}
                  horizontal={isHorizontal}
                />
              )}
            />
          </Box>
        )}
      </LoadingQuery>
    </Box>
  );
});

import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LegendList } from '@legendapp/list/react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import { Box, Text, type Theme } from '@/theme/theme';

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
import { getFocusableBackgroundColor } from '@/utils/focus-colors';

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
  /** Background image URL for player loading screen. */
  backgroundImage?: string;
  /** Logo image URL for player loading screen. */
  logoImage?: string;
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
  const { t } = useTranslation('media');
  const theme = useTheme<Theme>();
  const available = isStreamAvailable(stream);

  const recyclingKey = getStreamStableId(stream);

  const showCountry =
    !!stream.behaviorHints?.countryWhitelist && stream.behaviorHints.countryWhitelist.length > 0;

  return (
    <Focusable
      onPress={() => onSelect(stream)}
      disabled={!available}
      recyclingKey={recyclingKey}
      focusedStyle={{ borderRadius: theme.borderRadii.m }}>
      {({ isFocused }) => (
        <Box
          backgroundColor={getFocusableBackgroundColor({ isFocused })}
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
              <Ionicons
                name="chevron-forward"
                size={theme.sizes.iconSmall}
                color={theme.colors.textSecondary}
              />
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
});

interface StreamListInnerProps {
  streamList: Stream[];
  isHorizontal: boolean;
  handleSelectStream: (stream: Stream) => void;
}

const StreamListInner = memo(
  ({ streamList, isHorizontal, handleSelectStream }: StreamListInnerProps) => {
    const { t } = useTranslation('media');
    const renderItem = useCallback(
      ({ item }: { item: Stream }) => (
        <StreamListItem stream={item} onSelect={handleSelectStream} horizontal={isHorizontal} />
      ),
      [handleSelectStream, isHorizontal]
    );

    const keyExtractor = useCallback(
      (item: Stream, index: number) => `${item.addonId}-${item.infoHash}-${item.ytId}-${index}`,
      []
    );

    return (
      <Box gap="s">
        <Text variant="bodySmall" color="textSecondary">
          {t('streams_available', { count: streamList.length })}
        </Text>

        <LegendList
          data={streamList}
          horizontal={isHorizontal}
          showsHorizontalScrollIndicator={false}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={isHorizontal ? HorizontalSpacer : VerticalSpacer}
          renderItem={renderItem}
        />
      </Box>
    );
  }
);

export const StreamList = memo(
  ({ type, id, videoId, title, backgroundImage, logoImage }: StreamListProps) => {
    const { t } = useTranslation('media');
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
          backgroundImage,
          logoImage,
          stream,
          navigation: 'push',
        });
      },
      [backgroundImage, id, logoImage, openStreamFromStream, title, type, videoId]
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
            allLabel={t('all')}
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
            />
          )}
        </LoadingQuery>
      </Box>
    );
  }
);

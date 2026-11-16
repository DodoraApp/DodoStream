import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Modal } from '@/components/basic/Modal';
import { type PickerItem, PickerModal } from '@/components/basic/PickerModal';
import { StreamList } from '@/components/media/StreamList';
import { useDownloadActions } from '@/hooks/useDownloads';
import { showToast } from '@/store/toast.store';
import { Box, Text } from '@/theme/theme';
import type { ContentType, MetaDetail, Stream } from '@/types/stremio';
import { isStreamDownloadable } from '@/utils/downloads';
import { formatPlayerTitle } from '@/utils/format';

export interface SeasonDownloadModalProps {
  visible: boolean;
  onClose: () => void;
  media: MetaDetail;
  type: ContentType;
}

/**
 * Downloads a whole season in two steps: pick the season (when there are
 * several), then pick a stream of its first episode. The other episodes are
 * downloaded with the corresponding stream of the same addon.
 */
export const SeasonDownloadModal = memo(
  ({ visible, onClose, media, type }: SeasonDownloadModalProps) => {
    const { t } = useTranslation('media');
    const { startSeasonDownload } = useDownloadActions();
    const [pickedSeason, setPickedSeason] = useState<number | null>(null);
    // The season picker closes itself after a choice; that must not end the flow.
    const didPickSeasonRef = useRef(false);

    const videos = useMemo(() => media.videos ?? [], [media.videos]);

    const seasons = useMemo(() => {
      const seen = new Set<number>();
      for (const video of videos) seen.add(video.season ?? 0);
      return [...seen];
    }, [videos]);

    const season = seasons.length === 1 ? seasons[0] : pickedSeason;

    const episodes = useMemo(
      () =>
        season == null
          ? []
          : videos
              .filter((video) => (video.season ?? 0) === season)
              .map((video) => ({
                videoId: video.id,
                title: formatPlayerTitle(media, video) ?? media.name,
              })),
      [media, season, videos]
    );

    const seasonItems = useMemo<PickerItem<number>[]>(
      () =>
        seasons.map((value) => ({
          label: value === 0 ? t('specials') : t('season', { number: value }),
          value,
        })),
      [seasons, t]
    );

    const handleClose = useCallback(() => {
      setPickedSeason(null);
      onClose();
    }, [onClose]);

    const handlePickSeason = useCallback((value: number) => {
      didPickSeasonRef.current = true;
      setPickedSeason(value);
    }, []);

    const handleSeasonPickerClose = useCallback(() => {
      if (didPickSeasonRef.current) {
        didPickSeasonRef.current = false;
        return;
      }
      handleClose();
    }, [handleClose]);

    const handleSelectStream = useCallback(
      (stream: Stream) => {
        if (!isStreamDownloadable(stream) || !stream.addonManifestUrl) {
          showToast({ title: t('download_not_supported'), preset: 'error' });
          return;
        }

        startSeasonDownload({
          metaId: media.id,
          type,
          referenceStream: stream,
          referenceEpisode: episodes[0],
          episodes,
        });
        handleClose();
      },
      [episodes, handleClose, media.id, startSeasonDownload, t, type]
    );

    if (!visible) return null;

    if (season == null) {
      return (
        <PickerModal
          visible
          onClose={handleSeasonPickerClose}
          label={t('download_season')}
          icon="download-outline"
          items={seasonItems}
          onValueChange={handlePickSeason}
        />
      );
    }

    const firstEpisode = episodes[0];
    if (!firstEpisode) return null;

    return (
      <Modal
        visible
        onClose={handleClose}
        label={t('download_season_choose_stream')}
        icon="download-outline">
        <Box flex={1} gap="s" testID="season-download-streams">
          <Text variant="caption" color="textSecondary">
            {t('download_season_hint')}
          </Text>
          <StreamList
            type={type}
            id={media.id}
            videoId={firstEpisode.videoId}
            onSelectOverride={handleSelectStream}
            layout="vertical"
          />
        </Box>
      </Modal>
    );
  }
);

SeasonDownloadModal.displayName = 'SeasonDownloadModal';

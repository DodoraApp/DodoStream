import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '@/theme/theme';

import type { MetaDetail, MetaVideo } from '@/types/stremio';
import { DetailsTabBar, DetailsTab } from '@/components/media/DetailsTabBar';
import { EpisodeList } from '@/components/media/EpisodeList';
import { CastTab } from '@/components/media/CastTab';
import { TrailersTab } from '@/components/media/TrailersTab';

interface MediaDetailsTabsProps {
  media: MetaDetail;
  onEpisodePress: (video: MetaVideo) => void;
  onEpisodeLongPress?: (video: MetaVideo) => void;
}

export const MediaDetailsTabs: FC<MediaDetailsTabsProps> = ({ media, onEpisodePress, onEpisodeLongPress }) => {
  const { t } = useTranslation('media');
  const hasSeasonsTab = (media.videos?.length ?? 0) > 1;
  const hasTrailersTab = (media.trailerStreams?.length ?? 0) > 0;

  const tabs = useMemo<DetailsTab[]>(() => {
    const result: DetailsTab[] = [];
    if (hasSeasonsTab) {
      result.push({ key: 'seasons', label: t('seasons') });
    }
    result.push({ key: 'cast', label: t('cast') });
    if (hasTrailersTab) {
      result.push({ key: 'trailers', label: t('trailers') });
    }
    return result;
  }, [hasSeasonsTab, hasTrailersTab, t]);

  const defaultTab = hasSeasonsTab ? 'seasons' : 'cast';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabPress = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  // If there's only one tab with no content worth showing, skip rendering entirely
  if (tabs.length === 0) return null;

  return (
    <Box gap="m">
      <DetailsTabBar tabs={tabs} activeTab={activeTab} onTabPress={handleTabPress} />

      {activeTab === 'seasons' && hasSeasonsTab && media.videos && (
        <EpisodeList metaId={media.id} videos={media.videos} onEpisodePress={onEpisodePress} onEpisodeLongPress={onEpisodeLongPress} />
      )}

      <CastTab media={media} isActive={activeTab === 'cast'} />

      {hasTrailersTab && (
        <TrailersTab trailers={media.trailerStreams!} isActive={activeTab === 'trailers'} />
      )}
    </Box>
  );
};

import { memo, PropsWithChildren, useMemo } from 'react';
import { Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedImage } from '@/components/basic/AnimatedImage';
import { Box, Text } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import type { MetaDetail, MetaVideo } from '@/types/stremio';
import { MediaInfo } from '@/components/media/MediaInfo';
import { getDetailsCoverSource, getDetailsLogoSource } from '@/utils/media-artwork';

import { MEDIA_DETAILS_HEADER_COVER_HEIGHT } from '@/constants/media';
import { Tag } from '@/components/basic/Tag';
import FadeIn from '@/components/basic/FadeIn';

const { width } = Dimensions.get('window');

interface MediaDetailsHeaderProps {
  media: MetaDetail;
  video?: MetaVideo;
  variant?: 'minimal' | 'compact' | 'full';
}

export const MediaDetailsHeader = memo(
  ({ media, video, variant = 'full', children }: PropsWithChildren<MediaDetailsHeaderProps>) => {
    const theme = useTheme<Theme>();

    const coverSource = useMemo(() => {
      return getDetailsCoverSource(media.background, media.poster);
    }, [media.background, media.poster]);

    const logoSource = useMemo(() => {
      return getDetailsLogoSource(media.logo);
    }, [media.logo]);

    const episodeTag = useMemo(() => {
      if (!video) return undefined;
      if (video.season === undefined && video.episode === undefined) return undefined;
      const s = video.season !== undefined ? `S${video.season}` : '';
      const e = video.episode !== undefined ? `E${video.episode}` : '';
      return `${s}${e}` || undefined;
    }, [video]);

    const episodeTitle = useMemo(() => {
      if (!video?.title) return undefined;
      return video.title === media.name ? undefined : video.title;
    }, [media.name, video?.title]);

    const showEpisodeBlock = Boolean(episodeTag || episodeTitle);

    // MediaInfo currently supports only 'compact' | 'full'. Treat 'minimal' as 'compact'.
    const mediaInfoVariant = variant === 'minimal' ? 'compact' : variant;
    return (
      <Box>
        {variant !== 'minimal' && (
          <Box height={MEDIA_DETAILS_HEADER_COVER_HEIGHT} width={width} position="relative">
            <AnimatedImage
              source={coverSource}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />

            <LinearGradient
              colors={['transparent', theme.colors.mainBackground]}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '50%',
              }}
            />
          </Box>
        )}

        <Box gap="m" padding="l">
          {variant !== 'minimal' && logoSource && (
            <AnimatedImage
              source={logoSource}
              contentFit="contain"
              style={{
                width: Math.min(width - theme.spacing.l * 2, theme.sizes.logoMaxWidth),
                height: theme.sizes.logoHeight,
              }}
            />
          )}
          {variant !== 'minimal' && !logoSource && (
            <FadeIn>
              <Text variant="header" textAlign="center">
                {media.name}
              </Text>
            </FadeIn>
          )}

          {!!showEpisodeBlock && (
            <FadeIn>
              <Box gap="s" flexDirection="column">
                {!!episodeTag && (
                  <Box alignSelf="flex-start">
                    <Tag label={episodeTag} selected />
                  </Box>
                )}
                {!!episodeTitle && <Text variant="subheader">{episodeTitle}</Text>}
              </Box>
            </FadeIn>
          )}

          {children}
          <MediaInfo media={media} video={video} variant={mediaInfoVariant} />
        </Box>
      </Box>
    );
  }
);
MediaDetailsHeader.displayName = 'MediaDetailsHeader';

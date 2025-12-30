import { memo, PropsWithChildren, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { AnimatedImage } from '@/components/basic/AnimatedImage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@shopify/restyle';

import type { MetaDetail } from '@/types/stremio';
import type { Theme } from '@/theme/theme';
import { Box, Text } from '@/theme/theme';
import { MediaDetailsHeader } from '@/components/media/MediaDetailsHeader';
import { MediaInfo } from '@/components/media/MediaInfo';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';
import { getDetailsCoverSource, getDetailsLogoSource } from '@/utils/media-artwork';
import FadeIn from '@/components/basic/FadeIn';

interface DetailsShellProps {
  media: MetaDetail;
  /** Use TV layout when running on a TV platform (Apple TV / Android TV). */
  forceTVLayout?: boolean;
  /** Rendered directly under the logo/title in the header area (TV and non-TV). */
  headerChildren?: ReactNode;
}

export const DetailsShell = memo(
  ({ media, forceTVLayout, headerChildren, children }: PropsWithChildren<DetailsShellProps>) => {
    const theme = useTheme<Theme>();
    const { isPlatformTV, width } = useResponsiveLayout();

    const useTVLayout = forceTVLayout ?? isPlatformTV;

    const coverSource = useMemo(
      () => getDetailsCoverSource(media.background, media.poster),
      [media.background, media.poster]
    );
    const logoSource = useMemo(() => getDetailsLogoSource(media.logo), [media.logo]);

    if (!useTVLayout) {
      return (
        <ScrollView>
          <MediaDetailsHeader media={media}>{headerChildren}</MediaDetailsHeader>

          <Box paddingHorizontal="l" gap="m">
            {children}
          </Box>
        </ScrollView>
      );
    }

    return (
      <Box flex={1}>
        <AnimatedImage
          source={coverSource}
          contentFit="cover"
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={[theme.colors.semiTransparentBackground, theme.colors.mainBackground]}
          style={StyleSheet.absoluteFillObject}
        />

        <ScrollView>
          <Box padding="xl" gap="l" position="relative">
            <Box alignItems="center" gap="m" paddingTop="xxl">
              {!!logoSource ? (
                <AnimatedImage
                  source={logoSource}
                  contentFit="contain"
                  style={{
                    width: Math.min(width - theme.spacing.xl * 2, theme.sizes.logoMaxWidth),
                    height: theme.sizes.logoHeight,
                  }}
                />
              ) : (
                <FadeIn>
                  <Text variant="header" textAlign="center">
                    {media.name}
                  </Text>
                </FadeIn>
              )}
            </Box>

            {headerChildren}

            <MediaInfo media={media} variant="full" layout="tvHeader" />
          </Box>

          <Box paddingHorizontal="l" paddingBottom="xl" gap="m">
            {children}
          </Box>
        </ScrollView>
      </Box>
    );
  }
);

DetailsShell.displayName = 'DetailsShell';

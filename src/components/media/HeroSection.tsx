import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useTheme } from '@shopify/restyle';
import { Box, Text, Theme } from '@/theme/theme';
import { useHeroCatalogContent } from '@/api/stremio/hooks';
import { useHomeStore } from '@/store/home.store';
import { useAddonStore } from '@/store/addon.store';
import { useHomeScroll } from '@/hooks/useHomeScroll';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { createDebugLogger } from '@/utils/debug';
import {
  HERO_AUTO_SCROLL_INTERVAL_MS,
  HERO_CROSSFADE_DURATION_MS,
  HERO_CONTENT_SLIDE_DURATION_MS,
  HERO_CONTENT_SLIDE_DELAY_MS,
  HERO_DOT_ANIMATION_MS,
  HERO_HEIGHT,
} from '@/constants/ui';
import { Button } from '@/components/basic/Button';

const debug = createDebugLogger('HeroSection');

interface HeroSectionProps {
  hasTVPreferredFocus?: boolean;
}

export const HeroSection = memo(({ hasTVPreferredFocus = false }: HeroSectionProps) => {
  const theme = useTheme<Theme>();
  const { pushToStreams, navigateToDetails } = useMediaNavigation();

  const [activeIndex, setActiveIndex] = useState(0);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get home settings from store
  const { heroItemCount, heroCatalogSources } = useHomeStore((state) => ({
    heroItemCount: state.getActiveSettings().heroItemCount,
    heroCatalogSources: state.getActiveSettings().heroCatalogSources,
  }));

  const addons = useAddonStore((state) => state.addons);

  // Scroll context for TV focus handling
  const { scrollToTop } = useHomeScroll();

  // Handle focus on any hero element - scroll to show full hero
  const handleHeroFocus = useCallback(
    (isFocused: boolean) => {
      if (isFocused) {
        scrollToTop();
      }
    },
    [scrollToTop]
  );

  // Build catalog sources with manifest URLs
  const catalogSources = useMemo(() => {
    const sources = heroCatalogSources
      .map((source) => {
        const addon = addons[source.addonId];
        if (!addon) {
          debug('catalogSourceMissingAddon', {
            addonId: source.addonId,
            catalogId: source.catalogId,
            catalogType: source.catalogType,
            availableAddons: Object.keys(addons),
          });
          return null;
        }
        return {
          manifestUrl: addon.manifestUrl,
          type: source.catalogType,
          catalogId: source.catalogId,
        };
      })
      .filter(Boolean) as { manifestUrl: string; type: string; catalogId: string }[];

    if (heroCatalogSources.length > 0 && sources.length === 0) {
      debug('allCatalogSourcesFiltered', {
        configuredSources: heroCatalogSources.length,
        availableAddons: Object.keys(addons).length,
      });
    }

    return sources;
  }, [heroCatalogSources, addons]);

  // Fetch hero content from catalogs
  const { data: heroItems, hasData } = useHeroCatalogContent(
    catalogSources,
    heroItemCount,
    catalogSources.length > 0
  );

  // Safe active index bound check
  const safeActiveIndex = hasData && heroItems.length > 0 ? activeIndex % heroItems.length : 0;
  // Cast to HeroMetaItem since catalog responses may include extra fields like genres
  const activeItem = heroItems[safeActiveIndex];

  // Reset active index when hero items change
  useEffect(() => {
    setActiveIndex(0);
  }, [heroItems.length]);

  // Auto-scroll effect
  useEffect(() => {
    if (!hasData || heroItems.length <= 1) return;

    autoScrollRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % heroItems.length);
    }, HERO_AUTO_SCROLL_INTERVAL_MS);

    return () => {
      if (autoScrollRef.current) {
        clearInterval(autoScrollRef.current);
      }
    };
  }, [hasData, heroItems.length]);

  // Reset auto-scroll when user interacts
  const resetAutoScroll = useCallback(() => {
    if (!hasData || heroItems.length <= 1) return;

    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
    }
    autoScrollRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % heroItems.length);
    }, HERO_AUTO_SCROLL_INTERVAL_MS);
  }, [hasData, heroItems.length]);

  const handlePlay = useCallback(() => {
    if (!activeItem) return;
    resetAutoScroll();
    pushToStreams({
      metaId: activeItem.id,
      videoId: activeItem.id,
      type: activeItem.type,
    });
  }, [activeItem, pushToStreams, resetAutoScroll]);

  const handleDetails = useCallback(() => {
    if (!activeItem) return;
    resetAutoScroll();
    navigateToDetails(activeItem.id, activeItem.type);
  }, [navigateToDetails, activeItem, resetAutoScroll]);

  // Extract genres (limit to 3)
  const genres = useMemo(() => {
    if (!activeItem?.genres) return [];
    return activeItem.genres.slice(0, 3);
  }, [activeItem?.genres]);

  // Get backdrop image
  const backdropImage = activeItem?.background ?? activeItem?.poster;

  // Don't render if no catalog sources configured or no data
  if (catalogSources.length === 0 || !hasData || !activeItem) {
    return null;
  }

  return (
    <Box height={HERO_HEIGHT} width="100%" overflow="hidden">
      {/* Background Image with Fade Animation */}
      <MotiView
        key={activeItem.id}
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: HERO_CROSSFADE_DURATION_MS }}
        style={StyleSheet.absoluteFill}>
        <Image source={{ uri: backdropImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
      </MotiView>

      {/* Gradient Overlay */}
      <LinearGradient
        colors={[
          'transparent',
          theme.colors.semiTransparentBackground,
          theme.colors.mainBackground,
        ]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      <Box style={StyleSheet.absoluteFill} justifyContent="flex-end" padding="m" paddingBottom="l">
        {/* Genres */}
        {genres.length > 0 && (
          <Box flexDirection="row" gap="s" marginBottom="s">
            {genres.map((genre) => (
              <Box
                key={genre}
                backgroundColor="semiTransparentBackground"
                paddingHorizontal="s"
                paddingVertical="xs"
                borderRadius="s">
                <Text variant="caption" color="textPrimary">
                  {genre}
                </Text>
              </Box>
            ))}
          </Box>
        )}

        {/* Title */}
        <MotiView
          key={`title-${activeItem.id}`}
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: HERO_CONTENT_SLIDE_DURATION_MS }}>
          <Text variant="header" numberOfLines={2} marginBottom="s">
            {activeItem.name}
          </Text>
        </MotiView>

        {/* Description */}
        {activeItem.description && (
          <MotiView
            key={`desc-${activeItem.id}`}
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{
              type: 'timing',
              duration: HERO_CONTENT_SLIDE_DURATION_MS,
              delay: HERO_CONTENT_SLIDE_DELAY_MS,
            }}>
            <Text variant="bodySmall" numberOfLines={3} marginBottom="m" style={{ maxWidth: 600 }}>
              {activeItem.description}
            </Text>
          </MotiView>
        )}

        {/* Buttons Row */}
        <Box flexDirection="row" gap="s" marginBottom="m">
          <Button
            variant="primary"
            icon="play"
            title="Play"
            onPress={handlePlay}
            hasTVPreferredFocus={hasTVPreferredFocus}
            onFocusChange={handleHeroFocus}
          />
          <Button
            variant="secondary"
            icon="information-circle-outline"
            title="Details"
            onPress={handleDetails}
            hasTVPreferredFocus={hasTVPreferredFocus}
            onFocusChange={handleHeroFocus}
          />
        </Box>

        {/* Pagination Dots - Centered */}
        <Box flexDirection="row" gap="s" alignItems="center" justifyContent="center">
          {heroItems.map((item, index) => (
            <MotiView
              key={item.id}
              animate={{
                width: index === safeActiveIndex ? 24 : 8,
                opacity: index === safeActiveIndex ? 1 : 0.5,
              }}
              transition={{ type: 'timing', duration: HERO_DOT_ANIMATION_MS }}>
              <Box
                height={8}
                borderRadius="full"
                backgroundColor={index === safeActiveIndex ? 'primaryBackground' : 'textSecondary'}
                style={{ width: '100%' }}
              />
            </MotiView>
          ))}
        </Box>
      </Box>
    </Box>
  );
});

HeroSection.displayName = 'HeroSection';

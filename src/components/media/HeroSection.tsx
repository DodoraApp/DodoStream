import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, TVFocusGuideView } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import FastImage, { Source } from '@d11/react-native-fast-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@shopify/restyle';
import { Box, Text, Theme } from '@/theme/theme';
import { Skeleton } from '@/components/basic/Skeleton';
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

  // ---- Dual-image crossfade: avoids destroying/recreating Image nodes ----
  // We alternate between two Image layers (A and B). On each transition,
  // the "front" layer fades in with the new image while the "back" layer
  // still shows the old image underneath.
  const [imageSourceA, setImageSourceA] = useState<Source | undefined>(undefined);
  const [imageSourceB, setImageSourceB] = useState<Source | undefined>(undefined);
  const activeLayerRef = useRef<'A' | 'B'>('A');
  const opacityA = useSharedValue(1);
  const opacityB = useSharedValue(0);

  const animatedStyleA = useAnimatedStyle(() => ({ opacity: opacityA.value }));
  const animatedStyleB = useAnimatedStyle(() => ({ opacity: opacityB.value }));

  // Prefetch the next hero image before transition
  useEffect(() => {
    if (!hasData || heroItems.length <= 1) return;
    const nextIndex = (safeActiveIndex + 1) % heroItems.length;
    const nextItem = heroItems[nextIndex];
    const nextImage = nextItem?.background ?? nextItem?.poster;
    if (nextImage) {
      FastImage.preload([{ uri: nextImage }]);
    }
  }, [safeActiveIndex, hasData, heroItems]);

  // Update the dual crossfade layers when the active item changes
  const updateCrossfade = useCallback(
    (newBackdropImage: string) => {
      const newSource: Source = { uri: newBackdropImage };

      if (activeLayerRef.current === 'A') {
        // Currently showing A, load new image into B and fade B in
        setImageSourceB(newSource);
        activeLayerRef.current = 'B';
        opacityB.value = withTiming(1, {
          duration: HERO_CROSSFADE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
        });
        opacityA.value = withTiming(0, {
          duration: HERO_CROSSFADE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
        });
      } else {
        // Currently showing B, load new image into A and fade A in
        setImageSourceA(newSource);
        activeLayerRef.current = 'A';
        opacityA.value = withTiming(1, {
          duration: HERO_CROSSFADE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
        });
        opacityB.value = withTiming(0, {
          duration: HERO_CROSSFADE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
        });
      }
    },
    [opacityA, opacityB]
  );

  useEffect(() => {
    if (!backdropImage) return;
    updateCrossfade(backdropImage);
  }, [backdropImage, updateCrossfade]);

  // No catalog sources configured — hero is disabled entirely
  if (catalogSources.length === 0) {
    return null;
  }

  // Sources configured but data not yet ready — hold the space so the list below
  // doesn't jump when hero content arrives
  if (!hasData || !activeItem) {
    return <Skeleton width="100%" height={theme.sizes.heroHeight} style={{ borderRadius: 0 }} />;
  }

  return (
    <TVFocusGuideView autoFocus trapFocusRight trapFocusUp>
      <Box height={theme.sizes.heroHeight} width="100%" overflow="hidden">
        {/* Dual-layer crossfade: two persistent Image nodes, opacity animated */}
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyleA]}>
          <FastImage
            source={imageSourceA}
            style={StyleSheet.absoluteFill}
            resizeMode={FastImage.resizeMode.cover}
          />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyleB]}>
          <FastImage
            source={imageSourceB}
            style={StyleSheet.absoluteFill}
            resizeMode={FastImage.resizeMode.cover}
          />
        </Animated.View>

        {/* Gradient Overlay */}
        <LinearGradient
          colors={[
            theme.colors.transparent,
            theme.colors.transparent,
            theme.colors.semiTransparentBackground,
            theme.colors.mainBackground,
          ]}
          locations={[0, 0.28, 0.68, 1]}
          style={StyleSheet.absoluteFill}
        />

        <LinearGradient
          colors={[
            theme.colors.transparent,
            theme.colors.overlayBackground,
            theme.colors.mainBackground,
          ]}
          locations={[0, 0.72, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Content */}
        <Box
          style={StyleSheet.absoluteFill}
          justifyContent="flex-end"
          padding="m"
          paddingBottom="l">
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
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: HERO_CONTENT_SLIDE_DURATION_MS }}>
            <Text variant="header" numberOfLines={2} marginBottom="s">
              {activeItem.name}
            </Text>
          </MotiView>

          {/* Description */}
          {activeItem.description && (
            <MotiView
              key={`desc-${activeItem.id}`}
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                type: 'timing',
                duration: HERO_CONTENT_SLIDE_DURATION_MS,
                delay: HERO_CONTENT_SLIDE_DELAY_MS,
              }}>
              <Text
                variant="bodySmall"
                numberOfLines={3}
                marginBottom="m"
                style={{ maxWidth: 600 }}>
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
              onFocusChange={handleHeroFocus}
            />
          </Box>

          {/* Pagination Dots - Centered */}
          <Box flexDirection="row" gap="s" alignItems="center" justifyContent="center">
            {heroItems.map((item, index) => (
              <Box
                key={item.id}
                style={{
                  width: index === safeActiveIndex ? theme.spacing.l : theme.spacing.s,
                  opacity: index === safeActiveIndex ? 1 : 0.45,
                }}>
                <Box
                  height={theme.spacing.xs + theme.spacing.xs / 2}
                  borderRadius="full"
                  backgroundColor={
                    index === safeActiveIndex ? 'primaryBackground' : 'textSecondary'
                  }
                  style={{ width: '100%' }}
                />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </TVFocusGuideView>
  );
});

HeroSection.displayName = 'HeroSection';

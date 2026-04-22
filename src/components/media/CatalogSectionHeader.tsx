import { memo, useCallback } from 'react';
import { Box, Text, Theme } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';
import { useTheme } from '@shopify/restyle';
import { TVFocusGuideView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import type { SyncProviderBadge } from '@/hooks/useSyncProviderBadges';

import { SyncBadge } from '@/components/basic/SyncBadge';

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  movie: 'film-outline',
  series: 'tv-outline',
  anime: 'sparkles-outline',
};

export interface CatalogSectionHeaderProps {
  title: string;
  type?: string;
  /** Explicit icon to display - takes priority over type-derived icon */
  icon?: keyof typeof Ionicons.glyphMap;
  onFocused?: () => void;
  /** Generic link destination - takes priority over catalogData */
  linkTo?: Href;
  /** Catalog navigation data - if provided, header becomes pressable */
  catalogData?: {
    manifestUrl: string;
    catalogType: string;
    catalogId: string;
  };
  syncBadges?: SyncProviderBadge[];
}

export const CatalogSectionHeader = memo(
  ({ title, type, icon, onFocused, linkTo, catalogData, syncBadges }: CatalogSectionHeaderProps) => {
    const theme = useTheme<Theme>();
    const router = useRouter();

    const isNavigable = !!linkTo || !!catalogData;

    const handlePress = useCallback(() => {
      if (linkTo) {
        router.push(linkTo);
      } else if (catalogData) {
        router.push({
          pathname: '/catalog',
          params: {
            manifestUrl: catalogData.manifestUrl,
            catalogType: catalogData.catalogType,
            catalogId: catalogData.catalogId,
            catalogName: title,
          },
        });
      }
    }, [linkTo, catalogData, router, title]);

    return (
      <TVFocusGuideView trapFocusRight>
        <Focusable
          onFocus={onFocused}
          onPress={isNavigable ? handlePress : undefined}
          variant="none"
          style={{
            paddingHorizontal: theme.spacing.m,
          }}>
          {({ isFocused }) => {
            return (
              <Box
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                marginTop="m"
                marginBottom="m">
                <Box
                  flexDirection="row"
                  alignItems="center"
                  gap="l"
                  paddingLeft="m"
                  style={{
                    borderLeftWidth: theme.focus.borderWidthSmall,
                    borderLeftColor: isFocused
                      ? theme.colors.primaryBackground
                      : theme.colors.transparent,
                  }}>
                  {(icon || (type && TYPE_ICONS[type])) && (
                    <Ionicons
                      name={icon ?? TYPE_ICONS[type!]}
                      size={theme.sizes.iconLarge}
                      color={
                        isFocused ? theme.colors.primaryBackground : theme.colors.textSecondary
                      }
                    />
                  )}
                  <Text variant="subheader">{title}</Text>
                </Box>
                <Box flexDirection="row" alignItems="center" gap="s">
                  {syncBadges && syncBadges.length > 0 && (
                    <Box flexDirection="row" gap="s">
                      {syncBadges.map((badge) => (
                        <SyncBadge key={badge.key} status={badge.status} provider={badge.key} />
                      ))}
                    </Box>
                  )}
                  {isNavigable && (
                    <Ionicons
                      name="chevron-forward"
                      size={theme.sizes.iconMedium}
                      color={isFocused ? theme.colors.primaryBackground : theme.colors.textSecondary}
                    />
                  )}
                </Box>
              </Box>
            );
          }}
        </Focusable>
      </TVFocusGuideView>
    );
  }
);

CatalogSectionHeader.displayName = 'CatalogSectionHeader';

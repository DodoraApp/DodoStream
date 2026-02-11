import { memo, useCallback } from 'react';
import { Box, Text, Theme } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';
import { useTheme } from '@shopify/restyle';
import { TVFocusGuideView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { MotiView } from 'moti';

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  movie: 'film-outline',
  series: 'tv-outline',
  anime: 'sparkles-outline',
};

export interface CatalogSectionHeaderProps {
  title: string;
  type?: string;
  onFocused?: () => void;
  /** Generic link destination - takes priority over catalogData */
  linkTo?: Href;
  /** Catalog navigation data - if provided, header becomes pressable */
  catalogData?: {
    manifestUrl: string;
    catalogType: string;
    catalogId: string;
  };
}

export const CatalogSectionHeader = memo(
  ({ title, type, onFocused, linkTo, catalogData }: CatalogSectionHeaderProps) => {
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
            marginHorizontal: theme.spacing.m,
            paddingHorizontal: theme.spacing.m,
          }}>
          {({ isFocused }) => (
            <MotiView animate={{ scale: isFocused ? theme.focus.scaleSmall : 1 }}>
              <Box
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                marginTop="m"
                marginBottom={type ? 's' : 'm'}>
                <Box flexDirection="row" alignItems="center" gap="m">
                  {type && TYPE_ICONS[type] && (
                    <Ionicons
                      name={TYPE_ICONS[type]}
                      size={theme.sizes.iconLarge}
                      color={
                        isFocused ? theme.colors.primaryBackground : theme.colors.textSecondary
                      }
                    />
                  )}
                  <Box>
                    <Text variant="subheader">{title}</Text>
                    {type && (
                      <Text variant="caption" color="textSecondary" textTransform="capitalize">
                        {type}
                      </Text>
                    )}
                  </Box>
                </Box>
                {isNavigable && (
                  <Ionicons
                    name="chevron-forward"
                    size={theme.sizes.iconMedium}
                    color={isFocused ? theme.colors.primaryBackground : theme.colors.textSecondary}
                  />
                )}
              </Box>
            </MotiView>
          )}
        </Focusable>
      </TVFocusGuideView>
    );
  }
);

CatalogSectionHeader.displayName = 'CatalogSectionHeader';

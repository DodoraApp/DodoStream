import { FC, memo } from 'react';
import { ScrollView } from 'react-native';
import { Box, Text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { Focusable } from '@/components/basic/Focusable';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import { router } from 'expo-router';
import { getFocusableBackgroundColor } from '@/utils/focus-colors';

export interface SettingsMenuItem {
  id: string;
  title: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Navigation href for navigation mode */
  href?: string;
}

interface SettingsMenuProps {
  items: SettingsMenuItem[];
  selectedId: string;
  onSelect?: (id: string) => void;
  /** When true, items navigate to their href instead of calling onSelect */
  navigationMode?: boolean;
}

/**
 * Settings menu component for the left panel in split layout
 * Supports both selection mode (for split layout) and navigation mode (for mobile)
 */
export const SettingsMenu: FC<SettingsMenuProps> = memo(
  ({ items, selectedId, onSelect, navigationMode = false }) => {
    const handlePress = (item: SettingsMenuItem) => {
      if (navigationMode && item.href) {
        router.push(item.href as Parameters<typeof router.push>[0]);
      } else if (onSelect) {
        onSelect(item.id);
      }
    };

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <Box gap="s" padding="s">
          {items.map((item) => (
            <SettingsMenuItemInner
              key={item.id}
              item={item}
              isSelected={item.id === selectedId}
              onPress={() => handlePress(item)}
              hasTVPreferredFocus={item.id === selectedId}
            />
          ))}
        </Box>
      </ScrollView>
    );
  }
);

interface SettingsMenuItemInnerProps {
  item: SettingsMenuItem;
  isSelected: boolean;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
}

const SettingsMenuItemInner: FC<SettingsMenuItemInnerProps> = memo(
  ({ item, isSelected, onPress, hasTVPreferredFocus = false }) => {
    const theme = useTheme<Theme>();

    return (
      <Focusable onPress={onPress} hasTVPreferredFocus={hasTVPreferredFocus}>
        {({ isFocused }) => (
          <Box
            backgroundColor={getFocusableBackgroundColor({ isFocused })}
            borderRadius="m"
            padding="s"
            flexDirection="row"
            alignItems="center"
            gap="m">
            <Box
              backgroundColor={isSelected ? 'primaryBackground' : undefined}
              borderRadius="m"
              width={40}
              height={40}
              justifyContent="center"
              alignItems="center">
              <Ionicons name={item.icon} size={20} color={theme.colors.primaryForeground} />
            </Box>
            <Box flex={1} gap="xs">
              <Text variant="cardTitle" color="textPrimary">
                {item.title}
              </Text>
              {item.description && (
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {item.description}
                </Text>
              )}
            </Box>
          </Box>
        )}
      </Focusable>
    );
  }
);

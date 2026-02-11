import { FC, memo, useCallback, useEffect, useRef } from 'react';
import { ScrollView, View, findNodeHandle } from 'react-native';
import { Box, Text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { Focusable } from '@/components/basic/Focusable';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import { router } from 'expo-router';
import { useSidebarFocusStore } from '@/store/sidebar-focus.store';

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
  /** When false, renders only the list items without an outer ScrollView */
  scrollable?: boolean;
}

/**
 * Settings menu component for the left panel in split layout
 * Supports both selection mode (for split layout) and navigation mode (for mobile)
 */
export const SettingsMenu: FC<SettingsMenuProps> = memo(
  ({ items, selectedId, onSelect, navigationMode = false, scrollable = true }) => {
    const handlePress = (item: SettingsMenuItem) => {
      if (navigationMode && item.href) {
        router.push(item.href as Parameters<typeof router.push>[0]);
      } else if (onSelect) {
        onSelect(item.id);
      }
    };

    const content = (
      <Box gap="s">
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
    );

    if (!scrollable) {
      return content;
    }

    return <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>;
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
    const setSelectedSettingsMenuNodeHandle = useSidebarFocusStore(
      (state) => state.setSelectedSettingsMenuNodeHandle
    );

    const iconContainerSize = theme.sizes.loadingIndicatorSizeSmall;
    const iconSize = theme.spacing.l;

    // Store the node handle in a ref so it's available when selection changes
    const nodeHandleRef = useRef<number | null>(null);

    // Capture node handle immediately when ref is set
    const handleRef = useCallback((ref: View | null) => {
      if (ref) {
        nodeHandleRef.current = findNodeHandle(ref);
      }
    }, []);

    // Update the store when this item becomes selected
    useEffect(() => {
      if (isSelected && nodeHandleRef.current) {
        setSelectedSettingsMenuNodeHandle(nodeHandleRef.current);
      }
    }, [isSelected, setSelectedSettingsMenuNodeHandle]);

    return (
      <Focusable onPress={onPress} hasTVPreferredFocus={hasTVPreferredFocus} onRef={handleRef}>
        <Box borderRadius="m" padding="s" flexDirection="row" alignItems="center" gap="m">
          <Box
            backgroundColor={isSelected ? 'primaryBackground' : undefined}
            borderRadius="m"
            width={iconContainerSize}
            height={iconContainerSize}
            justifyContent="center"
            alignItems="center">
            <Ionicons name={item.icon} size={iconSize} color={theme.colors.primaryForeground} />
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
      </Focusable>
    );
  }
);

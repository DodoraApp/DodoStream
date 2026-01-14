import { FC, useCallback, useMemo } from 'react';
import { TVFocusGuideView } from 'react-native';
import theme, { Box, Text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { NAV_ITEMS, NavItem } from '@/constants/navigation';
import { Focusable } from '@/components/basic/Focusable';
import { AppLogo } from '@/components/basic/AppLogo';

interface TVSidebarProps {
  onItemFocus?: () => void;
}

export const TVSidebar: FC<TVSidebarProps> = ({ onItemFocus }) => {
  const router = useRouter();

  const handlePress = useCallback(
    (route: string) => {
      router.push(route as any);
    },
    [router]
  );

  // TODO https://dev.to/amazonappdev/5-ways-of-managing-focus-in-react-native-3kfd
  return (
    <TVFocusGuideView
      trapFocusUp
      trapFocusDown
      trapFocusLeft
      style={[
        {
          height: '100%',
          backgroundColor: theme.colors.cardBackground,
          borderRightWidth: 1,
          borderRightColor: theme.colors.cardBorder,
        },
      ]}>
      <Box flex={1} paddingVertical="s" gap="l">
        <Box alignItems="center">
          <AppLogo size={theme.sizes.stickyLogoHeight} />
        </Box>
        <Box flex={1} gap="m" justifyContent="space-between">
          <Box gap="s">
            {NAV_ITEMS.filter((i) => i.location === 'top').map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                onPress={() => handlePress(item.route)}
                onFocus={onItemFocus}
              />
            ))}
          </Box>
          <Box gap="s">
            {NAV_ITEMS.filter((i) => i.location === 'bottom').map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                onPress={() => handlePress(item.route)}
                onFocus={onItemFocus}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </TVFocusGuideView>
  );
};

interface SidebarItemProps {
  item: NavItem;
  onPress: () => void;
  onFocus?: () => void;
}

const SidebarItem: FC<SidebarItemProps> = ({ item, onPress, onFocus }) => {
  const pathname = usePathname();

  const isActive = useMemo(() => {
    if (item.route === '/') {
      return pathname === '/' || pathname === '/index';
    }
    return pathname.startsWith(item.route);
  }, [pathname, item.route]);

  return (
    <Focusable onPress={onPress} onFocusChange={(isFocused) => isFocused && onFocus?.()}>
      {({ isFocused }) => {
        const iconColor = isActive
          ? theme.colors.primaryBackground
          : isFocused
            ? theme.colors.textPrimary
            : theme.colors.textSecondary;

        const textColor = isActive
          ? theme.colors.primaryBackground
          : isFocused
            ? theme.colors.textPrimary
            : theme.colors.textSecondary;

        return (
          <Box flexDirection="row" alignItems="center" gap="m" padding="m">
            <Box width={32} alignItems="center" gap="xs">
              <Ionicons name={item.icon} size={28} color={iconColor} />
              {/* Focus indicator - rounded underline */}
              <Box
                width={24}
                height={4}
                borderRadius="full"
                backgroundColor={isFocused ? 'primaryBackground' : 'transparent'}
              />
            </Box>
            <Text
              variant="body"
              style={{ display: 'none', color: textColor }}
              fontFamily={theme.fonts.poppinsSemiBold}>
              {item.label}
            </Text>
          </Box>
        );
      }}
    </Focusable>
  );
};

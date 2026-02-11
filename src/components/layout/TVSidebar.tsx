import { FC, useCallback, useEffect, useMemo, useRef } from 'react';
import { TVFocusGuideView, View, findNodeHandle } from 'react-native';
import { useTheme } from '@shopify/restyle';
import { Box, Text, type Theme } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { NAV_ITEMS, NavItem } from '@/constants/navigation';
import { Focusable } from '@/components/basic/Focusable';
import { AppLogo } from '@/components/basic/AppLogo';
import { useProfileStore } from '@/store/profile.store';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { useSidebarFocusStore } from '@/store/sidebar-focus.store';

interface TVSidebarProps {
  onItemFocus?: () => void;
}

export const TVSidebar: FC<TVSidebarProps> = ({ onItemFocus }) => {
  const theme = useTheme<Theme>();
  const router = useRouter();

  const handlePress = useCallback(
    (route: string) => {
      router.push(route as any);
    },
    [router]
  );

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

        {/* Profile Switcher */}
        <SidebarProfileSwitcher />

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

/** Compact profile switcher button for the sidebar */
const SidebarProfileSwitcher: FC = () => {
  const theme = useTheme<Theme>();
  const profiles = useProfileStore((state) => state.profiles);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const clearActiveProfile = useProfileStore((state) => state.clearActiveProfile);

  const activeProfile = useMemo(() => {
    if (!activeProfileId) return undefined;
    return profiles[activeProfileId];
  }, [activeProfileId, profiles]);

  const canSwitch = useMemo(() => Object.keys(profiles).length > 1, [profiles]);

  const handleSwitchProfile = useCallback(() => {
    clearActiveProfile();
    // No need to navigate - AppLayout will automatically show ProfileSelector
  }, [clearActiveProfile]);

  if (!activeProfile || !canSwitch) {
    return null;
  }

  return (
    <Box alignItems="center">
      <Focusable
        onPress={handleSwitchProfile}
        disabled={!canSwitch}
        variant="outline"
        focusedStyle={{
          borderRadius: theme.borderRadii.full,
        }}>
        <ProfileAvatar
          icon={activeProfile.avatarIcon}
          color={activeProfile.avatarColor}
          size="small"
        />
      </Focusable>
    </Box>
  );
};

interface SidebarItemProps {
  item: NavItem;
  onPress: () => void;
  onFocus?: () => void;
  onActiveRef?: (ref: View | null) => void;
}

const SidebarItem: FC<SidebarItemProps> = ({ item, onPress, onFocus, onActiveRef }) => {
  const theme = useTheme<Theme>();
  const pathname = usePathname();
  const nodeHandleRef = useRef<number>(null);
  const setActiveSidebarNodeHandle = useSidebarFocusStore(
    (state) => state.setActiveSidebarNodeHandle
  );

  const isActive = useMemo(() => {
    if (item.route === '/') {
      return pathname === '/' || pathname === '/index';
    }
    return pathname.startsWith(item.route);
  }, [pathname, item.route]);

  useEffect(() => {
    if (isActive && nodeHandleRef.current) {
      setActiveSidebarNodeHandle(nodeHandleRef.current);
    }
  }, [isActive, item.route, setActiveSidebarNodeHandle]);

  // When this item becomes active, register its node handle
  const handleRef = useCallback((ref: View | null) => {
    if (ref) {
      const handle = findNodeHandle(ref);
      nodeHandleRef.current = handle;
    }
  }, []);

  return (
    <Focusable
      onPress={onPress}
      onFocusChange={(isFocused) => isFocused && onFocus?.()}
      onRef={handleRef}>
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
            <Box width={theme.sizes.iconMedium} alignItems="center" gap="xs">
              <Ionicons name={item.icon} size={theme.sizes.iconMedium} color={iconColor} />
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

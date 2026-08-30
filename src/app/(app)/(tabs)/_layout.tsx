import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import { Tabs } from 'expo-router';

import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { NAV_ITEMS } from '@/constants/navigation';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { Theme } from '@/theme/theme';

export default function TabsLayout() {
  const { t } = useTranslation('navigation');
  const theme = useTheme<Theme>();
  const { bottom } = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const breakpoint = useBreakpoint();
  const isLandscape = width > height;

  // Landscape screens use the sidebar, so the phone tab bar is portrait-only.
  const showTabs = breakpoint === 'mobile' && !isLandscape;

  return (
    <ResponsiveLayout>
      <Tabs
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          tabBarStyle: showTabs
            ? {
                backgroundColor: theme.colors.cardBackground,
                borderTopColor: theme.colors.cardBorder,
                borderTopWidth: 1,
                paddingBottom: bottom + theme.sizes.tabBarPadding,
                paddingTop: theme.sizes.tabBarPadding,
                height: theme.sizes.tabBarHeight + bottom + theme.sizes.tabBarPadding * 2,
              }
            : {
                display: 'none',
              },
          tabBarActiveTintColor: theme.colors.primaryBackground,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarLabelStyle: {
            fontFamily: theme.fonts.poppinsSemiBold,
            fontSize: theme.sizes.tabBarLabelSize,
          },
        }}>
        {NAV_ITEMS.map((item) => (
          <Tabs.Screen
            key={item.id}
            name={item.screenName}
            options={{
              title: t(item.id),
              tabBarButtonTestID: `nav-${item.id}`,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name={item.icon} size={size} color={color} />
              ),
            }}
          />
        ))}
      </Tabs>
    </ResponsiveLayout>
  );
}

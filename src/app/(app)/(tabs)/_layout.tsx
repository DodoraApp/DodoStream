import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { NAV_ITEMS } from '@/constants/navigation';

export default function TabsLayout() {
  const { t } = useTranslation('navigation');
  const theme = useTheme<Theme>();
  const { bottom } = useSafeAreaInsets();
  const breakpoint = useBreakpoint();

  // Hide tabs on tablet/TV since we have sidebar
  const showTabs = breakpoint === 'mobile';

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
                display: 'none', // Hide tabs on tablet/TV
              },
          tabBarActiveTintColor: theme.colors.primaryBackground,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarLabelStyle: {
            fontFamily: theme.fonts.poppinsSemiBold,
            fontSize: 12,
          },
        }}>
        {NAV_ITEMS.map((item) => (
          <Tabs.Screen
            key={item.id}
            name={item.screenName}
            options={{
              title: t(item.id),
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

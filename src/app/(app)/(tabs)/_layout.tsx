import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import theme, { Box } from '@/theme/theme';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { NAV_ITEMS } from '@/constants/navigation';
import { useWindowDimensions } from 'react-native';

export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets();
  const breakpoint = useBreakpoint();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Hide tabs on tablet/TV since we have sidebar,
  // and collapse to a compact style on phones in landscape to save vertical space
  const showTabs = breakpoint === 'mobile';
  const compactTabs = showTabs && isLandscape;

  return (
    <ResponsiveLayout>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: showTabs
            ? {
                backgroundColor: theme.colors.cardBackground,
                borderTopColor: theme.colors.cardBorder,
                borderTopWidth: 1,
                paddingBottom: compactTabs ? 2 : bottom,
                paddingTop: compactTabs ? 4 : 10,
                height: compactTabs ? 46 : 65 + bottom,
              }
            : {
                display: 'none', // Hide tabs on tablet/TV
              },
          tabBarActiveTintColor: theme.colors.primaryBackground,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarLabelStyle: {
            fontFamily: theme.fonts.poppinsSemiBold,
            fontSize: compactTabs ? 10 : 12,
          },
          tabBarIconStyle: compactTabs ? { marginBottom: -2 } : undefined,
        }}>
        {NAV_ITEMS.map((item) => (
          <Tabs.Screen
            key={item.id}
            name={item.screenName}
            options={{
              title: item.label,
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

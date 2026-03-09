import { memo, useCallback } from 'react';
import { ScrollView } from 'react-native';
import { Box } from '@/theme/theme';
import { Tag } from '@/components/basic/Tag';

export interface DetailsTab {
  key: string;
  label: string;
}

interface DetailsTabBarProps {
  tabs: DetailsTab[];
  activeTab: string;
  onTabPress: (key: string) => void;
}

export const DetailsTabBar = memo(({ tabs, activeTab, onTabPress }: DetailsTabBarProps) => {
  const renderTab = useCallback(
    (tab: DetailsTab) => (
      <Tag
        key={tab.key}
        label={tab.label}
        size="large"
        colorScheme="secondary"
        focusable
        selected={activeTab === tab.key}
        onPress={() => onTabPress(tab.key)}
      />
    ),
    [activeTab, onTabPress]
  );

  if (tabs.length <= 1) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Box flexDirection="row" gap="s">
        {tabs.map(renderTab)}
      </Box>
    </ScrollView>
  );
});

DetailsTabBar.displayName = 'DetailsTabBar';

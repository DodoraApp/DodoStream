import { useTheme } from '@shopify/restyle';
import { Box, Text, type Theme } from '@/theme/theme';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';

import { ReactNode } from 'react';

interface TabHeaderProps {
  title?: string;
  rightElement?: ReactNode;
}

export const TabHeader = ({ title, rightElement }: TabHeaderProps) => {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const theme = useTheme<Theme>();

  return (
    <Box flexDirection="row" alignItems="center" gap="m" marginBottom="m" marginTop="m">
      <TouchableOpacity onPress={() => navigation.openDrawer()}>
        <Ionicons name="menu" size={theme.sizes.iconLarge} color={theme.colors.mainForeground} />
      </TouchableOpacity>
      <>
        {!!title && <Text variant="header">{title}</Text>}
        {!!rightElement && <Box flex={1}>{rightElement}</Box>}
      </>
    </Box>
  );
};

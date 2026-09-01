import Ionicons, { IoniconsIconName } from '@react-native-vector-icons/ionicons/static';
import { useTheme } from '@shopify/restyle';
import { useRouter } from 'expo-router';

import { Focusable } from '@/components/basic/Focusable';
import { Box, Text, type Theme } from '@/theme/theme';
import { getFocusableBackgroundColor } from '@/utils/focus-colors';

interface SettingsLinkProps {
  title: string;
  description?: string;
  icon: IoniconsIconName;
  href: string;
  testID?: string;
}

export function SettingsLink({ title, description, icon, href, testID }: SettingsLinkProps) {
  const router = useRouter();
  const theme = useTheme<Theme>();

  const iconContainerSize = theme.sizes.loadingIndicatorSizeSmall;
  const iconSize = theme.spacing.l;

  return (
    <Focusable onPress={() => router.push(href as any)} testID={testID}>
      {({ isFocused }) => (
        <Box
          backgroundColor={getFocusableBackgroundColor({ isFocused })}
          borderRadius="m"
          padding="m"
          flexDirection="row"
          alignItems="center"
          gap="m">
          <Box
            backgroundColor="primaryBackground"
            borderRadius="s"
            width={iconContainerSize}
            height={iconContainerSize}
            justifyContent="center"
            alignItems="center">
            <Ionicons name={icon} size={iconSize} color={theme.colors.primaryForeground} />
          </Box>
          <Box flex={1} gap="xs">
            <Text variant="cardTitle">{title}</Text>
            {description && (
              <Text variant="caption" color="textSecondary">
                {description}
              </Text>
            )}
          </Box>
          <Ionicons name="chevron-forward" size={iconSize} color={theme.colors.textSecondary} />
        </Box>
      )}
    </Focusable>
  );
}

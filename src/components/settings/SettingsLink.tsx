import theme, { Box, Text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Focusable } from '@/components/basic/Focusable';
import { getFocusableBackgroundColor } from '@/utils/focus-colors';

interface SettingsLinkProps {
  title: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
}

export function SettingsLink({ title, description, icon, href }: SettingsLinkProps) {
  const router = useRouter();

  return (
    <Focusable onPress={() => router.push(href as any)}>
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
            width={48}
            height={48}
            justifyContent="center"
            alignItems="center">
            <Ionicons name={icon} size={24} color={theme.colors.primaryForeground} />
          </Box>
          <Box flex={1} gap="xs">
            <Text variant="cardTitle">{title}</Text>
            {description && (
              <Text variant="caption" color="textSecondary">
                {description}
              </Text>
            )}
          </Box>
          <Ionicons name="chevron-forward" size={24} color={theme.colors.textSecondary} />
        </Box>
      )}
    </Focusable>
  );
}

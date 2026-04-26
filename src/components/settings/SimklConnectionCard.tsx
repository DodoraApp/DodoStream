import { FC, memo, useCallback } from 'react';
import { Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import FastImage from '@d11/react-native-fast-image';
import { useTheme } from '@shopify/restyle';
import { Box, Text, type Theme } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import type { ProfileIntegrationSettings } from '@/types/integrations';

interface SimklConnectionCardProps {
  settings?: ProfileIntegrationSettings['simkl'];
  onConnect: () => void;
  onDisconnect: () => void;
}

export const SimklConnectionCard: FC<SimklConnectionCardProps> = memo(
  ({ settings, onConnect, onDisconnect }) => {
    const { t } = useTranslation('settings');
    const theme = useTheme<Theme>();
    const isConnected = !!settings?.connection;

    const handleSimklLink = useCallback(() => {
      Linking.openURL('https://simkl.com/');
    }, []);

    return (
      <SettingsCard title="Simkl">
        <Focusable onPress={handleSimklLink} variant="background">
          <Box
            borderRadius="m"
            paddingHorizontal="m"
            paddingVertical="s"
            flexDirection="row"
            alignItems="center"
            gap="s">
            <FastImage
              source={require('../../../assets/simkl-logo.png')}
              style={{ height: theme.sizes.iconLarge, width: theme.sizes.iconLarge }}
              resizeMode={FastImage.resizeMode.contain}
            />
            <Text variant="caption" color="textSecondary">
              {t('simkl.desc')}
            </Text>
          </Box>
        </Focusable>

        {isConnected ? (
          <>
            <SettingsRow label={t('simkl.connected_as')}>
              <Text variant="body" color="textSecondary">
                {settings!.connection!.username}
              </Text>
            </SettingsRow>

            <Focusable onPress={onDisconnect} variant="background">
              <Box borderRadius="m" padding="m" flexDirection="row" alignItems="center" gap="m">
                <Ionicons
                  name="log-out-outline"
                  size={theme.sizes.iconMedium}
                  color={theme.colors.textSecondary}
                />
                <Text variant="body" color="textSecondary">
                  {t('simkl.disconnect')}
                </Text>
              </Box>
            </Focusable>
          </>
        ) : (
          <Focusable onPress={onConnect} variant="background">
            <Box borderRadius="m" padding="m" flexDirection="row" alignItems="center" gap="m">
              <Ionicons
                name="link-outline"
                size={theme.sizes.iconMedium}
                color={theme.colors.textSecondary}
              />
              <Text variant="body">{t('simkl.connect')}</Text>
            </Box>
          </Focusable>
        )}
      </SettingsCard>
    );
  }
);

SimklConnectionCard.displayName = 'SimklConnectionCard';

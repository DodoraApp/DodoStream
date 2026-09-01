import React, { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { useTheme } from '@shopify/restyle';
import { Asset } from 'expo-asset';
import { Image } from 'expo-image';

import { Button } from '@/components/basic/Button';
import { MarkdownText } from '@/components/basic/MarkdownText';
import { Modal } from '@/components/basic/Modal';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';
import { WHATS_NEW_IMAGE_HEIGHT_FACTOR, WHATS_NEW_MODAL_HEIGHT_FACTOR } from '@/constants/ui';
import { useWhatsNew } from '@/hooks/useWhatsNew';
import { Box, Text, Theme } from '@/theme/theme';

/**
 * Modal to display What's New entries to users.
 *
 * Features:
 * - Shows markdown content with images
 * - Pagination through multiple entries
 * - Toggle to control showing on startup
 * - Persists cursor to avoid showing seen entries again
 */
export const WhatsNewModal: FC = () => {
  const { t } = useTranslation('settings');
  const theme = useTheme<Theme>();
  const { height: windowHeight } = useWindowDimensions();
  const [imageWidth, setImageWidth] = useState(0);

  const handleImageLayout = useCallback((event: LayoutChangeEvent) => {
    setImageWidth(event.nativeEvent.layout.width);
  }, []);

  const {
    isVisible,
    unseenEntries,
    currentIndex,
    currentEntry,
    showOnStartup,
    setShowOnStartup,
    goNext,
    dismiss,
  } = useWhatsNew();

  // Determine button state
  const isLastEntry = currentIndex >= unseenEntries.length - 1;
  const buttonTitle = isLastEntry ? t('ui.whats_new_dismiss') : t('ui.whats_new_next');
  const handleButtonPress = isLastEntry ? dismiss : goNext;

  // Calculate max image dimensions based on screen size (use smaller of width/height for square-ish constraint)
  const modalContentHeight = windowHeight * WHATS_NEW_MODAL_HEIGHT_FACTOR;
  const maxImageHeight = modalContentHeight * WHATS_NEW_IMAGE_HEIGHT_FACTOR;

  if (!isVisible || !currentEntry) {
    return null;
  }

  // Size the entry image from its intrinsic aspect ratio: RN's Image injects a
  // require()'d asset's pixel size into the style (making the frame hugely
  // tall), so use expo-image and derive the height from the measured width
  // instead, capped at maxImageHeight.
  const imageAsset = currentEntry.image ? Asset.fromModule(currentEntry.image) : null;
  const imageAspectRatio =
    imageAsset && (imageAsset.width ?? 0) > 0 && (imageAsset.height ?? 0) > 0
      ? (imageAsset.width ?? 0) / (imageAsset.height ?? 0)
      : null;
  const imageHeight =
    imageWidth > 0 && imageAspectRatio !== null
      ? Math.min(imageWidth / imageAspectRatio, maxImageHeight)
      : undefined;

  return (
    <Modal visible={isVisible} onClose={dismiss} label={t('ui.whats_new_heading')} wide>
      <Box flex={1} gap="s">
        {/* Entry header: title, page counter, and version badge */}
        <Box paddingHorizontal="m" gap="m" flexDirection="row" alignItems="center">
          <Text variant="subheader" numberOfLines={2}>
            {currentEntry.title}
          </Text>
          <Box
            borderWidth={1}
            borderColor="cardBorder"
            borderRadius="s"
            paddingHorizontal="s"
            paddingVertical="xs">
            <Text variant="caption" color="textSecondary">
              {currentEntry.version}
            </Text>
          </Box>
        </Box>

        <ScrollView
          key={currentEntry.id}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.m,
            paddingBottom: theme.spacing.m,
          }}
          showsVerticalScrollIndicator>
          {currentEntry.image && (
            <Image
              source={currentEntry.image}
              contentFit="contain"
              onLayout={handleImageLayout}
              style={{
                width: '100%',
                height: imageHeight,
                borderRadius: theme.borderRadii.l,
              }}
            />
          )}
          <MarkdownText content={currentEntry.body} />
        </ScrollView>

        {/* Footer: startup toggle + primary action */}
        <Box
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          paddingTop="m"
          paddingHorizontal="m"
          borderTopWidth={1}
          borderTopColor="cardBorder">
          <SettingsSwitch
            label={t('ui.whats_new_on_startup')}
            value={showOnStartup}
            onValueChange={setShowOnStartup}
            flex={false}
          />

          <Box flexDirection="row" gap="m" alignItems="center">
            {unseenEntries.length > 1 && (
              <Text variant="caption" color="textSecondary">
                {t('ui.whats_new_page', {
                  current: currentIndex + 1,
                  total: unseenEntries.length,
                })}
              </Text>
            )}
            <Button
              variant="primary"
              title={buttonTitle}
              onPress={handleButtonPress}
              hasTVPreferredFocus
              testID="whats-new-primary-action"
            />
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

WhatsNewModal.displayName = 'WhatsNewModal';

import React, { FC, memo, useCallback, useMemo, useState } from 'react';
import { Platform, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useTheme } from '@shopify/restyle';
import { Ionicons } from '@expo/vector-icons';
import theme, { Box, Text } from '@/theme/theme';
import type { Theme } from '@/theme/theme';
import { ColorPicker } from '@/components/basic/ColorPicker';
import { SliderInput } from '@/components/basic/SliderInput';
import { PickerModal, PickerItem } from '@/components/basic/PickerModal';
import { useProfileStore } from '@/store/profile.store';
import { useProfileSettingsStore } from '@/store/profile-settings.store';
import {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_COMMON_COLORS,
  SUBTITLE_FONT_FAMILIES,
  SUBTITLE_FONT_SIZE_MAX,
  SUBTITLE_FONT_SIZE_MIN,
  SUBTITLE_FONT_SIZE_STEP,
  SUBTITLE_POSITION_MIN,
  SUBTITLE_POSITION_MAX,
  SUBTITLE_POSITION_STEP,
  SUBTITLE_MAX_LINES,
} from '@/constants/subtitles';
import type { SubtitleStyle, SubtitleFontFamily } from '@/types/subtitles';
import { computeSubtitleStyle } from '@/utils/subtitle-style';

const PREVIEW_ASPECT_RATIO = 16 / 9;
const PREVIEW_SAMPLE_TEXT = 'Sample subtitle text\nSecond line of dialogue';

interface SubtitlePreviewProps {
  style: SubtitleStyle;
  containerWidth: number;
}

/**
 * Get the platform-specific font family for the given subtitle font family.
 */
const getFontFamily = (family: SubtitleFontFamily): string | undefined => {
  switch (family) {
    case 'System':
      return undefined;
    case 'Serif':
      return Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
    case 'Monospace':
      return Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
    default:
      return family;
  }
};

/**
 * Renders a 16:9 preview of subtitles with the current style settings.
 * The preview scales relative to the container width to simulate real playback.
 * Background includes varied brightness areas to test subtitle readability.
 */
const SubtitlePreview = memo<SubtitlePreviewProps>(({ style, containerWidth }) => {
  const previewWidth = containerWidth;
  const previewHeight = previewWidth / PREVIEW_ASPECT_RATIO;

  const computed = useMemo(
    () => computeSubtitleStyle(style, previewHeight),
    [
      previewHeight,
      style.fontFamily,
      style.fontSize,
      style.fontColor,
      style.fontOpacity,
      style.backgroundColor,
      style.backgroundOpacity,
      style.bottomPosition,
    ]
  );

  return (
    <Box
      width={previewWidth}
      height={previewHeight}
      backgroundColor="playerBackground"
      borderRadius="m"
      overflow="hidden"
      style={{ position: 'relative' }}>
      <Box position="absolute" top={0} left={0} right={0} bottom={0}>
        <Box
          position="absolute"
          top={0}
          left={0}
          width="33%"
          height="100%"
          style={{ backgroundColor: '#0a0a14' }}
        />
        <Box
          position="absolute"
          top={0}
          left="33%"
          width="34%"
          height="100%"
          style={{ backgroundColor: '#3d4566' }}
        />
        <Box
          position="absolute"
          top={0}
          right={0}
          width="33%"
          height="100%"
          style={{ backgroundColor: '#8899bb' }}
        />
      </Box>

      <Box
        position="absolute"
        left={0}
        right={0}
        bottom={computed.bottomOffset}
        alignItems="center"
        paddingHorizontal="m">
        <Box
          borderRadius="s"
          style={{
            backgroundColor: computed.backgroundColorWithOpacity,
            maxWidth: '90%',
            paddingHorizontal: computed.paddingHorizontal,
            paddingVertical: computed.paddingVertical,
          }}>
          <Text
            style={{
              fontSize: computed.fontSize,
              lineHeight: computed.lineHeight,
              fontFamily: computed.fontFamily,
              color: computed.fontColorWithOpacity,
              textAlign: 'center',
            }}
            numberOfLines={SUBTITLE_MAX_LINES}>
            {PREVIEW_SAMPLE_TEXT}
          </Text>
        </Box>
      </Box>
    </Box>
  );
});

SubtitlePreview.displayName = 'SubtitlePreview';

const SectionLabel: FC<{ label: string }> = memo(({ label }) => (
  <Text variant="sectionLabel" marginTop="m" marginBottom="xs">
    {label}
  </Text>
));

SectionLabel.displayName = 'SectionLabel';

const SettingRow: FC<{ label: string; children: React.ReactNode }> = memo(({ label, children }) => (
  <Box flexDirection="row" justifyContent="space-between" alignItems="center" paddingVertical="s">
    <Text variant="body" color="textPrimary">
      {label}
    </Text>
    {children}
  </Box>
));

SettingRow.displayName = 'SettingRow';

const useActiveProfileSubtitleStyle = () => {
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const { subtitleStyle, setSubtitleStyleForProfile } = useProfileSettingsStore((state) => ({
    subtitleStyle:
      (activeProfileId ? state.byProfile[activeProfileId]?.subtitleStyle : undefined) ??
      DEFAULT_SUBTITLE_STYLE,
    setSubtitleStyleForProfile: state.setSubtitleStyleForProfile,
  }));

  const updateStyle = useCallback(
    (updates: Partial<SubtitleStyle>) => {
      if (!activeProfileId) return;
      setSubtitleStyleForProfile(activeProfileId, {
        ...subtitleStyle,
        ...updates,
      });
    },
    [activeProfileId, setSubtitleStyleForProfile, subtitleStyle]
  );

  return { subtitleStyle, updateStyle };
};

export const SubtitleStylePreview: FC = memo(() => {
  const restyleTheme = useTheme<Theme>();
  const { width: windowWidth } = useWindowDimensions();
  const { subtitleStyle } = useActiveProfileSubtitleStyle();

  const previewWidth = useMemo(() => {
    const horizontalPadding = restyleTheme.spacing.m * 3;
    return Math.min(windowWidth - horizontalPadding, 600);
  }, [restyleTheme.spacing.m, windowWidth]);

  return (
    <Box alignItems="center" marginBottom="m">
      <SubtitlePreview style={subtitleStyle} containerWidth={previewWidth} />
    </Box>
  );
});

SubtitleStylePreview.displayName = 'SubtitleStylePreview';

export const SubtitleStyleControls: FC = memo(() => {
  const [showFontPicker, setShowFontPicker] = useState(false);
  const { subtitleStyle, updateStyle } = useActiveProfileSubtitleStyle();

  const fontFamilyItems: PickerItem<SubtitleFontFamily>[] = useMemo(
    () =>
      SUBTITLE_FONT_FAMILIES.map((f) => ({
        label: f.label,
        value: f.value,
      })),
    []
  );

  const currentFontLabel = useMemo(() => {
    const found = SUBTITLE_FONT_FAMILIES.find((f) => f.value === subtitleStyle.fontFamily);
    return found?.label ?? 'System Default';
  }, [subtitleStyle.fontFamily]);

  return (
    <Box gap="s">
      <SectionLabel label="Font" />

      <SettingRow label="Font Family">
        <TouchableOpacity onPress={() => setShowFontPicker(true)}>
          <Box
            backgroundColor="inputBackground"
            borderRadius="m"
            paddingHorizontal="m"
            paddingVertical="s"
            flexDirection="row"
            alignItems="center"
            gap="s"
            minWidth={140}>
            <Ionicons name="text" size={20} color={theme.colors.textSecondary} />
            <Text variant="body">{currentFontLabel}</Text>
            <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
          </Box>
        </TouchableOpacity>
      </SettingRow>

      <SliderInput
        label="Font Size"
        value={subtitleStyle.fontSize}
        onValueChange={(v) => updateStyle({ fontSize: v })}
        minimumValue={SUBTITLE_FONT_SIZE_MIN}
        maximumValue={SUBTITLE_FONT_SIZE_MAX}
        step={SUBTITLE_FONT_SIZE_STEP}
        unit="px"
      />

      <SettingRow label="Font Color">
        <ColorPicker
          value={subtitleStyle.fontColor}
          onValueChange={(c) => updateStyle({ fontColor: c })}
          colors={SUBTITLE_COMMON_COLORS}
        />
      </SettingRow>

      <SliderInput
        label="Font Opacity"
        value={Math.round(subtitleStyle.fontOpacity * 100)}
        onValueChange={(v) => updateStyle({ fontOpacity: v / 100 })}
        minimumValue={50}
        maximumValue={100}
        step={5}
        unit="%"
      />

      <SectionLabel label="Background" />

      <SettingRow label="Background Color">
        <ColorPicker
          value={subtitleStyle.backgroundColor}
          onValueChange={(c) => updateStyle({ backgroundColor: c })}
          colors={SUBTITLE_COMMON_COLORS}
        />
      </SettingRow>

      <SliderInput
        label="Background Opacity"
        value={Math.round(subtitleStyle.backgroundOpacity * 100)}
        onValueChange={(v) => updateStyle({ backgroundOpacity: v / 100 })}
        minimumValue={0}
        maximumValue={100}
        step={5}
        unit="%"
      />

      <SectionLabel label="Position" />

      <SliderInput
        label="Distance from Bottom"
        value={subtitleStyle.bottomPosition}
        onValueChange={(v) => updateStyle({ bottomPosition: v })}
        minimumValue={SUBTITLE_POSITION_MIN}
        maximumValue={SUBTITLE_POSITION_MAX}
        step={SUBTITLE_POSITION_STEP}
        unit="%"
      />

      <PickerModal
        visible={showFontPicker}
        onClose={() => setShowFontPicker(false)}
        label="Select Font"
        icon="text"
        items={fontFamilyItems}
        selectedValue={subtitleStyle.fontFamily}
        onValueChange={(value: SubtitleFontFamily) => {
          updateStyle({ fontFamily: value });
          setShowFontPicker(false);
        }}
      />
    </Box>
  );
});

SubtitleStyleControls.displayName = 'SubtitleStyleControls';

export const SubtitleStyleSettings: FC = memo(() => {
  return (
    <Box gap="s">
      <SubtitleStylePreview />
      <SubtitleStyleControls />
    </Box>
  );
});

SubtitleStyleSettings.displayName = 'SubtitleStyleSettings';

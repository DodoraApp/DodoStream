import React, { FC, memo, useCallback, useMemo, useState } from 'react';
import { useWindowDimensions, TouchableOpacity } from 'react-native';
import theme, { Box, Text } from '@/theme/theme';
import { ColorPicker } from '@/components/basic/ColorPicker';
import { SliderInput } from '@/components/basic/SliderInput';
import { PickerModal, PickerItem } from '@/components/basic/PickerModal';
import { useProfileStore } from '@/store/profile.store';
import { useProfileSettingsStore } from '@/store/profile-settings.store';
import { Ionicons } from '@expo/vector-icons';
import {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_FONT_FAMILIES,
  SUBTITLE_FONT_SIZE_MIN,
  SUBTITLE_FONT_SIZE_MAX,
  SUBTITLE_FONT_SIZE_STEP,
  SUBTITLE_POSITION_MIN,
  SUBTITLE_POSITION_MAX,
  SUBTITLE_POSITION_STEP,
  SUBTITLE_COMMON_COLORS,
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
      {/* Video placeholder with varied brightness to test subtitle readability */}
      <Box position="absolute" top={0} left={0} right={0} bottom={0}>
        {/* Dark area on left */}
        <Box
          position="absolute"
          top={0}
          left={0}
          width="33%"
          height="100%"
          style={{ backgroundColor: '#0a0a14' }}
        />
        {/* Medium area in center */}
        <Box
          position="absolute"
          top={0}
          left="33%"
          width="34%"
          height="100%"
          style={{ backgroundColor: '#3d4566' }}
        />
        {/* Bright area on right */}
        <Box
          position="absolute"
          top={0}
          right={0}
          width="33%"
          height="100%"
          style={{ backgroundColor: '#8899bb' }}
        />
      </Box>

      {/* Subtitle container */}
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

/**
 * Section label component for subtitle settings groups
 */
const SectionLabel: FC<{ label: string }> = memo(({ label }) => (
  <Text variant="sectionLabel" marginTop="m" marginBottom="xs">
    {label}
  </Text>
));

SectionLabel.displayName = 'SectionLabel';

/**
 * Row component for a setting with label and control
 */
const SettingRow: FC<{ label: string; children: React.ReactNode }> = memo(({ label, children }) => (
  <Box flexDirection="row" justifyContent="space-between" alignItems="center" paddingVertical="s">
    <Text variant="body" color="textPrimary">
      {label}
    </Text>
    {children}
  </Box>
));

SettingRow.displayName = 'SettingRow';

/**
 * Subtitle style customization settings component.
 * Provides a live preview and controls for all subtitle style properties.
 */
export const SubtitleStyleSettings: FC = memo(() => {
  const { width: windowWidth } = useWindowDimensions();
  const activeProfileId = useProfileStore((state) => state.activeProfileId);

  const [showFontPicker, setShowFontPicker] = useState(false);

  const { subtitleStyle, setSubtitleStyleForProfile } = useProfileSettingsStore((state) => ({
    subtitleStyle:
      (activeProfileId ? state.byProfile[activeProfileId]?.subtitleStyle : undefined) ??
      DEFAULT_SUBTITLE_STYLE,
    setSubtitleStyleForProfile: state.setSubtitleStyleForProfile,
  }));

  // Calculate preview width (with padding)
  const previewWidth = Math.min(windowWidth - 48, 600);

  const updateStyle = useCallback(
    (updates: Partial<SubtitleStyle>) => {
      if (!activeProfileId) return;
      setSubtitleStyleForProfile(activeProfileId, {
        ...subtitleStyle,
        ...updates,
      });
    },
    [activeProfileId, subtitleStyle, setSubtitleStyleForProfile]
  );

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
      {/* Preview */}
      <Box alignItems="center" marginBottom="m">
        <SubtitlePreview style={subtitleStyle} containerWidth={previewWidth} />
      </Box>

      {/* Font Section */}
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

      {/* Background Section */}
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

      {/* Position Section */}
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

      {/* Font Family Picker Modal */}
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

SubtitleStyleSettings.displayName = 'SubtitleStyleSettings';

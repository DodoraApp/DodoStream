import { FC, memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, Linking } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useTheme } from '@shopify/restyle';
import { Box, Text, type Theme } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';
import { LanguagePreferenceModal } from '@/components/settings/LanguagePreferenceModal';
import { DEFAULT_PROFILE_PLAYBACK_SETTINGS, usePlaybackStore } from '@/store/playback.store';
import type { PlayerType } from '@/types/player';
import { useProfileStore } from '@/store/profile.store';
import { PLAYER_PICKER_ITEMS } from '@/constants/playback';
import { COMMON_LANGUAGE_CODES } from '@/constants/languages';
import { getDevicePreferredLanguageCodes } from '@/utils/languages';
import { PickerInput } from '@/components/basic/PickerInput';
import { Focusable } from '@/components/basic/Focusable';

export interface PlaybackSettingsContentProps {
  /** Whether to show the player selection section (default: true) */
  showPlayerSelection?: boolean;
  /** Whether to show the language preferences section (default: true) */
  showLanguages?: boolean;
  /** Whether to wrap content in ScrollView (default: true) */
  scrollable?: boolean;
}

/**
 * Playback settings content component
 * Extracted for use in both standalone page and split layout
 */
export const PlaybackSettingsContent: FC<PlaybackSettingsContentProps> = memo(
  ({ showPlayerSelection = true, showLanguages = true, scrollable = true }) => {
    const { t } = useTranslation('settings');
    const theme = useTheme<Theme>();
    const [showAudioLanguagePicker, setShowAudioLanguagePicker] = useState(false);
    const [showSubtitleLanguagePicker, setShowSubtitleLanguagePicker] = useState(false);
    const activeProfileId = useProfileStore((state) => state.activeProfileId);

    const {
      player,
      automaticFallback,
      autoPlayFirstStream,
      showVideoStatistics,
      preferredAudioLanguages,
      preferredSubtitleLanguages,
      tunneled,
      audioPassthrough,
      enableWorkarounds,
      matchFrameRate,
      enableVideoSoftwareDecoding,
      skipIntroEnabled,
      setPlayerForProfile,
      setAutomaticFallbackForProfile,
      setAutoPlayFirstStreamForProfile,
      setShowVideoStatisticsForProfile,
      setPreferredAudioLanguagesForProfile,
      setPreferredSubtitleLanguagesForProfile,
      setTunneledForProfile,
      setAudioPassthroughForProfile,
      setEnableWorkaroundsForProfile,
      setMatchFrameRateForProfile,
      setEnableVideoSoftwareDecodingForProfile,
      setSkipIntroEnabledForProfile,
    } = usePlaybackStore((state) => ({
      player:
        (activeProfileId ? state.byProfile[activeProfileId]?.player : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.player,
      automaticFallback:
        (activeProfileId ? state.byProfile[activeProfileId]?.automaticFallback : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.automaticFallback,
      autoPlayFirstStream:
        (activeProfileId ? state.byProfile[activeProfileId]?.autoPlayFirstStream : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.autoPlayFirstStream,
      showVideoStatistics:
        (activeProfileId ? state.byProfile[activeProfileId]?.showVideoStatistics : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.showVideoStatistics,
      preferredAudioLanguages: activeProfileId
        ? (state.byProfile[activeProfileId]?.preferredAudioLanguages ?? [])
        : [],
      preferredSubtitleLanguages: activeProfileId
        ? (state.byProfile[activeProfileId]?.preferredSubtitleLanguages ?? [])
        : [],
      tunneled:
        (activeProfileId ? state.byProfile[activeProfileId]?.tunneled : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.tunneled,
      audioPassthrough:
        (activeProfileId ? state.byProfile[activeProfileId]?.audioPassthrough : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.audioPassthrough,
      enableWorkarounds:
        (activeProfileId ? state.byProfile[activeProfileId]?.enableWorkarounds : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.enableWorkarounds,
      matchFrameRate:
        (activeProfileId ? state.byProfile[activeProfileId]?.matchFrameRate : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.matchFrameRate,
      enableVideoSoftwareDecoding:
        (activeProfileId
          ? state.byProfile[activeProfileId]?.enableVideoSoftwareDecoding
          : undefined) ?? DEFAULT_PROFILE_PLAYBACK_SETTINGS.enableVideoSoftwareDecoding,
      skipIntroEnabled:
        (activeProfileId ? state.byProfile[activeProfileId]?.skipIntroEnabled : undefined) ??
        DEFAULT_PROFILE_PLAYBACK_SETTINGS.skipIntroEnabled,
      setPlayerForProfile: state.setPlayerForProfile,
      setAutomaticFallbackForProfile: state.setAutomaticFallbackForProfile,
      setAutoPlayFirstStreamForProfile: state.setAutoPlayFirstStreamForProfile,
      setShowVideoStatisticsForProfile: state.setShowVideoStatisticsForProfile,
      setPreferredAudioLanguagesForProfile: state.setPreferredAudioLanguagesForProfile,
      setPreferredSubtitleLanguagesForProfile: state.setPreferredSubtitleLanguagesForProfile,
      setTunneledForProfile: state.setTunneledForProfile,
      setAudioPassthroughForProfile: state.setAudioPassthroughForProfile,
      setEnableWorkaroundsForProfile: state.setEnableWorkaroundsForProfile,
      setMatchFrameRateForProfile: state.setMatchFrameRateForProfile,
      setEnableVideoSoftwareDecodingForProfile: state.setEnableVideoSoftwareDecodingForProfile,
      setSkipIntroEnabledForProfile: state.setSkipIntroEnabledForProfile,
    }));

    const deviceLanguageCodes = getDevicePreferredLanguageCodes();
    const availableLanguageCodes = Array.from(
      new Set([...deviceLanguageCodes, ...COMMON_LANGUAGE_CODES])
    );

    const renderLanguageSummary = (codes: string[]) => {
      if (!codes || codes.length === 0) return t('playback.device_default');
      return codes.join(', ');
    };

    const handleOpenIntroDB = useCallback(() => {
      Linking.openURL('https://introdb.app');
    }, []);

    const content = (
      <Box paddingVertical="m" paddingHorizontal="m" gap="l">
        {showPlayerSelection && (
          <SettingsCard title={t('playback.title')}>
            <SettingsRow label={t('playback.player')}>
              <PickerInput
                label={t('playback.select_player')}
                icon="play"
                items={PLAYER_PICKER_ITEMS}
                selectedLabel={
                  PLAYER_PICKER_ITEMS.find((item) => item.value === player)?.label || 'Unknown'
                }
                selectedValue={player}
                onValueChange={(value: PlayerType) =>
                  activeProfileId && setPlayerForProfile(activeProfileId, value)
                }
              />
            </SettingsRow>

            <SettingsSwitch
              label={t('playback.automatic_fallback')}
              description={t('playback.automatic_fallback_desc')}
              value={automaticFallback}
              onValueChange={(value) =>
                activeProfileId && setAutomaticFallbackForProfile(activeProfileId, value)
              }
            />
            <SettingsSwitch
              label={t('playback.auto_play')}
              description={t('playback.auto_play_desc')}
              value={autoPlayFirstStream}
              onValueChange={(value) =>
                activeProfileId && setAutoPlayFirstStreamForProfile(activeProfileId, value)
              }
            />
          </SettingsCard>
        )}

        <SettingsCard title={t('playback.skip_intro')}>
          <SettingsSwitch
            label={t('playback.skip_intro')}
            description={t('playback.skip_intro_desc')}
            value={skipIntroEnabled}
            onValueChange={(value) =>
              activeProfileId && setSkipIntroEnabledForProfile(activeProfileId, value)
            }
          />
          <Text variant="caption" color="textSecondary">
            {t('playback.skip_intro_info')}
          </Text>
          <TouchableOpacity onPress={handleOpenIntroDB}>
            <Text variant="caption" color="textLink">
              {t('playback.powered_by', { name: 'IntroDB' })}
            </Text>
          </TouchableOpacity>
        </SettingsCard>

        <SettingsCard title={t('playback.android_advanced')}>
          <Text variant="caption" color="textSecondary">
            {t('playback.android_advanced_desc')}
          </Text>
          <SettingsSwitch
            label={t('playback.tunneled')}
            description={t('playback.tunneled_desc')}
            value={tunneled}
            onValueChange={(value) =>
              activeProfileId && setTunneledForProfile(activeProfileId, value)
            }
          />
          <SettingsSwitch
            label={t('playback.audio_passthrough')}
            description={t('playback.audio_passthrough_desc')}
            value={audioPassthrough}
            onValueChange={(value) =>
              activeProfileId && setAudioPassthroughForProfile(activeProfileId, value)
            }
          />
          <SettingsSwitch
            label={t('playback.workarounds')}
            description={t('playback.workarounds_desc')}
            value={enableWorkarounds}
            onValueChange={(value) =>
              activeProfileId && setEnableWorkaroundsForProfile(activeProfileId, value)
            }
          />
          <SettingsSwitch
            label={t('playback.match_frame_rate')}
            description={t('playback.match_frame_rate_desc')}
            value={matchFrameRate}
            onValueChange={(value) =>
              activeProfileId && setMatchFrameRateForProfile(activeProfileId, value)
            }
          />
          <SettingsSwitch
            label={t('playback.software_decoding')}
            description={t('playback.software_decoding_desc')}
            value={enableVideoSoftwareDecoding}
            onValueChange={(value) =>
              activeProfileId && setEnableVideoSoftwareDecodingForProfile(activeProfileId, value)
            }
          />
        </SettingsCard>

        <SettingsCard title={t('playback.diagnostics')}>
          <SettingsSwitch
            label={t('playback.video_stats')}
            description={t('playback.video_stats_desc')}
            value={showVideoStatistics}
            onValueChange={(value) =>
              activeProfileId && setShowVideoStatisticsForProfile(activeProfileId, value)
            }
          />
        </SettingsCard>

        {showLanguages && (
          <SettingsCard title={t('playback.languages')}>
            <SettingsRow
              label={t('playback.preferred_audio')}
              description={t('playback.preferred_audio_desc')}>
              <Focusable
                onPress={() => setShowAudioLanguagePicker(true)}
                variant="outline"
                focusedStyle={{
                  outlineWidth: theme.focus.borderWidthSmall,
                  borderRadius: theme.borderRadii.m,
                }}>
                <Box
                  backgroundColor="cardBackground"
                  borderRadius="m"
                  paddingHorizontal="m"
                  paddingVertical="s"
                  flexDirection="row"
                  alignItems="center"
                  gap="s">
                  <Ionicons
                    name="volume-high"
                    size={theme.sizes.iconSmall}
                    color={theme.colors.textSecondary}
                  />
                  <Text variant="body" numberOfLines={1}>
                    {renderLanguageSummary(preferredAudioLanguages)}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={theme.sizes.iconSmall}
                    color={theme.colors.mainForeground}
                  />
                </Box>
              </Focusable>
            </SettingsRow>

            <SettingsRow
              label={t('playback.preferred_subtitles')}
              description={t('playback.preferred_subtitles_desc')}>
              <Focusable
                onPress={() => setShowSubtitleLanguagePicker(true)}
                variant="outline"
                focusedStyle={{
                  outlineWidth: theme.focus.borderWidthSmall,
                  borderRadius: theme.borderRadii.m,
                }}>
                <Box
                  backgroundColor="cardBackground"
                  borderRadius="m"
                  paddingHorizontal="m"
                  paddingVertical="s"
                  flexDirection="row"
                  alignItems="center"
                  gap="s">
                  <Ionicons
                    name="text"
                    size={theme.sizes.iconSmall}
                    color={theme.colors.textSecondary}
                  />
                  <Text variant="body" numberOfLines={1}>
                    {renderLanguageSummary(preferredSubtitleLanguages)}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={theme.sizes.iconSmall}
                    color={theme.colors.mainForeground}
                  />
                </Box>
              </Focusable>
            </SettingsRow>
          </SettingsCard>
        )}
      </Box>
    );

    const scrollableContent = scrollable ? (
      <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>
    ) : (
      content
    );

    return (
      <>
        {scrollableContent}

        {showLanguages && (
          <>
            <LanguagePreferenceModal
              visible={showAudioLanguagePicker}
              onClose={() => setShowAudioLanguagePicker(false)}
              title={t('playback.preferred_audio')}
              selectedLanguageCodes={preferredAudioLanguages}
              availableLanguageCodes={availableLanguageCodes}
              onChange={(next) =>
                activeProfileId && setPreferredAudioLanguagesForProfile(activeProfileId, next)
              }
            />

            <LanguagePreferenceModal
              visible={showSubtitleLanguagePicker}
              onClose={() => setShowSubtitleLanguagePicker(false)}
              title={t('playback.preferred_subtitles')}
              selectedLanguageCodes={preferredSubtitleLanguages}
              availableLanguageCodes={availableLanguageCodes}
              onChange={(next) =>
                activeProfileId && setPreferredSubtitleLanguagesForProfile(activeProfileId, next)
              }
            />
          </>
        )}
      </>
    );
  }
);

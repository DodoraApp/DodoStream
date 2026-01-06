import { FC, useEffect, useState } from 'react';
import { useProfileStore } from '@/store/profile.store';
import {
  DEFAULT_PROFILE_PLAYBACK_SETTINGS,
  useProfileSettingsStore,
} from '@/store/profile-settings.store';
import { VideoPlayerSession, type VideoPlayerProps } from './VideoPlayerSession';
import { getVideoSessionId } from '@/utils/stream';
import { useKeepAwake } from 'expo-keep-awake';
import ImmersiveMode from 'react-native-immersive-mode';
import { Platform, StatusBar } from 'react-native';

export const VideoPlayer: FC<VideoPlayerProps> = (props) => {
  const activeProfileId = useProfileStore((state) => state.activeProfileId);

  const { player: playerType, automaticFallback } = useProfileSettingsStore((state) => ({
    player:
      (activeProfileId ? state.byProfile[activeProfileId]?.player : undefined) ??
      DEFAULT_PROFILE_PLAYBACK_SETTINGS.player,
    automaticFallback:
      (activeProfileId ? state.byProfile[activeProfileId]?.automaticFallback : undefined) ??
      DEFAULT_PROFILE_PLAYBACK_SETTINGS.automaticFallback,
  }));

  const [usedPlayerType, setUsedPlayerType] = useState(playerType);
  const sessionKey = getVideoSessionId(props.source, props.metaId, props.videoId, usedPlayerType);

  // Keep screen awake
  useKeepAwake('PlayScreen');

  // Enable immersive mode (hide navigation bar) on Android
  useEffect(() => {
    // Hide status bar on all platforms
    StatusBar.setHidden(true);

    if (Platform.OS === 'android') {
      ImmersiveMode.fullLayout(true);
      ImmersiveMode.setBarMode('FullSticky');
    }

    return () => {
      StatusBar.setHidden(false);
      if (Platform.OS === 'android') {
        ImmersiveMode.fullLayout(false);
        ImmersiveMode.setBarMode('Normal');
      }
    };
  }, []);

  return (
    <VideoPlayerSession
      key={sessionKey}
      {...props}
      usedPlayerType={usedPlayerType}
      setUsedPlayerType={setUsedPlayerType}
      playerType={playerType}
      automaticFallback={automaticFallback}
    />
  );
};

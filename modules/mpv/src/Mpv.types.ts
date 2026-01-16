import type { StyleProp, ViewStyle } from 'react-native';

// Event payloads
export type MpvLoadEventPayload = {
  duration: number;
  width: number;
  height: number;
};

export type MpvProgressEventPayload = {
  currentTime: number;
  duration: number;
};

export type MpvErrorEventPayload = {
  error: string;
};

export type MpvBufferingEventPayload = {
  isBuffering: boolean;
};

export type MpvTrack = {
  id: number;
  name: string;
  language: string;
  codec: string;
};

export type MpvTracksChangedEventPayload = {
  audioTracks: MpvTrack[];
  subtitleTracks: MpvTrack[];
};

// View props
export type MpvViewProps = {
  // Source
  source: string;
  paused: boolean;

  // Playback
  volume?: number;
  rate?: number;
  resizeMode?: 'contain' | 'cover' | 'stretch';
  headers?: Record<string, string>;

  // Decoder settings
  decoderMode?: 'auto' | 'sw' | 'hw' | 'hw+';
  gpuMode?: 'gpu' | 'gpu-next';

  // Subtitle styling
  subtitleSize?: number;
  subtitleColor?: string;
  subtitleBackgroundOpacity?: number;
  subtitleBorderSize?: number;
  subtitleBorderColor?: string;
  subtitleShadowEnabled?: boolean;
  subtitlePosition?: number;
  subtitleDelay?: number;
  subtitleAlignment?: 'left' | 'center' | 'right';

  // Events
  onLoad?: (event: { nativeEvent: MpvLoadEventPayload }) => void;
  onProgress?: (event: { nativeEvent: MpvProgressEventPayload }) => void;
  onEnd?: () => void;
  onError?: (event: { nativeEvent: MpvErrorEventPayload }) => void;
  onBuffering?: (event: { nativeEvent: MpvBufferingEventPayload }) => void;
  onTracksChanged?: (event: { nativeEvent: MpvTracksChangedEventPayload }) => void;

  style?: StyleProp<ViewStyle>;
};

// Ref methods
export type MpvViewRef = {
  seek: (position: number) => Promise<void>;
  setAudioTrack: (trackId: number) => Promise<void>;
  setSubtitleTrack: (trackId: number) => Promise<void>;
};

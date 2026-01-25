import { PickerItem } from '@/components/basic/PickerModal';
import type { PlayerType } from '@/types/player';
import { Platform } from 'react-native';

// Playback ratios
export const PLAYBACK_FINISHED_RATIO = 0.9;

// Up Next popup thresholds (shown earlier than continue watching threshold)
export const UPNEXT_POPUP_SERIES_RATIO = 0.95;
export const UPNEXT_POPUP_MOVIE_RATIO = 0.9;

// Up Next popup becomes inactive (reduced opacity/scale) after this delay
export const UPNEXT_POPUP_INACTIVE_DELAY_MS = 5000;

export const PLAYBACK_RATIO_PERSIST_INTERVAL = 5000;
export const MAX_AUTO_PLAY_ATTEMPTS = 3;

// Player control timing
export const PLAYER_CONTROLS_AUTO_HIDE_MS = 5000;
export const SKIP_FORWARD_SECONDS = 15;
export const SKIP_BACKWARD_SECONDS = 15;

export const PLAYER_PICKER_ITEMS: PickerItem<PlayerType>[] = [
  { label: 'ExoPlayer', value: 'exoplayer' },
  { label: 'VLC', value: 'vlc' },
];

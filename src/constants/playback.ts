import { PickerItem } from '@/components/basic/PickerModal';
import type { PlayerType } from '@/types/player';

// Playback ratios
// Used across watch-history, continue-watching, and autoplay decisions.
export const PLAYBACK_CONTINUE_WATCHING_MIN_RATIO = 0.05;
export const PLAYBACK_FINISHED_RATIO = 0.9;

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

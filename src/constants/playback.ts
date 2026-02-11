import { PickerItem } from '@/components/basic/PickerModal';
import type { PlayerType } from '@/types/player';

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
// Debounce window for TV remote scrubbing (D-pad left/right emits value changes without a reliable "sliding complete")
export const PLAYER_SEEK_DEBOUNCE_MS = 750;
// Seconds to seek per D-pad press on TV (custom seek bar only)
export const PLAYER_SEEK_STEP_SECONDS = 10;

// TV seek bar timing (watchdog pattern - don't rely on keyUp events)
/** Interval between seek steps when holding D-pad (ms) */
export const TV_SEEK_REPEAT_INTERVAL_MS = 200;
/** If no event within this time, assume key released (watchdog timeout) */
export const TV_SEEK_WATCHDOG_TIMEOUT_MS = 300;
/** Delay before committing seek to player (allows for rapid key presses) */
export const TV_SEEK_COMMIT_DELAY_MS = 600;
/** After this many repeats, increase seek speed */
export const TV_SEEK_ACCELERATION_THRESHOLD = 5;
/** Multiplier applied after acceleration threshold */
export const TV_SEEK_ACCELERATION_MULTIPLIER = 3;
// Keep the seek UI pinned briefly after committing a TV seek, until playback time catches up.
export const PLAYER_SEEK_UI_SYNC_TIMEOUT_MS = 1500;
export const PLAYER_SEEK_UI_SYNC_THRESHOLD_SECONDS = 1;
export const SKIP_FORWARD_SECONDS = 15;
export const SKIP_BACKWARD_SECONDS = 15;

export const PLAYER_PICKER_ITEMS: PickerItem<PlayerType>[] = [
  { label: 'ExoPlayer', value: 'exoplayer' },
  { label: 'VLC', value: 'vlc' },
];

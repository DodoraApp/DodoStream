import { PLAYBACK_FINISHED_RATIO, PLAYBACK_CONTINUE_WATCHING_MIN_RATIO } from '@/constants/playback';

// Simkl scrobble rules
export const SIMKL_SCROBBLE_START_PERCENT = PLAYBACK_CONTINUE_WATCHING_MIN_RATIO * 100;
export const SIMKL_SCROBBLE_FINISHED_PERCENT = PLAYBACK_FINISHED_RATIO * 100;

/**
 * Scrobble thresholds - reuse existing playback ratios
 * This matches the ADR specification for threshold naming
 */
export const SCROBBLE_THRESHOLDS = {
    /** Start scrobbling ("now watching") - 5% */
    START: PLAYBACK_CONTINUE_WATCHING_MIN_RATIO,

    /** Mark as watched/finished - 90% */
    FINISH: PLAYBACK_FINISHED_RATIO,
} as const;

// Scrobble throttling
export const SIMKL_SCROBBLE_MIN_PROGRESS_DELTA_PERCENT = 2;
export const SIMKL_SCROBBLE_MIN_INTERVAL_MS = 15_000;
export const SIMKL_SCROBBLE_DEBOUNCE_MS = 750;

/** Debounce time for scrobble updates (ADR alias) */
export const SCROBBLE_DEBOUNCE_MS = SIMKL_SCROBBLE_DEBOUNCE_MS;

// Sync manager
export const SIMKL_SYNC_INTERVAL_MS = 30 * 60_000;
export const SIMKL_PIN_POLL_TICK_MS = 2_000;

/** Minimum time between sync attempts (ADR alias) */
export const SYNC_INTERVAL_MS = SIMKL_SYNC_INTERVAL_MS;

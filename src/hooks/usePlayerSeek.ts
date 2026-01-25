import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import {
    PLAYER_SEEK_DEBOUNCE_MS,
    PLAYER_SEEK_UI_SYNC_THRESHOLD_SECONDS,
    PLAYER_SEEK_UI_SYNC_TIMEOUT_MS,
} from '@/constants/playback';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('usePlayerSeek');

export interface UsePlayerSeekOptions {
    /** Current playback time in seconds */
    currentTime: number;
    /** Total duration in seconds */
    duration: number;
    /** Whether playback is paused */
    paused: boolean;
    /** Toggle play/pause state */
    onPlayPause: () => void;
    /** Commit a seek to the specified time */
    onSeek: (time: number) => void;
    /** Called when user interaction occurs (for auto-hide reset) */
    onInteraction?: () => void;
}

export interface UsePlayerSeekResult {
    /** Whether seeking is in progress (UI should show seek time instead of current time) */
    isSeeking: boolean;
    /** The time being seeked to */
    seekTime: number;
    /** Whether the seek slider is focused (for TV highlight) */
    isSeekFocused: boolean;
    /** Set seek slider focus state */
    setIsSeekFocused: (focused: boolean) => void;
    /** Call when user starts dragging the slider (touch platforms) */
    handleSeekStart: () => void;
    /** Call when slider value changes (both touch and TV D-pad) */
    handleSeekChange: (value: number) => void;
    /** Call when user finishes dragging (touch platforms only) */
    handleSeekEnd: (value: number) => void;
    /** 
     * TV only: Update seek time for display purposes without triggering debounce/commit.
     * Use this when TVSeekBar handles its own commit logic via onSeekComplete.
     */
    setSeekTimeForDisplay: (value: number) => void;
    /** TV only: Reset seeking state (call after TVSeekBar commit) */
    resetSeekingState: () => void;
    /** The effective duration to use (handles edge cases where duration is 0) */
    effectiveDuration: number;
    /** The clamped slider value to display */
    sliderValue: number;
    /** The maximum value for the slider */
    sliderMaximumValue: number;
}

/**
 * Hook that encapsulates all player seek bar logic including:
 * - Touch platform: standard drag-to-seek with start/change/end
 * - TV platform: D-pad scrubbing with debounced commits (no reliable "sliding complete")
 * - UI sync: Keeps seek UI pinned until playback catches up to seek position
 * - Pause/resume: Auto-pauses during seek, resumes if was playing before
 */
export const usePlayerSeek = ({
    currentTime,
    duration,
    paused,
    onPlayPause,
    onSeek,
    onInteraction,
}: UsePlayerSeekOptions): UsePlayerSeekResult => {
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekTime, setSeekTime] = useState(0);
    const [isSeekFocused, setIsSeekFocused] = useState(false);

    // Refs for debouncing and state tracking
    const seekDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seekDebounceTokenRef = useRef(0);
    const lastSeekTimeRef = useRef(0);
    const wasPlayingBeforeSeekRef = useRef(false);

    // TV-specific refs
    const tvSeekActiveRef = useRef(false);
    const tvPendingSeekTimeRef = useRef<number | null>(null);
    const tvUiSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep track of last valid duration (handles edge cases where duration becomes 0)
    const lastNonZeroDurationRef = useRef(0);

    // Update last known valid duration
    useEffect(() => {
        if (duration > 0 && isFinite(duration)) {
            lastNonZeroDurationRef.current = duration;
        }
    }, [duration]);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (seekDebounceTimeoutRef.current) {
                clearTimeout(seekDebounceTimeoutRef.current);
            }
            if (tvUiSyncTimeoutRef.current) {
                clearTimeout(tvUiSyncTimeoutRef.current);
            }
        };
    }, []);

    // TV: Sync UI when playback catches up to pending seek position
    useEffect(() => {
        if (!Platform.isTV) return;
        if (tvSeekActiveRef.current) return;

        const pending = tvPendingSeekTimeRef.current;
        if (!isSeeking || pending == null) return;

        if (Math.abs(currentTime - pending) <= PLAYER_SEEK_UI_SYNC_THRESHOLD_SECONDS) {
            debug('tvSeekSynced', { currentTime, pending });
            tvPendingSeekTimeRef.current = null;
            setIsSeeking(false);
        }
    }, [currentTime, isSeeking]);

    // Touch platforms: Called when user starts dragging the slider
    const handleSeekStart = useCallback(() => {
        debug('seekStart', { currentTime });
        onInteraction?.();
        setIsSeeking(true);
        setSeekTime(currentTime);
        lastSeekTimeRef.current = currentTime;

        // Remember if we need to resume after seeking
        wasPlayingBeforeSeekRef.current = !paused;
        if (!paused) {
            onPlayPause(); // Pause video while seeking
        }
    }, [currentTime, paused, onPlayPause, onInteraction]);

    // Called when slider value changes (both touch and TV)
    // On TV with TVSeekBar: just updates seekTime for display, pause/resume handled by TVSeekBar
    const handleSeekChange = useCallback(
        (value: number) => {
            onInteraction?.();

            setSeekTime(value);
            lastSeekTimeRef.current = value;

            // On touch platforms, just update the preview time (actual seek on end)
            if (!Platform.isTV) return;

            // TV: When TVSeekBar calls onValueChange, we just need to update the seeking state
            // for display purposes. The pause/resume is handled by TVSeekBar via onSeekStart/onSeekComplete.
            // We mark tvSeekActive to prevent the debounce logic from interfering.
            if (!tvSeekActiveRef.current) {
                debug('tvSeekStart (display only)');
                tvSeekActiveRef.current = true;
                setIsSeeking(true);
                // Note: Don't pause here - TVSeekBar handles pause/resume via onSeekStart/onSeekComplete
            }

            // Cancel any pending debounced seek
            if (seekDebounceTimeoutRef.current) {
                clearTimeout(seekDebounceTimeoutRef.current);
                seekDebounceTimeoutRef.current = null;
            }

            // Create new debounced seek
            seekDebounceTokenRef.current += 1;
            const token = seekDebounceTokenRef.current;

            seekDebounceTimeoutRef.current = setTimeout(() => {
                if (token !== seekDebounceTokenRef.current) return;

                const max = lastNonZeroDurationRef.current;
                const commitValue = max > 0 ? Math.min(lastSeekTimeRef.current, max) : lastSeekTimeRef.current;

                debug('tvSeekCommit', { commitValue });
                onInteraction?.();
                onSeek(commitValue);

                // Keep the UI pinned to the committed value until playback time catches up
                setSeekTime(commitValue);
                tvPendingSeekTimeRef.current = commitValue;
                tvSeekActiveRef.current = false;

                // Cancel any existing UI sync timeout
                if (tvUiSyncTimeoutRef.current) {
                    clearTimeout(tvUiSyncTimeoutRef.current);
                    tvUiSyncTimeoutRef.current = null;
                }

                // Fallback: Release seeking state after timeout even if playback doesn't sync
                tvUiSyncTimeoutRef.current = setTimeout(() => {
                    tvUiSyncTimeoutRef.current = null;
                    tvPendingSeekTimeRef.current = null;
                    setIsSeeking(false);
                }, PLAYER_SEEK_UI_SYNC_TIMEOUT_MS);

                // Resume playback if was playing before
                if (wasPlayingBeforeSeekRef.current) {
                    wasPlayingBeforeSeekRef.current = false;
                    onPlayPause();
                }
            }, PLAYER_SEEK_DEBOUNCE_MS);
        },
        [onPlayPause, onSeek, onInteraction]
    );

    // TV only: Update seek time for display without triggering debounce/commit
    // Used by TVSeekBar which handles its own commit logic
    const setSeekTimeForDisplay = useCallback((value: number) => {
        if (!isSeeking) {
            setIsSeeking(true);
        }
        setSeekTime(value);
        lastSeekTimeRef.current = value;
    }, [isSeeking]);

    // TV only: Reset seeking state after TVSeekBar commits
    const resetSeekingState = useCallback(() => {
        tvSeekActiveRef.current = false;
        tvPendingSeekTimeRef.current = null;
        setIsSeeking(false);
    }, []);

    // Touch platforms: Called when user finishes dragging
    const handleSeekEnd = useCallback(
        (value: number) => {
            debug('seekEnd', { value });
            onInteraction?.();
            setIsSeeking(false);
            onSeek(value);

            // Resume playback if was playing before seeking
            if (wasPlayingBeforeSeekRef.current) {
                wasPlayingBeforeSeekRef.current = false;
                onPlayPause();
            }
        },
        [onSeek, onPlayPause, onInteraction]
    );

    // Computed values for slider
    const effectiveDuration = duration > 0 ? duration : lastNonZeroDurationRef.current;
    const sliderMaximumValue = effectiveDuration > 0 ? effectiveDuration : 1;

    // When seeking, show the seek time instead of current playback time
    const sliderValue = Math.min(
        isSeeking ? seekTime : currentTime,
        sliderMaximumValue
    );

    return {
        isSeeking,
        seekTime,
        isSeekFocused,
        setIsSeekFocused,
        handleSeekStart,
        handleSeekChange,
        handleSeekEnd,
        setSeekTimeForDisplay,
        resetSeekingState,
        effectiveDuration,
        sliderValue,
        sliderMaximumValue,
    };
};

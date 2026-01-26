import React, { FC, memo, useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, Pressable, useTVEventHandler, HWEvent } from 'react-native';
import { Box, Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import {
  PLAYER_SEEK_STEP_SECONDS,
  TV_SEEK_REPEAT_INTERVAL_MS,
  TV_SEEK_COMMIT_DELAY_MS,
  TV_SEEK_ACCELERATION_THRESHOLD,
  TV_SEEK_ACCELERATION_MULTIPLIER,
} from '@/constants/playback';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('TVSeekBar');

// ============================================================================
// Constants
// ============================================================================

// Maximum duration for continuous seeking (safety timeout)
const MAX_HOLD_DURATION_MS = 30000;

// ============================================================================
// Types
// ============================================================================

interface TVSeekBarProps {
  /** Current value (0 to maximumValue) */
  value: number;
  /** Maximum value */
  maximumValue: number;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Called when value changes during seeking (for time display updates) */
  onValueChange?: (value: number) => void;
  /** Called when seeking starts */
  onSeekStart?: () => void;
  /** Called when seeking completes (after debounce) */
  onSeekComplete?: (value: number) => void;
  /** Called when focus changes */
  onFocus?: () => void;
  onBlur?: () => void;
  /** Whether this element should receive focus on TV */
  hasTVPreferredFocus?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const TVSeekBar: FC<TVSeekBarProps> = memo(
  ({
    value,
    maximumValue,
    disabled = false,
    onValueChange,
    onSeekStart,
    onSeekComplete,
    onFocus,
    onBlur,
    hasTVPreferredFocus,
  }) => {
    const theme = useTheme<Theme>();
    const [isFocused, setIsFocused] = useState(false);
    const [localValue, setLocalValue] = useState(value);

    // Refs for tracking state
    const seekingRef = useRef(false);
    const localValueRef = useRef(value);

    // Refs for continuous seeking (long press)
    const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const holdRepeatCountRef = useRef(0);

    // Ref to track if focused (avoids stale closure issues)
    const isFocusedRef = useRef(false);

    // Keep ref in sync with state
    useEffect(() => {
      localValueRef.current = localValue;
    }, [localValue]);

    // Sync local value with prop when not seeking
    useEffect(() => {
      if (!seekingRef.current) {
        setLocalValue(value);
        localValueRef.current = value;
      }
    }, [value]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
        if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
      };
    }, []);

    // Stop any ongoing continuous seek
    const stopContinuousSeek = useCallback(() => {
      if (holdIntervalRef.current) {
        debug('stopContinuousSeek');
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
      }
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = null;
      }
      holdRepeatCountRef.current = 0;
    }, []);

    // Schedule commit after seeking stops
    const scheduleCommit = useCallback(() => {
      // Clear existing commit timeout
      if (commitTimeoutRef.current) {
        clearTimeout(commitTimeoutRef.current);
      }

      // Schedule new commit
      commitTimeoutRef.current = setTimeout(() => {
        commitTimeoutRef.current = null;
        seekingRef.current = false;

        const commitValue = localValueRef.current;
        debug('seekComplete', { value: commitValue });
        onSeekComplete?.(commitValue);
      }, TV_SEEK_COMMIT_DELAY_MS);
    }, [onSeekComplete]);

    // Perform a single seek step
    const performSeekStep = useCallback(
      (direction: 'left' | 'right') => {
        // Calculate step with acceleration
        const repeatCount = holdRepeatCountRef.current;
        const baseStep =
          direction === 'left' ? -PLAYER_SEEK_STEP_SECONDS : PLAYER_SEEK_STEP_SECONDS;
        const multiplier =
          repeatCount >= TV_SEEK_ACCELERATION_THRESHOLD ? TV_SEEK_ACCELERATION_MULTIPLIER : 1;
        const step = baseStep * multiplier;

        // Calculate new value
        const currentVal = localValueRef.current;
        const newValue = Math.max(0, Math.min(maximumValue, currentVal + step));
        debug('seekStep', { prev: currentVal, step, newValue, repeatCount, multiplier });

        // Update local state for UI
        setLocalValue(newValue);
        localValueRef.current = newValue;

        // Notify parent of value change (for time display)
        onValueChange?.(newValue);

        // Increment repeat count for acceleration
        holdRepeatCountRef.current += 1;
      },
      [maximumValue, onValueChange]
    );

    // Start seeking (pause player)
    const startSeeking = useCallback(() => {
      if (!seekingRef.current) {
        seekingRef.current = true;
        debug('seekStart');
        onSeekStart?.();
      }
    }, [onSeekStart]);

    // Handle single press (short press) - just one seek step
    const handleSingleSeek = useCallback(
      (direction: 'left' | 'right') => {
        debug('singleSeek', { direction });
        holdRepeatCountRef.current = 0;
        startSeeking();
        performSeekStep(direction);
        scheduleCommit();
      },
      [startSeeking, performSeekStep, scheduleCommit]
    );

    // Start continuous seeking (long press)
    const startContinuousSeek = useCallback(
      (direction: 'left' | 'right') => {
        debug('startContinuousSeek', { direction });

        // Stop any existing continuous seek
        stopContinuousSeek();

        holdRepeatCountRef.current = 0;
        startSeeking();

        // First step immediately
        performSeekStep(direction);

        // Continue seeking at interval
        holdIntervalRef.current = setInterval(() => {
          performSeekStep(direction);
        }, TV_SEEK_REPEAT_INTERVAL_MS);

        // Safety timeout - stop after max duration
        holdTimeoutRef.current = setTimeout(() => {
          debug('maxHoldDuration reached');
          stopContinuousSeek();
          scheduleCommit();
        }, MAX_HOLD_DURATION_MS);
      },
      [startSeeking, performSeekStep, stopContinuousSeek, scheduleCommit]
    );

    // Handle TV events when focused
    // TV remote behavior:
    // - 'left'/'right': Short press (single seek)
    // - 'longLeft'/'longRight': Long press detected (start continuous seeking)
    // - Another 'left'/'right' or 'longLeft'/'longRight': Key released (stop continuous)
    const handleTVEvent = useCallback(
      (evt: HWEvent) => {
        if (disabled || !isFocusedRef.current) return;

        const eventType = evt.eventType;
        debug('tvEvent', { eventType });

        // Handle short press
        if (eventType === 'left' || eventType === 'right') {
          // If we're in continuous seek mode, this means key was released
          if (holdIntervalRef.current) {
            debug('shortPress while holding - stopping');
            stopContinuousSeek();
            scheduleCommit();
          } else {
            handleSingleSeek(eventType);
          }
          return;
        }

        // Handle long press - start continuous seeking
        if (eventType === 'longLeft') {
          // If already seeking continuously, treat as release
          if (holdIntervalRef.current) {
            debug('longPress while holding - stopping');
            stopContinuousSeek();
            scheduleCommit();
          } else {
            startContinuousSeek('left');
          }
          return;
        }

        if (eventType === 'longRight') {
          if (holdIntervalRef.current) {
            debug('longPress while holding - stopping');
            stopContinuousSeek();
            scheduleCommit();
          } else {
            startContinuousSeek('right');
          }
          return;
        }
      },
      [disabled, handleSingleSeek, startContinuousSeek, stopContinuousSeek, scheduleCommit]
    );

    // Use TV event handler hook
    useTVEventHandler(handleTVEvent);

    const handleFocus = useCallback(() => {
      isFocusedRef.current = true;
      setIsFocused(true);
      onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
      isFocusedRef.current = false;
      setIsFocused(false);
      onBlur?.();

      // Stop any ongoing continuous seek
      stopContinuousSeek();

      // If we were seeking, commit immediately
      if (seekingRef.current) {
        if (commitTimeoutRef.current) {
          clearTimeout(commitTimeoutRef.current);
          commitTimeoutRef.current = null;
        }
        seekingRef.current = false;
        debug('blur - immediate commit', { value: localValueRef.current });
        onSeekComplete?.(localValueRef.current);
      }
    }, [onBlur, onSeekComplete, stopContinuousSeek]);

    // Calculate progress percentage and sizes from theme
    const progress = maximumValue > 0 ? (localValue / maximumValue) * 100 : 0;
    const trackHeight = theme.sizes.progressBarHeight;
    const thumbSize = trackHeight * 2.5; // Base thumb size proportional to track
    const focusedThumbSize = thumbSize * theme.focus.scaleMedium; // Scale by theme focus scale
    const effectiveThumbSize = isFocused ? focusedThumbSize : thumbSize;
    const trackColor = isFocused
      ? theme.colors.focusBackgroundPrimary
      : theme.colors.primaryBackground;

    // Only render on TV platforms
    if (!Platform.isTV) {
      return null;
    }

    return (
      <Pressable
        disabled={disabled}
        onFocus={handleFocus}
        onBlur={handleBlur}
        hasTVPreferredFocus={hasTVPreferredFocus}
        style={styles.pressable}>
        <Box
          height={theme.sizes.inputHeight}
          justifyContent="center"
          paddingHorizontal="s"
          opacity={disabled ? 0.5 : 1}>
          {/* Track container */}
          <View style={styles.trackContainer}>
            {/* Background track */}
            <View
              style={[
                styles.track,
                {
                  backgroundColor: theme.colors.secondaryBackground,
                  height: trackHeight,
                  borderRadius: trackHeight / 2,
                },
              ]}
            />

            {/* Progress track */}
            <View
              style={[
                styles.progressTrack,
                {
                  backgroundColor: trackColor,
                  width: `${progress}%`,
                  height: trackHeight,
                  borderRadius: trackHeight / 2,
                },
              ]}
            />

            {/* Thumb */}
            <View
              style={[
                styles.thumb,
                {
                  left: `${progress}%`,
                  width: effectiveThumbSize,
                  height: effectiveThumbSize,
                  borderRadius: effectiveThumbSize / 2,
                  backgroundColor: trackColor,
                  marginLeft: -effectiveThumbSize / 2,
                  marginTop: -effectiveThumbSize / 2 + trackHeight / 2,
                },
              ]}
            />
          </View>
        </Box>
      </Pressable>
    );
  }
);

TVSeekBar.displayName = 'TVSeekBar';

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  trackContainer: {
    position: 'relative',
    width: '100%',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  thumb: {
    position: 'absolute',
    top: 0,
  },
});

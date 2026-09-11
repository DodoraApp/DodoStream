import { useCallback, useEffect, useRef, useState } from 'react';

import { PLAYER_CONTROLS_AUTO_HIDE_MS } from '@/constants/playback';
import { createDebugLogger } from '@/utils/debug';

const debug = createDebugLogger('useControlsVisibility');

type TimeoutHandle = number | NodeJS.Timeout;

export interface UseControlsVisibilityOptions {
  /** Whether playback is paused - controls stay visible when paused */
  paused: boolean;
  /** Whether seeking is in progress - controls stay visible during seek */
  isSeeking?: boolean;
  /** Whether any modal is open - controls stay visible when modal is shown */
  isModalOpen?: boolean;
  /** Called when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
  /** Auto-hide delay in milliseconds (defaults to PLAYER_CONTROLS_AUTO_HIDE_MS) */
  autoHideDelayMs?: number;
}

export interface UseControlsVisibilityResult {
  /** Whether controls are currently visible */
  visible: boolean;
  /** Register a user interaction (resets auto-hide timer) */
  registerInteraction: () => void;
  /** Show the controls (calls registerInteraction internally) */
  showControls: () => void;
  /** Toggle controls visibility */
  toggleControls: () => void;
  /** Hide controls immediately */
  hideControls: () => void;
}

/**
 * Hook that manages player controls visibility with auto-hide behavior.
 *
 * Features:
 * - Controls stay visible when paused, seeking, or modal is open
 * - Auto-hides after inactivity period during playback
 * - Interaction tracking resets the auto-hide timer
 * - Notifies parent when visibility changes
 */
export const useControlsVisibility = ({
  paused,
  isSeeking = false,
  isModalOpen = false,
  onVisibilityChange,
  autoHideDelayMs = PLAYER_CONTROLS_AUTO_HIDE_MS,
}: UseControlsVisibilityOptions): UseControlsVisibilityResult => {
  const [visible, setVisible] = useState(false);
  // Interaction counter to trigger auto-hide timer reset. The refs are updated
  // synchronously by commands so a native event cannot observe stale visibility
  // while React is batching state updates.
  const [interactionId, setInteractionId] = useState(0);
  const visibleRef = useRef(false);
  const interactionIdRef = useRef(0);
  const autoHideTimeoutRef = useRef<TimeoutHandle | null>(null);
  const pausedRef = useRef(paused);
  const isSeekingRef = useRef(isSeeking);
  const isModalOpenRef = useRef(isModalOpen);

  useEffect(() => {
    pausedRef.current = paused;
    isSeekingRef.current = isSeeking;
    isModalOpenRef.current = isModalOpen;
  }, [paused, isSeeking, isModalOpen]);

  const clearAutoHideTimeout = useCallback(() => {
    const timeout = autoHideTimeoutRef.current;
    autoHideTimeoutRef.current = null;
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  }, []);

  // Clear auto-hide timeout on unmount
  useEffect(() => {
    return clearAutoHideTimeout;
  }, [clearAutoHideTimeout]);

  // Notify parent when visibility changes
  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [visible, onVisibilityChange]);

  // Auto-hide logic
  useEffect(() => {
    clearAutoHideTimeout();

    // Don't auto-hide if:
    // - Controls are not visible
    // - Playback is paused
    // - User is seeking
    // - A modal is open
    const shouldAutoHide = visible && !paused && !isSeeking && !isModalOpen;

    if (shouldAutoHide) {
      const scheduledInteractionId = interactionIdRef.current;
      autoHideTimeoutRef.current = setTimeout(() => {
        // A timeout that was queued before the latest interaction can still
        // fire after clearTimeout on native platforms. Never let it hide
        // controls after a newer interaction has reset the timer.
        if (interactionIdRef.current !== scheduledInteractionId) {
          debug('ignoreStaleAutoHide', {
            scheduledInteractionId,
            currentInteractionId: interactionIdRef.current,
          });
          return;
        }

        if (
          !visibleRef.current ||
          pausedRef.current ||
          isSeekingRef.current ||
          isModalOpenRef.current
        ) {
          return;
        }

        autoHideTimeoutRef.current = null;
        visibleRef.current = false;
        debug('autoHide', { interactionId: scheduledInteractionId });
        setVisible(false);
      }, autoHideDelayMs);
    }

    return clearAutoHideTimeout;
  }, [
    visible,
    paused,
    isSeeking,
    isModalOpen,
    interactionId,
    autoHideDelayMs,
    clearAutoHideTimeout,
  ]);

  const registerInteraction = useCallback(() => {
    const nextInteractionId = interactionIdRef.current + 1;
    interactionIdRef.current = nextInteractionId;
    visibleRef.current = true;
    setInteractionId(nextInteractionId);
    setVisible(true);
  }, []);

  const showControls = useCallback(() => {
    registerInteraction();
  }, [registerInteraction]);

  const hideControls = useCallback(() => {
    interactionIdRef.current += 1;
    visibleRef.current = false;
    setVisible(false);
  }, []);

  const toggleControls = useCallback(() => {
    if (visibleRef.current) {
      hideControls();
    } else {
      registerInteraction();
    }
  }, [hideControls, registerInteraction]);

  return {
    visible,
    registerInteraction,
    showControls,
    toggleControls,
    hideControls,
  };
};

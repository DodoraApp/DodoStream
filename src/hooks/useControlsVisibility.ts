import { useState, useCallback, useEffect, useRef } from 'react';
import { PLAYER_CONTROLS_AUTO_HIDE_MS } from '@/constants/playback';

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
    const [visible, setVisible] = useState(true);
    // Interaction counter to trigger auto-hide timer reset
    const [interactionId, setInteractionId] = useState(0);
    const autoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Clear auto-hide timeout on unmount
    useEffect(() => {
        return () => {
            if (autoHideTimeoutRef.current) {
                clearTimeout(autoHideTimeoutRef.current);
            }
        };
    }, []);

    // Notify parent when visibility changes
    useEffect(() => {
        onVisibilityChange?.(visible);
    }, [visible, onVisibilityChange]);

    // Auto-hide logic
    useEffect(() => {
        // Clear any existing timeout
        if (autoHideTimeoutRef.current) {
            clearTimeout(autoHideTimeoutRef.current);
            autoHideTimeoutRef.current = null;
        }

        // Don't auto-hide if:
        // - Controls are not visible
        // - Playback is paused
        // - User is seeking
        // - A modal is open
        const shouldAutoHide = visible && !paused && !isSeeking && !isModalOpen;

        if (shouldAutoHide) {
            autoHideTimeoutRef.current = setTimeout(() => {
                setVisible(false);
            }, autoHideDelayMs);
        }

        return () => {
            if (autoHideTimeoutRef.current) {
                clearTimeout(autoHideTimeoutRef.current);
                autoHideTimeoutRef.current = null;
            }
        };
    }, [visible, paused, isSeeking, isModalOpen, interactionId, autoHideDelayMs]);

    const registerInteraction = useCallback(() => {
        setInteractionId((prev) => prev + 1);
        setVisible(true);
    }, []);

    const showControls = useCallback(() => {
        registerInteraction();
    }, [registerInteraction]);

    const toggleControls = useCallback(() => {
        if (visible) {
            setVisible(false);
        } else {
            registerInteraction();
        }
    }, [visible, registerInteraction]);

    const hideControls = useCallback(() => {
        setVisible(false);
    }, []);

    return {
        visible,
        registerInteraction,
        showControls,
        toggleControls,
        hideControls,
    };
};

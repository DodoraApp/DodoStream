import { useCallback, useEffect, useRef, useState } from 'react';

type ActivePlayerMenu = 'streams' | 'episodes' | null;

interface UsePlayerMenuControllerProps {
  paused: boolean;
  onPlayPause: () => void;
}

interface CloseSelectionMenuOptions {
  resumePlayback?: boolean;
}

/** Owns player menu visibility and restores playback state when selection menus close. */
export function usePlayerMenuController({ paused, onPlayPause }: UsePlayerMenuControllerProps) {
  const [showAudioTracks, setShowAudioTracks] = useState(false);
  const [showTextTracks, setShowTextTracks] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState<ActivePlayerMenu>(null);
  const isModalOpen = showAudioTracks || showTextTracks || showSettingsModal || activeMenu !== null;

  const pausedRef = useRef(paused);
  const onPlayPauseRef = useRef(onPlayPause);
  const wasPlayingBeforeMenuRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
    onPlayPauseRef.current = onPlayPause;
  }, [onPlayPause, paused]);

  useEffect(() => {
    if (activeMenu !== null) {
      if (!pausedRef.current && !wasPlayingBeforeMenuRef.current) {
        wasPlayingBeforeMenuRef.current = true;
        onPlayPauseRef.current();
      }
      return;
    }

    if (isModalOpen || !wasPlayingBeforeMenuRef.current) return;
    wasPlayingBeforeMenuRef.current = false;
    onPlayPauseRef.current();
  }, [activeMenu, isModalOpen]);

  const closeSelectionMenu = useCallback(
    ({ resumePlayback = true }: CloseSelectionMenuOptions = {}) => {
      if (!resumePlayback) {
        wasPlayingBeforeMenuRef.current = false;
      }
      setActiveMenu(null);
    },
    []
  );

  return {
    activeMenu,
    closeSelectionMenu,
    isModalOpen,
    setActiveMenu,
    showAudioTracks,
    setShowAudioTracks,
    showTextTracks,
    setShowTextTracks,
    showSettingsModal,
    setShowSettingsModal,
  };
}

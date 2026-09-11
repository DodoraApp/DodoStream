import { act, renderHook } from '@testing-library/react-native';

import { usePlayerMenuController } from '../usePlayerMenuController';

describe('usePlayerMenuController', () => {
  it('does not resume playback until all modals are closed', () => {
    const onPlayPause = jest.fn();
    const { result } = renderHook(() => usePlayerMenuController({ paused: false, onPlayPause }));

    act(() => {
      result.current.setShowAudioTracks(true);
      result.current.setActiveMenu('streams');
    });
    expect(onPlayPause).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setActiveMenu(null);
    });
    expect(onPlayPause).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setShowAudioTracks(false);
    });
    expect(onPlayPause).toHaveBeenCalledTimes(2);
  });

  it('does not toggle playback when the player is already paused', () => {
    const onPlayPause = jest.fn();
    const { result } = renderHook(() => usePlayerMenuController({ paused: true, onPlayPause }));

    act(() => {
      result.current.setActiveMenu('episodes');
    });
    act(() => {
      result.current.setActiveMenu(null);
    });

    expect(onPlayPause).not.toHaveBeenCalled();
  });

  it('does not pause twice when switching selection menus', () => {
    const onPlayPause = jest.fn();
    const { result } = renderHook(() => usePlayerMenuController({ paused: false, onPlayPause }));

    act(() => {
      result.current.setActiveMenu('streams');
    });
    act(() => {
      result.current.setActiveMenu('episodes');
    });
    expect(onPlayPause).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setActiveMenu(null);
    });
    expect(onPlayPause).toHaveBeenCalledTimes(2);
  });

  it('waits for audio, text, and settings modals before resuming', () => {
    const onPlayPause = jest.fn();
    const { result } = renderHook(() => usePlayerMenuController({ paused: false, onPlayPause }));

    act(() => {
      result.current.setActiveMenu('episodes');
      result.current.setShowAudioTracks(true);
    });
    expect(onPlayPause).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setActiveMenu(null);
      result.current.setShowTextTracks(true);
    });
    act(() => {
      result.current.setShowAudioTracks(false);
      result.current.setShowSettingsModal(true);
    });
    act(() => {
      result.current.setShowTextTracks(false);
    });
    expect(onPlayPause).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setShowSettingsModal(false);
    });
    expect(onPlayPause).toHaveBeenCalledTimes(2);
  });

  it('can close a selection menu without resuming during navigation', () => {
    const onPlayPause = jest.fn();
    const { result } = renderHook(() => usePlayerMenuController({ paused: false, onPlayPause }));

    act(() => {
      result.current.setActiveMenu('episodes');
    });
    expect(onPlayPause).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.closeSelectionMenu({ resumePlayback: false });
    });

    expect(result.current.activeMenu).toBeNull();
    expect(onPlayPause).toHaveBeenCalledTimes(1);
  });
});

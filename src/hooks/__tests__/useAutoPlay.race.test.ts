import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as streamsApi from '@/api/stremio';
import { MAX_AUTO_PLAY_ATTEMPTS } from '@/constants/playback';
import * as db from '@/db';
import * as mediaNav from '@/hooks/useMediaNavigation';
import * as playbackStore from '@/store/playback.store';
import * as toastStore from '@/store/toast.store';

import { useAutoPlay } from '../useAutoPlay';

jest.mock('@/store/toast.store', () => ({ showToast: jest.fn() }));
jest.mock('@/api/stremio');
jest.mock('@/hooks/useMediaNavigation', () => ({ useMediaNavigation: jest.fn() }));
jest.mock('@/store/playback.store', () => {
  const mockStore = Object.assign(jest.fn(), {
    getState: jest.fn(() => ({ setActiveProfileId: jest.fn() })),
    subscribe: jest.fn(() => jest.fn()),
  });
  return { usePlaybackStore: mockStore };
});
jest.mock('@/db', () => ({ getLastStreamTarget: jest.fn() }));
jest.mock('@/utils/debug', () => ({ createDebugLogger: () => jest.fn() }));

const defaultProps = {
  metaId: 'meta-1',
  videoId: 'episode-1',
  type: 'movie' as const,
  playerTitle: 'Title',
};

const createDeferred = <T>() => {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve: resolve! };
};

describe('useAutoPlay race and input behavior', () => {
  let streams: any[];
  let state: any;
  let openStreamFromStream: jest.Mock;
  let openStreamTarget: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    streams = [
      { addonId: 'addon-a', url: 'https://cdn.example/first.m3u8' },
      { addonId: 'addon-a', url: 'https://cdn.example/second.m3u8' },
      { addonId: 'addon-a', url: 'https://cdn.example/third.m3u8' },
      { addonId: 'addon-a', url: 'https://cdn.example/fourth.m3u8' },
    ];
    state = {
      activeProfileId: 'profile-1',
      byProfile: { 'profile-1': { autoPlayFirstStream: true } },
    };
    (playbackStore.usePlaybackStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(state)
    );
    (playbackStore.usePlaybackStore as any).getState = () => state;
    (streamsApi.useStreams as jest.Mock).mockReturnValue({ data: streams, isLoading: false });

    openStreamFromStream = jest.fn();
    openStreamTarget = jest.fn();
    (mediaNav.useMediaNavigation as jest.Mock).mockReturnValue({
      openStreamFromStream,
      openStreamTarget,
    });
    (db.getLastStreamTarget as jest.Mock).mockResolvedValue(undefined);
  });

  it.each(['0', 'false'])(
    'treats explicit autoPlay=%s as an opt-out even when the setting is on',
    (autoPlay) => {
      const { result } = renderHook(() => useAutoPlay({ ...defaultProps, autoPlay }));

      expect(result.current.effectiveAutoPlay).toBe(false);
      expect(openStreamFromStream).not.toHaveBeenCalled();
      expect(streamsApi.useStreams).toHaveBeenLastCalledWith(
        defaultProps.type,
        defaultProps.metaId,
        defaultProps.videoId,
        false
      );
    }
  );

  it('waits for the persisted stream target before selecting a first-stream fallback', async () => {
    const deferredTarget = createDeferred<{ type: 'url'; value: string } | undefined>();
    (db.getLastStreamTarget as jest.Mock).mockReturnValue(deferredTarget.promise);

    renderHook(() => useAutoPlay({ ...defaultProps, autoPlay: '1' }));

    expect(openStreamFromStream).not.toHaveBeenCalled();
    expect(openStreamTarget).not.toHaveBeenCalled();

    await act(async () => {
      deferredTarget.resolve({ type: 'url', value: 'https://saved.example/resume.m3u8' });
      await deferredTarget.promise;
    });

    await waitFor(() => {
      expect(openStreamTarget).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { type: 'url', value: 'https://saved.example/resume.m3u8' },
          fromAutoPlay: true,
          navigation: 'replace',
        })
      );
    });
    expect(openStreamFromStream).not.toHaveBeenCalled();
  });

  it('falls back to a playable stream when reading the persisted target fails', async () => {
    (db.getLastStreamTarget as jest.Mock).mockRejectedValue(new Error('database unavailable'));

    renderHook(() => useAutoPlay({ ...defaultProps, autoPlay: '1' }));

    await waitFor(() => {
      expect(openStreamFromStream).toHaveBeenCalledWith(
        expect.objectContaining({ stream: streams[0], navigation: 'replace', fromAutoPlay: true })
      );
    });
    expect(openStreamTarget).not.toHaveBeenCalled();
  });

  it('does not act on a stale persisted target after navigating to another episode', async () => {
    const oldTarget = createDeferred<{ type: 'url'; value: string } | undefined>();
    const newTarget = createDeferred<{ type: 'url'; value: string } | undefined>();
    (db.getLastStreamTarget as jest.Mock)
      .mockReturnValueOnce(oldTarget.promise)
      .mockReturnValueOnce(newTarget.promise);

    const { rerender } = renderHook(
      (props: typeof defaultProps) => useAutoPlay({ ...props, autoPlay: '1' }),
      { initialProps: defaultProps }
    );

    rerender({ ...defaultProps, metaId: 'meta-2', videoId: 'episode-2' });

    await act(async () => {
      oldTarget.resolve({ type: 'url', value: 'https://old.example/stream.m3u8' });
      await oldTarget.promise;
    });
    expect(openStreamTarget).not.toHaveBeenCalled();
    expect(openStreamFromStream).not.toHaveBeenCalled();

    await act(async () => {
      newTarget.resolve({ type: 'url', value: 'https://new.example/stream.m3u8' });
      await newTarget.promise;
    });

    await waitFor(() => {
      expect(openStreamTarget).toHaveBeenCalledWith(
        expect.objectContaining({
          metaId: 'meta-2',
          videoId: 'episode-2',
          target: { type: 'url', value: 'https://new.example/stream.m3u8' },
        })
      );
    });
  });

  it('limits external-open retries to the configured attempt ceiling', async () => {
    openStreamFromStream.mockImplementation(({ onExternalOpenFailed }) => onExternalOpenFailed());

    const { result } = renderHook(() => useAutoPlay({ ...defaultProps, autoPlay: '1' }));

    await waitFor(() => {
      expect(openStreamFromStream).toHaveBeenCalledTimes(MAX_AUTO_PLAY_ATTEMPTS);
      expect(result.current.effectiveAutoPlay).toBe(false);
    });
    expect(openStreamFromStream).toHaveBeenNthCalledWith(
      MAX_AUTO_PLAY_ATTEMPTS,
      expect.objectContaining({ stream: streams[MAX_AUTO_PLAY_ATTEMPTS - 1] })
    );
  });

  it('reports a group with no playable streams rather than crossing into a different release group', async () => {
    streams = [
      { url: 'https://cdn.example/group-a.m3u8', behaviorHints: { group: 'group-a' } },
      { externalUrl: 'https://browser.example/group-a', behaviorHints: { group: 'group-a' } },
    ];
    (streamsApi.useStreams as jest.Mock).mockReturnValue({ data: streams, isLoading: false });

    const { result } = renderHook(() =>
      useAutoPlay({ ...defaultProps, autoPlay: '1', bingeGroup: 'group-b' })
    );

    await waitFor(() => {
      expect(toastStore.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'no_playable_stream', preset: 'error' })
      );
      expect(result.current.effectiveAutoPlay).toBe(false);
    });
    expect(openStreamFromStream).not.toHaveBeenCalled();
  });

  it('does not navigate after autoplay is cancelled while target resolution is pending', async () => {
    const deferredTarget = createDeferred<{ type: 'url'; value: string } | undefined>();
    (db.getLastStreamTarget as jest.Mock).mockReturnValue(deferredTarget.promise);

    const { result } = renderHook(() => useAutoPlay({ ...defaultProps, autoPlay: '1' }));
    act(() => result.current.cancelAutoPlay());

    await act(async () => {
      deferredTarget.resolve({ type: 'url', value: 'https://saved.example/resume.m3u8' });
      await deferredTarget.promise;
    });

    expect(result.current.effectiveAutoPlay).toBe(false);
    expect(openStreamTarget).not.toHaveBeenCalled();
    expect(openStreamFromStream).not.toHaveBeenCalled();
  });
});

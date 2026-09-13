import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as streamsApi from '@/api/stremio';
import { MAX_AUTO_PLAY_ATTEMPTS } from '@/constants/playback';
import * as db from '@/db';
import * as mediaNav from '@/hooks/useMediaNavigation';
import * as profileStore from '@/store/playback.store';
import * as toastStore from '@/store/toast.store';

import { useAutoPlay } from '../useAutoPlay';

jest.mock('@/store/toast.store', () => ({ showToast: jest.fn() }));
jest.mock('@/api/stremio');
jest.mock('@/hooks/useMediaNavigation', () => ({
  useMediaNavigation: jest.fn(),
}));
jest.mock('@/store/playback.store', () => {
  const mockStore = Object.assign(jest.fn(), {
    getState: jest.fn(() => ({ setActiveProfileId: jest.fn() })),
    subscribe: jest.fn(() => jest.fn()),
  });
  return { usePlaybackStore: mockStore };
});
jest.mock('@/db', () => ({
  getLastStreamTarget: jest.fn(),
}));
jest.mock('@/utils/debug', () => ({
  __esModule: true,
  createDebugLogger: () => jest.fn(),
}));

const defaultProps = {
  metaId: 'meta1',
  videoId: 'vid1',
  type: 'movie' as const,
  playerTitle: 'My Movie',
};
const flushPromiseQueue = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('useAutoPlay', () => {
  let mockStreams: any[];
  let openStreamFromStream: jest.Mock;
  let openStreamTarget: jest.Mock;
  let profileSettingsState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStreams = [
      { url: 'http://example.com/1', name: 'Stream1' },
      { url: 'http://example.com/2', name: 'Stream2' },
    ];

    profileSettingsState = {
      activeProfileId: 'profile1',
      byProfile: {
        profile1: { autoPlayFirstStream: false },
      },
    };

    (profileStore.usePlaybackStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(profileSettingsState)
    );
    (profileStore.usePlaybackStore as any).getState = () => profileSettingsState;

    (streamsApi.useStreams as jest.Mock).mockReturnValue({
      data: mockStreams,
      isLoading: false,
    });

    // Media navigation mock
    openStreamFromStream = jest.fn();
    openStreamTarget = jest.fn();
    (mediaNav.useMediaNavigation as jest.Mock).mockReturnValue({
      openStreamFromStream,
      openStreamTarget,
    });

    (db.getLastStreamTarget as jest.Mock).mockResolvedValue(undefined);
  });

  it('auto plays when autoPlay param is passed', async () => {
    profileSettingsState.byProfile.profile1.autoPlayFirstStream = false;

    renderHook(() => useAutoPlay({ ...defaultProps, autoPlay: '1' }));
    await flushPromiseQueue();

    await waitFor(() => {
      expect(openStreamFromStream).toHaveBeenCalledWith(
        expect.objectContaining({ stream: mockStreams[0] })
      );
    });
  });

  it('auto plays when the setting is on and the param is not passed', async () => {
    profileSettingsState.byProfile.profile1.autoPlayFirstStream = true;

    renderHook(() => useAutoPlay(defaultProps));
    await flushPromiseQueue();

    await waitFor(() => {
      expect(openStreamFromStream).toHaveBeenCalledWith(
        expect.objectContaining({ stream: mockStreams[0] })
      );
    });
  });

  it('does not auto play if the param is not passed and the setting is off', async () => {
    profileSettingsState.byProfile.profile1.autoPlayFirstStream = false;

    renderHook(() => useAutoPlay(defaultProps));

    expect(openStreamFromStream).not.toHaveBeenCalled();
  });

  it('fails after max auto play attempts and triggers showToast', async () => {
    profileSettingsState.byProfile.profile1.autoPlayFirstStream = true;

    // Streams: all invalid
    const invalidStreams = Array(MAX_AUTO_PLAY_ATTEMPTS).fill({});
    (streamsApi.useStreams as jest.Mock).mockReturnValue({
      data: invalidStreams,
      isLoading: false,
    });

    renderHook(() => useAutoPlay(defaultProps));
    await flushPromiseQueue();

    await waitFor(() => {
      expect(toastStore.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'no_playable_stream',
          preset: 'error',
        })
      );
    });
  });

  it('auto plays last stream target if it exists', async () => {
    profileSettingsState.byProfile.profile1.autoPlayFirstStream = true;

    const lastTarget = { type: 'url', url: 'http://laststream.com' };
    (db.getLastStreamTarget as jest.Mock).mockResolvedValue({
      type: 'url',
      value: lastTarget.url,
    });

    (streamsApi.useStreams as jest.Mock)
      .mockImplementationOnce(() => ({
        data: [],
        isLoading: true,
      }))
      .mockImplementation(() => ({
        data: mockStreams,
        isLoading: false,
      }));

    // Streams: playable, but should not be used
    (streamsApi.useStreams as jest.Mock).mockReturnValue({
      data: mockStreams,
      isLoading: false,
    });

    renderHook(() => useAutoPlay(defaultProps));
    await flushPromiseQueue();

    await waitFor(() => {
      expect(openStreamTarget).toHaveBeenCalledWith(
        expect.objectContaining({
          metaId: defaultProps.metaId,
          videoId: defaultProps.videoId,
          target: { type: 'url', value: lastTarget.url },
          fromAutoPlay: true,
        })
      );
    });

    // Ensure openStreamFromStream is NOT called
    expect(openStreamFromStream).not.toHaveBeenCalled();
  });
  it('uses the refreshed URL when a persisted stream ID matches', async () => {
    profileSettingsState.byProfile.profile1.autoPlayFirstStream = true;
    mockStreams = [
      {
        addonId: 'addon-1',
        infoHash: 'info-hash',
        url: 'http://newstream.com',
        name: 'Refreshed stream',
      },
    ];
    (streamsApi.useStreams as jest.Mock)
      .mockImplementationOnce(() => ({
        data: [],
        isLoading: true,
      }))
      .mockImplementation(() => ({
        data: mockStreams,
        isLoading: false,
      }));
    (db.getLastStreamTarget as jest.Mock).mockResolvedValue({
      type: 'url',
      value: 'http://oldstream.com',
      streamId: 'addon-1::info-hash',
    });

    renderHook(() => useAutoPlay(defaultProps));
    await flushPromiseQueue();

    await waitFor(() => {
      expect(openStreamTarget).toHaveBeenCalledWith(
        expect.objectContaining({
          target: {
            type: 'url',
            value: 'http://newstream.com',
            streamId: 'addon-1::info-hash',
          },
          streamId: 'addon-1::info-hash',
        })
      );
    });
  });
  it('cancels autoplay when manual stream selection is requested', async () => {
    const { result } = renderHook(() => useAutoPlay({ ...defaultProps, autoPlay: '1' }));

    expect(result.current.effectiveAutoPlay).toBe(true);

    act(() => {
      result.current.cancelAutoPlay();
    });

    await flushPromiseQueue();

    expect(result.current.effectiveAutoPlay).toBe(false);
    expect(openStreamFromStream).not.toHaveBeenCalled();
  });
});

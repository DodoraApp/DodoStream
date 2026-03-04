import { renderHook, waitFor } from '@testing-library/react-native';
import { useAutoPlay } from '../useAutoPlay';
import * as toastStore from '@/store/toast.store';
import * as streamsApi from '@/api/stremio';
import * as mediaNav from '@/hooks/useMediaNavigation';
import * as profileStore from '@/store/profile-settings.store';
import * as db from '@/db';
import { MAX_AUTO_PLAY_ATTEMPTS } from '@/constants/playback';

jest.mock('@/store/toast.store', () => ({ showToast: jest.fn() }));
jest.mock('@/api/stremio');
jest.mock('@/hooks/useMediaNavigation', () => ({
  useMediaNavigation: jest.fn(),
}));
jest.mock('@/store/profile-settings.store');
jest.mock('@/db', () => ({
  getLastStreamTarget: jest.fn(),
}));
jest.mock('@/utils/debug', () => ({
  __esModule: true,
  useDebugLogger: () => jest.fn(),
  createDebugLogger: () => jest.fn(),
}));

const defaultProps = {
  metaId: 'meta1',
  videoId: 'vid1',
  type: 'movie' as const,
  playerTitle: 'My Movie',
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

    (profileStore.useProfileSettingsStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(profileSettingsState)
    );
    (profileStore.useProfileSettingsStore as any).getState = () => profileSettingsState;

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

    expect(openStreamFromStream).toHaveBeenCalledWith(
      expect.objectContaining({ stream: mockStreams[0] })
    );
  });

  it('auto plays when the setting is on and the param is not passed', async () => {
    profileSettingsState.byProfile.profile1.autoPlayFirstStream = true;

    renderHook(() => useAutoPlay(defaultProps));

    expect(openStreamFromStream).toHaveBeenCalledWith(
      expect.objectContaining({ stream: mockStreams[0] })
    );
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

    await waitFor(() => {
      expect(toastStore.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'No playable stream found',
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
});

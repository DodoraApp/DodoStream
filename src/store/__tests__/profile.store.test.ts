import { initializeProfiles, type Profile, useProfileStore } from '@/store/profile.store';

jest.mock('@/db', () => ({
  removeProfileMyList: jest.fn(),
  removeProfileWatchHistory: jest.fn(),
}));

jest.mock('@/store/home.store', () => ({
  useHomeStore: {
    getState: () => ({ setActiveProfileId: jest.fn() }),
  },
}));

jest.mock('@/store/playback.store', () => ({
  usePlaybackStore: {
    getState: () => ({ setActiveProfileId: jest.fn() }),
  },
}));

const createProfile = (id: string, pin?: string): Profile => ({
  id,
  name: id,
  avatarIcon: 'person',
  avatarColor: 'blue',
  pin,
  createdAt: 1,
  lastUsedAt: 1,
});

describe('initializeProfiles', () => {
  beforeEach(() => {
    useProfileStore.setState({
      profiles: {},
      activeProfileId: undefined,
      isInitialized: false,
    });
  });

  it('auto-selects the only profile at startup', async () => {
    const profile = createProfile('profile-1');
    useProfileStore.setState({ profiles: { [profile.id]: profile } });

    await initializeProfiles();

    expect(useProfileStore.getState().activeProfileId).toBe(profile.id);
    expect(useProfileStore.getState().isInitialized).toBe(true);
  });

  it('leaves multiple profiles unselected so the picker can be shown', async () => {
    const firstProfile = createProfile('profile-1');
    const secondProfile = createProfile('profile-2');
    useProfileStore.setState({
      profiles: {
        [firstProfile.id]: firstProfile,
        [secondProfile.id]: secondProfile,
      },
    });

    await initializeProfiles();

    expect(useProfileStore.getState().activeProfileId).toBeUndefined();
    expect(useProfileStore.getState().isInitialized).toBe(true);
  });

  it('does not bypass the PIN on a single protected profile', async () => {
    const profile = createProfile('profile-1', '1234');
    useProfileStore.setState({ profiles: { [profile.id]: profile } });

    await initializeProfiles();

    expect(useProfileStore.getState().activeProfileId).toBeUndefined();
    expect(useProfileStore.getState().isInitialized).toBe(true);
  });
});

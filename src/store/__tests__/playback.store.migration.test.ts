/**
 * Regression tests for the playback store persisted-state migration.
 *
 * Background: version 2 introduced `skipTimestampProvidersEnabled`, which gates
 * external timestamp providers such as IntroDB. Version 1 persisted profiles
 * only knew `skipIntroEnabled`. The migration derives the new flag from the
 * user's previous choice instead of enabling it blindly:
 *   - `skipIntroEnabled` passes through untouched
 *   - `skipTimestampProvidersEnabled` is true only where skip intro was true
 */

import { migratePersistedPlaybackState } from '../playback.store';

/** A persisted profile as it looked in version 1 — no timestamp-provider flag. */
const v1Profile = {
  player: 'exoplayer',
  automaticFallback: true,
  autoPlayFirstStream: false,
  showVideoStatistics: false,
  tunneled: false,
  audioPassthrough: false,
  enableWorkarounds: true,
  matchFrameRate: false,
  enableVideoSoftwareDecoding: false,
  skipIntroEnabled: true,
};

describe('migratePersistedPlaybackState', () => {
  it('derives skipTimestampProvidersEnabled from the previous skipIntroEnabled choice', () => {
    const migrated = migratePersistedPlaybackState(
      {
        activeProfileId: 'p1',
        byProfile: {
          p1: v1Profile,
          p2: { ...v1Profile, skipIntroEnabled: false },
        },
      },
      1
    );

    expect(migrated.byProfile.p1.skipIntroEnabled).toBe(true);
    expect(migrated.byProfile.p1.skipTimestampProvidersEnabled).toBe(true);
    expect(migrated.byProfile.p2.skipIntroEnabled).toBe(false);
    expect(migrated.byProfile.p2.skipTimestampProvidersEnabled).toBe(false);
    expect(migrated.activeProfileId).toBe('p1');
  });

  it('treats a missing version as pre-v2 and migrates', () => {
    const migrated = migratePersistedPlaybackState(
      { activeProfileId: 'p1', byProfile: { p1: v1Profile } },
      0
    );

    expect(migrated.byProfile.p1.skipTimestampProvidersEnabled).toBe(true);
    expect(migrated.byProfile.p1.skipIntroEnabled).toBe(true);
  });

  it('passes version 2 state through untouched', () => {
    const current = {
      activeProfileId: 'p1',
      byProfile: {
        p1: { ...v1Profile, skipTimestampProvidersEnabled: false },
      },
    };

    const migrated = migratePersistedPlaybackState(current, 2);

    expect(migrated).toBe(current);
  });

  it('handles persisted state without profiles', () => {
    const migrated = migratePersistedPlaybackState({ activeProfileId: 'p1' }, 1);

    expect(migrated.byProfile).toEqual({});
    expect(migrated.activeProfileId).toBe('p1');
  });

  it('does not crash on a null byProfile map', () => {
    const migrated = migratePersistedPlaybackState({ byProfile: null }, 1);

    expect(migrated.byProfile).toEqual({});
  });
});

/**
 * Integration tests for ID mapping cache management queries.
 */

import { initializeDatabase } from '../client';
import { clearMetaIds, countMetaIds, upsertMetaIds } from '../queries/idMapping';

describe('meta ID cache management (integration)', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await clearMetaIds();
  });

  it('counts and clears cached external ID mappings', async () => {
    await upsertMetaIds({ metaId: 'cached-meta-1', imdbId: 'tt0000001' });
    await upsertMetaIds({ metaId: 'cached-meta-2', tmdbId: '1000002' });

    await expect(countMetaIds()).resolves.toBe(2);

    await clearMetaIds();

    await expect(countMetaIds()).resolves.toBe(0);
  });
});

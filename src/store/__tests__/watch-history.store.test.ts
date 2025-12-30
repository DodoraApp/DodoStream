import { useWatchHistoryStore } from '../watch-history.store';
import { ContentType } from '@/types/stremio';

describe('WatchHistoryStore', () => {
    const profileId = 'test-profile-id';

    beforeEach(() => {
        // Reset watch history store
        useWatchHistoryStore.setState({ byProfile: {}, activeProfileId: profileId });
        useWatchHistoryStore.getState().setActiveProfileId(profileId);
    });

    describe('upsertItem', () => {
        it('should upsert an item', () => {
            // Arrange
            const item = {
                id: 'tt1234567',
                type: 'movie' as ContentType,
                progressSeconds: 100,
                durationSeconds: 1000,
            };

            // Act
            useWatchHistoryStore.getState().upsertItem(item);

            // Assert
            const storedItem = useWatchHistoryStore.getState().getItem(item.id);
            expect(storedItem).toBeDefined();
            expect(storedItem?.id).toBe(item.id);
            expect(storedItem?.progressSeconds).toBe(item.progressSeconds);
        });

        it('should not upsert item with very low progress (below threshold)', () => {
            // Arrange
            const item = {
                id: 'tt1234567',
                type: 'movie' as ContentType,
                progressSeconds: 10, // 1%
                durationSeconds: 1000,
            };

            // Act
            useWatchHistoryStore.getState().upsertItem(item);

            // Assert
            const storedItem = useWatchHistoryStore.getState().getItem(item.id);
            expect(storedItem).toBeUndefined();
        });

        it('should separate history by profile', () => {
            // Arrange
            const item = {
                id: 'tt1',
                type: 'movie' as ContentType,
                progressSeconds: 500,
                durationSeconds: 1000,
            };

            // Add to profile 1
            // Act
            useWatchHistoryStore.getState().upsertItem(item);

            // Assert
            expect(useWatchHistoryStore.getState().getItem(item.id)).toBeDefined();

            // Switch to profile 2
            // Act
            const profile2Id = 'profile-2';
            useWatchHistoryStore.getState().setActiveProfileId(profile2Id);

            // Assert
            expect(useWatchHistoryStore.getState().getItem(item.id)).toBeUndefined();
        });
    });

    describe('updateProgress', () => {
        it('should update progress', () => {
            // Arrange
            const item = {
                id: 'tt1234567',
                type: 'movie' as ContentType,
                progressSeconds: 100,
                durationSeconds: 1000,
            };

            // Act
            useWatchHistoryStore.getState().upsertItem(item);
            useWatchHistoryStore.getState().updateProgress(item.id, undefined, 500, 1000);

            // Assert
            const storedItem = useWatchHistoryStore.getState().getItem(item.id);
            expect(storedItem?.progressSeconds).toBe(500);
        });
    });

    describe('getContinueWatching', () => {
        it('should get continue watching items', () => {
            // Arrange
            const item1 = {
                id: 'tt1',
                type: 'movie' as ContentType,
                progressSeconds: 500,
                durationSeconds: 1000, // 50% - should show
                lastWatchedAt: Date.now() - 1000,
            };
            const item2 = {
                id: 'tt2',
                type: 'movie' as ContentType,
                progressSeconds: 950,
                durationSeconds: 1000, // 95% - finished, should not show unless videoId present (logic check)
                lastWatchedAt: Date.now(),
            };
            // Logic check: isContinueWatching says:
            // if ratio >= PLAYBACK_FINISHED_RATIO (0.9) && !!videoId -> true
            // if ratio >= PLAYBACK_FINISHED_RATIO (0.9) && !videoId -> false (movie finished)

            // Act
            useWatchHistoryStore.getState().upsertItem(item1);
            useWatchHistoryStore.getState().upsertItem(item2);

            // Assert
            const continueWatching = useWatchHistoryStore.getState().getContinueWatching();
            expect(continueWatching).toHaveLength(1);
            expect(continueWatching[0].id).toBe('tt1');
        });

        it('should include finished episodes in continue watching (Up Next candidates)', () => {
            // Arrange
            const episode = {
                id: 'tt_show',
                videoId: 'tt_show:1:1',
                type: 'series' as ContentType,
                progressSeconds: 950,
                durationSeconds: 1000, // Finished
            };

            // Act
            useWatchHistoryStore.getState().upsertItem(episode);

            // Assert
            const continueWatching = useWatchHistoryStore.getState().getContinueWatching();
            expect(continueWatching).toHaveLength(1);
            expect(continueWatching[0].id).toBe('tt_show');
        });
    });

    describe('remove', () => {
        it('should remove an item', () => {
            // Arrange
            const item = {
                id: 'tt1',
                type: 'movie' as ContentType,
                progressSeconds: 500,
                durationSeconds: 1000,
            };

            // Act
            useWatchHistoryStore.getState().upsertItem(item);
            expect(useWatchHistoryStore.getState().getItem(item.id)).toBeDefined();

            // Act
            useWatchHistoryStore.getState().remove(item.id);

            // Assert
            expect(useWatchHistoryStore.getState().getItem(item.id)).toBeUndefined();
        });
    });

    describe('getItemsForMeta', () => {
        it('should return all items for a specific meta', () => {
            // Arrange
            const episode1 = {
                id: 'tt_show',
                videoId: 'tt_show:1:1',
                type: 'series' as ContentType,
                progressSeconds: 500,
                durationSeconds: 1000,
            };
            const episode2 = {
                id: 'tt_show',
                videoId: 'tt_show:1:2',
                type: 'series' as ContentType,
                progressSeconds: 300,
                durationSeconds: 1000,
            };
            const otherShow = {
                id: 'tt_other',
                videoId: 'tt_other:1:1',
                type: 'series' as ContentType,
                progressSeconds: 200,
                durationSeconds: 1000,
            };

            // Act
            useWatchHistoryStore.getState().upsertItem(episode1);
            useWatchHistoryStore.getState().upsertItem(episode2);
            useWatchHistoryStore.getState().upsertItem(otherShow);

            // Assert
            const items = useWatchHistoryStore.getState().getItemsForMeta('tt_show');
            expect(items).toHaveLength(2);
            expect(items.map((i) => i.videoId).sort()).toEqual(['tt_show:1:1', 'tt_show:1:2']);
        });

        it('should return empty array for unknown meta', () => {
            // Act
            const items = useWatchHistoryStore.getState().getItemsForMeta('unknown');

            // Assert
            expect(items).toEqual([]);
        });
    });

    describe('lastStreamTarget', () => {
        it('setLastStreamTarget stores target on specific level only (videoId provided = video level only)', () => {
            useWatchHistoryStore
                .getState()
                .setLastStreamTarget('m1', 'v1', 'movie' as ContentType, {
                    type: 'url',
                    value: 'https://example.com/video.mp4',
                });

            // Video-level should be set
            expect(useWatchHistoryStore.getState().getLastStreamTarget('m1', 'v1')).toEqual({
                type: 'url',
                value: 'https://example.com/video.mp4',
            });

            // Meta-level should NOT be set when videoId was provided
            expect(useWatchHistoryStore.getState().getLastStreamTarget('m1')).toBeUndefined();
        });

        it('setLastStreamTarget stores on meta level when videoId is undefined', () => {
            useWatchHistoryStore
                .getState()
                .setLastStreamTarget('m2', undefined, 'movie' as ContentType, {
                    type: 'external',
                    value: 'https://example.com',
                });

            // Meta-level should be set
            expect(useWatchHistoryStore.getState().getLastStreamTarget('m2')).toEqual({
                type: 'external',
                value: 'https://example.com',
            });
        });
    });

    describe('getWatchState', () => {
        it('returns not-watched when no history item exists', () => {
            expect(useWatchHistoryStore.getState().getWatchState('unknown')).toBe('not-watched');
        });

        it('returns not-watched when progress is 0', () => {
            useWatchHistoryStore.getState().upsertItem({
                id: 'tt1',
                type: 'movie' as ContentType,
                progressSeconds: 100, // above threshold
                durationSeconds: 1000,
            });
            useWatchHistoryStore.getState().updateProgress('tt1', undefined, 0, 1000);

            expect(useWatchHistoryStore.getState().getWatchState('tt1')).toBe('not-watched');
        });

        it('returns in-progress when partially watched', () => {
            useWatchHistoryStore.getState().upsertItem({
                id: 'tt1',
                type: 'movie' as ContentType,
                progressSeconds: 500,
                durationSeconds: 1000,
            });

            expect(useWatchHistoryStore.getState().getWatchState('tt1')).toBe('in-progress');
        });

        it('returns watched when at or above finished ratio', () => {
            useWatchHistoryStore.getState().upsertItem({
                id: 'tt1',
                type: 'movie' as ContentType,
                progressSeconds: 950,
                durationSeconds: 1000,
            });

            expect(useWatchHistoryStore.getState().getWatchState('tt1')).toBe('watched');
        });

        it('returns correct state for specific videoId', () => {
            useWatchHistoryStore.getState().upsertItem({
                id: 'show1',
                videoId: 'ep1',
                type: 'series' as ContentType,
                progressSeconds: 500,
                durationSeconds: 1000,
            });
            useWatchHistoryStore.getState().upsertItem({
                id: 'show1',
                videoId: 'ep2',
                type: 'series' as ContentType,
                progressSeconds: 950,
                durationSeconds: 1000,
            });

            expect(useWatchHistoryStore.getState().getWatchState('show1', 'ep1')).toBe('in-progress');
            expect(useWatchHistoryStore.getState().getWatchState('show1', 'ep2')).toBe('watched');
        });
    });

    describe('getLatestItemForMeta', () => {
        it('returns undefined when no items exist', () => {
            expect(useWatchHistoryStore.getState().getLatestItemForMeta('unknown')).toBeUndefined();
        });

        it('returns the single item when only one exists', () => {
            useWatchHistoryStore.getState().upsertItem({
                id: 'tt1',
                type: 'movie' as ContentType,
                progressSeconds: 500,
                durationSeconds: 1000,
            });

            const latest = useWatchHistoryStore.getState().getLatestItemForMeta('tt1');
            expect(latest?.id).toBe('tt1');
        });

        it('returns the most recently watched item', () => {
            useWatchHistoryStore.getState().upsertItem({
                id: 'show1',
                videoId: 'ep1',
                type: 'series' as ContentType,
                progressSeconds: 500,
                durationSeconds: 1000,
                lastWatchedAt: 1000,
            });
            useWatchHistoryStore.getState().upsertItem({
                id: 'show1',
                videoId: 'ep2',
                type: 'series' as ContentType,
                progressSeconds: 300,
                durationSeconds: 1000,
                lastWatchedAt: 2000,
            });

            const latest = useWatchHistoryStore.getState().getLatestItemForMeta('show1');
            expect(latest?.videoId).toBe('ep2');
        });
    });
});

import { renderHook } from '@testing-library/react-native';
import {
    useContinueWatching,
    useContinueWatchingForMeta,
    useNextVideo,
} from '../useContinueWatching';
import { useProfileStore } from '@/store/profile.store';
import { useWatchHistoryStore, type WatchHistoryItem } from '@/store/watch-history.store';

describe('useContinueWatching', () => {
    const setActiveProfileId = (profileId?: string) => {
        useProfileStore.setState({ activeProfileId: profileId } as any);
    };

    /**
     * Set watch history using the new nested structure:
     * byProfile[profileId][metaId][videoKey] = WatchHistoryItem
     */
    const setWatchHistoryNested = (
        profileId: string,
        items: WatchHistoryItem[]
    ) => {
        const nested: Record<string, Record<string, WatchHistoryItem>> = {};
        for (const item of items) {
            const metaId = item.id;
            const videoKey = item.videoId ?? '_';
            if (!nested[metaId]) {
                nested[metaId] = {};
            }
            nested[metaId][videoKey] = item;
        }
        useWatchHistoryStore.setState({
            activeProfileId: profileId,
            byProfile: {
                [profileId]: nested,
            },
        } as any);
    };

    const makeItem = (overrides: Partial<WatchHistoryItem>): WatchHistoryItem => {
        return {
            id: 'meta-1',
            type: 'movie' as any,
            progressSeconds: 100,
            durationSeconds: 1000,
            lastWatchedAt: 1000,
            ...overrides,
        };
    };

    beforeEach(() => {
        setActiveProfileId(undefined);
        useWatchHistoryStore.setState({ activeProfileId: undefined, byProfile: {} } as any);
    });

    describe('useContinueWatching hook', () => {
        const profileId = 'profile-1';

        it('returns empty array when no active profile', () => {
            // Arrange
            setActiveProfileId(undefined);
            setWatchHistoryNested(profileId, [makeItem({ id: 'movie-1' })]);

            // Act
            const { result } = renderHook(() => useContinueWatching());

            // Assert
            expect(result.current).toEqual([]);
        });

        it('filters out items that are not "continue watching" (too early or finished)', () => {
            // Arrange
            setActiveProfileId(profileId);
            setWatchHistoryNested(profileId, [
                makeItem({
                    id: 'movie-early',
                    type: 'movie' as any,
                    progressSeconds: 10,
                    durationSeconds: 1000,
                    lastWatchedAt: 1000,
                }),
                makeItem({
                    id: 'movie-valid',
                    type: 'movie' as any,
                    progressSeconds: 500,
                    durationSeconds: 1000,
                    lastWatchedAt: 2000,
                }),
                makeItem({
                    id: 'movie-finished',
                    type: 'movie' as any,
                    progressSeconds: 950,
                    durationSeconds: 1000,
                    lastWatchedAt: 3000,
                }),
            ]);

            // Act
            const { result } = renderHook(() => useContinueWatching());

            // Assert
            expect(result.current).toHaveLength(1);
            expect(result.current[0].metaId).toBe('movie-valid');
        });

        it('selects the latest episode for a series (same meta ID)', () => {
            // Arrange
            setActiveProfileId(profileId);
            setWatchHistoryNested(profileId, [
                makeItem({
                    id: 'show-1',
                    videoId: 'ep1',
                    type: 'series' as any,
                    progressSeconds: 500,
                    durationSeconds: 1000,
                    lastWatchedAt: 1000,
                }),
                makeItem({
                    id: 'show-1',
                    videoId: 'ep2',
                    type: 'series' as any,
                    progressSeconds: 200,
                    durationSeconds: 1000,
                    lastWatchedAt: 2000,
                }),
            ]);

            // Act
            const { result } = renderHook(() => useContinueWatching());

            // Assert
            expect(result.current).toHaveLength(1);
            expect(result.current[0].videoId).toBe('ep2');
            expect(result.current[0].metaId).toBe('show-1');
        });

        it('sorts items by lastWatchedAt descending', () => {
            // Arrange
            setActiveProfileId(profileId);
            setWatchHistoryNested(profileId, [
                makeItem({
                    id: 'movie-old',
                    type: 'movie' as any,
                    progressSeconds: 500,
                    durationSeconds: 1000,
                    lastWatchedAt: 1000,
                }),
                makeItem({
                    id: 'movie-new',
                    type: 'movie' as any,
                    progressSeconds: 500,
                    durationSeconds: 1000,
                    lastWatchedAt: 3000,
                }),
                makeItem({
                    id: 'movie-mid',
                    type: 'movie' as any,
                    progressSeconds: 500,
                    durationSeconds: 1000,
                    lastWatchedAt: 2000,
                }),
            ]);

            // Act
            const { result } = renderHook(() => useContinueWatching());

            // Assert
            expect(result.current).toHaveLength(3);
            expect(result.current[0].metaId).toBe('movie-new');
            expect(result.current[1].metaId).toBe('movie-mid');
            expect(result.current[2].metaId).toBe('movie-old');
        });

        it('calculates progress ratio correctly', () => {
            // Arrange
            setActiveProfileId(profileId);
            setWatchHistoryNested(profileId, [
                makeItem({
                    id: 'movie-1',
                    type: 'movie' as any,
                    progressSeconds: 300,
                    durationSeconds: 600,
                    lastWatchedAt: 1000,
                }),
            ]);

            // Act
            const { result } = renderHook(() => useContinueWatching());

            // Assert
            expect(result.current[0].progressRatio).toBe(0.5);
        });

        it('handles zero duration gracefully', () => {
            // Arrange
            setActiveProfileId(profileId);
            setWatchHistoryNested(profileId, [
                makeItem({
                    id: 'movie-zero',
                    type: 'movie' as any,
                    progressSeconds: 100,
                    durationSeconds: 0,
                    lastWatchedAt: 1000,
                }),
            ]);

            // Act
            const { result } = renderHook(() => useContinueWatching());

            // Assert
            expect(result.current).toHaveLength(0);
        });
    });

    describe('useContinueWatchingForMeta', () => {
        const profileId = 'profile-1';

        beforeEach(() => {
            setActiveProfileId(profileId);
        });

        it('returns undefined if meta has no videos', () => {
            // Arrange
            setWatchHistoryNested(profileId, []);

            // Act
            const { result } = renderHook(() =>
                useContinueWatchingForMeta('meta-1', { videos: [] })
            );

            // Assert
            expect(result.current).toBeUndefined();
        });

        it('returns undefined if no history for this meta', () => {
            // Arrange
            setWatchHistoryNested(profileId, []);

            // Act
            const { result } = renderHook(() =>
                useContinueWatchingForMeta('meta-1', {
                    videos: [{ id: 'ep1' } as any],
                })
            );

            // Assert
            expect(result.current).toBeUndefined();
        });

        it('returns current episode if in progress', () => {
            // Arrange
            setWatchHistoryNested(profileId, [
                makeItem({
                    id: 'meta-1',
                    videoId: 'ep1',
                    type: 'series' as any,
                    lastWatchedAt: 1000,
                    progressSeconds: 500,
                    durationSeconds: 1000,
                }),
            ]);

            // Act
            const { result } = renderHook(() =>
                useContinueWatchingForMeta('meta-1', {
                    videos: [{ id: 'ep1' } as any, { id: 'ep2' } as any],
                })
            );

            // Assert
            expect(result.current).toBeDefined();
            expect(result.current?.videoId).toBe('ep1');
            expect(result.current?.isUpNext).toBe(false);
            expect(result.current?.progressRatio).toBe(0.5);
        });

        it('returns next episode if current is finished', () => {
            // Arrange
            setWatchHistoryNested(profileId, [
                makeItem({
                    id: 'meta-1',
                    videoId: 'ep1',
                    type: 'series' as any,
                    lastWatchedAt: 1000,
                    progressSeconds: 950,
                    durationSeconds: 1000,
                }),
            ]);

            // Act
            const { result } = renderHook(() =>
                useContinueWatchingForMeta('meta-1', {
                    videos: [{ id: 'ep1' } as any, { id: 'ep2' } as any],
                })
            );

            // Assert
            expect(result.current).toBeDefined();
            expect(result.current?.videoId).toBe('ep2');
            expect(result.current?.isUpNext).toBe(true);
            expect(result.current?.progressRatio).toBe(0);
        });

        it('returns undefined if last episode is finished', () => {
            // Arrange
            setWatchHistoryNested(profileId, [
                makeItem({
                    id: 'meta-1',
                    videoId: 'ep2',
                    type: 'series' as any,
                    lastWatchedAt: 1000,
                    progressSeconds: 950,
                    durationSeconds: 1000,
                }),
            ]);

            // Act
            const { result } = renderHook(() =>
                useContinueWatchingForMeta('meta-1', {
                    videos: [{ id: 'ep1' } as any, { id: 'ep2' } as any], // ep2 is last
                })
            );

            // Assert
            expect(result.current).toBeUndefined();
        });

        it('returns in-progress movie', () => {
            // Arrange
            setWatchHistoryNested(profileId, [
                makeItem({
                    id: 'movie-1',
                    type: 'movie' as any,
                    lastWatchedAt: 1000,
                    progressSeconds: 500,
                    durationSeconds: 1000,
                }),
            ]);

            // Act
            const { result } = renderHook(() =>
                useContinueWatchingForMeta('movie-1', {
                    videos: [{ id: 'movie-1' } as any],
                })
            );

            // Assert
            expect(result.current).toBeDefined();
            expect(result.current?.metaId).toBe('movie-1');
            expect(result.current?.isUpNext).toBe(false);
        });

        it('returns undefined for finished movie', () => {
            // Arrange
            setWatchHistoryNested(profileId, [
                makeItem({
                    id: 'movie-1',
                    type: 'movie' as any,
                    lastWatchedAt: 1000,
                    progressSeconds: 950,
                    durationSeconds: 1000,
                }),
            ]);

            // Act
            const { result } = renderHook(() =>
                useContinueWatchingForMeta('movie-1', {
                    videos: [{ id: 'movie-1' } as any],
                })
            );

            // Assert
            expect(result.current).toBeUndefined();
        });

        it('selects latest watched episode when multiple exist', () => {
            // Arrange
            setWatchHistoryNested(profileId, [
                makeItem({
                    id: 'meta-1',
                    videoId: 'ep1',
                    type: 'series' as any,
                    lastWatchedAt: 1000,
                    progressSeconds: 500,
                    durationSeconds: 1000,
                }),
                makeItem({
                    id: 'meta-1',
                    videoId: 'ep2',
                    type: 'series' as any,
                    lastWatchedAt: 2000, // More recent
                    progressSeconds: 300,
                    durationSeconds: 1000,
                }),
            ]);

            // Act
            const { result } = renderHook(() =>
                useContinueWatchingForMeta('meta-1', {
                    videos: [{ id: 'ep1' } as any, { id: 'ep2' } as any, { id: 'ep3' } as any],
                })
            );

            // Assert
            expect(result.current?.videoId).toBe('ep2');
        });
    });

    describe('useNextVideo', () => {
        it('returns undefined if no videos', () => {
            const { result } = renderHook(() => useNextVideo(undefined, 'ep1'));
            expect(result.current).toBeUndefined();
        });

        it('returns undefined if no currentVideoId', () => {
            const { result } = renderHook(() =>
                useNextVideo([{ id: 'ep1' } as any, { id: 'ep2' } as any], undefined)
            );
            expect(result.current).toBeUndefined();
        });

        it('returns next video in sequence', () => {
            const { result } = renderHook(() =>
                useNextVideo([{ id: 'ep1' } as any, { id: 'ep2' } as any, { id: 'ep3' } as any], 'ep2')
            );
            expect(result.current).toEqual({ id: 'ep3' });
        });

        it('returns undefined if current is last video', () => {
            const { result } = renderHook(() =>
                useNextVideo([{ id: 'ep1' } as any, { id: 'ep2' } as any], 'ep2')
            );
            expect(result.current).toBeUndefined();
        });

        it('returns undefined if currentVideoId not found in videos', () => {
            const { result } = renderHook(() =>
                useNextVideo([{ id: 'ep1' } as any, { id: 'ep2' } as any], 'ep99')
            );
            expect(result.current).toBeUndefined();
        });
    });
});

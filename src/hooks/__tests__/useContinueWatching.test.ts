import { renderHook, waitFor } from '@testing-library/react-native';
import {
    useContinueWatching,
    useContinueWatchingForMeta,
    useNextVideo,
} from '../useContinueWatching';
import { useProfileStore } from '@/store/profile.store';
import * as db from '@/db';

jest.mock('@/db', () => ({
    getContinueWatchingWithUpNext: jest.fn(),
    listWatchHistoryForProfile: jest.fn(),
}));

describe('useContinueWatching', () => {
    const setActiveProfileId = (profileId?: string) => {
        useProfileStore.setState({ activeProfileId: profileId } as any);
    };

    const makeHistoryItem = (overrides: Record<string, unknown> = {}) => ({
        id: 'meta-1',
        type: 'movie' as any,
        progressSeconds: 100,
        durationSeconds: 1000,
        lastWatchedAt: 1000,
        ...overrides,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        setActiveProfileId(undefined);
        (db.getContinueWatchingWithUpNext as jest.Mock).mockResolvedValue([]);
        (db.listWatchHistoryForProfile as jest.Mock).mockResolvedValue([]);
    });

    describe('useContinueWatching hook', () => {
        it('returns empty array when no active profile', () => {
            const { result } = renderHook(() => useContinueWatching());
            expect(result.current).toEqual([]);
            expect(db.getContinueWatchingWithUpNext).not.toHaveBeenCalled();
        });

        it('loads entries from DB and maps keys correctly', async () => {
            setActiveProfileId('profile-1');
            (db.getContinueWatchingWithUpNext as jest.Mock).mockResolvedValue([
                {
                    metaId: 'show-1',
                    type: 'series',
                    videoId: 'ep-2',
                    progressSeconds: 200,
                    durationSeconds: 1000,
                    progressRatio: 0.2,
                    lastWatchedAt: 2000,
                    isUpNext: false,
                },
                {
                    metaId: 'movie-1',
                    type: 'movie',
                    progressSeconds: 500,
                    durationSeconds: 1000,
                    progressRatio: 0.5,
                    lastWatchedAt: 1000,
                    isUpNext: false,
                },
            ]);

            const { result } = renderHook(() => useContinueWatching());

            await waitFor(() => {
                expect(result.current).toHaveLength(2);
            });

            expect(result.current[0].key).toBe('show-1::ep-2');
            expect(result.current[1].key).toBe('movie-1');
        });
    });

    describe('useContinueWatchingForMeta', () => {
        beforeEach(() => {
            setActiveProfileId('profile-1');
        });

        it('returns undefined when no history for this meta', async () => {
            (db.listWatchHistoryForProfile as jest.Mock).mockResolvedValue([]);

            const { result } = renderHook(() =>
                useContinueWatchingForMeta('meta-1', {
                    videos: [{ id: 'ep1' } as any],
                })
            );

            await waitFor(() => {
                expect(result.current).toBeUndefined();
            });
        });

        it('returns current episode if in progress', async () => {
            (db.listWatchHistoryForProfile as jest.Mock).mockResolvedValue([
                makeHistoryItem({
                    id: 'meta-1',
                    videoId: 'ep1',
                    type: 'series',
                    progressSeconds: 500,
                    durationSeconds: 1000,
                }),
            ]);

            const { result } = renderHook(() =>
                useContinueWatchingForMeta('meta-1', {
                    videos: [{ id: 'ep1' } as any, { id: 'ep2' } as any],
                })
            );

            await waitFor(() => {
                expect(result.current?.videoId).toBe('ep1');
            });
            expect(result.current?.isUpNext).toBe(false);
            expect(result.current?.progressRatio).toBe(0.5);
        });

        it('returns next episode if current is finished', async () => {
            (db.listWatchHistoryForProfile as jest.Mock).mockResolvedValue([
                makeHistoryItem({
                    id: 'meta-1',
                    videoId: 'ep1',
                    type: 'series',
                    progressSeconds: 950,
                    durationSeconds: 1000,
                }),
            ]);

            const { result } = renderHook(() =>
                useContinueWatchingForMeta('meta-1', {
                    videos: [{ id: 'ep1' } as any, { id: 'ep2' } as any],
                })
            );

            await waitFor(() => {
                expect(result.current?.videoId).toBe('ep2');
            });
            expect(result.current?.isUpNext).toBe(true);
            expect(result.current?.progressRatio).toBe(0);
        });

        it('returns undefined for finished movie', async () => {
            (db.listWatchHistoryForProfile as jest.Mock).mockResolvedValue([
                makeHistoryItem({
                    id: 'movie-1',
                    type: 'movie',
                    progressSeconds: 950,
                    durationSeconds: 1000,
                }),
            ]);

            const { result } = renderHook(() =>
                useContinueWatchingForMeta('movie-1', {
                    videos: [{ id: 'movie-1' } as any],
                })
            );

            await waitFor(() => {
                expect(result.current).toBeUndefined();
            });
        });

        it('selects latest watched episode when multiple exist', async () => {
            (db.listWatchHistoryForProfile as jest.Mock).mockResolvedValue([
                makeHistoryItem({
                    id: 'meta-1',
                    videoId: 'ep1',
                    type: 'series',
                    progressSeconds: 500,
                    durationSeconds: 1000,
                    lastWatchedAt: 1000,
                }),
                makeHistoryItem({
                    id: 'meta-1',
                    videoId: 'ep2',
                    type: 'series',
                    progressSeconds: 300,
                    durationSeconds: 1000,
                    lastWatchedAt: 2000,
                }),
            ]);

            const { result } = renderHook(() =>
                useContinueWatchingForMeta('meta-1', {
                    videos: [{ id: 'ep1' } as any, { id: 'ep2' } as any, { id: 'ep3' } as any],
                })
            );

            await waitFor(() => {
                expect(result.current?.videoId).toBe('ep2');
            });
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

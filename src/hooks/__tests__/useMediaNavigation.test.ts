import { renderHook } from '@testing-library/react-native';
import { useMediaNavigation } from '../useMediaNavigation';
import { useWatchHistoryStore } from '@/store/watch-history.store';
import { Linking } from 'react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
    }),
}));

const mockShowToast = jest.fn();
jest.mock('@/store/toast.store', () => ({
    showToast: (...args: any[]) => mockShowToast(...args),
}));

describe('useMediaNavigation', () => {
    const mockSetLastStreamTarget = jest.fn();
    const mockGetLastStreamTarget = jest.fn();
    let openUrlSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();

        openUrlSpy = jest.spyOn(Linking, 'openURL');

        // Ensure store selector returns our mock.
        useWatchHistoryStore.setState({
            setLastStreamTarget: mockSetLastStreamTarget,
            getLastStreamTarget: mockGetLastStreamTarget,
        } as any);
    });

    it('openStreamTarget navigates to /play for url targets', async () => {
        const { result } = renderHook(() => useMediaNavigation());

        const ok = await result.current.openStreamTarget({
            metaId: 'm1',
            videoId: 'v1',
            type: 'movie' as any,
            title: 'Title',
            bingeGroup: 'bg',
            target: { type: 'url', value: 'https://example.com/video.mp4' },
            navigation: 'push',
            fromAutoPlay: true,
        });

        expect(ok).toBe(true);
        expect(mockPush).toHaveBeenCalledWith({
            pathname: '/play',
            params: {
                source: 'https://example.com/video.mp4',
                title: 'Title',
                metaId: 'm1',
                type: 'movie',
                videoId: 'v1',
                bingeGroup: 'bg',
                fromAutoPlay: '1',
            },
        });
        expect(openUrlSpy).not.toHaveBeenCalled();
        expect(mockSetLastStreamTarget).not.toHaveBeenCalled();
    });

    it('openStreamTarget opens and persists external targets', async () => {
        openUrlSpy.mockResolvedValueOnce(undefined as any);

        const { result } = renderHook(() => useMediaNavigation());

        const ok = await result.current.openStreamTarget({
            metaId: 'm1',
            videoId: 'v1',
            type: 'movie' as any,
            title: 'Title',
            target: { type: 'external', value: 'https://example.com' },
        });

        expect(ok).toBe(true);
        expect(openUrlSpy).toHaveBeenCalledWith('https://example.com');
        expect(mockSetLastStreamTarget).toHaveBeenCalledWith('m1', 'v1', 'movie', {
            type: 'external',
            value: 'https://example.com',
        });
        expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('openStreamTarget opens and persists yt targets', async () => {
        openUrlSpy.mockResolvedValueOnce(undefined as any);

        const { result } = renderHook(() => useMediaNavigation());

        const ok = await result.current.openStreamTarget({
            metaId: 'm1',
            videoId: 'v1',
            type: 'movie' as any,
            title: 'Title',
            target: { type: 'yt', value: 'abc123' },
        });

        expect(ok).toBe(true);
        expect(openUrlSpy).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc123');
        expect(mockSetLastStreamTarget).toHaveBeenCalledWith('m1', 'v1', 'movie', {
            type: 'yt',
            value: 'abc123',
        });
    });

    it('openStreamTarget shows toast and does not persist when external open fails', async () => {
        openUrlSpy.mockRejectedValueOnce(new Error('nope'));
        const onExternalOpenFailed = jest.fn();

        const { result } = renderHook(() => useMediaNavigation());

        const ok = await result.current.openStreamTarget({
            metaId: 'm1',
            videoId: 'v1',
            type: 'movie' as any,
            title: 'Title',
            target: { type: 'external', value: 'https://example.com' },
            onExternalOpenFailed,
        });

        expect(ok).toBe(false);
        expect(mockShowToast).toHaveBeenCalled();
        expect(mockSetLastStreamTarget).not.toHaveBeenCalled();
        expect(onExternalOpenFailed).toHaveBeenCalled();
    });

    it('openStreamFromStream uses stream behaviorHints.group as bingeGroup for url streams', async () => {
        const { result } = renderHook(() => useMediaNavigation());

        const ok = await result.current.openStreamFromStream({
            metaId: 'm1',
            videoId: 'v1',
            type: 'movie' as any,
            title: 'Title',
            navigation: 'replace',
            fromAutoPlay: true,
            stream: {
                url: 'https://example.com/video.mp4',
                behaviorHints: { group: 'bg2' },
            } as any,
        });

        expect(ok).toBe(true);
        expect(mockReplace).toHaveBeenCalledWith({
            pathname: '/play',
            params: {
                source: 'https://example.com/video.mp4',
                title: 'Title',
                metaId: 'm1',
                type: 'movie',
                videoId: 'v1',
                bingeGroup: 'bg2',
                fromAutoPlay: '1',
            },
        });
    });

    it('pushToStreams defaults to autoPlay=1 when a last stream target exists', () => {
        mockGetLastStreamTarget.mockReturnValueOnce({ type: 'url', value: 'https://example.com' });

        const { result } = renderHook(() => useMediaNavigation());
        result.current.pushToStreams({ metaId: 'm1', videoId: 'v1', type: 'movie' as any });

        expect(mockPush).toHaveBeenCalledWith({
            pathname: '/streams',
            params: {
                metaId: 'm1',
                videoId: 'v1',
                type: 'movie',
                autoPlay: '1',
            },
        });
    });

    it('pushToStreams does not force autoPlay when explicitly provided', () => {
        mockGetLastStreamTarget.mockReturnValueOnce({ type: 'url', value: 'https://example.com' });

        const { result } = renderHook(() => useMediaNavigation());
        result.current.pushToStreams(
            { metaId: 'm1', videoId: 'v1', type: 'movie' as any },
            { autoPlay: '0' }
        );

        expect(mockPush).toHaveBeenCalledWith({
            pathname: '/streams',
            params: {
                metaId: 'm1',
                videoId: 'v1',
                type: 'movie',
                autoPlay: '0',
            },
        });
    });

    it('replaceToStreams defaults to autoPlay=1 when a last stream target exists', () => {
        mockGetLastStreamTarget.mockReturnValueOnce({ type: 'url', value: 'https://example.com' });

        const { result } = renderHook(() => useMediaNavigation());
        result.current.replaceToStreams({ metaId: 'm1', videoId: 'v1', type: 'movie' as any });

        expect(mockReplace).toHaveBeenCalledWith({
            pathname: '/streams',
            params: {
                metaId: 'm1',
                videoId: 'v1',
                type: 'movie',
                autoPlay: '1',
            },
        });
    });
});

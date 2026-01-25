import { renderHook, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { usePlayerSeek, UsePlayerSeekOptions } from '../usePlayerSeek';
import {
    PLAYER_SEEK_DEBOUNCE_MS,
    PLAYER_SEEK_UI_SYNC_TIMEOUT_MS,
} from '@/constants/playback';

// Mock debug logger to prevent console spam
jest.mock('@/utils/debug', () => ({
    createDebugLogger: () => jest.fn(),
    useDebugLogger: () => jest.fn(),
}));

// Store original Platform.isTV value
const originalIsTV = Platform.isTV;

describe('usePlayerSeek', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        // Reset Platform.isTV to original value before each test
        Object.defineProperty(Platform, 'isTV', {
            get: () => originalIsTV,
            configurable: true,
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        // Restore original Platform.isTV after each test
        Object.defineProperty(Platform, 'isTV', {
            get: () => originalIsTV,
            configurable: true,
        });
    });

    const createDefaultOptions = (overrides = {}) => ({
        currentTime: 30,
        duration: 120,
        paused: false,
        onPlayPause: jest.fn(),
        onSeek: jest.fn(),
        onInteraction: jest.fn(),
        ...overrides,
    });

    describe('initial state', () => {
        it('starts with isSeeking false and seekTime 0', () => {
            const options = createDefaultOptions();
            const { result } = renderHook(() => usePlayerSeek(options));

            expect(result.current.isSeeking).toBe(false);
            expect(result.current.seekTime).toBe(0);
            expect(result.current.isSeekFocused).toBe(false);
        });

        it('computes sliderValue from currentTime when not seeking', () => {
            const options = createDefaultOptions({ currentTime: 45 });
            const { result } = renderHook(() => usePlayerSeek(options));

            expect(result.current.sliderValue).toBe(45);
        });

        it('handles duration = 0 gracefully', () => {
            const options = createDefaultOptions({ duration: 0 });
            const { result } = renderHook(() => usePlayerSeek(options));

            expect(result.current.effectiveDuration).toBe(0);
            expect(result.current.sliderMaximumValue).toBe(1); // fallback to 1
        });

        it('remembers last non-zero duration', () => {
            const options = createDefaultOptions({ duration: 100 });
            const { result, rerender } = renderHook(
                (props: UsePlayerSeekOptions) => usePlayerSeek(props),
                { initialProps: options }
            );

            expect(result.current.effectiveDuration).toBe(100);

            // Duration drops to 0 (edge case during buffering)
            rerender({ ...options, duration: 0 });

            expect(result.current.effectiveDuration).toBe(100); // remembers 100
            expect(result.current.sliderMaximumValue).toBe(100);
        });
    });

    describe('touch platform seeking (non-TV)', () => {
        beforeEach(() => {
            (Platform as any).isTV = false;
        });

        it('handleSeekStart pauses playback if playing', () => {
            const options = createDefaultOptions({ paused: false, currentTime: 30 });
            const { result } = renderHook(() => usePlayerSeek(options));

            act(() => {
                result.current.handleSeekStart();
            });

            expect(result.current.isSeeking).toBe(true);
            expect(result.current.seekTime).toBe(30);
            expect(options.onPlayPause).toHaveBeenCalledTimes(1); // paused
        });

        it('handleSeekStart does not pause if already paused', () => {
            const options = createDefaultOptions({ paused: true, currentTime: 30 });
            const { result } = renderHook(() => usePlayerSeek(options));

            act(() => {
                result.current.handleSeekStart();
            });

            expect(result.current.isSeeking).toBe(true);
            expect(options.onPlayPause).not.toHaveBeenCalled();
        });

        it('handleSeekChange updates seekTime without seeking on touch', () => {
            const options = createDefaultOptions({ currentTime: 30 });
            const { result } = renderHook(() => usePlayerSeek(options));

            act(() => {
                result.current.handleSeekStart();
                result.current.handleSeekChange(50);
            });

            expect(result.current.seekTime).toBe(50);
            expect(options.onSeek).not.toHaveBeenCalled(); // Not committed yet
        });

        it('handleSeekEnd commits seek and resumes if was playing', () => {
            const options = createDefaultOptions({ paused: false, currentTime: 30 });
            const { result } = renderHook(() => usePlayerSeek(options));

            act(() => {
                result.current.handleSeekStart();
            });

            // Was playing, so onPlayPause was called once (to pause)
            expect(options.onPlayPause).toHaveBeenCalledTimes(1);

            act(() => {
                result.current.handleSeekEnd(60);
            });

            expect(result.current.isSeeking).toBe(false);
            expect(options.onSeek).toHaveBeenCalledWith(60);
            expect(options.onPlayPause).toHaveBeenCalledTimes(2); // resume
        });

        it('handleSeekEnd does not resume if was already paused', () => {
            const options = createDefaultOptions({ paused: true, currentTime: 30 });
            const { result } = renderHook(() => usePlayerSeek(options));

            act(() => {
                result.current.handleSeekStart();
                result.current.handleSeekEnd(60);
            });

            expect(options.onSeek).toHaveBeenCalledWith(60);
            expect(options.onPlayPause).not.toHaveBeenCalled();
        });

        it('sliderValue shows seekTime during seeking', () => {
            const options = createDefaultOptions({ currentTime: 30 });
            const { result } = renderHook(() => usePlayerSeek(options));

            act(() => {
                result.current.handleSeekStart();
                result.current.handleSeekChange(75);
            });

            expect(result.current.sliderValue).toBe(75);
        });
    });

    describe('TV platform seeking (D-pad scrubbing)', () => {
        beforeEach(() => {
            // Mock Platform.isTV as true for TV tests
            Object.defineProperty(Platform, 'isTV', {
                get: () => true,
                configurable: true,
            });
        });

        afterEach(() => {
            // Restore Platform.isTV to original value
            Object.defineProperty(Platform, 'isTV', {
                get: () => originalIsTV,
                configurable: true,
            });
        });

        it('handleSeekChange starts seeking but does not pause (TVSeekBar handles pause)', () => {
            const options = createDefaultOptions({ paused: false, currentTime: 30 });
            const { result } = renderHook(() => usePlayerSeek(options));

            act(() => {
                result.current.handleSeekChange(35);
            });

            expect(result.current.isSeeking).toBe(true);
            expect(result.current.seekTime).toBe(35);
            expect(options.onPlayPause).not.toHaveBeenCalled(); // TVSeekBar handles pause/resume
        });

        it('debounces multiple rapid D-pad value changes', () => {
            const options = createDefaultOptions({ paused: false, currentTime: 30 });
            const { result } = renderHook(() => usePlayerSeek(options));

            // Simulate rapid D-pad presses (left/right)
            act(() => {
                result.current.handleSeekChange(35);
                result.current.handleSeekChange(40);
                result.current.handleSeekChange(45);
                result.current.handleSeekChange(50);
            });

            expect(result.current.seekTime).toBe(50);
            expect(options.onSeek).not.toHaveBeenCalled(); // Not committed yet

            // Fast forward past debounce window
            act(() => {
                jest.advanceTimersByTime(PLAYER_SEEK_DEBOUNCE_MS);
            });

            expect(options.onSeek).toHaveBeenCalledWith(50);
        });

        it('commits seek after debounce (TVSeekBar handles pause/resume)', async () => {
            const options = createDefaultOptions({ paused: false, currentTime: 30 });
            const { result } = renderHook(() => usePlayerSeek(options));

            act(() => {
                result.current.handleSeekChange(60);
            });

            // TVSeekBar handles pause/resume, not the hook
            expect(options.onPlayPause).not.toHaveBeenCalled();

            act(() => {
                jest.advanceTimersByTime(PLAYER_SEEK_DEBOUNCE_MS);
            });

            expect(options.onSeek).toHaveBeenCalledWith(60);
            expect(options.onPlayPause).not.toHaveBeenCalled(); // Still not called
        });

        it('clamps seek value to duration', () => {
            const options = createDefaultOptions({ duration: 100 });
            const { result } = renderHook(() => usePlayerSeek(options));

            act(() => {
                result.current.handleSeekChange(150); // Beyond duration
            });

            act(() => {
                jest.advanceTimersByTime(PLAYER_SEEK_DEBOUNCE_MS);
            });

            expect(options.onSeek).toHaveBeenCalledWith(100); // Clamped
        });

        it('keeps UI pinned until playback catches up', () => {
            const options = createDefaultOptions({ currentTime: 30, duration: 120 });
            const { result, rerender } = renderHook(
                (props: UsePlayerSeekOptions) => usePlayerSeek(props),
                { initialProps: options }
            );

            act(() => {
                result.current.handleSeekChange(90);
            });

            act(() => {
                jest.advanceTimersByTime(PLAYER_SEEK_DEBOUNCE_MS);
            });

            // Still seeking (waiting for playback to catch up)
            expect(result.current.isSeeking).toBe(true);
            expect(result.current.seekTime).toBe(90);

            // Simulate playback catching up
            rerender({ ...options, currentTime: 89.5 }); // Within threshold

            expect(result.current.isSeeking).toBe(false);
        });

        it('releases seeking state after sync timeout even if playback does not catch up', () => {
            const options = createDefaultOptions({ currentTime: 30, duration: 120 });
            const { result } = renderHook(() => usePlayerSeek(options));

            act(() => {
                result.current.handleSeekChange(90);
            });

            act(() => {
                jest.advanceTimersByTime(PLAYER_SEEK_DEBOUNCE_MS);
            });

            expect(result.current.isSeeking).toBe(true);

            // Fast forward past UI sync timeout
            act(() => {
                jest.advanceTimersByTime(PLAYER_SEEK_UI_SYNC_TIMEOUT_MS);
            });

            expect(result.current.isSeeking).toBe(false);
        });

        it('simulates complete TV remote seeking flow (display only, TVSeekBar handles commits)', () => {
            const options = createDefaultOptions({ paused: false, currentTime: 30, duration: 120 });
            const { result, rerender } = renderHook(
                (props: UsePlayerSeekOptions) => usePlayerSeek(props),
                { initialProps: options }
            );

            // 1. User starts scrubbing with D-pad (just updates display, TVSeekBar handles pause)
            act(() => {
                result.current.handleSeekChange(35);
            });
            expect(result.current.isSeeking).toBe(true);
            expect(options.onPlayPause).not.toHaveBeenCalled(); // TVSeekBar handles pause

            // 2. User continues scrubbing rapidly
            act(() => {
                result.current.handleSeekChange(40);
                result.current.handleSeekChange(45);
            });
            expect(options.onSeek).not.toHaveBeenCalled(); // Debouncing

            // 3. User stops scrubbing, debounce commits
            act(() => {
                jest.advanceTimersByTime(PLAYER_SEEK_DEBOUNCE_MS);
            });
            expect(options.onSeek).toHaveBeenCalledWith(45);
            expect(options.onPlayPause).not.toHaveBeenCalled(); // TVSeekBar handles resume

            // 4. Playback catches up
            rerender({ ...options, currentTime: 45 });
            expect(result.current.isSeeking).toBe(false);
        });
    });

    describe('focus state', () => {
        it('setIsSeekFocused updates focus state', () => {
            const options = createDefaultOptions();
            const { result } = renderHook(() => usePlayerSeek(options));

            expect(result.current.isSeekFocused).toBe(false);

            act(() => {
                result.current.setIsSeekFocused(true);
            });

            expect(result.current.isSeekFocused).toBe(true);
        });
    });

    describe('interaction callbacks', () => {
        it('calls onInteraction during seek operations', () => {
            (Platform as any).isTV = false;
            const options = createDefaultOptions();
            const { result } = renderHook(() => usePlayerSeek(options));

            act(() => {
                result.current.handleSeekStart();
            });
            expect(options.onInteraction).toHaveBeenCalled();

            act(() => {
                result.current.handleSeekChange(50);
            });
            expect(options.onInteraction).toHaveBeenCalledTimes(2);

            act(() => {
                result.current.handleSeekEnd(50);
            });
            expect(options.onInteraction).toHaveBeenCalledTimes(3);
        });
    });
});

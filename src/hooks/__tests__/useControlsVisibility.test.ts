import { renderHook, act } from '@testing-library/react-native';
import { useControlsVisibility, UseControlsVisibilityOptions } from '../useControlsVisibility';
import { PLAYER_CONTROLS_AUTO_HIDE_MS } from '@/constants/playback';

describe('useControlsVisibility', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const createDefaultOptions = (overrides: Partial<UseControlsVisibilityOptions> = {}) => ({
        paused: false,
        isSeeking: false,
        isModalOpen: false,
        onVisibilityChange: jest.fn(),
        ...overrides,
    });

    describe('initial state', () => {
        it('starts with controls visible', () => {
            const options = createDefaultOptions();
            const { result } = renderHook(() => useControlsVisibility(options));

            expect(result.current.visible).toBe(true);
        });

        it('calls onVisibilityChange with initial state', () => {
            const options = createDefaultOptions();
            renderHook(() => useControlsVisibility(options));

            expect(options.onVisibilityChange).toHaveBeenCalledWith(true);
        });
    });

    describe('auto-hide behavior', () => {
        it('auto-hides controls after inactivity during playback', () => {
            const options = createDefaultOptions({ paused: false });
            const { result } = renderHook(() => useControlsVisibility(options));

            expect(result.current.visible).toBe(true);

            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS);
            });

            expect(result.current.visible).toBe(false);
            expect(options.onVisibilityChange).toHaveBeenLastCalledWith(false);
        });

        it('does not auto-hide when paused', () => {
            const options = createDefaultOptions({ paused: true });
            const { result } = renderHook(() => useControlsVisibility(options));

            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS + 1000);
            });

            expect(result.current.visible).toBe(true);
        });

        it('does not auto-hide when seeking', () => {
            const options = createDefaultOptions({ isSeeking: true });
            const { result } = renderHook(() => useControlsVisibility(options));

            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS + 1000);
            });

            expect(result.current.visible).toBe(true);
        });

        it('does not auto-hide when modal is open', () => {
            const options = createDefaultOptions({ isModalOpen: true });
            const { result } = renderHook(() => useControlsVisibility(options));

            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS + 1000);
            });

            expect(result.current.visible).toBe(true);
        });

        it('uses custom auto-hide delay', () => {
            const customDelay = 2000;
            const options = createDefaultOptions({ autoHideDelayMs: customDelay });
            const { result } = renderHook(() => useControlsVisibility(options));

            act(() => {
                jest.advanceTimersByTime(customDelay - 100);
            });
            expect(result.current.visible).toBe(true);

            act(() => {
                jest.advanceTimersByTime(200);
            });
            expect(result.current.visible).toBe(false);
        });
    });

    describe('registerInteraction', () => {
        it('resets auto-hide timer on interaction', () => {
            const options = createDefaultOptions();
            const { result } = renderHook(() => useControlsVisibility(options));

            // Advance halfway through auto-hide timer
            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS / 2);
            });
            expect(result.current.visible).toBe(true);

            // Register interaction (resets timer)
            act(() => {
                result.current.registerInteraction();
            });

            // Advance another half - should still be visible because timer was reset
            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS / 2);
            });
            expect(result.current.visible).toBe(true);

            // Advance full duration from last interaction
            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS / 2 + 100);
            });
            expect(result.current.visible).toBe(false);
        });

        it('shows controls if hidden', () => {
            const options = createDefaultOptions();
            const { result } = renderHook(() => useControlsVisibility(options));

            // Hide controls
            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS);
            });
            expect(result.current.visible).toBe(false);

            // Register interaction to show
            act(() => {
                result.current.registerInteraction();
            });
            expect(result.current.visible).toBe(true);
        });
    });

    describe('showControls', () => {
        it('shows controls and registers interaction', () => {
            const options = createDefaultOptions();
            const { result } = renderHook(() => useControlsVisibility(options));

            // Hide first
            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS);
            });
            expect(result.current.visible).toBe(false);

            act(() => {
                result.current.showControls();
            });
            expect(result.current.visible).toBe(true);
        });
    });

    describe('toggleControls', () => {
        it('hides controls when visible', () => {
            const options = createDefaultOptions();
            const { result } = renderHook(() => useControlsVisibility(options));

            expect(result.current.visible).toBe(true);

            act(() => {
                result.current.toggleControls();
            });
            expect(result.current.visible).toBe(false);
        });

        it('shows controls when hidden', () => {
            const options = createDefaultOptions();
            const { result } = renderHook(() => useControlsVisibility(options));

            // Hide first
            act(() => {
                result.current.toggleControls();
            });
            expect(result.current.visible).toBe(false);

            // Toggle back on
            act(() => {
                result.current.toggleControls();
            });
            expect(result.current.visible).toBe(true);
        });
    });

    describe('hideControls', () => {
        it('hides controls immediately', () => {
            const options = createDefaultOptions();
            const { result } = renderHook(() => useControlsVisibility(options));

            expect(result.current.visible).toBe(true);

            act(() => {
                result.current.hideControls();
            });
            expect(result.current.visible).toBe(false);
            expect(options.onVisibilityChange).toHaveBeenLastCalledWith(false);
        });
    });

    describe('visibility change callback', () => {
        it('calls onVisibilityChange when visibility changes', () => {
            const options = createDefaultOptions();
            const { result } = renderHook(() => useControlsVisibility(options));

            // Initial call
            expect(options.onVisibilityChange).toHaveBeenCalledWith(true);

            // Hide
            act(() => {
                result.current.toggleControls();
            });
            expect(options.onVisibilityChange).toHaveBeenLastCalledWith(false);

            // Show
            act(() => {
                result.current.toggleControls();
            });
            expect(options.onVisibilityChange).toHaveBeenLastCalledWith(true);
        });
    });

    describe('state transitions', () => {
        it('starts auto-hide timer when transitioning from paused to playing', () => {
            const options = createDefaultOptions({ paused: true });
            const { result, rerender } = renderHook(
                (props: UseControlsVisibilityOptions) => useControlsVisibility(props),
                { initialProps: options }
            );

            // Should not hide while paused
            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS + 1000);
            });
            expect(result.current.visible).toBe(true);

            // Transition to playing
            rerender({ ...options, paused: false });

            // Now should auto-hide
            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS);
            });
            expect(result.current.visible).toBe(false);
        });

        it('cancels auto-hide timer when seeking starts', () => {
            const options = createDefaultOptions({ isSeeking: false });
            const { result, rerender } = renderHook(
                (props: UseControlsVisibilityOptions) => useControlsVisibility(props),
                { initialProps: options }
            );

            // Advance halfway
            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS / 2);
            });
            expect(result.current.visible).toBe(true);

            // Start seeking
            rerender({ ...options, isSeeking: true });

            // Should not hide even after full duration
            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS);
            });
            expect(result.current.visible).toBe(true);

            // Stop seeking
            rerender({ ...options, isSeeking: false });

            // Now timer restarts
            act(() => {
                jest.advanceTimersByTime(PLAYER_CONTROLS_AUTO_HIDE_MS);
            });
            expect(result.current.visible).toBe(false);
        });
    });
});

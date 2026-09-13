import React from 'react';
import { Platform } from 'react-native';

import { act, fireEvent } from '@testing-library/react-native';

import {
  PLAYER_SEEK_STEP_SECONDS,
  TV_SEEK_ACCELERATION_MULTIPLIER,
  TV_SEEK_COMMIT_DELAY_MS,
  TV_SEEK_REPEAT_INTERVAL_MS,
} from '@/constants/playback';
import { renderWithProviders } from '@/utils/test-utils';

import { TVSeekBar } from '../TVSeekBar';

const mockTVEventHandlers: ((event: { eventType: string }) => void)[] = [];
const originalIsTV = Platform.isTV;

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories require() their mocks
  const ReactMock = require('react');
  const Pressable = ReactMock.forwardRef((props: Record<string, unknown>, ref: unknown) =>
    ReactMock.createElement(actual.View, {
      ...props,
      ref,
      testID: (props.testID as string | undefined) ?? 'tv-seek-bar',
    })
  );

  return new Proxy(actual, {
    get(target, property, receiver) {
      if (property === 'useTVEventHandler') {
        return (handler: (event: { eventType: string }) => void) => {
          mockTVEventHandlers.push(handler);
        };
      }
      if (property === 'Pressable') return Pressable;
      return Reflect.get(target, property, receiver);
    },
  });
});

const getLatestTVHandler = () => {
  const handler = mockTVEventHandlers.at(-1);
  if (!handler) throw new Error('TV seek handler was not registered');
  return handler;
};

describe('TVSeekBar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockTVEventHandlers.length = 0;
    Object.defineProperty(Platform, 'isTV', { get: () => true, configurable: true });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    Object.defineProperty(Platform, 'isTV', {
      get: () => originalIsTV,
      configurable: true,
    });
  });

  it('does not render or register an interactive control off TV', () => {
    Object.defineProperty(Platform, 'isTV', { get: () => false, configurable: true });
    const { queryByTestId } = renderWithProviders(<TVSeekBar value={20} maximumValue={100} />);

    expect(queryByTestId('tv-seek-bar')).toBeNull();
  });

  it('renders one gap per chapter boundary and skips invalid starts', () => {
    const chapters = [
      { startTime: 0, endTime: 50 },
      { startTime: 50, endTime: 100 },
      { startTime: 100, endTime: 200 },
      { startTime: 250, endTime: 300 },
      { startTime: 1, endTime: 10 },
      { startTime: 199, endTime: 200 },
    ];
    const { queryByTestId } = renderWithProviders(
      <TVSeekBar value={20} maximumValue={200} chapters={chapters as any} />
    );

    // Boundaries at 25% and 50% remain. The 0s start, the beyond-duration chapter,
    // and boundaries within 1% of either edge render no gap, and there is no third gap.
    expect(queryByTestId('chapter-gap-0')).toBeTruthy();
    expect(queryByTestId('chapter-gap-1')).toBeTruthy();
    expect(queryByTestId('chapter-gap-2')).toBeNull();
    expect(queryByTestId('chapter-gap-0')?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ left: '25%' })])
    );
    expect(queryByTestId('chapter-gap-1')?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ left: '50%' })])
    );
  });

  it('targets the chapter label node on focus up', () => {
    const { getByTestId } = renderWithProviders(
      <TVSeekBar value={20} maximumValue={200} nextFocusUpId={42} />
    );

    expect(getByTestId('tv-seek-bar').props.nextFocusUp).toBe(42);
  });

  it('performs one bounded seek step and commits only after the debounce delay', () => {
    const onSeekStart = jest.fn();
    const onValueChange = jest.fn();
    const onSeekComplete = jest.fn();
    const { getByTestId } = renderWithProviders(
      <TVSeekBar
        value={95}
        maximumValue={100}
        onSeekStart={onSeekStart}
        onValueChange={onValueChange}
        onSeekComplete={onSeekComplete}
      />
    );

    fireEvent(getByTestId('tv-seek-bar'), 'focus');
    act(() => {
      getLatestTVHandler()({ eventType: 'right' });
    });

    expect(onSeekStart).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(100);
    expect(onSeekComplete).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(TV_SEEK_COMMIT_DELAY_MS - 1);
    });
    expect(onSeekComplete).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onSeekComplete).toHaveBeenCalledTimes(1);
    expect(onSeekComplete).toHaveBeenCalledWith(100);
  });

  it('debounces rapid directional presses into one commit at the latest value', () => {
    const onSeekStart = jest.fn();
    const onSeekComplete = jest.fn();
    const { getByTestId } = renderWithProviders(
      <TVSeekBar
        value={40}
        maximumValue={100}
        onSeekStart={onSeekStart}
        onSeekComplete={onSeekComplete}
      />
    );

    fireEvent(getByTestId('tv-seek-bar'), 'focus');
    act(() => {
      getLatestTVHandler()({ eventType: 'right' });
      getLatestTVHandler()({ eventType: 'right' });
      getLatestTVHandler()({ eventType: 'left' });
    });

    expect(onSeekStart).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(TV_SEEK_COMMIT_DELAY_MS);
    });
    expect(onSeekComplete).toHaveBeenCalledTimes(1);
    expect(onSeekComplete).toHaveBeenCalledWith(50);
  });

  it('accelerates a held seek, stops on release, and commits the final bounded value once', () => {
    const onValueChange = jest.fn();
    const onSeekComplete = jest.fn();
    const { getByTestId } = renderWithProviders(
      <TVSeekBar
        value={0}
        maximumValue={200}
        onValueChange={onValueChange}
        onSeekComplete={onSeekComplete}
      />
    );

    fireEvent(getByTestId('tv-seek-bar'), 'focus');
    act(() => {
      getLatestTVHandler()({ eventType: 'longRight' });
      jest.advanceTimersByTime(TV_SEEK_REPEAT_INTERVAL_MS * 5);
    });

    // The first five increments use the base step. The sixth is accelerated.
    expect(onValueChange).toHaveBeenLastCalledWith(
      PLAYER_SEEK_STEP_SECONDS * (5 + TV_SEEK_ACCELERATION_MULTIPLIER)
    );

    act(() => {
      getLatestTVHandler()({ eventType: 'longRight' });
      jest.advanceTimersByTime(TV_SEEK_COMMIT_DELAY_MS);
    });

    expect(onSeekComplete).toHaveBeenCalledTimes(1);
    expect(onSeekComplete).toHaveBeenCalledWith(
      PLAYER_SEEK_STEP_SECONDS * (5 + TV_SEEK_ACCELERATION_MULTIPLIER)
    );
  });

  it('commits immediately on blur and cancels the scheduled duplicate commit', () => {
    const onBlur = jest.fn();
    const onSeekComplete = jest.fn();
    const { getByTestId } = renderWithProviders(
      <TVSeekBar value={30} maximumValue={100} onBlur={onBlur} onSeekComplete={onSeekComplete} />
    );

    const seekBar = getByTestId('tv-seek-bar');
    fireEvent(seekBar, 'focus');
    act(() => {
      getLatestTVHandler()({ eventType: 'right' });
    });

    fireEvent(seekBar, 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onSeekComplete).toHaveBeenCalledWith(40);

    act(() => {
      jest.advanceTimersByTime(TV_SEEK_COMMIT_DELAY_MS);
    });
    expect(onSeekComplete).toHaveBeenCalledTimes(1);
  });

  it('ignores remote input while disabled or unfocused', () => {
    const onSeekStart = jest.fn();
    const onValueChange = jest.fn();
    const { getByTestId } = renderWithProviders(
      <TVSeekBar
        value={50}
        maximumValue={100}
        disabled
        onSeekStart={onSeekStart}
        onValueChange={onValueChange}
      />
    );

    fireEvent(getByTestId('tv-seek-bar'), 'focus');
    act(() => {
      getLatestTVHandler()({ eventType: 'right' });
    });

    expect(onSeekStart).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('accepts updated playback position while idle but preserves a local seek in progress', () => {
    const onSeekComplete = jest.fn();
    const { getByTestId, rerender } = renderWithProviders(
      <TVSeekBar value={20} maximumValue={100} onSeekComplete={onSeekComplete} />
    );

    rerender(<TVSeekBar value={70} maximumValue={100} onSeekComplete={onSeekComplete} />);
    fireEvent(getByTestId('tv-seek-bar'), 'focus');
    act(() => {
      getLatestTVHandler()({ eventType: 'right' });
    });

    rerender(<TVSeekBar value={5} maximumValue={100} onSeekComplete={onSeekComplete} />);
    act(() => {
      jest.advanceTimersByTime(TV_SEEK_COMMIT_DELAY_MS);
    });

    expect(onSeekComplete).toHaveBeenCalledWith(80);
  });

  it('cleans up a pending commit when unmounted', () => {
    const onSeekComplete = jest.fn();
    const { getByTestId, unmount } = renderWithProviders(
      <TVSeekBar value={20} maximumValue={100} onSeekComplete={onSeekComplete} />
    );

    fireEvent(getByTestId('tv-seek-bar'), 'focus');
    act(() => {
      getLatestTVHandler()({ eventType: 'right' });
    });
    unmount();

    act(() => {
      jest.advanceTimersByTime(TV_SEEK_COMMIT_DELAY_MS);
    });

    expect(onSeekComplete).not.toHaveBeenCalled();
  });
});

import { act, renderHook } from '@testing-library/react-native';

import { PLAYER_STATISTICS_SAMPLE_INTERVAL_MS } from '@/constants/playback';

import { usePlaybackDiagnostics } from '../usePlaybackDiagnostics';

describe('usePlaybackDiagnostics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('collects statistics and bandwidth only while enabled', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => usePlaybackDiagnostics(enabled),
      { initialProps: { enabled: false } }
    );

    act(() => {
      result.current.handleStatistics({ videoCodecName: 'HEVC' });
      result.current.handleBandwidthUpdate({ bitrate: 4_000_000, width: 1920, height: 1080 });
    });
    expect(result.current.statistics).toEqual({});
    expect(result.current.bandwidth).toBeUndefined();

    act(() => {
      result.current.recordBufferSample(0, 10);
      result.current.handleBuffering(true, false);
    });
    expect(result.current.diagnostics.rebufferCount).toBe(0);
    expect(result.current.diagnostics.bufferHistory).toEqual([]);

    rerender({ enabled: true });
    act(() => {
      result.current.handleStatistics({ videoCodecName: 'HEVC' });
      result.current.handleBandwidthUpdate({ bitrate: 4_000_000, width: 1920, height: 1080 });
    });
    expect(result.current.statistics.videoCodecName).toBe('HEVC');
    expect(result.current.bandwidth?.bitrate).toBe(4_000_000);
  });

  it('counts rebuffer start/stop and duration after playback started', () => {
    const { result } = renderHook(() => usePlaybackDiagnostics(true));

    // Initial buffering before playback is not a rebuffer.
    act(() => {
      result.current.handleBuffering(true, false);
      result.current.handleBuffering(false, false);
      result.current.markPlaybackStarted();
    });
    expect(result.current.diagnostics.rebufferCount).toBe(0);

    act(() => {
      jest.advanceTimersByTime(1_000);
      result.current.handleBuffering(true, false);
    });
    act(() => {
      jest.advanceTimersByTime(2_500);
      result.current.handleBuffering(false, false);
    });

    expect(result.current.diagnostics.rebufferCount).toBe(1);
    expect(result.current.diagnostics.totalRebufferSeconds).toBeGreaterThanOrEqual(2.5);
  });

  it('does not count a rebuffer while paused', () => {
    const { result } = renderHook(() => usePlaybackDiagnostics(true));

    act(() => {
      result.current.markPlaybackStarted();
      result.current.handleBuffering(true, true);
      result.current.handleBuffering(false, true);
    });

    expect(result.current.diagnostics.rebufferCount).toBe(0);
  });

  it('throttles buffer samples to the sample interval', () => {
    const { result } = renderHook(() => usePlaybackDiagnostics(true));

    act(() => {
      result.current.recordBufferSample(0, 10);
    });
    expect(result.current.diagnostics.bufferAheadSeconds).toBe(10);

    act(() => {
      jest.advanceTimersByTime(PLAYER_STATISTICS_SAMPLE_INTERVAL_MS - 1);
      result.current.recordBufferSample(5, 15);
    });
    expect(result.current.diagnostics.bufferHistory).toEqual([10]);

    act(() => {
      jest.advanceTimersByTime(1);
      result.current.recordBufferSample(10, 30);
    });
    expect(result.current.diagnostics.bufferAheadSeconds).toBe(20);
    expect(result.current.diagnostics.bufferHistory).toEqual([10, 20]);
  });

  it('resets all diagnostics state', () => {
    const { result } = renderHook(() => usePlaybackDiagnostics(true));

    act(() => {
      result.current.handleStatistics({ videoCodecName: 'HEVC' });
      result.current.recordBufferSample(0, 10);
      result.current.markPlaybackStarted();
      result.current.handleBuffering(true, false);
      result.current.handleBuffering(false, false);
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.statistics).toEqual({});
    expect(result.current.bandwidth).toBeUndefined();
    expect(result.current.diagnostics).toEqual({
      bufferAheadSeconds: undefined,
      bufferHistory: [],
      rebufferCount: 0,
      totalRebufferSeconds: 0,
    });

    // The rebuffer latch must be cleared too: a fresh rebuffer is not counted.
    act(() => {
      result.current.handleBuffering(true, false);
      result.current.handleBuffering(false, false);
    });
    expect(result.current.diagnostics.rebufferCount).toBe(0);
  });
});

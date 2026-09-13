import { useCallback, useEffect, useRef, useState } from 'react';

import {
  PLAYER_STATISTICS_HISTORY_SIZE,
  PLAYER_STATISTICS_SAMPLE_INTERVAL_MS,
} from '@/constants/playback';
import type { PlaybackDiagnostics, PlayerBandwidth, PlayerStatistics } from '@/types/player';

const createEmptyDiagnostics = (): PlaybackDiagnostics => ({
  bufferAheadSeconds: undefined,
  bufferHistory: [],
  rebufferCount: 0,
  totalRebufferSeconds: 0,
});

export interface PlaybackDiagnosticsController {
  statistics: PlayerStatistics;
  bandwidth: PlayerBandwidth | undefined;
  diagnostics: PlaybackDiagnostics;
  /** Feeds native codec/decoder statistics into the overlay state. */
  handleStatistics: (statistics: PlayerStatistics) => void;
  /** Feeds bandwidth estimate updates into the overlay state. */
  handleBandwidthUpdate: (data: PlayerBandwidth) => void;
  /** Tracks rebuffer start/stop and accumulates rebuffer duration. */
  handleBuffering: (buffering: boolean, paused: boolean) => void;
  /** Notes that the player reported actual playback (not initial buffering). */
  markPlaybackStarted: () => void;
  /** Samples buffered-ahead seconds, throttled by PLAYER_STATISTICS_SAMPLE_INTERVAL_MS. */
  recordBufferSample: (timeSeconds: number, bufferedSeconds?: number) => void;
  /** Clears every diagnostics value; call when a new stream loads. */
  reset: () => void;
}

/**
 * Collects playback diagnostics for the statistics overlay.
 *
 * All collection is gated by `enabled`: while the overlay is hidden every
 * handler is a cheap no-op, so diagnostics never run during normal playback.
 * Handlers are stable (ref-based gating) so player event subscriptions never
 * need to re-attach when the overlay toggles.
 */
export function usePlaybackDiagnostics(enabled: boolean): PlaybackDiagnosticsController {
  // Kept in a ref so the collector callbacks stay referentially stable
  // (player event subscriptions never re-attach on overlay toggle).
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const [statistics, setStatistics] = useState<PlayerStatistics>({});
  const [bandwidth, setBandwidth] = useState<PlayerBandwidth | undefined>(undefined);
  const [diagnostics, setDiagnostics] = useState<PlaybackDiagnostics>(createEmptyDiagnostics);

  const diagnosticsRef = useRef(diagnostics);
  const hasStartedPlaybackRef = useRef(false);
  const bufferingStartedAtRef = useRef<number | null>(null);
  const bufferingIsRebufferRef = useRef(false);
  const lastBufferSampleAtRef = useRef(0);

  const publish = useCallback((next: PlaybackDiagnostics) => {
    diagnosticsRef.current = next;
    setDiagnostics(next);
  }, []);

  const handleStatistics = useCallback((nextStatistics: PlayerStatistics) => {
    if (!enabledRef.current) return;
    setStatistics(nextStatistics);
  }, []);

  const handleBandwidthUpdate = useCallback((data: PlayerBandwidth) => {
    if (!enabledRef.current) return;
    setBandwidth(data);
  }, []);

  const handleBuffering = useCallback(
    (buffering: boolean, paused: boolean) => {
      if (!enabledRef.current) return;

      const now = Date.now();
      const bufferingStartedAt = bufferingStartedAtRef.current;

      if (buffering && bufferingStartedAt === null) {
        bufferingStartedAtRef.current = now;
        bufferingIsRebufferRef.current = hasStartedPlaybackRef.current && !paused;
        if (bufferingIsRebufferRef.current) {
          publish({
            ...diagnosticsRef.current,
            rebufferCount: diagnosticsRef.current.rebufferCount + 1,
          });
        }
      } else if (!buffering && bufferingStartedAt !== null) {
        const rebufferDurationSeconds = bufferingIsRebufferRef.current
          ? Math.max(0, (now - bufferingStartedAt) / 1000)
          : 0;
        if (rebufferDurationSeconds > 0) {
          publish({
            ...diagnosticsRef.current,
            totalRebufferSeconds:
              diagnosticsRef.current.totalRebufferSeconds + rebufferDurationSeconds,
          });
        }
        bufferingStartedAtRef.current = null;
        bufferingIsRebufferRef.current = false;
      }
    },
    [publish]
  );

  const markPlaybackStarted = useCallback(() => {
    hasStartedPlaybackRef.current = true;
  }, []);

  const recordBufferSample = useCallback(
    (timeSeconds: number, bufferedSeconds?: number) => {
      if (
        !enabledRef.current ||
        bufferedSeconds === undefined ||
        !Number.isFinite(bufferedSeconds)
      ) {
        return;
      }
      const now = Date.now();
      if (
        diagnosticsRef.current.bufferHistory.length > 0 &&
        now - lastBufferSampleAtRef.current < PLAYER_STATISTICS_SAMPLE_INTERVAL_MS
      ) {
        return;
      }

      const bufferAheadSeconds = Math.max(0, bufferedSeconds - timeSeconds);
      publish({
        ...diagnosticsRef.current,
        bufferAheadSeconds,
        bufferHistory: [
          ...diagnosticsRef.current.bufferHistory.slice(-(PLAYER_STATISTICS_HISTORY_SIZE - 1)),
          bufferAheadSeconds,
        ],
      });
      lastBufferSampleAtRef.current = now;
    },
    [publish]
  );

  const reset = useCallback(() => {
    hasStartedPlaybackRef.current = false;
    bufferingStartedAtRef.current = null;
    bufferingIsRebufferRef.current = false;
    lastBufferSampleAtRef.current = 0;
    const empty = createEmptyDiagnostics();
    diagnosticsRef.current = empty;
    setDiagnostics(empty);
    setBandwidth(undefined);
    setStatistics({});
  }, []);

  return {
    statistics,
    bandwidth,
    diagnostics,
    handleStatistics,
    handleBandwidthUpdate,
    handleBuffering,
    markPlaybackStarted,
    recordBufferSample,
    reset,
  };
}

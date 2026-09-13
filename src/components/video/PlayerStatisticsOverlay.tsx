import { memo } from 'react';

import { useTheme } from '@shopify/restyle';

import { PLAYER_STATISTICS_HISTORY_SIZE } from '@/constants/playback';
import { Box, Text, type Theme } from '@/theme/theme';
import type {
  PlaybackDiagnostics,
  PlayerBandwidth,
  PlayerStatistics,
  PlayerStatisticsValue,
  PlayerType,
} from '@/types/player';

const NATIVE_STATISTIC_ORDER = [
  'streamType',
  'container',
  'videoCodecName',
  'audioCodecName',
  'resolution',
  'frameRate',
  'decodedVideoFormat',
  'decodedAudioFormat',
  'audioLayout',
  'decodedAudioChannels',
  'videoDecoder',
  'audioDecoder',
  'bitrate',
  'profileLevel',
] as const;
const NATIVE_STATISTIC_KEYS: Record<string, true> = {
  streamType: true,
  container: true,
  videoCodecName: true,
  resolution: true,
  frameRate: true,
  decodedVideoFormat: true,
  decodedAudioFormat: true,
  audioCodecName: true,
  audioLayout: true,
  decodedAudioChannels: true,
  videoDecoder: true,
  audioDecoder: true,
  bitrate: true,
  profileLevel: true,
};

const STATISTIC_LABELS: Record<string, string> = {
  sourceHost: 'source',
  streamType: 'stream',
  videoCodecName: 'video codec',
  audioCodecName: 'audio codec',
  decodedVideoFormat: 'video format',
  decodedAudioFormat: 'audio format',
  decodedAudioChannels: 'audio channels',
  videoDecoder: 'video decoder',
  audioDecoder: 'audio decoder',
  frameRate: 'fps',
  bufferAhead: 'buffer',
  profileLevel: 'profile',
};

const getStatisticLabel = (key: string): string => STATISTIC_LABELS[key] ?? key;

export interface PlayerStatisticsOverlayProps {
  statistics: PlayerStatistics;
  diagnostics: PlaybackDiagnostics;
  bandwidth?: PlayerBandwidth;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isBuffering: boolean;
  playerType: PlayerType;
  source: string;
}

const formatStatisticValue = (value: PlayerStatisticsValue): string => {
  if (value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';

  try {
    return JSON.stringify(value) ?? '—';
  } catch {
    return '[unserializable]';
  }
};

const formatDuration = (seconds: number | undefined): string => {
  if (seconds === undefined || !Number.isFinite(seconds)) return '—';

  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = String(wholeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
};

const formatBufferDuration = (seconds: number | undefined): string => {
  if (seconds === undefined || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return formatDuration(seconds);
};

const getSourceHost = (source: string): string => {
  try {
    return new URL(source).host || 'unknown';
  } catch {
    return 'unknown';
  }
};

interface StatisticRowProps {
  label: string;
  value: string;
}

const StatisticRow = memo(({ label, value }: StatisticRowProps) => (
  <Box
    flexDirection="row"
    alignItems="flex-start"
    gap="xs"
    flexBasis="45%"
    flexGrow={1}
    flexShrink={1}
    style={{ minWidth: 0, maxWidth: '100%' }}>
    <Text variant="caption" color="textSecondary" style={{ flexShrink: 0 }}>
      {label}:
    </Text>
    <Text variant="caption" color="textPrimary" style={{ flex: 1, flexShrink: 1, minWidth: 0 }}>
      {value}
    </Text>
  </Box>
));

const BufferChart = memo(({ history }: { history: number[] }) => {
  const theme = useTheme<Theme>();
  const samples = history.slice(-PLAYER_STATISTICS_HISTORY_SIZE);
  const maxSeconds = Math.max(...samples, 1);
  const chartHeight = theme.sizes.iconMedium;
  const minimumBarHeight = theme.sizes.progressBarHeight;

  return (
    <Box gap="xs" style={{ minWidth: 0, width: '100%' }} testID="player-statistics-buffer-chart">
      <Box
        flexDirection="row"
        justifyContent="space-between"
        gap="s"
        style={{ minWidth: 0, width: '100%' }}>
        <Text variant="caption" color="textSecondary">
          buffer ahead over time
        </Text>
        {samples.length > 0 && (
          <Text variant="caption" color="textSecondary">
            max {formatBufferDuration(maxSeconds)}
          </Text>
        )}
      </Box>
      {samples.length > 0 ? (
        <Box
          flexDirection="row"
          alignItems="flex-end"
          height={chartHeight}
          backgroundColor="cardBackground"
          borderRadius="s"
          overflow="hidden">
          {samples.map((seconds, index) => {
            const normalizedSeconds = Math.max(0, seconds) / maxSeconds;
            const barHeight = Math.max(
              minimumBarHeight,
              normalizedSeconds * (chartHeight - minimumBarHeight)
            );

            return (
              <Box
                key={`${seconds}-${index}`}
                flex={1}
                height={barHeight}
                backgroundColor={seconds > 0 ? 'primaryBackground' : 'cardBorder'}
              />
            );
          })}
        </Box>
      ) : (
        <Text variant="caption" color="textSecondary">
          no samples yet
        </Text>
      )}
    </Box>
  );
});
StatisticRow.displayName = 'StatisticRow';
BufferChart.displayName = 'BufferChart';

export const PlayerStatisticsOverlay = memo<PlayerStatisticsOverlayProps>(
  ({
    statistics,
    diagnostics,
    bandwidth,
    currentTime,
    duration,
    isPlaying,
    isBuffering,
    playerType,
    source,
  }) => {
    const theme = useTheme<Theme>();
    const nativeEntries = NATIVE_STATISTIC_ORDER.flatMap((key) => {
      const value = statistics[key];
      return value === undefined ? [] : [[key, formatStatisticValue(value)] as const];
    });
    const additionalEntries = Object.entries(statistics)
      .filter(([key, value]) => NATIVE_STATISTIC_KEYS[key] !== true && value !== undefined)
      .map(([key, value]) => [key, formatStatisticValue(value)] as const);
    const state = `${isPlaying ? 'playing' : 'paused'}${isBuffering ? ' / buffering' : ''}`;
    const bandwidthValue =
      bandwidth && Number.isFinite(bandwidth.bitrate)
        ? `${(bandwidth.bitrate / 1_000_000).toFixed(2)} Mbps`
        : '—';
    const rows = [
      ['sourceHost', getSourceHost(source)],
      ['player', playerType],
      ['state', state],
      ['position', `${formatDuration(currentTime)} / ${formatDuration(duration)}`],
      ['bandwidth', bandwidthValue],
      ['bufferAhead', formatBufferDuration(diagnostics.bufferAheadSeconds)],
      [
        'rebuffers',
        `${diagnostics.rebufferCount} (${diagnostics.totalRebufferSeconds.toFixed(1)}s)`,
      ],
      ...nativeEntries,
      ...additionalEntries,
    ] as const;

    return (
      <Box
        testID="player-statistics-overlay"
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: theme.spacing.m,
          left: theme.spacing.m,
          right: theme.spacing.m,
          bottom: theme.spacing.m,
        }}>
        <Box
          pointerEvents="auto"
          testID="player-statistics-overlay-surface"
          flex={1}
          backgroundColor="overlayBackground"
          borderRadius="m"
          padding="s"
          gap="xs"
          overflow="hidden">
          <Text variant="caption" color="textPrimary">
            PLAYBACK DIAGNOSTICS
          </Text>
          <BufferChart history={diagnostics.bufferHistory} />
          <Box
            testID="player-statistics-columns"
            flexDirection="row"
            flexWrap="wrap"
            alignContent="flex-start"
            gap="s">
            {rows.map(([key, value]) => (
              <StatisticRow key={key} label={getStatisticLabel(key)} value={value} />
            ))}
          </Box>
        </Box>
      </Box>
    );
  }
);

PlayerStatisticsOverlay.displayName = 'PlayerStatisticsOverlay';

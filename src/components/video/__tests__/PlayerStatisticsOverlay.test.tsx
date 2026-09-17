import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';

import { renderWithProviders } from '@/utils/test-utils';

import { PlayerStatisticsOverlay } from '../PlayerStatisticsOverlay';

type TestNode = {
  children: (TestNode | string)[];
  props: Record<string, unknown>;
};

// StatisticRow is a memo wrapper; the styled Box carrying the row flex props
// sits one level below the columns container.
const getFirstRowBox = (container: TestNode): TestNode => {
  const row = container.children[0] as TestNode;
  return row.children[0] as TestNode;
};

describe('PlayerStatisticsOverlay', () => {
  it('shows playback state, buffer diagnostics, bandwidth, and native statistics', () => {
    const { getByTestId, getByText } = renderWithProviders(
      <PlayerStatisticsOverlay
        statistics={{
          streamType: 'Progressive',
          videoCodecName: 'HEVC',
          bitrate: 'Video 4.20 Mbps',
        }}
        diagnostics={{
          bufferAheadSeconds: 18.4,
          bufferHistory: [0, 10, 5],
          rebufferCount: 2,
          totalRebufferSeconds: 3.5,
        }}
        bandwidth={{ bitrate: 5_500_000, width: 1920, height: 1080 }}
        currentTime={75}
        duration={120}
        isPlaying
        isBuffering={false}
        playerType="exoplayer"
        source="https://cdn.example/video.mp4"
      />
    );

    expect(getByText('statistics_title')).toBeTruthy();
    expect(getByText('source:')).toBeTruthy();
    expect(getByText('cdn.example')).toBeTruthy();
    expect(getByText('state:')).toBeTruthy();
    expect(getByText('playing')).toBeTruthy();
    expect(getByText('buffer:')).toBeTruthy();
    expect(getByText('18.4s')).toBeTruthy();
    expect(getByText('rebuffers:')).toBeTruthy();
    expect(getByText('2 (3.5s)')).toBeTruthy();
    expect(getByText('bandwidth:')).toBeTruthy();
    expect(getByText('stream:')).toBeTruthy();
    expect(getByText('video codec:')).toBeTruthy();
    expect(getByText('HEVC')).toBeTruthy();
    expect(getByText('buffer_chart_max')).toBeTruthy();
    expect(getByTestId('player-statistics-buffer-chart')).toBeTruthy();
    expect(getByTestId('player-statistics-overlay').props.pointerEvents).toBe('box-none');
    expect(getByTestId('player-statistics-overlay-surface').props.pointerEvents).toBe('auto');
  });

  it('is anchored to the screen and can never extend past it', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(
      <PlayerStatisticsOverlay
        statistics={{ decodedAudioFormat: 'a'.repeat(500) }}
        diagnostics={{
          bufferAheadSeconds: 1,
          bufferHistory: [1],
          rebufferCount: 0,
          totalRebufferSeconds: 0,
        }}
        currentTime={0}
        duration={120}
        isPlaying={false}
        isBuffering={false}
        playerType="exoplayer"
        source="https://cdn.example/video.mp4"
      />
    );

    expect(queryByTestId('player-statistics-scroll')).toBeNull();
    const overlayStyle = StyleSheet.flatten(getByTestId('player-statistics-overlay').props.style);
    expect(overlayStyle.position).toBe('absolute');
    expect(overlayStyle.top).toBeDefined();
    expect(overlayStyle.left).toBeDefined();
    expect(overlayStyle.right).toBeDefined();
    expect(overlayStyle.bottom).toBeDefined();

    const surfaceStyle = StyleSheet.flatten(
      getByTestId('player-statistics-overlay-surface').props.style
    );
    expect(surfaceStyle.flex).toBe(1);
    expect(surfaceStyle.overflow).toBe('hidden');
  });

  it('keeps long values inside the panel without truncating them', () => {
    const longValue =
      'Dolby Digital Plus (audio/eac3) with an intentionally long decoder description';
    const { getByTestId, getByText } = renderWithProviders(
      <PlayerStatisticsOverlay
        statistics={{ decodedAudioFormat: longValue }}
        diagnostics={{
          bufferAheadSeconds: 1,
          bufferHistory: [1],
          rebufferCount: 0,
          totalRebufferSeconds: 0,
        }}
        currentTime={0}
        duration={120}
        isPlaying={false}
        isBuffering={false}
        playerType="exoplayer"
        source="https://cdn.example/video.mp4"
      />
    );

    const row = getFirstRowBox(getByTestId('player-statistics-columns'));
    expect(row.props.flexBasis).toBe('45%');
    expect(row.props.flexGrow).toBe(1);
    expect(row.props.flexShrink).toBe(1);
    const rowStyle = StyleSheet.flatten(row.props.style as ViewStyle);
    expect(rowStyle).toEqual(expect.objectContaining({ minWidth: 0, maxWidth: '100%' }));

    const valueNode = getByText(longValue);
    const valueStyle = StyleSheet.flatten(valueNode.props.style as ViewStyle);
    expect(valueStyle).toEqual(
      expect.objectContaining({
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
      })
    );
    expect(valueNode.props.numberOfLines).toBeUndefined();
    expect(valueNode.props.ellipsizeMode).toBeUndefined();
  });

  it('flows statistic rows into wrapping columns', () => {
    const { getByTestId, getByText } = renderWithProviders(
      <PlayerStatisticsOverlay
        statistics={{
          videoCodecName: 'HEVC',
          audioCodecName: 'E-AC-3',
          resolution: '1920x1080',
        }}
        diagnostics={{
          bufferAheadSeconds: 12,
          bufferHistory: [4, 8, 12],
          rebufferCount: 0,
          totalRebufferSeconds: 0,
        }}
        currentTime={10}
        duration={120}
        isPlaying
        isBuffering={false}
        playerType="exoplayer"
        source="https://cdn.example/video.mkv"
      />
    );

    const columnsStyle = StyleSheet.flatten(
      getByTestId('player-statistics-columns').props.style as ViewStyle
    );
    expect(columnsStyle.flexDirection).toBe('row');
    expect(columnsStyle.flexWrap).toBe('wrap');
    expect(columnsStyle.alignContent).toBe('flex-start');

    const row = getFirstRowBox(getByTestId('player-statistics-columns'));
    expect(row.props.flexDirection).toBe('row');
    expect(row.props.flexBasis).toBe('45%');
    expect(row.props.flexGrow).toBe(1);
    expect(row.props.flexShrink).toBe(1);

    expect(getByText('HEVC')).toBeTruthy();
  });
});

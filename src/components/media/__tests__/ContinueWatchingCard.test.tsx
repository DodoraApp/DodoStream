import React from 'react';

import { fireEvent } from '@testing-library/react-native';

import type { ContinueWatchingEntry } from '@/hooks/useContinueWatching';
import { renderWithProviders } from '@/utils/test-utils';

import { ContinueWatchingCard } from '../ContinueWatchingCard';

const createMockEntry = (
  overrides: Partial<ContinueWatchingEntry> = {}
): ContinueWatchingEntry => ({
  key: 'test-key',
  metaId: 'meta-1',
  type: 'series',
  videoId: 'ep1',
  progressSeconds: 500,
  durationSeconds: 1000,
  progressRatio: 0.5,
  lastWatchedAt: Date.now(),
  isUpNext: false,
  video: { id: 'ep1', season: 1, episode: 2, title: 'Episode Title' } as any,
  metaName: 'Show',
  imageUrl: 'https://example.com/bg.jpg',
  ...overrides,
});

describe('ContinueWatchingCard', () => {
  it('renders title, optional badges, and progress bar when in-progress', () => {
    // Arrange
    const onPress = jest.fn();
    const entry = createMockEntry({
      progressRatio: 0.5,
      isUpNext: false,
    });

    // Act
    const { getByText, getByTestId, queryByText } = renderWithProviders(
      <ContinueWatchingCard entry={entry} onPress={onPress} testID="continue-watching-card" />
    );

    // Assert
    expect(getByText('Show')).toBeTruthy();
    expect(getByText('S1E2: Episode Title')).toBeTruthy();
    expect(getByText('S1E2')).toBeTruthy();
    expect(queryByText('UP NEXT')).toBeNull();
    expect(getByTestId('continue-watching-progress')).toBeTruthy();

    // Act
    fireEvent.press(getByTestId('continue-watching-card'));

    // Assert
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows UP NEXT badge and hides progress bar when isUpNext', () => {
    // Arrange
    const entry = createMockEntry({
      progressRatio: 0,
      isUpNext: true,
      video: { id: 'ep2', season: 1, episode: 3, title: 'Next Episode' } as any,
    });

    // Act
    const { getByText, queryByTestId } = renderWithProviders(
      <ContinueWatchingCard entry={entry} onPress={() => {}} />
    );

    // Assert
    expect(getByText('up_next')).toBeTruthy();
    expect(getByText('S1E3')).toBeTruthy();
    expect(queryByTestId('continue-watching-progress')).toBeNull();
  });
});

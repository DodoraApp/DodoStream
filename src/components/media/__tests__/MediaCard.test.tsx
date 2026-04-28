import React from 'react';

import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/utils/test-utils';

import { MediaCard } from '../MediaCard';

describe('MediaCard', () => {
  const media = {
    id: 'm1',
    name: 'My Media',
    type: 'movie',
    poster: 'https://example.com/poster.jpg',
  } as any;

  it('renders title and badge when provided', () => {
    // Arrange

    // Act
    const { getByText } = renderWithProviders(
      <MediaCard media={media} onPress={() => {}} badgeLabel="S1E2" />
    );

    // Assert
    expect(getByText('My Media')).toBeTruthy();
    expect(getByText('S1E2')).toBeTruthy();
  });

  it('calls onPress with media', () => {
    // Arrange
    const onPress = jest.fn();

    // Act
    const { getByTestId } = renderWithProviders(
      <MediaCard media={media} onPress={onPress} testID="media-card" />
    );

    fireEvent.press(getByTestId('media-card'));

    // Assert
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(media);
  });
});

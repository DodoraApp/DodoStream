import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from '@/utils/test-utils';
import * as mockReact from 'react';
import { View as mockView } from 'react-native';

import { PlayerControls } from '../PlayerControls';

jest.mock('@/components/video/controls/ControlButton', () => ({
  ControlButton: (props: any) =>
    mockReact.createElement(
      mockView,
      props,
      props.label ? mockReact.createElement('Text', null, props.label) : null
    ),
}));

jest.mock('@/store/profile.store', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ activeProfileId: 'p1' })),
}));

jest.mock('@/store/profile-settings.store', () => ({
  useProfileSettingsStore: jest.fn((selector: any) =>
    selector({
      byProfile: {
        p1: {
          preferredAudioLanguages: undefined,
          preferredSubtitleLanguages: undefined,
        },
      },
    })
  ),
}));

jest.mock('@react-native-community/slider', () => {
  return (props: any) => mockReact.createElement(mockView, props);
});

describe('PlayerControls', () => {
  it('renders title and toggles visibility on press', () => {
    // Arrange
    const { getByText, queryByText, getByTestId } = renderWithProviders(
      <PlayerControls
        paused={true}
        currentTime={0}
        duration={100}
        showLoadingIndicator={false}
        title="My Title"
        audioTracks={[]}
        textTracks={[]}
        onPlayPause={() => {}}
        onSeek={() => {}}
        onSkipBackward={() => {}}
        onSkipForward={() => {}}
        onSelectAudioTrack={() => {}}
        onSelectTextTrack={() => {}}
        subtitleDelay={0}
        onSubtitleDelayChange={() => {}}
      />
    );

    // Assert (initial)
    expect(getByText('My Title')).toBeTruthy();

    // Act
    fireEvent.press(getByTestId('player-controls-overlay'));

    // Assert
    expect(queryByText('My Title')).toBeNull();
  });

  it('displays subtitle items with correct labels', () => {
    // Arrange: build sample combined tracks (pre-sorted as the combiner would produce)
    // Since no preferred languages are set, order is alphabetical by language display name:
    // German (de) comes before English (en) which comes before Spanish (es)
    // Within each language group, addon tracks come before video tracks
    const tracks = [
      // German (first alphabetically)
      {
        source: 'addon',
        index: 0,
        title: 'De Addon Subtitle',
        language: 'de',
        addonName: 'De Addon',
      },
      // English (addon first, then video)
      {
        source: 'addon',
        index: 1,
        title: 'Eng Addon Subtitle',
        language: 'en',
        addonName: 'Eng Addon',
      },
      { source: 'video', index: 2, title: 'Video EN', language: 'en' },
      // Spanish
      { source: 'video', index: 3, title: 'Video ES', language: 'es' },
    ];

    const { getByText } = renderWithProviders(
      <PlayerControls
        paused={true}
        currentTime={0}
        duration={100}
        showLoadingIndicator={false}
        title="My Title"
        audioTracks={[]}
        textTracks={tracks as any}
        onPlayPause={() => {}}
        onSeek={() => {}}
        onSkipBackward={() => {}}
        onSkipForward={() => {}}
        onSelectAudioTrack={() => {}}
        onSelectTextTrack={() => {}}
        subtitleDelay={0}
        onSubtitleDelayChange={() => {}}
      />
    );

    // Open subtitles modal
    fireEvent.press(getByText('Subtitles'));

    // Assert: All subtitle tracks should be displayed with correct labeling
    // Addon tracks show: "{addonName} | {language}"
    expect(getByText(/De Addon \| German/)).toBeTruthy();
    expect(getByText(/Eng Addon \| English/)).toBeTruthy();

    // Video tracks show: "{title} | {language}" or just "{language}" if title matches language
    expect(getByText(/Video EN \| English/)).toBeTruthy();
    expect(getByText(/Video ES \| Spanish/)).toBeTruthy();
  });
});

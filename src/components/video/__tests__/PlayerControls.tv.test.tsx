import * as mockReact from 'react';
import React from 'react';
import { View as mockView } from 'react-native';

import { act, fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/utils/test-utils';

import { PlayerControls } from '../PlayerControls';

// Capture every handler PlayerControls registers with React Native's TV event
// system so tests can drive D-pad events directly, isolating the center/select
// reveal behavior from the native focus system.
const mockTVEventHandlers: ((event: { eventType: string }) => void)[] = [];

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  // Intercept only useTVEventHandler. A Proxy (not a spread) keeps RNTV's lazy
  // export getters un-evaluated, which the jest env cannot resolve (DevMenu
  // TurboModule etc.).
  return new Proxy(actual, {
    get(target, prop, receiver) {
      if (prop === 'useTVEventHandler') {
        return (handler: (event: { eventType: string }) => void) => {
          mockTVEventHandlers.push(handler);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
      return prop === 'useTVEventHandler' || Reflect.has(target, prop);
    },
  });
});

const mockShowControls = jest.fn();
const mockToggleControls = jest.fn();
const mockRegisterInteraction = jest.fn();

jest.mock('@/hooks/useControlsVisibility', () => ({
  useControlsVisibility: () => ({
    visible: false,
    registerInteraction: mockRegisterInteraction,
    showControls: mockShowControls,
    toggleControls: mockToggleControls,
    hideControls: jest.fn(),
  }),
}));

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

jest.mock('@/store/playback.store', () => ({
  usePlaybackStore: jest.fn((selector: any) =>
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

const renderHiddenControls = () =>
  renderWithProviders(
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
      fitMode="contain"
      onToggleFitMode={() => {}}
    />
  );

describe('PlayerControls (TV)', () => {
  beforeEach(() => {
    mockTVEventHandlers.length = 0;
    mockShowControls.mockReset();
    mockToggleControls.mockReset();
    mockRegisterInteraction.mockReset();
  });

  it('center/select while hidden only records the focus target and does not reveal controls', () => {
    // Arrange - hidden controls registered their TV event handler
    renderHiddenControls();
    const tvHandler = mockTVEventHandlers[0];
    expect(tvHandler).toBeTruthy();

    // Act - native select dispatch while controls are hidden
    act(() => {
      tvHandler({ eventType: 'select' });
    });

    // Assert - the TV handler must not reveal; the hidden Pressable owns the reveal
    expect(mockShowControls).not.toHaveBeenCalled();
  });

  it('pressing the hidden full-screen area reveals controls exactly once', () => {
    // Arrange
    const { getByTestId } = renderHiddenControls();

    // Act - the native center/select reaches the focused Pressable's onPress
    fireEvent.press(getByTestId('player-controls-invisible-area'));

    // Assert - single reveal path
    expect(mockShowControls).toHaveBeenCalledTimes(1);
  });

  it('directional right while hidden reveals controls and targets the seek bar', () => {
    // Arrange
    renderHiddenControls();
    const tvHandler = mockTVEventHandlers[0];
    expect(tvHandler).toBeTruthy();

    // Act - D-pad right while controls are hidden
    act(() => {
      tvHandler({ eventType: 'right' });
    });

    // Assert - directional input still reveals through the TV handler
    expect(mockShowControls).toHaveBeenCalledTimes(1);
  });
});

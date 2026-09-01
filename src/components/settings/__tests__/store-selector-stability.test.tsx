import React from 'react';

import { renderWithProviders } from '@/utils/test-utils';

import { ProfileSelector } from '../../profile/ProfileSelector';
import { AddonsSettingsContent } from '../AddonsSettingsContent';
import { HomeSettingsContent } from '../HomeSettingsContent';
import { PlaybackSettingsContent } from '../PlaybackSettingsContent';
import { SubtitlesSettingsContent } from '../SubtitlesSettingsContent';
import { SubtitleStyleSettings } from '../SubtitleStyleSettings';

jest.mock('react-native-nitro-http-server', () => ({ start: jest.fn(), stop: jest.fn() }));
jest.mock('../RemoteControlModal', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories require() their mocks
  const ReactMock = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories require() their mocks
  const { View } = require('react-native');
  return {
    RemoteControlModal: (props: Record<string, unknown>) => ReactMock.createElement(View, props),
  };
});

// Regression: zustand v5 + React 19 loop when a selector returns fresh
// references ("getSnapshot should be cached"). These components subscribe
// with the real stores, so any new unstable selector fails with
// "Maximum update depth exceeded".
describe('store selector stability regression', () => {
  it('renders store-consuming settings content', () => {
    const { getAllByText } = renderWithProviders(
      <>
        <HomeSettingsContent />
        <PlaybackSettingsContent />
        <SubtitleStyleSettings />
        <SubtitlesSettingsContent />
        <AddonsSettingsContent />
      </>
    );
    expect(getAllByText(/home|playback|subtitles/i).length).toBeGreaterThan(0);
  });

  it('renders the profile selector', () => {
    const { getAllByText } = renderWithProviders(<ProfileSelector onSelect={jest.fn()} />);
    // i18next is mocked to return the key
    expect(getAllByText('who_is_watching')).toBeTruthy();
  });
});

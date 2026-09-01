import React from 'react';
import { Dimensions } from 'react-native';

import { fireEvent } from '@testing-library/react-native';
import { Asset } from 'expo-asset';
import { Image } from 'expo-image';

import { WHATS_NEW_IMAGE_HEIGHT_FACTOR, WHATS_NEW_MODAL_HEIGHT_FACTOR } from '@/constants/ui';
import { useAppSettingsStore } from '@/store/app-settings.store';
import { renderWithProviders } from '@/utils/test-utils';

import { WhatsNewModal } from '../WhatsNewModal';

// Use a stable fixture registry so tests don't depend on shipped content
// Entry A carries an `image` (require() result); the ID is not registered in
// the jest asset registry, so resolveAssetSource returns null unless stubbed.
jest.mock('@/constants/whats-new/_registry', () => ({
  whatsNewEntries: [
    { id: '0001', version: 'v0.1.0', title: 'Entry A', body: 'Body A', image: 42 },
    { id: '0002', version: 'v0.2.0', title: 'Entry B', body: 'Body B' },
  ],
}));

// Mock debug logger to prevent console spam
jest.mock('@/utils/debug', () => ({
  createDebugLogger: () => jest.fn(),
}));

describe('WhatsNewModal', () => {
  beforeEach(() => {
    useAppSettingsStore.setState({ lastSeenWhatsNewId: null, showWhatsNewOnStartup: true });
  });

  it('renders nothing when hidden', () => {
    useAppSettingsStore.setState({ showWhatsNewOnStartup: false });

    const { queryByText } = renderWithProviders(<WhatsNewModal />);

    expect(queryByText('Entry A')).toBeNull();
  });

  it('shows the current entry title, version badge, and body', () => {
    const { getByText } = renderWithProviders(<WhatsNewModal />);

    expect(getByText('Entry A')).toBeTruthy();
    expect(getByText('v0.1.0')).toBeTruthy();
    expect(getByText('Body A')).toBeTruthy();
  });

  it('advances to the next entry when Next is pressed', () => {
    const { getByText } = renderWithProviders(<WhatsNewModal />);

    fireEvent.press(getByText('ui.whats_new_next'));

    expect(getByText('Entry B')).toBeTruthy();
  });

  it('dismisses the last entry and persists the cursor', () => {
    const { getByText } = renderWithProviders(<WhatsNewModal />);

    fireEvent.press(getByText('ui.whats_new_next'));
    fireEvent.press(getByText('ui.whats_new_dismiss'));

    expect(useAppSettingsStore.getState().lastSeenWhatsNewId).toBe('0002');
  });
});

describe('WhatsNewModal image sizing', () => {
  // Intrinsic size of a require()'d asset (e.g. 0002, 3827x1589 px).
  const INTRINSIC_WIDTH = 3827;
  const INTRINSIC_HEIGHT = 1589;
  const CONTAINER_WIDTH = 400;

  beforeEach(() => {
    useAppSettingsStore.setState({ lastSeenWhatsNewId: null, showWhatsNewOnStartup: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sizes the entry image to the intrinsic aspect ratio at the measured width', () => {
    // The image must not be sized from the asset's intrinsic pixel height
    // (which RN injects into the Image style); the frame has to derive from
    // the width measured via onLayout and the intrinsic aspect ratio instead.
    jest.spyOn(Asset, 'fromModule').mockReturnValue({
      uri: 'file:///entry-a.png',
      width: INTRINSIC_WIDTH,
      height: INTRINSIC_HEIGHT,
    } as never);

    const { UNSAFE_getByType } = renderWithProviders(<WhatsNewModal />);

    const image = UNSAFE_getByType(Image);
    // Not sized until the rendered width is measured via onLayout.
    expect(image.props.style.height).toBeUndefined();

    fireEvent(image, 'layout', {
      nativeEvent: { layout: { width: CONTAINER_WIDTH, height: 0, x: 0, y: 0 } },
    });

    const windowHeight = Dimensions.get('window').height;
    const maxImageHeight =
      windowHeight * WHATS_NEW_MODAL_HEIGHT_FACTOR * WHATS_NEW_IMAGE_HEIGHT_FACTOR;
    const aspectRatio = INTRINSIC_WIDTH / INTRINSIC_HEIGHT;
    const expectedHeight = Math.min(CONTAINER_WIDTH / aspectRatio, maxImageHeight);

    expect(UNSAFE_getByType(Image).props.style.height).toBe(expectedHeight);
    // Regression guard: the frame must never fall back to the asset's
    // intrinsic pixel height.
    expect(UNSAFE_getByType(Image).props.style.height).not.toBe(INTRINSIC_HEIGHT);
  });
});

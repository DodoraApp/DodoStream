import React from 'react';

import { fireEvent } from '@testing-library/react-native';

import type { DbDownload } from '@/db';
import { useDownloadsStore } from '@/store/downloads.store';
import { renderWithProviders } from '@/utils/test-utils';

import { DownloadItem } from '../DownloadItem';

// The hooks module pulls in the native transfer layer; only the pure progress hook is needed.
jest.mock('@/api/downloads/download-fs');
jest.mock('@/api/downloads/download-manager', () => ({ downloadKeys: { all: ['downloads-db'] } }));
jest.mock('@/hooks/useMediaNavigation', () => ({ useMediaNavigation: jest.fn() }));
jest.mock('@/utils/debug', () => ({ createDebugLogger: () => jest.fn() }));

const download = (overrides: Partial<DbDownload> = {}): DbDownload => ({
  id: 7,
  profileId: 'profile-1',
  metaId: 'tt-1',
  type: 'movie',
  title: 'Download Movie',
  streamTitle: '1080p',
  sourceUrl: 'https://cdn.example/movie.mkv',
  fileName: 'tt-1_1.mkv',
  status: 'downloading',
  bytesDownloaded: 0,
  createdAt: 1,
  ...overrides,
});

describe('DownloadItem', () => {
  const onPlay = jest.fn();
  const onRetry = jest.fn();
  const onRemove = jest.fn();

  const renderItem = (item: DbDownload) =>
    renderWithProviders(
      <DownloadItem download={item} onPlay={onPlay} onRetry={onRetry} onRemove={onRemove} />
    );

  beforeEach(() => {
    jest.clearAllMocks();
    useDownloadsStore.setState({ progressById: {} });
  });

  it('shows live progress of a running download and only offers to cancel it', () => {
    useDownloadsStore.setState({
      progressById: { 7: { bytesDownloaded: 512, bytesTotal: 1024 } },
    });

    const { getByTestId, queryByTestId } = renderItem(
      download({ bytesDownloaded: 100, bytesTotal: 1024 })
    );

    expect(getByTestId('download-progress-7')).toBeTruthy();
    expect(getByTestId('download-status-7').props.children).toBe('media:download_progress');
    expect(queryByTestId('download-play-7')).toBeNull();
    expect(queryByTestId('download-retry-7')).toBeNull();
  });

  it('shows a waiting download without a progress bar', () => {
    const { getByTestId, queryByTestId } = renderItem(download({ status: 'queued' }));

    expect(getByTestId('download-status-7').props.children).toBe('media:download_queued');
    expect(queryByTestId('download-progress-7')).toBeNull();
  });

  it('plays a finished download', () => {
    const item = download({ status: 'completed', bytesDownloaded: 1024, bytesTotal: 1024 });
    const { getByTestId, queryByTestId } = renderItem(item);

    fireEvent.press(getByTestId('download-play-7'));

    expect(onPlay).toHaveBeenCalledWith(item);
    expect(queryByTestId('download-progress-7')).toBeNull();
  });

  it('retries a failed download', () => {
    const item = download({ status: 'failed' });
    const { getByTestId } = renderItem(item);

    fireEvent.press(getByTestId('download-retry-7'));

    expect(onRetry).toHaveBeenCalledWith(item);
    expect(getByTestId('download-status-7').props.children).toBe('media:download_failed');
  });

  it('asks in an app dialog before deleting and removes only after confirmation', () => {
    const item = download({ status: 'completed' });
    const { getByTestId, getByText } = renderItem(item);

    fireEvent.press(getByTestId('download-remove-7'));

    expect(getByText('media:download_delete_confirm_title')).toBeTruthy();
    expect(onRemove).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('download-confirm-7-confirm'));
    expect(onRemove).toHaveBeenCalledWith(item);
  });

  it('keeps the download when the dialog is dismissed', () => {
    const { getByTestId } = renderItem(download({ status: 'completed' }));

    fireEvent.press(getByTestId('download-remove-7'));
    fireEvent.press(getByTestId('download-confirm-7-cancel'));

    expect(onRemove).not.toHaveBeenCalled();
  });

  it('words the confirmation as a cancel for an unfinished download', () => {
    const { getByTestId, getByText } = renderItem(download({ status: 'queued' }));

    fireEvent.press(getByTestId('download-remove-7'));

    expect(getByText('media:download_cancel_confirm_title')).toBeTruthy();
  });
});

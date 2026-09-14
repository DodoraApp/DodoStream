import * as mockReact from 'react';
import { View as mockView } from 'react-native';

import * as stremioApi from '@/api/stremio';
import type { MetaPreview } from '@/types/stremio';
import { renderWithProviders } from '@/utils/test-utils';

import { CatalogSection, type CatalogSectionProps } from '../CatalogSection';

jest.mock('@/api/stremio', () => ({
  useCatalog: jest.fn(),
}));

jest.mock('@/components/media/MediaList', () => ({
  MediaList: ({ dataKey }: { dataKey?: string }) =>
    mockReact.createElement(mockView, {
      testID: 'media-list',
      dataKey,
    } as unknown as mockReact.ComponentProps<typeof mockView>),
}));

const mockUseCatalog = stremioApi.useCatalog as jest.Mock;
const catalogMedia = {
  id: 'movie-1',
  type: 'movie',
  name: 'Movie 1',
} satisfies MetaPreview;

const baseProps: CatalogSectionProps = {
  manifestUrl: 'https://addon.example/manifest.json',
  catalogType: 'movie',
  catalogId: 'catalog-a',
  onMediaPress: () => {},
};

const catalogResult = {
  data: { metas: [catalogMedia] },
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
};

describe('CatalogSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCatalog.mockReturnValue(catalogResult);
  });

  it('changes the nested media list dataset when the catalog identity changes', () => {
    const { getByTestId, rerender } = renderWithProviders(<CatalogSection {...baseProps} />);

    expect(getByTestId('media-list').props.dataKey).toBe(
      'https://addon.example/manifest.json:movie:catalog-a'
    );

    rerender(<CatalogSection {...baseProps} catalogId="catalog-b" />);

    expect(getByTestId('media-list').props.dataKey).toBe(
      'https://addon.example/manifest.json:movie:catalog-b'
    );
  });
});

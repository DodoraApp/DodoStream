import { useState, useCallback, useMemo } from 'react';
import { Container } from '@/components/basic/Container';
import { TextInput } from 'react-native';
import { FlashList, ListRenderItem } from '@shopify/flash-list';
import { Box, Text } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import { useSearchCatalogs } from '@/api/stremio';
import { MetaPreview } from '@/types/stremio';
import { LoadingQuery } from '@/components/basic/LoadingQuery';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { CatalogSectionHeader } from '@/components/media/CatalogSectionHeader';
import { StaticCatalogSection } from '@/components/media/CatalogSection';
import { Ionicons } from '@expo/vector-icons';
import { Focusable } from '@/components/basic/Focusable';

/** Item types for the flattened search results list */
type SearchListItem =
  | { type: 'header'; title: string; catalogType: string; id: string }
  | { type: 'content'; metas: MetaPreview[]; id: string };

export default function SearchTab() {
  const theme = useTheme<Theme>();
  const { navigateToDetails } = useMediaNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const {
    data: searchResults,
    isLoading,
    isError,
  } = useSearchCatalogs(submittedQuery, submittedQuery.length > 0);

  const handleMediaPress = useCallback(
    (media: MetaPreview) => {
      navigateToDetails(media.id, media.type);
    },
    [navigateToDetails]
  );

  const handleSearch = useCallback(() => {
    const query = searchQuery.trim();
    if (query.length > 0) {
      setSubmittedQuery(query);
    }
  }, [searchQuery]);

  const handleClear = useCallback(() => {
    setSearchQuery('');
    setSubmittedQuery('');
  }, []);

  return (
    <Container disablePadding safeAreaEdges={['left', 'right', 'top']}>
      <Box flex={1}>
        {/* Full-width search bar */}
        <Box paddingHorizontal="m" paddingVertical="m">
          <Box
            flexDirection="row"
            alignItems="center"
            backgroundColor="inputBackground"
            borderRadius="m"
            paddingHorizontal="m"
            height={theme.sizes.inputHeight}>
            <Box marginRight="s">
              <Ionicons
                name="search"
                size={theme.sizes.iconMedium}
                color={theme.colors.textSecondary}
              />
            </Box>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1,
                color: theme.colors.textPrimary,
                fontSize: theme.textVariants.body.fontSize,
              }}
              placeholderTextColor={theme.colors.textPlaceholder}
              placeholder="Search movies, shows..."
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <Box gap="s" flexDirection="row" alignItems="center">
                <Focusable onPress={handleClear} variant="outline">
                  <Box padding="xs">
                    <Ionicons
                      name="close-circle"
                      size={theme.sizes.inputHeight / 2}
                      color={theme.colors.textSecondary}
                    />
                  </Box>
                </Focusable>
                <Focusable onPress={handleSearch} variant="outline">
                  <Box padding="xs">
                    <Ionicons
                      name="arrow-forward-circle"
                      size={theme.sizes.inputHeight / 2}
                      color={theme.colors.primaryBackground}
                    />
                  </Box>
                </Focusable>
              </Box>
            )}
          </Box>
        </Box>

        {/* Results or empty state */}
        {submittedQuery.length === 0 ? (
          <Box flex={1} justifyContent="center" alignItems="center" padding="xl">
            <Ionicons
              name="search-outline"
              size={theme.sizes.iconLarge}
              color={theme.colors.textSecondary}
            />
            <Text variant="body" color="textSecondary" marginTop="m" textAlign="center">
              Search for movies, TV shows, and more
            </Text>
          </Box>
        ) : (
          <LoadingQuery
            isLoading={isLoading}
            isError={isError}
            data={searchResults}
            loadingMessage="Searching..."
            isEmpty={(data) => data.length === 0}
            emptyMessage="No results found"
            errorMessage="Failed to search">
            {() => (
              <SearchResultsList searchResults={searchResults} onMediaPress={handleMediaPress} />
            )}
          </LoadingQuery>
        )}
      </Box>
    </Container>
  );
}

interface SearchResultsListProps {
  searchResults: NonNullable<ReturnType<typeof useSearchCatalogs>['data']>;
  onMediaPress: (media: MetaPreview) => void;
}

function SearchResultsList({ searchResults, onMediaPress }: SearchResultsListProps) {
  // Flatten search results into a single list with headers and content rows
  const flattenedData = useMemo<SearchListItem[]>(() => {
    const items: SearchListItem[] = [];
    for (const result of searchResults) {
      const sectionId = `${result.manifestUrl}-${result.catalogType}-${result.catalogId}`;
      items.push({
        type: 'header',
        title: result.catalogName,
        catalogType: result.catalogType,
        id: `header-${sectionId}`,
      });
      items.push({
        type: 'content',
        metas: result.metas,
        id: `content-${sectionId}`,
      });
    }
    return items;
  }, [searchResults]);

  const renderItem: ListRenderItem<SearchListItem> = useCallback(
    ({ item }) => {
      if (item.type === 'header') {
        return <CatalogSectionHeader title={item.title} type={item.catalogType} />;
      }
      return <StaticCatalogSection metas={item.metas} onMediaPress={onMediaPress} />;
    },
    [onMediaPress]
  );

  const keyExtractor = useCallback((item: SearchListItem) => item.id, []);

  const getItemType = useCallback((item: SearchListItem) => item.type, []);

  return (
    <FlashList
      data={flattenedData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      showsVerticalScrollIndicator={false}
    />
  );
}

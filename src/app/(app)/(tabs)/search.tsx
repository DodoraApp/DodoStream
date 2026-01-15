import { useState, useCallback } from 'react';
import { Container } from '@/components/basic/Container';
import { SectionList, TextInput, TouchableOpacity, Platform } from 'react-native';
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

export default function SearchTab() {
  const appTheme = useTheme<Theme>();
  const { navigateToDetails } = useMediaNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const {
    data: searchResults,
    isLoading,
    isError,
  } = useSearchCatalogs(submittedQuery, submittedQuery.length > 0);

  // Transform searchResults into SectionList format
  const sections = searchResults.map((result) => {
    const sectionKey = `${result.manifestUrl}-${result.catalogType}-${result.catalogId}`;
    return {
      key: sectionKey,
      title: result.catalogName,
      type: result.catalogType,
      data: [
        {
          key: `search-${sectionKey}-row`,
          metas: result.metas,
        },
      ],
    };
  });

  const handleMediaPress = (media: MetaPreview) => {
    navigateToDetails(media.id, media.type);
  };

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
            height={56}>
            <Box marginRight="s">
              <Ionicons name="search" size={20} color={appTheme.colors.textSecondary} />
            </Box>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1,
                color: appTheme.colors.textPrimary,
                fontSize: 16,
              }}
              placeholderTextColor={appTheme.colors.textPlaceholder}
              placeholder="Search movies, shows..."
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoFocus={!Platform.isTV}
            />
            {searchQuery.length > 0 && (
              <>
                <TouchableOpacity onPress={handleClear}>
                  <Box marginLeft="s">
                    <Ionicons name="close-circle" size={20} color={appTheme.colors.textSecondary} />
                  </Box>
                </TouchableOpacity>
                <Focusable onPress={handleSearch}>
                  {({ isFocused }) => (
                    <Box
                      marginLeft="s"
                      padding="xs"
                      borderRadius="full"
                      backgroundColor={isFocused ? 'focusBackground' : 'transparent'}>
                      <Ionicons
                        name="arrow-forward-circle"
                        size={24}
                        color={appTheme.colors.primaryBackground}
                      />
                    </Box>
                  )}
                </Focusable>
              </>
            )}
          </Box>
        </Box>

        {/* Results or empty state */}
        {submittedQuery.length === 0 ? (
          <Box flex={1} justifyContent="center" alignItems="center" padding="xl">
            <Ionicons name="search-outline" size={64} color={appTheme.colors.textSecondary} />
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
            emptyMessage="No results found"
            errorMessage="Failed to search">
            {() => (
              <SectionList
                sections={sections}
                keyExtractor={(item) => item.key}
                renderItem={({ item }) => (
                  <StaticCatalogSection metas={item.metas} onMediaPress={handleMediaPress} />
                )}
                renderSectionHeader={({ section }) => (
                  <CatalogSectionHeader title={section.title} type={section.type} />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            )}
          </LoadingQuery>
        )}
      </Box>
    </Container>
  );
}

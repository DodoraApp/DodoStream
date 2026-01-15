import { Container } from '@/components/basic/Container';
import { useLocalSearchParams, Stack } from 'expo-router';
import { SectionList } from 'react-native';
import { Box, Text } from '@/theme/theme';
import { useSearchCatalogs } from '@/api/stremio';
import { MetaPreview } from '@/types/stremio';
import { LoadingQuery } from '@/components/basic/LoadingQuery';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { CatalogSectionHeader } from '@/components/media/CatalogSectionHeader';
import { StaticCatalogSection } from '@/components/media/CatalogSection';

export default function Search() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { navigateToDetails } = useMediaNavigation();
  const searchQuery = q || '';

  const {
    data: searchResults,
    isLoading,
    isError,
  } = useSearchCatalogs(searchQuery, searchQuery.length > 0);

  // Transform searchResults into SectionList format compatible with Home layout
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

  return (
    <Container>
      <Stack.Screen
        options={{
          title: `Search: ${searchQuery}`,
        }}
      />
      <Box flex={1}>
        <LoadingQuery
          isLoading={isLoading}
          isError={isError}
          data={searchResults}
          loadingMessage="Searching..."
          errorMessage="Failed to load media details">
          {(searchResults) =>
            searchResults.length === 0 ? (
              <Box backgroundColor="cardBackground" padding="m" borderRadius="m">
                <Text variant="body" color="textSecondary">
                  No results found for &quot;{searchQuery}&quot;
                </Text>
              </Box>
            ) : (
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
            )
          }
        </LoadingQuery>
      </Box>
    </Container>
  );
}

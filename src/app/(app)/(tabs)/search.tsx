import { type RefObject, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findNodeHandle, Keyboard, Platform, TextInput, useTVEventHandler } from 'react-native';

import { LegendList, type LegendListRenderItemProps } from '@legendapp/list/react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme } from '@shopify/restyle';
import { useLocalSearchParams } from 'expo-router';

import { type SearchCatalogResult, useSearchCatalogs } from '@/api/stremio';
import { Container } from '@/components/basic/Container';
import { Focusable } from '@/components/basic/Focusable';
import { LoadingQuery } from '@/components/basic/LoadingQuery';
import { StaticCatalogSection } from '@/components/media/CatalogSection';
import { CatalogSectionHeader } from '@/components/media/CatalogSectionHeader';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';
import { useSidebarFocusStore } from '@/store/sidebar-focus.store';
import type { Theme } from '@/theme/theme';
import { Box, Text } from '@/theme/theme';
import { MetaPreview } from '@/types/stremio';

/** Flattened search results: one header + one content row per catalog. */
type SearchListItem =
  | { type: 'header'; title: string; catalogType: string; id: string }
  | { type: 'content'; metas: MetaPreview[]; id: string };

/** State and actions driving the search bar. */
interface SearchBarApi {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  /** Last query actually submitted to the catalogs */
  submittedQuery: string;
  isEditing: boolean;
  enterEditMode: () => void;
  exitEditMode: () => void;
  inputRef: RefObject<TextInput | null>;
  isAndroidTV: boolean;
  handleSearch: () => void;
  handleClear: () => void;
  /** Query param from navigation, e.g. from a cast card */
  initialQuery?: string;
}

/** Search input state machine: query state plus the TV display/edit mode. */
function useSearchBar(initialQuery?: string): SearchBarApi {
  const [searchQuery, setSearchQuery] = useState(initialQuery ?? '');
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery ?? '');
  const inputRef = useRef<TextInput>(null);
  const isAndroidTV = Platform.isTV && Platform.OS === 'android';
  // TV: a focused EditText captures D-pad for caret movement, so a plain
  // focusable "display" stands in until the user actually edits.
  const [isEditing, setIsEditing] = useState(false);

  const enterEditMode = useCallback(() => setIsEditing(true), []);
  const exitEditMode = useCallback(() => setIsEditing(false), []);

  // Re-apply a new query param when navigated here (e.g. from a cast card).
  // Adjusted during render (React's derived-state pattern) so the compiler
  // can preserve memoization.
  const [lastInitialQuery, setLastInitialQuery] = useState(initialQuery);
  if (initialQuery && initialQuery !== lastInitialQuery) {
    setLastInitialQuery(initialQuery);
    setSearchQuery(initialQuery);
    setSubmittedQuery(initialQuery);
  }

  const handleSearch = useCallback(() => {
    const query = searchQuery.trim();
    if (query.length > 0) {
      setSubmittedQuery(query);
      if (Platform.isTV) {
        Keyboard.dismiss(); // close the keyboard so results are visible
        exitEditMode();
      }
    }
  }, [searchQuery, exitEditMode]);

  // TV: remotes may deliver Enter as a window key event instead of an IME action;
  // submit on key-up only when the input itself is focused.
  useTVEventHandler(
    useCallback(
      (evt) => {
        if (evt.eventType !== 'select' || evt.eventKeyAction !== 1) return;
        const inputTag = inputRef.current ? findNodeHandle(inputRef.current) : null;
        if (inputTag != null && evt.tag === inputTag) {
          handleSearch();
        }
      },
      [handleSearch]
    )
  );

  const handleClear = useCallback(() => {
    setSearchQuery('');
    setSubmittedQuery('');
    if (Platform.isTV) {
      // Go straight back to typing a fresh query.
      enterEditMode();
    }
  }, [enterEditMode]);

  return {
    searchQuery,
    setSearchQuery,
    submittedQuery,
    isEditing,
    enterEditMode,
    exitEditMode,
    inputRef,
    isAndroidTV,
    handleSearch,
    handleClear,
    initialQuery,
  };
}

export default function SearchTab() {
  const { t } = useTranslation('media');
  const { navigateToDetails } = useMediaNavigation();
  const { query: initialQuery } = useLocalSearchParams<{ query?: string }>();
  const searchBar = useSearchBar(initialQuery);

  const {
    data: searchResults,
    isLoading,
    isError,
  } = useSearchCatalogs(searchBar.submittedQuery, searchBar.submittedQuery.length > 0);

  const handleMediaPress = useCallback(
    (media: MetaPreview) => {
      navigateToDetails(media.id, media.type);
    },
    [navigateToDetails]
  );

  return (
    <Container
      disablePadding
      safeAreaEdges={['left', 'right', 'top']}
      preserveVerticalInsetsInLandscape
      ignoreLeftInsetInLandscape>
      <Box flex={1}>
        <SearchBar searchBar={searchBar} />
        {searchBar.submittedQuery.length === 0 ? (
          <SearchEmptyState />
        ) : (
          <LoadingQuery
            isLoading={isLoading}
            isError={isError}
            data={searchResults}
            loadingMessage={t('searching')}
            isEmpty={(data) => data.length === 0}
            emptyMessage={t('no_results')}
            errorMessage={t('search_failed')}>
            {() => (
              <SearchResultsList searchResults={searchResults} onMediaPress={handleMediaPress} />
            )}
          </LoadingQuery>
        )}
      </Box>
    </Container>
  );
}

interface SearchBarProps {
  searchBar: SearchBarApi;
}

/** Full-width search bar: icon, editable input (or TV display), clear/submit buttons. */
function SearchBar({ searchBar }: SearchBarProps) {
  const { t } = useTranslation('media');
  const theme = useTheme<Theme>();
  const activeSidebarNodeHandle = useSidebarFocusStore((state) => state.activeSidebarNodeHandle);
  const {
    searchQuery,
    setSearchQuery,
    isEditing,
    enterEditMode,
    exitEditMode,
    inputRef,
    isAndroidTV,
    handleSearch,
    handleClear,
    initialQuery,
  } = searchBar;

  return (
    <Box paddingHorizontal="m" paddingVertical="m">
      <Box
        flexDirection="row"
        alignItems="center"
        backgroundColor="inputBackground"
        borderRadius="m"
        // TV: no right padding so the display highlight fills the bar; buttons carry the margin.
        paddingLeft="m"
        paddingRight={isAndroidTV ? undefined : 'm'}
        height={theme.sizes.inputHeight}>
        <Box marginRight="s">
          <Ionicons
            name="search"
            size={theme.sizes.iconMedium}
            color={theme.colors.textSecondary}
          />
        </Box>
        {isAndroidTV && !isEditing ? (
          // TV: plain focus target (no text caret) so D-pad reaches buttons/results.
          <Focusable
            onPress={enterEditMode}
            nextFocusLeftId={activeSidebarNodeHandle}
            variant="background"
            style={{ flex: 1, alignSelf: 'stretch' }}>
            {({ isFocused }) => (
              <Box flex={1} justifyContent="center" paddingHorizontal="s">
                <Text
                  numberOfLines={1}
                  variant="body"
                  color={isFocused || searchQuery.length > 0 ? 'textPrimary' : 'textPlaceholder'}>
                  {searchQuery || t('search_placeholder')}
                </Text>
              </Box>
            )}
          </Focusable>
        ) : (
          <TextInput
            ref={inputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              color: theme.colors.textPrimary,
              fontSize: theme.textVariants.body.fontSize,
            }}
            placeholderTextColor={theme.colors.textPlaceholder}
            placeholder={t('search_placeholder')}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoFocus={!Platform.isTV ? !initialQuery : isEditing} // mobile: open-to-type; TV: on edit entry
            onBlur={() => {
              // TV: swap the display back in without stealing focus.
              if (isAndroidTV) {
                exitEditMode();
              }
            }}
            blurOnSubmit={!Platform.isTV} // TV: submit without blurring so focus stays put
            testID="search-input"
          />
        )}
        {searchQuery.length > 0 && (
          <Box
            gap="s"
            flexDirection="row"
            alignItems="center"
            marginRight={isAndroidTV ? 'm' : undefined}>
            <Focusable onPress={handleClear} variant="outline" testID="search-clear">
              <Box padding="xs">
                <Ionicons
                  name="close-circle"
                  size={theme.sizes.inputHeight / 2}
                  color={theme.colors.textSecondary}
                />
              </Box>
            </Focusable>
            <Focusable onPress={handleSearch} variant="outline" testID="search-submit">
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
  );
}

/** Shown before any query has been submitted. */
function SearchEmptyState() {
  const { t } = useTranslation('media');
  const theme = useTheme<Theme>();

  return (
    <Box flex={1} justifyContent="center" alignItems="center" padding="xl">
      <Ionicons
        name="search-outline"
        size={theme.sizes.iconLarge}
        color={theme.colors.textSecondary}
      />
      <Text variant="body" color="textSecondary" marginTop="m" textAlign="center">
        {t('search_desc')}
      </Text>
    </Box>
  );
}

interface SearchResultsListProps {
  searchResults: SearchCatalogResult[];
  onMediaPress: (media: MetaPreview) => void;
}

/** Flatten catalog results into a single list with header + content rows. */
function flattenSearchResults(searchResults: SearchCatalogResult[]): SearchListItem[] {
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
}

function SearchResultsList({ searchResults, onMediaPress }: SearchResultsListProps) {
  const flattenedData = useMemo(() => flattenSearchResults(searchResults), [searchResults]);

  const renderItem = useCallback(
    ({ item }: LegendListRenderItemProps<SearchListItem>) => {
      if (item.type === 'header') {
        return <CatalogSectionHeader title={item.title} type={item.catalogType} />;
      }
      return <StaticCatalogSection metas={item.metas} onMediaPress={onMediaPress} />;
    },
    [onMediaPress]
  );

  const keyExtractor = useCallback((item: SearchListItem) => item.id, []);

  return (
    <LegendList
      data={flattenedData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      showsVerticalScrollIndicator={false}
    />
  );
}

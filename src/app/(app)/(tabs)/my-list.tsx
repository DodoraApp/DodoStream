import { Container } from '@/components/basic/Container';
import { PageHeader } from '@/components/basic/PageHeader';
import theme, { Box, Text } from '@/theme/theme';
import { FlashList } from '@shopify/flash-list';
import { memo, useCallback } from 'react';
import { useMyListStore, type MyListItem } from '@/store/my-list.store';
import { useBreakpointValue } from '@/hooks/useBreakpoint';
import { MediaCard } from '@/components/media/MediaCard';
import type { MetaPreview } from '@/types/stremio';
import { useMeta } from '@/api/stremio';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { useMediaNavigation } from '@/hooks/useMediaNavigation';

interface MyListEntryCardProps {
  entry: MyListItem;
  onPress: (media: MetaPreview) => void;
}

const MyListEntryCard = memo(({ entry, onPress }: MyListEntryCardProps) => {
  const { data: meta, isLoading } = useMeta(entry.type, entry.id);

  if (isLoading) {
    return (
      <Box width={140} height={240} justifyContent="center" alignItems="center">
        <LoadingIndicator size="small" />
      </Box>
    );
  }

  if (!meta) {
    return (
      <Box width={140} height={240} justifyContent="center" alignItems="center">
        <Text variant="caption" color="textSecondary">
          Unavailable
        </Text>
      </Box>
    );
  }

  const preview = {
    id: meta.id,
    type: meta.type ?? entry.type,
    name: meta.name,
    poster: meta.poster,
    background: meta.background,
  } as MetaPreview;

  return (
    <Box flex={1} alignItems="center" paddingBottom="m">
      <MediaCard media={preview} onPress={onPress} />
    </Box>
  );
});

export default function MyList() {
  const { navigateToDetails } = useMediaNavigation();
  const data = useMyListStore((state) => state.getActiveList());
  const numColumns = useBreakpointValue({ mobile: 2, tablet: 4, tv: 6 });

  const handlePress = useCallback(
    (media: MetaPreview) => {
      navigateToDetails(media.id, media.type);
    },
    [navigateToDetails]
  );

  return (
    <Container>
      <PageHeader title="My List" />

      <Box flex={1} paddingVertical="m" gap="l">
        {data.length === 0 ? (
          <Text variant="body" color="textSecondary">
            Your saved content will appear here
          </Text>
        ) : (
          <FlashList
            data={data}
            numColumns={numColumns}
            keyExtractor={(item) => `${item.type}:${item.id}`}
            renderItem={({ item }) => <MyListEntryCard entry={item} onPress={handlePress} />}
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.m,
              paddingTop: theme.spacing.s,
            }}
          />
        )}
      </Box>
    </Container>
  );
}

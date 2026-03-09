import { FC, useCallback, useMemo } from 'react';
import { FlashList } from '@shopify/flash-list';
import { Box, Text } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '@/theme/theme';
import { useRouter } from 'expo-router';

import type { MetaDetail, CastMember } from '@/types/stremio';
import { CastPersonCard } from '@/components/media/CastPersonCard';
import { HorizontalSpacer } from '@/components/basic/Spacer';
import FadeIn from '@/components/basic/FadeIn';

/** Extract people from app_extras or fall back to links */
const extractCastMembers = (
  media: MetaDetail,
  role: 'cast' | 'directors' | 'writers',
  linkCategory: string
): CastMember[] => {
  const fromExtras = media.app_extras?.[role];
  if (fromExtras && fromExtras.length > 0) {
    return fromExtras;
  }

  // Fallback: parse from links (name only, no photos)
  const normalizedCategory = linkCategory.toLowerCase();
  const fromLinks =
    media.links
      ?.filter((l) => l.category?.toLowerCase() === normalizedCategory)
      .map((l) => ({ name: l.name })) ?? [];

  return fromLinks;
};

interface CastSectionProps {
  title: string;
  members: CastMember[];
  onPersonPress: (name: string) => void;
}

const CastSection: FC<CastSectionProps> = ({ title, members, onPersonPress }) => {
  const theme = useTheme<Theme>();

  const renderItem = useCallback(
    ({ item }: { item: CastMember }) => (
      <CastPersonCard
        person={item}
        onPress={() => onPersonPress(item.name)}
        recyclingKey={`${title}-${item.name}`}
      />
    ),
    [onPersonPress, title]
  );

  const keyExtractor = useCallback((item: CastMember) => `${title}-${item.name}`, [title]);

  if (members.length === 0) return null;

  return (
    <Box gap="m">
      <Text variant="subheader">{title}</Text>
      <FlashList<CastMember>
        data={members}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={{
          paddingVertical: theme.spacing.s,
          paddingHorizontal: theme.spacing.s,
        }}
        ItemSeparatorComponent={HorizontalSpacer}
      />
    </Box>
  );
};

interface CastTabProps {
  media: MetaDetail;
  isActive: boolean;
}

export const CastTab: FC<CastTabProps> = ({ media, isActive }) => {
  const router = useRouter();

  const cast = useMemo(() => extractCastMembers(media, 'cast', 'Cast'), [media]);
  const directors = useMemo(() => extractCastMembers(media, 'directors', 'Directors'), [media]);
  const writers = useMemo(() => extractCastMembers(media, 'writers', 'Writers'), [media]);

  const handlePersonPress = useCallback(
    (name: string) => {
      router.push({ pathname: '/(app)/(tabs)/search', params: { query: name } });
    },
    [router]
  );

  if (!isActive) return null;

  const sections = [
    { key: 'cast', title: 'Cast', members: cast },
    { key: 'directors', title: 'Directors', members: directors },
    { key: 'writers', title: 'Writers', members: writers },
  ].filter((s) => s.members.length > 0);

  if (sections.length === 0) {
    return (
      <Box padding="l" alignItems="center">
        <Text variant="body" color="textSecondary">
          No cast information available
        </Text>
      </Box>
    );
  }

  return (
    <FadeIn>
      <Box gap="m">
        {sections.map((section) => (
          <CastSection
            key={section.key}
            title={section.title}
            members={section.members}
            onPersonPress={handlePersonPress}
          />
        ))}
      </Box>
    </FadeIn>
  );
};

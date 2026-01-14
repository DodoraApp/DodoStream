import { Box, Text } from '@/theme/theme';
import { Tag } from '@/components/basic/Tag';
import { ExpandableSection } from '@/components/basic/ExpandableSection';
import type { MetaDetail, MetaLink, MetaVideo } from '@/types/stremio';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import FadeIn from '@/components/basic/FadeIn';
import { formatReleaseInfo, formatRuntime, formatDescription } from '@/utils/format';

interface MediaInfoProps {
  media: MetaDetail;
  /** Optional selected video entry (episode). When set, its fields will be preferred. */
  video?: MetaVideo;
  variant?: 'compact' | 'full';
  layout?: 'default' | 'tvHeader';
}

const normalizeCategory = (category: string) => {
  const lowered = category.trim().toLowerCase();
  return lowered.endsWith('s') ? lowered.slice(0, -1) : lowered;
};

const uniqStrings = (values: (string | undefined | null)[]) => {
  const set = new Set<string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    set.add(trimmed);
  }
  return Array.from(set);
};

const getLinksByCategory = (links: MetaLink[] | undefined, category: string) => {
  if (!links?.length) return [] as MetaLink[];
  const normalized = normalizeCategory(category);
  return links.filter((l) => normalizeCategory(l.category) === normalized);
};

const parseImdbRating = (imdbRating: string | undefined) => {
  if (!imdbRating) return undefined;
  const n = Number.parseFloat(imdbRating);
  return Number.isFinite(n) ? n : undefined;
};

const IMDB_YELLOW = '#F5C518';
const IMDB_BLACK = '#000000';

const extractGenres = (media: MetaDetail) => {
  const fromLinks = getLinksByCategory(media.links, 'genre').map((l) => l.name);
  return uniqStrings(fromLinks);
};

const extractPeople = (media: MetaDetail, role: 'director' | 'writer' | 'actor') => {
  const fromLinks = getLinksByCategory(media.links, role).map((l) => l.name);

  return uniqStrings(fromLinks);
};

const DotSeparator = () => (
  <Box width={4} height={4} borderRadius="full" backgroundColor="textSecondary" />
);

const ImdbTag = ({ rating }: { rating: number }) => {
  return (
    <Box
      backgroundColor="cardBackground"
      borderRadius="s"
      borderWidth={1}
      borderColor="cardBorder"
      overflow="hidden"
      flexDirection="row"
      alignItems="stretch">
      <Box
        paddingHorizontal="s"
        paddingVertical="xs"
        style={{ backgroundColor: IMDB_YELLOW }}
        justifyContent="center">
        <Text variant="caption" fontWeight="700" style={{ color: IMDB_BLACK, fontSize: 12 }}>
          IMDb
        </Text>
      </Box>
      <Box paddingHorizontal="s" paddingVertical="xs" justifyContent="center">
        <Text variant="caption" fontWeight="700" color="textSecondary" style={{ fontSize: 12 }}>
          {rating.toFixed(1)}
        </Text>
      </Box>
    </Box>
  );
};

const DotSeparatedInfoRow = ({ items }: { items: { key: string; node: ReactNode }[] }) => {
  const visible = items.filter((i) => i.node !== null && i.node !== undefined);
  if (visible.length === 0) return null;

  return (
    <Box flexDirection="row" alignItems="center" flexWrap="wrap" gap="s">
      {visible.map((item, index) => (
        <Box key={item.key} flexDirection="row" alignItems="center" gap="s">
          {index === 0 ? null : <DotSeparator />}
          {item.node}
        </Box>
      ))}
    </Box>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  return (
    <Box gap="xs">
      <Text variant="cardTitle">{title}</Text>
      {children}
    </Box>
  );
};

const PeopleLine = ({ title, names }: { title: string; names: string[] }) => {
  if (!names.length) return null;
  return (
    <Section title={title}>
      <Text variant="body" color="textSecondary">
        {names.join(', ')}
      </Text>
    </Section>
  );
};

export const MediaInfo = ({
  media,
  video,
  variant = 'full',
  layout = 'default',
}: MediaInfoProps) => {
  const imdbRating = parseImdbRating(media.imdbRating);
  const releaseInfo = formatReleaseInfo(media, video);
  const runtime = formatRuntime(media, video);
  const genres = extractGenres(media);
  const description = formatDescription(media, video);
  const directors = extractPeople(media, 'director');
  const writers = extractPeople(media, 'writer');
  const cast = extractPeople(media, 'actor');

  const peopleBlock =
    directors.length || writers.length || cast.length ? (
      <Box gap="m" paddingTop="m">
        <PeopleLine title="Director(s)" names={directors} />
        <PeopleLine title="Writers" names={writers} />
        <PeopleLine title="Cast" names={cast} />
      </Box>
    ) : null;

  const descriptionBlock = description ? (
    <Text variant="body" color="textSecondary">
      {description}
    </Text>
  ) : null;

  const hasExpandableContent = Boolean(descriptionBlock || peopleBlock);

  const quickInfoItems = [
    {
      key: 'imdb',
      node: imdbRating !== undefined ? <ImdbTag rating={imdbRating} /> : null,
    },
    {
      key: 'release',
      node: releaseInfo ? (
        <Text variant="body" color="textSecondary">
          {releaseInfo}
        </Text>
      ) : null,
    },
    {
      key: 'runtime',
      node: runtime ? (
        <Text variant="body" color="textSecondary">
          {runtime}
        </Text>
      ) : null,
    },
  ];

  if (variant === 'compact') {
    return (
      <FadeIn>
        <Box gap="m">
          {hasExpandableContent && (
            <ExpandableSection collapsedLines={3} hasExtraContent={Boolean(peopleBlock)}>
              {({ mode, isExpanded, textProps }) => (
                <Box>
                  {description ? (
                    <Text variant="body" color="textSecondary" {...textProps}>
                      {description}
                    </Text>
                  ) : null}
                  {mode === 'display' && isExpanded ? peopleBlock : null}
                </Box>
              )}
            </ExpandableSection>
          )}
        </Box>
      </FadeIn>
    );
  }

  if (layout === 'tvHeader') {
    return (
      <FadeIn>
        <Box gap="m">
          <Box flexDirection="row" alignItems="flex-start" gap="l">
            <Box flexGrow={1} flexWrap="nowrap" style={{ minWidth: 0 }}>
              <DotSeparatedInfoRow items={quickInfoItems} />
            </Box>

            {!!genres.length && (
              <Box flexGrow={1} flexShrink={1} alignItems="flex-end" style={{ minWidth: 0 }}>
                <Box flexDirection="row" flexWrap="wrap" justifyContent="flex-end" gap="s">
                  {genres.map((g) => (
                    <Tag key={g} label={g} variant="glass" focusable={false} />
                  ))}
                </Box>
              </Box>
            )}
          </Box>

          {(!!description || peopleBlock) && (
            <ExpandableSection collapsedLines={3} hasExtraContent={Boolean(peopleBlock)}>
              {({ mode, isExpanded, textProps }) => (
                <Box>
                  {description ? (
                    <Text variant="body" color="textSecondary" {...textProps}>
                      {description}
                    </Text>
                  ) : null}
                  {mode === 'display' && isExpanded ? peopleBlock : null}
                </Box>
              )}
            </ExpandableSection>
          )}
        </Box>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <Box gap="m">
        <DotSeparatedInfoRow items={quickInfoItems} />

        {!!genres.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Box flexDirection="row" gap="s" paddingRight="l">
              {genres.map((g) => (
                <Tag key={g} label={g} variant="glass" />
              ))}
            </Box>
          </ScrollView>
        )}

        {(!!description || peopleBlock) && (
          <ExpandableSection collapsedLines={3} hasExtraContent={Boolean(peopleBlock)}>
            {({ mode, isExpanded, textProps }) => (
              <Box>
                {description ? (
                  <Text variant="body" color="textSecondary" {...textProps}>
                    {description}
                  </Text>
                ) : null}
                {mode === 'display' && isExpanded ? peopleBlock : null}
              </Box>
            )}
          </ExpandableSection>
        )}
      </Box>
    </FadeIn>
  );
};

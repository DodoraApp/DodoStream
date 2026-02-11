import { memo, PropsWithChildren, useCallback } from 'react';
import { useTheme } from '@shopify/restyle';
import { Ionicons } from '@expo/vector-icons';
import { Box, Text, Theme } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';
import { LoadingIndicator } from '@/components/basic/LoadingIndicator';
import { getMediaSectionHeight, getContinueWatchingSectionHeight } from '@/utils/layout';

export type SectionType = 'media' | 'continue-watching';

interface SectionPlaceholderBaseProps {
  /** Type of section to determine height */
  sectionType?: SectionType;
}

interface SectionLoadingPlaceholderProps extends SectionPlaceholderBaseProps {}

const SectionPlaceholder = memo(
  ({ sectionType = 'media', children }: PropsWithChildren<SectionPlaceholderBaseProps>) => {
    const theme = useTheme<Theme>();

    const height =
      sectionType === 'continue-watching'
        ? getContinueWatchingSectionHeight(theme)
        : getMediaSectionHeight(theme);

    return (
      <Box justifyContent="center" alignItems="center" height={height} marginHorizontal="m">
        {children}
      </Box>
    );
  }
);

/**
 * A focusable loading placeholder for catalog sections.
 * Uses a single animated view instead of multiple skeleton cards for better performance.
 * Maintains focus during loading to prevent focus from escaping to sidebar.
 */
export const SectionLoadingPlaceholder = memo((props: SectionLoadingPlaceholderProps) => {
  return (
    <SectionPlaceholder {...props}>
      <Box height={40}>
        <LoadingIndicator />
      </Box>
    </SectionPlaceholder>
  );
});

SectionLoadingPlaceholder.displayName = 'SectionLoadingPlaceholder';

interface SectionErrorPlaceholderProps extends SectionPlaceholderBaseProps {
  /** Called when retry button is pressed */
  onRetry: () => void;
  onFocused?: () => void;
  hasTVPreferredFocus?: boolean;
}

/**
 * A focusable error placeholder with retry button for failed catalog loads.
 * Maintains focus during error state to prevent focus from escaping.
 */
export const SectionErrorPlaceholder = memo(
  ({ onRetry, ...props }: SectionErrorPlaceholderProps) => {
    const theme = useTheme<Theme>();

    const handleRetry = useCallback(() => {
      onRetry();
    }, [onRetry]);

    return (
      <SectionPlaceholder>
        <Focusable variant="background" onPress={handleRetry} {...props}>
          <Box padding="m">
            <Ionicons
              name="refresh"
              size={theme.sizes.iconMedium}
              color={theme.colors.textPrimary}
            />
          </Box>
        </Focusable>
      </SectionPlaceholder>
    );
  }
);

SectionErrorPlaceholder.displayName = 'SectionErrorPlaceholder';

interface SectionEmptyPlaceholderProps extends SectionPlaceholderBaseProps {}

/**
 * A placeholder for sections with no content.
 * Non-focusable since there's nothing to interact with.
 */
export const SectionEmptyPlaceholder = memo((props: SectionEmptyPlaceholderProps) => {
  return (
    <SectionPlaceholder {...props}>
      <Text variant="body" color="textSecondary" padding="m">
        No content available
      </Text>
    </SectionPlaceholder>
  );
});

SectionEmptyPlaceholder.displayName = 'SectionEmptyPlaceholder';

import type { Theme } from '@/theme/theme';

// ============================================================================
// Text Height Utilities
// ============================================================================

/**
 * Get the approximate height for a text line based on theme text variant.
 * This includes the fontSize plus some line height adjustment (~4px for most fonts).
 */
export function getTextLineHeight(theme: Theme, variant: keyof Theme['textVariants']): number {
  const textVariant = theme.textVariants[variant];
  // Use lineHeight if defined, otherwise fontSize + buffer for descenders/spacing
  const lineHeight = 'lineHeight' in textVariant ? textVariant.lineHeight : undefined;
  return lineHeight ?? (textVariant.fontSize as number) + theme.spacing.s;
}

// ============================================================================
// Section Height Utilities
// ============================================================================

/**
 * Calculate the approximate height of a CatalogSectionHeader.
 *
 * Height breakdown:
 * - Top margin: theme.spacing.m
 * - Title text line: subheader fontSize + buffer
 * - Caption text line (for typed headers): caption fontSize + buffer
 * - Bottom margin: theme.spacing.m (or theme.spacing.s when caption is present)
 * - Horizontal padding from focusable wrapper: theme.spacing.m * 2
 *
 * Returns a height that covers the worst case (with caption).
 */
export function getSectionHeaderHeight(theme: Theme): number {
  const topMargin = theme.spacing.m;
  const titleHeight = getTextLineHeight(theme, 'subheader');
  const captionHeight = getTextLineHeight(theme, 'caption');
  const bottomMargin = theme.spacing.s;
  return topMargin + titleHeight + captionHeight + bottomMargin;
}

/**
 * Calculate the total height of a media section row.
 * This ensures placeholders match the exact height of loaded content.
 *
 * Height breakdown:
 * - Card image: theme.cardSizes.media.height (200)
 * - Gap between image and title: theme.spacing.s (8)
 * - Title text line: cardTitle fontSize + buffer
 * - Vertical padding: theme.spacing.s * 2 (matches paddingVertical on list contentContainerStyle)
 */
export function getMediaSectionHeight(theme: Theme): number {
  const cardHeight = theme.cardSizes.media.height;
  const gap = theme.spacing.s;
  const titleHeight = getTextLineHeight(theme, 'cardTitle');
  const verticalPadding = theme.spacing.s * 2;
  return cardHeight + gap + titleHeight + verticalPadding;
}

/**
 * Calculate the total height of a continue watching section row.
 *
 * Height breakdown:
 * - Card image: theme.cardSizes.continueWatching.height (140)
 * - Gap between image and title: theme.spacing.s (8)
 * - Title text line: cardTitle fontSize + buffer
 * - Subtitle text line: bodySmall fontSize + buffer
 * - Gap between title and subtitle: theme.spacing.xs (4)
 * - Vertical padding: theme.spacing.s * 2 (16)
 */
export function getContinueWatchingSectionHeight(theme: Theme): number {
  const cardHeight = theme.cardSizes.continueWatching.height;
  const gap = theme.spacing.s;
  const titleHeight = getTextLineHeight(theme, 'cardTitle');
  const subtitleHeight = getTextLineHeight(theme, 'bodySmall');
  const titleGap = theme.spacing.xs;
  const verticalPadding = theme.spacing.s * 2;
  return cardHeight + gap + titleHeight + titleGap + subtitleHeight + verticalPadding;
}

// ============================================================================
// Grid Column Utilities
// ============================================================================

/**
 * Calculate the number of columns for a media grid based on available width.
 * Accounts for horizontal padding and gaps between items.
 *
 * @param width - Available screen/container width
 * @param theme - Theme object for card sizes and spacing
 * @param minColumns - Minimum number of columns (default: 2)
 * @returns Number of columns that fit in the available width
 */
export function calculateMediaGridColumns(
  width: number,
  theme: Theme,
  minColumns: number = 2
): number {
  const cardWidth = theme.cardSizes.media.width;
  const horizontalPadding = theme.spacing.m * 2;
  const availableWidth = width - horizontalPadding;
  // Account for gap between items (spacing.s between columns)
  const columnWithGap = cardWidth + theme.spacing.s;
  const cols = Math.floor(availableWidth / columnWithGap);
  return Math.max(minColumns, cols);
}

// ============================================================================
// Home Screen Priority Loading Utilities
// ============================================================================

/**
 * Calculate how many catalog rows are visible (above the fold) given the
 * current screen height. Used to decide which catalog queries to fire first.
 *
 * @param screenHeight - Device screen height in pixels
 * @param theme - Restyle theme (needed for sizes/spacing)
 * @param heroEnabled - Whether the hero section is rendered (takes up heroHeight)
 * @param hasContinueWatching - Whether the continue watching row is visible
 * @param bufferRows - Extra rows to include beyond what strictly fits (default 1)
 * @returns Number of catalog rows that should be in the priority batch (≥ 2)
 */
export function getVisibleCatalogCount(
  screenHeight: number,
  theme: Theme,
  heroEnabled: boolean,
  hasContinueWatching: boolean,
  hasMyList: boolean,
  bufferRows: number = 1
): number {
  let remaining = screenHeight;

  if (heroEnabled) {
    remaining -= theme.sizes.heroHeight;
  }

  if (hasContinueWatching) {
    remaining -= getSectionHeaderHeight(theme) + getContinueWatchingSectionHeight(theme);
  }

  if (hasMyList) {
    // My List section height (approximate TagFilters height as 40px)
    remaining -= getSectionHeaderHeight(theme) + getMediaSectionHeight(theme) + 40;
  }

  const rowHeight = getSectionHeaderHeight(theme) + getMediaSectionHeight(theme);

  const visible = Math.max(2, Math.floor(remaining / rowHeight) + bufferRows);
  return visible;
}

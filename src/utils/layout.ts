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
 * Calculate the total height of a media section row.
 * This ensures placeholders match the exact height of loaded content.
 *
 * Height breakdown:
 * - Card image: theme.cardSizes.media.height (200)
 * - Gap between image and title: theme.spacing.s (8)
 * - Title text line: cardTitle fontSize + buffer
 */
export function getMediaSectionHeight(theme: Theme): number {
    const cardHeight = theme.cardSizes.media.height;
    const gap = theme.spacing.s;
    const titleHeight = getTextLineHeight(theme, 'cardTitle');
    return cardHeight + gap + titleHeight;
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

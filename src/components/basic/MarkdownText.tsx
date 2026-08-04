import React, { FC, useMemo } from 'react';
import Markdown from 'react-native-markdown-display';

import { useTheme } from '@shopify/restyle';

import { Theme } from '@/theme/theme';

interface MarkdownTextProps {
  /** Markdown content to render */
  content: string;
}

/**
 * Renders markdown content using theme values.
 * All styles are derived from the theme - no hardcoded values.
 */
export const MarkdownText: FC<MarkdownTextProps> = ({ content }) => {
  const theme = useTheme<Theme>();

  const markdownStyles = useMemo(
    () => ({
      body: {
        fontFamily: theme.fonts.poppinsRegular,
        fontSize: theme.textVariants.body.fontSize,
        color: theme.colors.textPrimary,
        lineHeight: theme.textVariants.body.lineHeight,
      },
      heading1: {
        fontFamily: theme.fonts.outfitBold,
        fontSize: theme.textVariants.header.fontSize,
        color: theme.colors.textPrimary,
        marginVertical: theme.spacing.m,
      },
      heading2: {
        fontFamily: theme.fonts.outfitSemiBold,
        fontSize: theme.textVariants.subheader.fontSize,
        color: theme.colors.textPrimary,
        marginVertical: theme.spacing.s,
      },
      heading3: {
        fontFamily: theme.textVariants.cardTitle.fontFamily,
        fontSize: theme.textVariants.cardTitle.fontSize,
        color: theme.colors.textPrimary,
        marginVertical: theme.spacing.s,
      },
      paragraph: {
        fontFamily: theme.fonts.poppinsRegular,
        fontSize: theme.textVariants.body.fontSize,
        color: theme.colors.textPrimary,
        lineHeight: theme.textVariants.body.lineHeight,
        marginVertical: theme.spacing.s,
      },
      list_item: {
        fontFamily: theme.fonts.poppinsRegular,
        fontSize: theme.textVariants.body.fontSize,
        color: theme.colors.textPrimary,
        lineHeight: theme.textVariants.body.lineHeight,
      },
      bullet_list: {
        marginVertical: theme.spacing.s,
      },
      ordered_list: {
        marginVertical: theme.spacing.s,
      },
      strong: {
        fontFamily: theme.fonts.poppinsSemiBold,
        color: theme.colors.textPrimary,
      },
      em: {
        fontStyle: 'italic' as const,
        color: theme.colors.textSecondary,
      },
      link: {
        color: theme.colors.textLink,
        textDecorationLine: 'underline' as const,
      },
      code_inline: {
        fontFamily: theme.fonts.poppinsRegular,
        backgroundColor: theme.colors.cardBackground,
        color: theme.colors.textPrimary,
        paddingHorizontal: theme.spacing.xs,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.spacing.xs,
      },
      code_block: {
        fontFamily: theme.fonts.poppinsRegular,
        backgroundColor: theme.colors.cardBackground,
        color: theme.colors.textPrimary,
        padding: theme.spacing.s,
        borderRadius: theme.spacing.s,
        marginVertical: theme.spacing.s,
      },
    }),
    [theme]
  );

  return <Markdown style={markdownStyles}>{content}</Markdown>;
};

MarkdownText.displayName = 'MarkdownText';

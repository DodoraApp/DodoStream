import { memo, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { NativeSyntheticEvent, TextLayoutEventData, ViewStyle } from 'react-native';
import { Box, Text, Theme } from '@/theme/theme';
import { Focusable } from '@/components/basic/Focusable';
import { getFocusableBackgroundColor, getFocusableForegroundColor } from '@/utils/focus-colors';

type TextVariant = Exclude<keyof Theme['textVariants'], 'defaults'>;

type ExpandableSectionMode = 'measure' | 'display';

export interface ExpandableSectionRenderParams {
  mode: ExpandableSectionMode;
  isExpanded: boolean;
  /** Apply these props to the Text that should be line-clamped/measured. */
  textProps: {
    numberOfLines?: number;
    onTextLayout?: (e: NativeSyntheticEvent<TextLayoutEventData>) => void;
  };
}

export interface ExpandableSectionProps {
  collapsedLines?: number;
  /** Set true when the section has additional expanded-only content beyond the measured Text. */
  hasExtraContent?: boolean;
  toggleLabelMore?: string;
  toggleLabelLess?: string;
  toggleTextVariant?: TextVariant;
  toggleTextColor?: keyof Theme['colors'];
  style?: ViewStyle;
  children: (params: ExpandableSectionRenderParams) => ReactNode;
}

export const ExpandableSection = memo(
  ({
    collapsedLines = 3,
    hasExtraContent = false,
    toggleLabelMore = 'Show more',
    toggleLabelLess = 'Show less',
    toggleTextVariant = 'bodySmall',
    toggleTextColor = 'textLink',
    style,
    children,
  }: ExpandableSectionProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [fullLineCount, setFullLineCount] = useState<number | null>(null);

    const handleMeasureLayout = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
      const next = e.nativeEvent.lines.length;
      setFullLineCount((prev) => (prev === null || next > prev ? next : prev));
    }, []);

    const canExpandByLines = useMemo(() => {
      if (fullLineCount === null) return false;
      return fullLineCount > collapsedLines;
    }, [collapsedLines, fullLineCount]);

    const showToggle = canExpandByLines || hasExtraContent;

    const handleToggle = useCallback(() => {
      setIsExpanded((prev) => !prev);
    }, []);

    return (
      <Box style={style}>
        {/* Hidden measurement render: render the text unclamped once to compute total lines. */}
        {fullLineCount === null ? (
          <Box style={{ position: 'absolute', opacity: 0, width: '100%' }} pointerEvents="none">
            {children({
              mode: 'measure',
              isExpanded: true,
              textProps: {
                onTextLayout: handleMeasureLayout,
                numberOfLines: undefined,
              },
            })}
          </Box>
        ) : null}

        {children({
          mode: 'display',
          isExpanded,
          textProps: {
            numberOfLines: canExpandByLines && !isExpanded ? collapsedLines : undefined,
          },
        })}

        {showToggle ? (
          <Focusable onPress={handleToggle} style={{ alignSelf: 'flex-start' }}>
            {({ isFocused }) => (
              <Text
                variant={toggleTextVariant}
                color={getFocusableForegroundColor({ isFocused, defaultColor: toggleTextColor })}>
                {isExpanded ? toggleLabelLess : toggleLabelMore}
              </Text>
            )}
          </Focusable>
        ) : null}
      </Box>
    );
  }
);

ExpandableSection.displayName = 'ExpandableSection';

// Backwards-compatible wrapper (keep existing import paths working).
export interface ExpandableTextProps {
  text: string;
  collapsedLines?: number;
  textVariant?: TextVariant;
  textColor?: keyof Theme['colors'];
  expandedContent?: ReactNode;
  toggleLabelMore?: string;
  toggleLabelLess?: string;
  toggleTextVariant?: TextVariant;
  toggleTextColor?: keyof Theme['colors'];
  style?: ViewStyle;
}

export const ExpandableText = memo(
  ({
    text,
    collapsedLines = 3,
    textVariant = 'body',
    textColor = 'textSecondary',
    expandedContent,
    toggleLabelMore,
    toggleLabelLess,
    toggleTextVariant,
    toggleTextColor,
    style,
  }: ExpandableTextProps) => {
    const hasExtraContent = expandedContent !== null && expandedContent !== undefined;
    const trimmed = text.trim();

    return (
      <ExpandableSection
        collapsedLines={collapsedLines}
        hasExtraContent={hasExtraContent}
        toggleLabelMore={toggleLabelMore}
        toggleLabelLess={toggleLabelLess}
        toggleTextVariant={toggleTextVariant}
        toggleTextColor={toggleTextColor}
        style={style}>
        {({ mode, isExpanded, textProps }) => (
          <Box>
            {trimmed.length ? (
              <Text variant={textVariant} color={textColor} {...textProps}>
                {text}
              </Text>
            ) : null}
            {mode === 'display' && isExpanded ? expandedContent : null}
          </Box>
        )}
      </ExpandableSection>
    );
  }
);

ExpandableText.displayName = 'ExpandableText';

import React from 'react';
import {
  createRestyleComponent,
  createVariant,
  VariantProps,
  SpacingProps,
  BorderProps,
  BackgroundColorProps,
  LayoutProps,
  spacing,
  border,
  backgroundColor,
  layout,
  useTheme,
} from '@shopify/restyle';
import { Theme, Text, Box } from '@/theme/theme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Focusable } from '@/components/basic/Focusable';
import { getFocusableBackgroundColor } from '@/utils/focus-colors';

export type IconComponentType = typeof Ionicons | typeof MaterialCommunityIcons;

type IconName<T extends IconComponentType> = T extends typeof Ionicons
  ? keyof typeof Ionicons.glyphMap
  : T extends typeof MaterialCommunityIcons
    ? keyof typeof MaterialCommunityIcons.glyphMap
    : never;

const ButtonContainer = createRestyleComponent<
  VariantProps<Theme, 'buttonVariants'> &
    SpacingProps<Theme> &
    BorderProps<Theme> &
    BackgroundColorProps<Theme> &
    LayoutProps<Theme> &
    React.ComponentProps<typeof Box>,
  Theme
>([createVariant({ themeKey: 'buttonVariants' }), spacing, border, backgroundColor, layout], Box);

export type ButtonProps<T extends IconComponentType> = React.ComponentProps<
  typeof ButtonContainer
> &
  Omit<React.ComponentProps<typeof Focusable>, 'children'> & {
    title?: string;
    disabled?: boolean;
    icon?: IconName<T>;
    iconComponent?: T;
  };

export const Button = <T extends IconComponentType = typeof Ionicons>({
  title,
  variant = 'primary',
  disabled = false,
  icon,
  iconComponent: IconComponent = Ionicons as T,
  style,
  ...rest
}: ButtonProps<T>) => {
  const theme = useTheme<Theme>();
  const textColor =
    variant === 'primary'
      ? 'primaryForeground'
      : variant === 'secondary'
        ? 'secondaryForeground'
        : 'tertiaryForeground';

  // Map button variants to whether they're considered "active" (primary style)
  const isPrimaryVariant = variant === 'primary';

  return (
    <Focusable disabled={disabled} hasTVPreferredFocus={false} {...rest}>
      {({ isFocused }) => (
        <ButtonContainer
          variant={variant}
          opacity={disabled ? 0.5 : 1}
          flexDirection="row"
          gap="s"
          borderRadius="full"
          style={
            isFocused && !disabled
              ? {
                  backgroundColor:
                    theme.colors[
                      getFocusableBackgroundColor({
                        isActive: isPrimaryVariant,
                        isFocused: true,
                      })
                    ],
                }
              : undefined
          }>
          {icon && (
            // @ts-expect-error: IconComponent type is generic and props are compatible for Ionicons/MaterialCommunityIcons
            <IconComponent
              name={icon as any}
              size={20}
              color={theme.colors[textColor as keyof Theme['colors']]}
            />
          )}
          {title && (
            <Text variant="button" color={textColor}>
              {title}
            </Text>
          )}
        </ButtonContainer>
      )}
    </Focusable>
  );
};

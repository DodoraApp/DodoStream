import { FC } from 'react';
import { Box, Theme } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';

interface ProfileAvatarProps {
  icon: string;
  color: string;
  size?: 'small' | 'medium' | 'large';
}

const getIconSize = (theme: Theme) => ({
  small: theme.sizes.iconMedium,
  medium: theme.sizes.iconXLarge,
  large: theme.sizes.iconXXLarge,
});

export const ProfileAvatar: FC<ProfileAvatarProps> = ({ icon, color, size = 'medium' }) => {
  const theme = useTheme<Theme>();
  const iconSize = getIconSize(theme)[size];
  const containerSize = iconSize * 2;

  return (
    <Box
      width={containerSize}
      height={containerSize}
      borderRadius="full"
      justifyContent="center"
      alignItems="center"
      style={{ backgroundColor: color }}>
      <Ionicons name={icon as any} size={iconSize} color={theme.colors.mainForeground} />
    </Box>
  );
};

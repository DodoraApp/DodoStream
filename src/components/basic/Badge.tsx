import { Box, Text } from '@/theme/theme';

interface BadgeProps {
  label: string | number;
  variant?: 'primary' | 'secondary' | 'tertiary';
}

export const Badge = ({ label, variant = 'primary' }: BadgeProps) => {
  const backgroundColor =
    variant === 'primary'
      ? 'primaryBackground'
      : variant === 'secondary'
        ? 'cardBackground'
        : 'tertiaryBackground';

  const foregroundColor =
    variant === 'primary'
      ? 'primaryForeground'
      : variant === 'secondary'
        ? 'textPrimary'
        : 'tertiaryForeground';

  return (
    <Box
      backgroundColor={backgroundColor}
      paddingHorizontal="s"
      paddingVertical="xs"
      borderRadius="s">
      <Text variant="caption" fontWeight="700" color={foregroundColor}>
        {label}
      </Text>
    </Box>
  );
};

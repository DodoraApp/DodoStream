import { TextInput, TextInputProps } from 'react-native';
import { useTheme } from '@shopify/restyle';
import { Theme, Box } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
  icon?: keyof typeof Ionicons.glyphMap;
}

export const Input = ({ icon, style, ...props }: InputProps) => {
  const theme = useTheme<Theme>();

  return (
    <Box
      flexDirection="row"
      alignItems="center"
      backgroundColor="inputBackground"
      borderRadius="m"
      paddingHorizontal="m"
      flex={1}
      height={theme.sizes.inputHeight}>
      {icon && (
        <Box marginRight="s">
          <Ionicons name={icon} size={theme.sizes.iconSmall} color={theme.colors.textSecondary} />
        </Box>
      )}
      <TextInput
        style={[
          {
            flex: 1,
            color: theme.colors.textPrimary,
            fontSize: theme.textVariants.body.fontSize,
            fontFamily: undefined, // Use system font or custom font if configured
          },
          style,
        ]}
        placeholderTextColor={theme.colors.textPlaceholder}
        {...props}
      />
    </Box>
  );
};

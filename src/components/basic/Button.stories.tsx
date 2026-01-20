import type { Meta, StoryObj } from '@storybook/react-native';
import { Button } from './Button';
import { Box } from '@/theme/theme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const ButtonMeta: Meta<typeof Button> = {
  title: 'Basic/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary'],
    },
    disabled: {
      control: 'boolean',
    },
  },
  args: {
    title: 'Button',
    variant: 'primary',
    disabled: false,
  },
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Box width={360} alignSelf="center">
          <Story />
        </Box>
      </Box>
    ),
  ],
};

export default ButtonMeta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    title: 'Primary Button',
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    title: 'Secondary Button',
    variant: 'secondary',
  },
};

export const Tertiary: Story = {
  args: {
    title: 'Tertiary Button',
    variant: 'tertiary',
  },
};

export const Disabled: Story = {
  args: {
    title: 'Disabled Button',
    variant: 'primary',
    disabled: true,
  },
};

export const WithIonicon: Story = {
  args: {
    title: 'With Icon',
    variant: 'primary',
    icon: 'play' as keyof typeof Ionicons.glyphMap,
    iconComponent: Ionicons,
  },
};

export const WithMaterialIcon: Story = {
  args: {
    title: 'Material Icon',
    variant: 'primary',
    icon: 'home' as keyof typeof MaterialCommunityIcons.glyphMap,
    iconComponent: MaterialCommunityIcons,
  },
};

export const IconOnly: Story = {
  args: {
    icon: 'search' as keyof typeof Ionicons.glyphMap,
    iconComponent: Ionicons,
    variant: 'primary',
  },
};

export const LongText: Story = {
  args: {
    title: 'This is a very long button text that might wrap',
    variant: 'primary',
  },
};

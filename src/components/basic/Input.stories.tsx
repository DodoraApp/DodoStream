import type { Meta, StoryObj } from '@storybook/react-native';
import { Input } from './Input';
import { Box } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';

const meta: Meta<typeof Input> = {
  title: 'Basic/Input',
  component: Input,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Box width={360} alignSelf="center">
          <Story />
        </Box>
      </Box>
    ),
  ],
  args: {
    placeholder: 'Type something...',
    icon: 'search' as keyof typeof Ionicons.glyphMap,
  },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const WithoutIcon: Story = {
  args: {
    icon: undefined,
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    editable: false,
  },
};

export const LongText: Story = {
  args: {
    defaultValue:
      'This is a very long input value that should wrap or scroll depending on the platform and style',
  },
};

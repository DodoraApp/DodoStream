import type { Meta, StoryObj } from '@storybook/react-native';
import { ProgressButton } from './ProgressButton';
import { Box } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';

const meta: Meta<typeof ProgressButton> = {
  title: 'Basic/ProgressButton',
  component: ProgressButton,
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
    title: 'Play',
    icon: 'play' as keyof typeof Ionicons.glyphMap,
    progress: 0.5,
  },
};

export default meta;

type Story = StoryObj<typeof ProgressButton>;

export const Default: Story = {};

export const Empty: Story = {
  args: { progress: 0 },
};

export const Completed: Story = {
  args: { progress: 1 },
};

export const Disabled: Story = {
  args: { progress: 0.3, disabled: true },
};

export const MinWidth: Story = {
  args: { progress: 0.5, minWidth: 220 },
};

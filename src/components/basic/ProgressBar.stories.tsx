import type { Meta, StoryObj } from '@storybook/react-native';
import { ProgressBar } from './ProgressBar';
import { Box } from '@/theme/theme';

const meta: Meta<typeof ProgressBar> = {
  title: 'Basic/ProgressBar',
  component: ProgressBar,
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
    progress: 0.4,
    height: 8,
  },
};

export default meta;

type Story = StoryObj<typeof ProgressBar>;

export const Default: Story = {};

export const Full: Story = {
  args: { progress: 1 },
};

export const Thin: Story = {
  args: { progress: 0.6, height: 4 },
};

import type { Meta, StoryObj } from '@storybook/react-native';
import { Skeleton } from './Skeleton';
import { Box } from '@/theme/theme';

const meta: Meta<typeof Skeleton> = {
  title: 'Basic/Skeleton',
  component: Skeleton,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {};

export const Avatar: Story = { args: { width: 64, height: 64, radius: 32 } };

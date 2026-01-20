import type { Meta, StoryObj } from '@storybook/react-native';
import { AppStartAnimation } from './AppStartAnimation';
import { Box } from '@/theme/theme';

const meta: Meta<typeof AppStartAnimation> = {
  title: 'Basic/AppStartAnimation',
  component: AppStartAnimation,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof AppStartAnimation>;

export const Default: Story = {};

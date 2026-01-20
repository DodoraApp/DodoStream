import type { Meta, StoryObj } from '@storybook/react-native';
import { Spacer } from './Spacer';
import { Box, Text } from '@/theme/theme';

const meta: Meta<typeof Spacer> = {
  title: 'Basic/Spacer',
  component: Spacer,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Story />
      </Box>
    ),
  ],
  args: {},
};

export default meta;

type Story = StoryObj<typeof Spacer>;

export const Default: Story = {
  render: () => (
    <Box>
      <Text>Above</Text>
      <Spacer size="m" />
      <Text>Below</Text>
    </Box>
  ),
};

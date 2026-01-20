import type { Meta, StoryObj } from '@storybook/react-native';
import { LoadingQuery } from './LoadingQuery';
import { Box, Text } from '@/theme/theme';

const meta: Meta<typeof LoadingQuery> = {
  title: 'Basic/LoadingQuery',
  component: LoadingQuery,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof LoadingQuery>;

export const Loading: Story = {
  args: { isLoading: true, isError: false, data: null },
};

export const Error: Story = {
  args: { isLoading: false, isError: true, error: new Error('Network failure') },
};

export const Empty: Story = {
  args: { isLoading: false, isError: false, data: null },
};

export const Success: Story = {
  render: () => (
    <LoadingQuery isLoading={false} isError={false} data={{ text: 'hello' }} isEmpty={() => false}>
      {(d: any) => <Text>Loaded: {d.text}</Text>}
    </LoadingQuery>
  ),
};

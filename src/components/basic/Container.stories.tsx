import type { Meta, StoryObj } from '@storybook/react-native';
import { Container } from './Container';
import { Box, Text } from '@/theme/theme';

const meta: Meta<typeof Container> = {
  title: 'Basic/Container',
  component: Container,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Container>;

export const Default: Story = {
  render: () => (
    <Container>
      <Box padding="m">
        <Text>Child content inside Container</Text>
      </Box>
    </Container>
  ),
};

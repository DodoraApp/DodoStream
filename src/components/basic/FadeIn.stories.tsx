import type { Meta, StoryObj } from '@storybook/react-native';
import FadeIn from './FadeIn';
import { Box, Text } from '@/theme/theme';

const meta: Meta<typeof FadeIn> = {
  title: 'Basic/FadeIn',
  component: FadeIn,
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

export default meta;

type Story = StoryObj<typeof FadeIn>;

export const Default: Story = {
  render: (args) => (
    <FadeIn {...args}>
      <Box padding="m" backgroundColor="cardBackground" borderRadius="s">
        <Text>Fading content</Text>
      </Box>
    </FadeIn>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-native';
import { AnimatedImage } from './AnimatedImage';
import { Box } from '@/theme/theme';

const meta: Meta<typeof AnimatedImage> = {
  title: 'Basic/AnimatedImage',
  component: AnimatedImage,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Box width={360} height={200} alignSelf="center">
          <Story />
        </Box>
      </Box>
    ),
  ],
  args: {
    source: { uri: 'https://placekitten.com/800/400' },
    durationMs: 300,
  },
};

export default meta;

type Story = StoryObj<typeof AnimatedImage>;

export const Default: Story = {};

export const Small: Story = { args: { durationMs: 200, style: { width: '100%', height: 120 } } };

export const Tall: Story = { args: { durationMs: 400, style: { width: '100%', height: 300 } } };

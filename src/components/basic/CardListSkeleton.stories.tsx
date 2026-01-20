import type { Meta, StoryObj } from '@storybook/react-native';
import { CardListSkeleton } from './CardListSkeleton';
import { Box } from '@/theme/theme';

const meta: Meta<typeof CardListSkeleton> = {
  title: 'Basic/CardListSkeleton',
  component: CardListSkeleton,
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

type Story = StoryObj<typeof CardListSkeleton>;

export const Default: Story = {};

import type { Meta, StoryObj } from '@storybook/react-native';
import { Badge } from './Badge';
import { Box } from '@/theme/theme';

const meta: Meta<typeof Badge> = {
  title: 'Basic/Badge',
  component: Badge,
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
    label: '1',
    variant: 'primary',
  },
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: 'secondary', label: 'New' } };

export const Tertiary: Story = { args: { variant: 'tertiary', label: 'i' } };

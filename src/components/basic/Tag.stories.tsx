import type { Meta, StoryObj } from '@storybook/react-native';
import { Tag } from './Tag';
import { Box } from '@/theme/theme';

const meta: Meta<typeof Tag> = {
  title: 'Basic/Tag',
  component: Tag,
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
    label: 'Action',
  },
};

export default meta;

type Story = StoryObj<typeof Tag>;

export const Default: Story = {};

export const Glass: Story = {
  args: { variant: 'glass' },
};

export const Selected: Story = {
  args: { selected: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

import type { Meta, StoryObj } from '@storybook/react-native';
import { TagFilters } from './TagFilters';
import { Box } from '@/theme/theme';

const sampleOptions = [
  { id: '1', label: 'All' },
  { id: '2', label: 'Popular' },
  { id: '3', label: 'New' },
  { id: '4', label: 'HD' },
];

const meta: Meta<typeof TagFilters> = {
  title: 'Basic/TagFilters',
  component: TagFilters,
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
    options: sampleOptions,
    selectedId: '2',
  },
};

export default meta;

type Story = StoryObj<typeof TagFilters>;

export const Default: Story = {
  argTypes: {
    onSelectId: { action: 'select' },
  },
};

export const LoadingOption: Story = {
  args: {
    options: [
      { id: '1', label: 'Popular' },
      { id: '2', label: 'Loading', isLoading: true },
      { id: '3', label: 'New' },
    ],
    selectedId: '1',
  },
  argTypes: { onSelectId: { action: 'select' } },
};

import type { Meta, StoryObj } from '@storybook/react-native';
import { SearchInput } from './SearchInput';
import { Box } from '@/theme/theme';

const meta: Meta<typeof SearchInput> = {
  title: 'Basic/SearchInput',
  component: SearchInput,
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
    placeholder: 'Search for movies or shows',
  },
};

export default meta;

type Story = StoryObj<typeof SearchInput>;

export const Default: Story = {};

export const LongPlaceholder: Story = {
  args: { placeholder: 'Search for movies, shows, actors, directors, and more...' },
};

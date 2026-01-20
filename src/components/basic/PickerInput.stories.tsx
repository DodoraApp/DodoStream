import type { Meta, StoryObj } from '@storybook/react-native';
import { PickerInput } from './PickerInput';
import { Box } from '@/theme/theme';

const meta: Meta<typeof PickerInput> = {
  title: 'Basic/PickerInput',
  component: PickerInput,
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
    selectedLabel: 'Select an item',
    items: [
      { label: 'Option A', value: 'A' },
      { label: 'Option B', value: 'B' },
      { label: 'Option C', value: 'C' },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof PickerInput>;

export const Default: Story = {};

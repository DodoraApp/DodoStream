import type { Meta, StoryObj } from '@storybook/react-native';
import { SliderInput } from './SliderInput';
import { Box } from '@/theme/theme';

const meta: Meta<typeof SliderInput> = {
  title: 'Basic/SliderInput',
  component: SliderInput,
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
    value: 30,
    minimumValue: 0,
    maximumValue: 100,
    step: 1,
    label: 'Volume',
    unit: '%',
  },
};

export default meta;

type Story = StoryObj<typeof SliderInput>;

export const Default: Story = {
  argTypes: {
    onValueChange: { action: 'valueChanged' },
  },
};

export const NoButtons: Story = {
  args: { showButtons: false },
  argTypes: {
    onValueChange: { action: 'valueChanged' },
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};

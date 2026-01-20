import type { Meta, StoryObj } from '@storybook/react-native';
import { ColorPicker } from './ColorPicker';
import { Box } from '@/theme/theme';

const meta: Meta<typeof ColorPicker> = {
  title: 'Basic/ColorPicker',
  component: ColorPicker,
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
    value: '#FF0000',
    label: 'Accent color',
  },
};

export default meta;

type Story = StoryObj<typeof ColorPicker>;

export const Default: Story = {
  argTypes: { onValueChange: { action: 'valueChanged' } },
};

export const Disabled: Story = {
  args: { disabled: true },
};

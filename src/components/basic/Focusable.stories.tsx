import type { Meta, StoryObj } from '@storybook/react-native';
import { Focusable } from './Focusable';
import { Box, Text } from '@/theme/theme';

const meta: Meta<typeof Focusable> = {
  title: 'Basic/Focusable',
  component: Focusable,
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

type Story = StoryObj<typeof Focusable>;

export const Default: Story = {
  render: () => (
    <Focusable onPress={() => {}}>
      {({ isFocused }) => (
        <Box
          padding="m"
          borderRadius="s"
          backgroundColor={isFocused ? 'focusBackground' : 'cardBackground'}>
          <Text>Focusable item</Text>
        </Box>
      )}
    </Focusable>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Focusable onPress={() => {}} disabled>
      {({ isFocused }) => (
        <Box padding="m" borderRadius="s" opacity={0.5} backgroundColor={'cardBackground'}>
          <Text>Disabled item</Text>
        </Box>
      )}
    </Focusable>
  ),
};

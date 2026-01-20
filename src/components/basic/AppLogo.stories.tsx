import type { Meta, StoryObj } from '@storybook/react-native';
import { AppLogo } from './AppLogo';
import { Box } from '@/theme/theme';

const meta: Meta<typeof AppLogo> = {
  title: 'Basic/AppLogo',
  component: AppLogo,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Box width={360} alignSelf="center">
          <Story />
        </Box>
      </Box>
    ),
  ],
  args: { size: 120 },
};

export default meta;

type Story = StoryObj<typeof AppLogo>;

export const Default: Story = {};

export const Small: Story = { args: { size: 48 } };

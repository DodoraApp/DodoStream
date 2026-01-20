import type { Meta, StoryObj } from '@storybook/react-native';
import { LoadingIndicator } from './LoadingIndicator';
import { Box } from '@/theme/theme';

const meta: Meta<typeof LoadingIndicator> = {
  title: 'Basic/LoadingIndicator',
  component: LoadingIndicator,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Story />
      </Box>
    ),
  ],
  args: { type: 'default', size: 'large', message: undefined },
};

export default meta;

type Story = StoryObj<typeof LoadingIndicator>;

export const Default: Story = {};

export const SimpleSmall: Story = { args: { type: 'simple', size: 'small' } };

export const WithMessage: Story = { args: { message: 'Loading content…' } };

export const SimpleLarge: Story = { args: { type: 'simple', size: 'large' } };

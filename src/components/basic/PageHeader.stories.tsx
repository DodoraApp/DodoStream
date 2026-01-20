import type { Meta, StoryObj } from '@storybook/react-native';
import { PageHeader } from './PageHeader';
import { Box } from '@/theme/theme';

const meta: Meta<typeof PageHeader> = {
  title: 'Basic/PageHeader',
  component: PageHeader,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Story />
      </Box>
    ),
  ],
  args: { title: 'Page Title' },
};

export default meta;

type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {};

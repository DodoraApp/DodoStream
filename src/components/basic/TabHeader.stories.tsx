import type { Meta, StoryObj } from '@storybook/react-native';
import { TabHeader } from './TabHeader';
import { Box } from '@/theme/theme';
import { NavigationContainer } from '@react-navigation/native';

const meta: Meta<typeof TabHeader> = {
  title: 'Basic/TabHeader',
  component: TabHeader,
  decorators: [
    (Story) => (
      <NavigationContainer>
        <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
          <Story />
        </Box>
      </NavigationContainer>
    ),
  ],
  args: { title: 'Home' },
};

export default meta;

type Story = StoryObj<typeof TabHeader>;

export const Default: Story = {};

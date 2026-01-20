import type { Meta, StoryObj } from '@storybook/react-native';
import { DismissableModal } from './DismissableModal';
import { Box } from '@/theme/theme';

const meta: Meta<typeof DismissableModal> = {
  title: 'Basic/DismissableModal',
  component: DismissableModal,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Story />
      </Box>
    ),
  ],
  args: {
    visible: true,
    heading: 'Delete item?',
    body: 'This action cannot be undone. Are you sure you want to delete?',
    primaryActionText: 'Delete',
    onPrimaryAction: () => {},
    onDismiss: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof DismissableModal>;

export const Default: Story = {};

export const WithMultipleActions: Story = {
  args: {
    secondaryActionText: 'Cancel',
    onSecondaryAction: () => {},
    tertiaryActionText: 'More',
    onTertiaryAction: () => {},
  },
};

import type { Meta, StoryObj } from '@storybook/react-native';
import ToastContainer, { showToast } from './Toast';
import { Box } from '@/theme/theme';
import { useEffect } from 'react';

const meta: Meta<typeof ToastContainer> = {
  title: 'Basic/Toast',
  component: ToastContainer,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="flex-start">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ToastContainer>;

export const Default: Story = {
  render: () => {
    useEffect(() => {
      showToast({
        title: 'Saved successfully',
        message: 'Your changes were saved.',
        preset: 'success',
      });
    }, []);

    return <ToastContainer />;
  },
};

export const ErrorToast: Story = {
  render: () => {
    useEffect(() => {
      showToast({ title: 'Failed', message: 'Unable to save changes.', preset: 'error' });
    }, []);

    return <ToastContainer />;
  },
};

export const WarningToast: Story = {
  render: () => {
    useEffect(() => {
      showToast({ title: 'Limited', message: 'Bandwidth is limited.', preset: 'warning' });
    }, []);

    return <ToastContainer />;
  },
};

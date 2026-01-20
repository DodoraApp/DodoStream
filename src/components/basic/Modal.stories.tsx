import type { Meta, StoryObj } from '@storybook/react-native';
import React, { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { Modal } from './Modal';
import { Box, Text } from '@/theme/theme';

const meta: Meta<typeof Modal> = {
  title: 'Basic/Modal',
  component: Modal,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Story />
      </Box>
    ),
  ],
  args: {
    visible: false,
    onClose: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof Modal>;

const ModalExample = (props: any) => {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)}>
        <Box padding="m" backgroundColor="primaryBackground" borderRadius="s">
          <Text color="primaryForeground">Open Modal</Text>
        </Box>
      </TouchableOpacity>

      <Modal {...props} visible={visible} onClose={() => setVisible(false)}>
        <Box backgroundColor="cardBackground" padding="m" borderRadius="m">
          <Text>This is modal content</Text>
        </Box>
      </Modal>
    </>
  );
};

const ModalNoBackdropExample = (props: any) => {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)}>
        <Box padding="m" backgroundColor="primaryBackground" borderRadius="s">
          <Text color="primaryForeground">Open Modal (no backdrop dismiss)</Text>
        </Box>
      </TouchableOpacity>

      <Modal
        {...props}
        visible={visible}
        onClose={() => setVisible(false)}
        closeOnBackdropPress={false}>
        <Box backgroundColor="cardBackground" padding="m" borderRadius="m">
          <Text>Clicking backdrop will not close this modal</Text>
        </Box>
      </Modal>
    </>
  );
};

export const Default: Story = {
  render: (args) => <ModalExample {...args} />,
};

export const NoBackdropDismiss: Story = {
  render: (args) => <ModalNoBackdropExample {...args} />,
};

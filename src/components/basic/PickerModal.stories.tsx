import type { Meta, StoryObj } from '@storybook/react-native';
import React, { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { PickerModal } from './PickerModal';
import { Box, Text } from '@/theme/theme';

const items = [
  { label: 'One', value: '1' },
  { label: 'Two', value: '2' },
  { label: 'Three', value: '3' },
];

const meta: Meta<typeof PickerModal> = {
  title: 'Basic/PickerModal',
  component: PickerModal,
  decorators: [
    (Story) => (
      <Box padding="m" backgroundColor="mainBackground" flex={1} justifyContent="center">
        <Story />
      </Box>
    ),
  ],
  args: {
    visible: false,
    items,
    onClose: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof PickerModal>;

const PickerModalExample = (props: any) => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)}>
        <Box padding="m" backgroundColor="primaryBackground" borderRadius="s">
          <Text color="primaryForeground">Open Picker</Text>
        </Box>
      </TouchableOpacity>

      <PickerModal
        {...props}
        visible={visible}
        onClose={() => setVisible(false)}
        onValueChange={(v) => {
          console.log('selected', v);
          setVisible(false);
        }}
      />
    </>
  );
};

const PickerModalSelectedExample = (props: any) => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)}>
        <Box padding="m" backgroundColor="primaryBackground" borderRadius="s">
          <Text color="primaryForeground">Open Picker (selected=2)</Text>
        </Box>
      </TouchableOpacity>

      <PickerModal
        {...props}
        visible={visible}
        selectedValue={'2'}
        onClose={() => setVisible(false)}
        onValueChange={(v) => {
          console.log('selected', v);
          setVisible(false);
        }}
      />
    </>
  );
};

export const Default: Story = {
  render: (args) => <PickerModalExample {...args} />,
};

export const SelectedValue: Story = {
  render: (args) => <PickerModalSelectedExample {...args} />,
};

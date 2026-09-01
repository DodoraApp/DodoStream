import { useState } from 'react';

import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme } from '@shopify/restyle';

import { Focusable } from '@/components/basic/Focusable';
import { PickerModal, PickerModalProps } from '@/components/basic/PickerModal';
import { Box, Text, Theme } from '@/theme/theme';

interface PickerInputProps<
  T extends string | number | undefined = string | number | undefined,
> extends Omit<PickerModalProps<T>, 'visible' | 'onClose'> {
  selectedLabel: string;
  testID?: string;
}

export function PickerInput<T extends string | number | undefined = string | number | undefined>({
  selectedLabel,
  testID,
  ...modalProps
}: PickerInputProps<T>) {
  const [showModal, setShowModal] = useState(false);
  const theme = useTheme<Theme>();

  return (
    <>
      <Focusable
        onPress={() => setShowModal(true)}
        variant="outline"
        testID={testID}
        focusedStyle={{
          outlineWidth: theme.focus.borderWidthSmall,
          borderRadius: theme.borderRadii.m,
        }}>
        <Box
          backgroundColor="cardBackground"
          borderRadius="m"
          paddingHorizontal="m"
          paddingVertical="s"
          flexDirection="row"
          alignItems="center"
          gap="s">
          <Text variant="body">{selectedLabel}</Text>
          <Ionicons
            name="chevron-down"
            size={theme.sizes.iconSmall}
            color={theme.colors.mainForeground}
          />
        </Box>
      </Focusable>
      <PickerModal visible={showModal} onClose={() => setShowModal(false)} {...modalProps} />
    </>
  );
}

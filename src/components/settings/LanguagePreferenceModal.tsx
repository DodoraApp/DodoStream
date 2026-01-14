import React, { useMemo, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Box, Text } from '@/theme/theme';
import { getLanguageDisplayName } from '@/utils/languages';
import { uniqNormalizedStrings } from '@/utils/array';
import { Button } from '@/components/basic/Button';
import { Modal } from '@/components/basic/Modal';
import { OrderableListSection, OrderableItem } from '@/components/settings/OrderableListSection';

interface LanguagePreferenceModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  selectedLanguageCodes: string[];
  availableLanguageCodes: string[];
  onChange: (next: string[]) => void;
}

export function LanguagePreferenceModal({
  visible,
  onClose,
  title,
  selectedLanguageCodes,
  availableLanguageCodes,
  onChange,
}: LanguagePreferenceModalProps) {
  const selected = uniqNormalizedStrings(selectedLanguageCodes);
  const availableCodes = uniqNormalizedStrings(availableLanguageCodes).filter(
    (code) => !selected.includes(code)
  );

  // Convert language codes to OrderableItem format
  const selectedItems = useMemo<OrderableItem[]>(
    () =>
      selected.map((code) => ({
        id: code,
        label: getLanguageDisplayName(code),
        secondaryLabel: code.toUpperCase(),
      })),
    [selected]
  );

  const availableItems = useMemo<OrderableItem[]>(
    () =>
      availableCodes.map((code) => ({
        id: code,
        label: getLanguageDisplayName(code),
        secondaryLabel: code.toUpperCase(),
      })),
    [availableCodes]
  );

  // Convert OrderableItem back to language codes
  const handleChange = useCallback(
    (items: OrderableItem[]) => {
      onChange(items.map((item) => item.id));
    },
    [onChange]
  );

  return (
    <Modal visible={visible} onClose={onClose} animationType="slide">
      <Box backgroundColor="cardBackground" borderRadius="l" padding="l" style={styles.card}>
        <Box flexDirection="row" alignItems="center" justifyContent="space-between">
          <Text variant="subheader">{title}</Text>
          <Button icon="close" onPress={onClose} />
        </Box>

        <ScrollView style={styles.scroll}>
          <OrderableListSection
            selectedItems={selectedItems}
            availableItems={availableItems}
            onChange={handleChange}
            selectedLabel="Selected (in order)"
            availableLabel="Add language"
            emptyPlaceholder="Device default"
          />
        </ScrollView>
      </Box>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 320,
    maxWidth: 520,
    maxHeight: 520,
  },
  scroll: {
    marginTop: 12,
  },
});

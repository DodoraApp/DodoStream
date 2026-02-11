import React, { useMemo, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Box, Text } from '@/theme/theme';
import { getLanguageEntry } from '@/utils/languages';
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

/**
 * Creates an OrderableItem from a language code.
 * Shows English name as label, with ISO code and native name as subtitle.
 */
const createLanguageItem = (code: string): OrderableItem => {
  const entry = getLanguageEntry(code);
  if (entry) {
    return {
      id: code,
      label: entry.englishName,
      secondaryLabel: `${code.toUpperCase()} · ${entry.name}`,
    };
  }
  // Fallback for unknown codes
  return {
    id: code,
    label: code.toUpperCase(),
    secondaryLabel: undefined,
  };
};

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
  // Selected items preserve their order
  const selectedItems = useMemo<OrderableItem[]>(
    () => selected.map(createLanguageItem),
    [selected]
  );

  // Available items sorted alphabetically by English name
  const availableItems = useMemo<OrderableItem[]>(
    () => availableCodes.map(createLanguageItem).sort((a, b) => a.label.localeCompare(b.label)),
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
    <Modal visible={visible} onClose={onClose} label={title}>
      <OrderableListSection
        selectedItems={selectedItems}
        availableItems={availableItems}
        onChange={handleChange}
        selectedLabel="Selected (in order)"
        availableLabel="Add language"
        emptyPlaceholder="Device default"
      />
    </Modal>
  );
}

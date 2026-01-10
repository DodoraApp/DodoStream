import React from 'react';
import { StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useTheme } from '@shopify/restyle';
import { Ionicons } from '@expo/vector-icons';
import { Box, Text, Theme } from '@/theme/theme';
import { getLanguageDisplayName } from '@/utils/languages';
import { moveItem, uniqNormalizedStrings } from '@/utils/array';
import { Focusable } from '@/components/basic/Focusable';
import { Button } from '@/components/basic/Button';
import { Modal } from '@/components/basic/Modal';

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
  const available = uniqNormalizedStrings(availableLanguageCodes).filter(
    (code) => !selected.includes(code)
  );

  return (
    <Modal visible={visible} onClose={onClose} animationType="slide">
      <Box backgroundColor="cardBackground" borderRadius="l" padding="l" style={styles.card}>
        <Box flexDirection="row" alignItems="center" justifyContent="space-between">
          <Text variant="subheader">{title}</Text>
          <Button icon="close" onPress={onClose} />
        </Box>

        <ScrollView style={styles.scroll}>
          <Box gap="m">
            <Box gap="s">
              <Text variant="caption" color="textSecondary">
                Selected (in order)
              </Text>

              {selected.length === 0 ? (
                <Text variant="body" color="textSecondary">
                  Device default
                </Text>
              ) : (
                <Box gap="s">
                  {selected.map((code, index) => (
                    <LanguageRow
                      key={`selected-${code}`}
                      code={code}
                      index={index}
                      total={selected.length}
                      onMoveUp={() => onChange(moveItem(selected, index, index - 1))}
                      onMoveDown={() => onChange(moveItem(selected, index, index + 1))}
                      onRemove={() => onChange(selected.filter((c) => c !== code))}
                    />
                  ))}
                </Box>
              )}
            </Box>

            <Box gap="s">
              <Text variant="caption" color="textSecondary">
                Add language
              </Text>

              <Box gap="s">
                {available.map((code) => (
                  <AddRow
                    key={`available-${code}`}
                    code={code}
                    onAdd={() => onChange([...selected, code])}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </ScrollView>
      </Box>
    </Modal>
  );
}

interface LanguageRowProps {
  code: string;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function LanguageRow({ code, index, total, onMoveUp, onMoveDown, onRemove }: LanguageRowProps) {
  const theme = useTheme<Theme>();
  const [isFocused, setIsFocused] = React.useState(false);

  const label = `${getLanguageDisplayName(code)} (${code})`;

  return (
    <Box
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="m"
      paddingVertical="s"
      borderRadius="m"
      backgroundColor="inputBackground"
      style={{
        borderWidth: theme.focus.borderWidthSmall,
        borderColor: isFocused ? theme.colors.primaryBackground : theme.colors.transparent,
      }}>
      <Box flex={1}>
        <Text variant="body" numberOfLines={1}>
          {label}
        </Text>
      </Box>

      <Box flexDirection="row" alignItems="center" gap="s">
        <Button
          icon="chevron-up"
          disabled={index === 0}
          onPress={onMoveUp}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <Button
          icon="chevron-down"
          disabled={index === total - 1}
          onPress={onMoveDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <Button
          icon="trash"
          onPress={onRemove}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </Box>
    </Box>
  );
}

interface AddRowProps {
  code: string;
  onAdd: () => void;
}

function AddRow({ code, onAdd }: AddRowProps) {
  const theme = useTheme<Theme>();

  const label = `${getLanguageDisplayName(code)} (${code})`;

  return (
    <Focusable
      onPress={onAdd}
      focusStyle={{
        borderWidth: theme.focus.borderWidthSmall,
        borderColor: theme.colors.primaryBackground,
        borderRadius: theme.borderRadii.m,
      }}>
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal="m"
        paddingVertical="s"
        borderRadius="m"
        backgroundColor="inputBackground"
        style={{
          borderWidth: theme.focus.borderWidthSmall,
          borderColor: theme.colors.transparent,
        }}>
        <Text variant="body" numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name="add" size={20} color={theme.colors.textSecondary} />
      </Box>
    </Focusable>
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

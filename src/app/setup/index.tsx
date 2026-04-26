import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Box } from '@/theme/theme';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { WizardStep } from '@/components/setup/WizardStep';
import { PickerInput } from '@/components/basic/PickerInput';
import { useUIStore } from '@/store/ui.store';
import { AVAILABLE_LANGUAGES } from '@/i18n';
import { getLanguageDisplayName } from '@/utils/languages';
import type { PickerItem } from '@/components/basic/PickerModal';

/**
 * Language selection step - first step of the setup wizard
 */
export default function LanguageStep() {
  const router = useRouter();
  const { t } = useTranslation(['setup', 'settings', 'common']);
  const language = useUIStore((state) => state.language);
  const setLanguage = useUIStore((state) => state.setLanguage);

  const handleNext = useCallback(() => {
    router.push('/setup/welcome');
  }, [router]);

  /** Picker items for language selection */
  const languagePickerItems: PickerItem<string | undefined>[] = useMemo(
    () => [
      { label: t('settings:ui.system_default'), value: undefined },
      ...AVAILABLE_LANGUAGES.map((lang) => ({
        label: getLanguageDisplayName(lang),
        value: lang,
      })),
    ],
    [t]
  );

  const currentLanguageLabel = useMemo(() => {
    if (!language) return t('settings:ui.system_default');
    return getLanguageDisplayName(language);
  }, [language, t]);

  const handleLanguageChange = useCallback(
    (value: string | undefined) => {
      setLanguage(value);
    },
    [setLanguage]
  );

  return (
    <WizardContainer>
      <WizardStep
        step="language"
        title={t('setup:language.title')}
        description={t('setup:language.description')}
        onNext={handleNext}
        nextLabel={t('common:next')}
        showBack={false}
        showSkip={false}
        hasTVPreferredFocus>
        <Box flex={1} justifyContent="center" alignItems="center">
          <Box width="100%" maxWidth={400}>
            <PickerInput
              label={t('setup:language.select_language')}
              icon="language"
              items={languagePickerItems}
              selectedLabel={currentLanguageLabel}
              selectedValue={language}
              onValueChange={handleLanguageChange}
            />
          </Box>
        </Box>
      </WizardStep>
    </WizardContainer>
  );
}

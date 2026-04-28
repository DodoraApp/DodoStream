import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shopify/restyle';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';

import { WizardContainer } from '@/components/setup/WizardContainer';
import { WizardStep } from '@/components/setup/WizardStep';
import { WIZARD_CONTENT_FADE_MS } from '@/constants/ui';
import { Box, Text, Theme } from '@/theme/theme';

/**
 * Welcome step - introduces the setup wizard
 */
export default function WelcomeStep() {
  const router = useRouter();
  const { t } = useTranslation('setup');

  const handleNext = useCallback(() => {
    router.push('/setup/ui');
  }, [router]);

  return (
    <WizardContainer>
      <WizardStep
        step="welcome"
        title={t('welcome.title')}
        description={t('welcome.description')}
        onNext={handleNext}
        nextLabel={t('welcome.get_started')}
        showBack={true}
        showSkip={false}
        hasTVPreferredFocus>
        <Box flex={1} justifyContent="center" alignItems="center" gap="xl">
          {/* Feature highlights */}
          <Box gap="m">
            <FeatureItem icon="person-add" title={t('welcome.feature_profile')} delay={300} />
            <FeatureItem icon="sync" title={t('welcome.feature_integrations')} delay={400} />
            <FeatureItem icon="extension-puzzle" title={t('welcome.feature_addons')} delay={500} />
            <FeatureItem icon="settings" title={t('welcome.feature_customize')} delay={600} />
          </Box>
        </Box>
      </WizardStep>
    </WizardContainer>
  );
}

interface FeatureItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  delay?: number;
}

function FeatureItem({ icon, title, delay = 0 }: FeatureItemProps) {
  const theme = useTheme<Theme>();

  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS, delay }}>
      <Box flexDirection="row" gap="m" alignItems="center">
        <Box
          width={theme.sizes.iconMedium * 2}
          height={theme.sizes.iconMedium * 2}
          borderRadius="m"
          backgroundColor="cardBackground"
          justifyContent="center"
          alignItems="center">
          <Ionicons
            name={icon}
            size={theme.sizes.iconMedium}
            color={theme.colors.primaryBackground}
          />
        </Box>
        <Box>
          <Text variant="cardTitle">{title}</Text>
        </Box>
      </Box>
    </MotiView>
  );
}

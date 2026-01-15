import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Box, Text, Theme } from '@/theme/theme';
import { useTheme } from '@shopify/restyle';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { WIZARD_CONTENT_FADE_MS } from '@/constants/ui';
import { WizardContainer } from '@/components/setup/WizardContainer';
import { WizardStep } from '@/components/setup/WizardStep';

/**
 * Welcome step - introduces the setup wizard
 */
export default function WelcomeStep() {
  const router = useRouter();

  const handleNext = useCallback(() => {
    router.push('/setup/profile');
  }, [router]);

  return (
    <WizardContainer>
      <WizardStep
        step="welcome"
        title="Welcome to DodoStream"
        description="Let's get you set up in just a few steps"
        onNext={handleNext}
        nextLabel="Get Started"
        showBack={false}
        showSkip={false}
        hasTVPreferredFocus>
        <Box flex={1} justifyContent="center" alignItems="center" gap="xl">
          {/* Feature highlights */}
          <Box gap="m">
            <FeatureItem icon="person-add" title="Create Your First Profile" delay={300} />
            <FeatureItem icon="extension-puzzle" title="Install Addons" delay={400} />
            <FeatureItem icon="settings" title="Customize Settings" delay={500} />
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
          width={48}
          height={48}
          borderRadius="m"
          backgroundColor="cardBackground"
          justifyContent="center"
          alignItems="center">
          <Ionicons name={icon} size={24} color={theme.colors.primaryBackground} />
        </Box>
        <Box>
          <Text variant="cardTitle">{title}</Text>
        </Box>
      </Box>
    </MotiView>
  );
}

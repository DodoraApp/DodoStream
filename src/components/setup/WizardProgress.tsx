import { FC, memo } from 'react';
import { Box, Text } from '@/theme/theme';
import { SetupWizardStep, WIZARD_STEPS } from '@/store/setup-wizard.store';

interface WizardProgressProps {
  currentStep: SetupWizardStep;
}

/**
 * Progress indicator showing current step in the wizard
 */
export const WizardProgress: FC<WizardProgressProps> = memo(({ currentStep }) => {
  const currentIndex = WIZARD_STEPS.indexOf(currentStep);
  const totalSteps = WIZARD_STEPS.length;

  const displayIndex = currentIndex + 1;
  return (
    <Box flexDirection="row" alignItems="center" gap="s">
      <Box flexDirection="row" gap="xs">
        {Array.from({ length: totalSteps }, (_, i) => (
          <Box
            key={i}
            width={8}
            height={8}
            borderRadius="full"
            backgroundColor={i <= currentIndex - 1 ? 'primaryBackground' : 'cardBorder'}
          />
        ))}
      </Box>
      <Text variant="caption" color="textSecondary">
        Step {displayIndex} of {totalSteps}
      </Text>
    </Box>
  );
});

WizardProgress.displayName = 'WizardProgress';

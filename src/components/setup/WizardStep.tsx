import { FC, memo, ReactNode } from 'react';
import { Box, Text } from '@/theme/theme';
import { MotiView } from 'moti';
import { WIZARD_CONTENT_FADE_MS } from '@/constants/ui';
import { SetupWizardStep } from '@/store/setup-wizard.store';
import { WizardProgress } from './WizardProgress';
import { WizardNavigation } from './WizardNavigation';

export interface WizardStepProps {
  /** Current step identifier */
  step: SetupWizardStep;
  /** Step title displayed at the top */
  title: string;
  /** Optional description below title */
  description?: string;
  /** Main content of the step */
  children: ReactNode;
  /** Called when user clicks Next/Continue */
  onNext?: () => void;
  /** Called when user clicks Back */
  onBack?: () => void;
  /** Called when user clicks Skip */
  onSkip?: () => void;
  /** Label for the next button */
  nextLabel?: string;
  /** Whether next button is disabled */
  nextDisabled?: boolean;
  /** Whether to show next button (default: true) */
  showNext?: boolean;
  /** Whether to show back button */
  showBack?: boolean;
  /** Override default skip behavior */
  showSkip?: boolean;
  /** Whether next button should have TV preferred focus */
  hasTVPreferredFocus?: boolean;
}

export const WizardStep: FC<WizardStepProps> = memo(
  ({
    step,
    title,
    description,
    children,
    onNext,
    onBack,
    onSkip,
    nextLabel,
    nextDisabled,
    showNext = true,
    showBack = true,
    showSkip,
    hasTVPreferredFocus = false,
  }) => {
    return (
      <Box flex={1} gap="s" paddingHorizontal="l">
        {/* Header with progress */}
        <WizardProgress currentStep={step} />

        {/* Title and description */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS }}>
          <Box gap="s">
            <Text variant="header">{title}</Text>
            {description && (
              <Text variant="body" color="textSecondary">
                {description}
              </Text>
            )}
          </Box>
        </MotiView>

        {/* Main content */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: WIZARD_CONTENT_FADE_MS, delay: 100 }}
          style={{ flex: 1 }}>
          <Box flex={1}>{children}</Box>
        </MotiView>

        {/* Navigation buttons */}
        <WizardNavigation
          currentStep={step}
          onNext={onNext}
          onBack={onBack}
          onSkip={onSkip}
          nextLabel={nextLabel}
          nextDisabled={nextDisabled}
          showNext={showNext}
          showBack={showBack}
          showSkip={showSkip}
          hasTVPreferredFocus={hasTVPreferredFocus}
        />
      </Box>
    );
  }
);

WizardStep.displayName = 'WizardStep';

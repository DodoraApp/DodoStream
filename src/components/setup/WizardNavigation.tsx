import { FC, memo } from 'react';
import { Box } from '@/theme/theme';
import { Button } from '@/components/basic/Button';
import { useSetupWizardStore, SetupWizardStep } from '@/store/setup-wizard.store';
import { useResponsiveLayout } from '@/hooks/useBreakpoint';

interface WizardNavigationProps {
  currentStep: SetupWizardStep;
  onNext?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showNext?: boolean;
  showBack?: boolean;
  showSkip?: boolean;
  hasTVPreferredFocus?: boolean;
}

/**
 * Navigation buttons for wizard steps (Back, Skip, Next)
 */
export const WizardNavigation: FC<WizardNavigationProps> = memo(
  ({
    currentStep,
    onNext,
    onBack,
    onSkip,
    nextLabel = 'Continue',
    nextDisabled = false,
    showNext = true,
    showBack = true,
    showSkip,
    hasTVPreferredFocus = false,
  }) => {
    const isStepSkippable = useSetupWizardStore((state) => state.isStepSkippable);
    const { isTV } = useResponsiveLayout();

    // Hide navigation if no buttons to show
    if (!showBack && !showNext && !onSkip) {
      return null;
    }

    return (
      <Box
        flexDirection="row"
        justifyContent={showBack ? 'space-between' : 'flex-end'}
        alignItems="center"
        gap="m"
        paddingVertical="m">
        {showBack && <Button variant="tertiary" icon="arrow-back" title="Back" onPress={onBack} />}

        <Box flexDirection="row" gap="m" alignItems="center">
          {isStepSkippable(currentStep) && onSkip && (
            <Button variant="secondary" title="Skip" onPress={onSkip} />
          )}
          {showNext && onNext && (
            <Button
              variant="primary"
              title={nextLabel}
              onPress={onNext}
              disabled={nextDisabled}
              hasTVPreferredFocus={hasTVPreferredFocus && isTV}
              icon="arrow-forward"
            />
          )}
        </Box>
      </Box>
    );
  }
);

WizardNavigation.displayName = 'WizardNavigation';

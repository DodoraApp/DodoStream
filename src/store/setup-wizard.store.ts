import { create } from 'zustand';

export type SetupWizardStep = 'welcome' | 'profile' | 'addons' | 'home' | 'playback' | 'complete';

export const WIZARD_STEPS: SetupWizardStep[] = [
    'welcome',
    'profile',
    'addons',
    'home',
    'playback',
    'complete',
];

interface SetupWizardState {
    /** The profile ID created during setup (used for applying settings) */
    createdProfileId?: string;

    // Actions
    setCreatedProfileId: (profileId: string) => void;
    getStepIndex: (step: SetupWizardStep) => number;
    getTotalSteps: () => number;
    isStepSkippable: (step: SetupWizardStep) => boolean;
}

export const useSetupWizardStore = create<SetupWizardState>()((set, get) => ({
    createdProfileId: undefined,

    setCreatedProfileId: (profileId: string) => {
        set({ createdProfileId: profileId });
    },

    getStepIndex: (step: SetupWizardStep) => {
        return WIZARD_STEPS.indexOf(step);
    },

    getTotalSteps: () => {
        return WIZARD_STEPS.length;
    },

    isStepSkippable: (step: SetupWizardStep) => {
        // Profile step is mandatory, all others can be skipped
        return step !== 'profile' && step !== 'welcome' && step !== 'complete';
    },
}));

import { create } from 'zustand';

export const WIZARD_STEPS: string[] = [
    'welcome',
    'ui',
    'profile',
    'addons',
    'home',
    'playback',
    'complete',
];
export type SetupWizardStep = typeof WIZARD_STEPS[number];


interface SetupWizardState {
    /** The profile ID created during setup (used for applying settings) */
    createdProfileId?: string;

    // Actions
    setCreatedProfileId: (profileId: string) => void;
    isStepSkippable: (step: SetupWizardStep) => boolean;
}

export const useSetupWizardStore = create<SetupWizardState>()((set, get) => ({
    createdProfileId: undefined,

    setCreatedProfileId: (profileId: string) => {
        set({ createdProfileId: profileId });
    },

    isStepSkippable: (step: SetupWizardStep) => {
        // Profile step is mandatory, all others can be skipped
        return step !== 'profile' && step !== 'welcome' && step !== 'complete';
    },
}));

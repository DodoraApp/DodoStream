import { create } from 'zustand';

/**
 * Store for tracking the active sidebar item's native node handle.
 * This enables content screens to set nextFocusLeft to the active sidebar item,
 * ensuring proper TV focus navigation back to the sidebar.
 */
interface SidebarFocusState {
    /** Native node handle of the currently active sidebar item */
    activeSidebarNodeHandle: number | null;
    /** Set the active sidebar item's native node handle */
    setActiveSidebarNodeHandle: (handle: number | null) => void;
    /** Native node handle of the currently selected settings menu item */
    selectedSettingsMenuNodeHandle: number | null;
    /** Set the selected settings menu item's native node handle */
    setSelectedSettingsMenuNodeHandle: (handle: number | null) => void;
}

export const useSidebarFocusStore = create<SidebarFocusState>((set) => ({
    activeSidebarNodeHandle: null,
    setActiveSidebarNodeHandle: (handle) => {
        set({ activeSidebarNodeHandle: handle })
    },
    selectedSettingsMenuNodeHandle: null,
    setSelectedSettingsMenuNodeHandle: (handle) => set({ selectedSettingsMenuNodeHandle: handle }),
}));

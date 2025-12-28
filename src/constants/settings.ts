import type { SettingsMenuItem } from '@/components/settings/SettingsMenu';

/** Settings menu items for navigation */
export const SETTINGS_MENU_ITEMS: SettingsMenuItem[] = [
    {
        id: 'playback',
        title: 'Profile Settings',
        description: 'Playback settings for the active profile',
        icon: 'play-circle-outline',
        href: '/settings/playback',
    },
    {
        id: 'profiles',
        title: 'Profiles',
        description: 'Manage profiles and switch users',
        icon: 'people-outline',
        href: '/settings/profiles',
    },
    {
        id: 'addons',
        title: 'Addons',
        description: 'Install and manage addons',
        icon: 'extension-puzzle-outline',
        href: '/settings/addons',
    },
    {
        id: 'integrations',
        title: 'Integrations',
        description: 'External watch history & scrobbling',
        icon: 'sync-outline',
        href: '/settings/integrations',
    },
];

/** Map settings page ID to route path */
export const SETTINGS_ROUTES: Record<string, string> = {
    playback: '/settings/playback',
    profiles: '/settings/profiles',
    addons: '/settings/addons',
    integrations: '/settings/integrations',
};

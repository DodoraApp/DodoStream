import type { SettingsMenuItem } from '@/components/settings/SettingsMenu';

export const SETTINGS_PROFILE_MENU_ITEMS: SettingsMenuItem[] = [
    {
        id: 'profiles',
        title: 'Profiles',
        description: 'Manage profiles and switch users',
        icon: 'people-outline',
        href: '/settings/profiles',
    },
    {
        id: 'home',
        title: 'Home',
        description: 'Customize the home screen hero section',
        icon: 'home-outline',
        href: '/settings/home',
    },
    {
        id: 'playback',
        title: 'Playback',
        description: 'Playback and language preferences for the active profile',
        icon: 'play-circle-outline',
        href: '/settings/playback',
    },
    {
        id: 'subtitles',
        title: 'Subtitles',
        description: 'Subtitle style and preview',
        icon: 'text-outline',
        href: '/settings/subtitles',
    },
];

export const SETTINGS_GLOBAL_MENU_ITEMS: SettingsMenuItem[] = [
    {
        id: 'addons',
        title: 'Addons',
        description: 'Install and manage addons',
        icon: 'extension-puzzle-outline',
        href: '/settings/addons',
    },
    {
        id: 'about',
        title: 'About',
        description: 'App info, version, and useful links',
        icon: 'information-circle-outline',
        href: '/settings/about',
    },
];

/** Flat list used in places that don’t render sections */
export const SETTINGS_MENU_ITEMS: SettingsMenuItem[] = [
    ...SETTINGS_PROFILE_MENU_ITEMS,
    ...SETTINGS_GLOBAL_MENU_ITEMS,
];

/** Map settings page ID to route path */
export const SETTINGS_ROUTES: Record<string, string> = {
    home: '/settings/home',
    playback: '/settings/playback',
    profiles: '/settings/profiles',
    subtitles: '/settings/subtitles',
    addons: '/settings/addons',
    about: '/settings/about',
};

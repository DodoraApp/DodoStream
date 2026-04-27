import type { SettingsMenuItem } from '@/components/settings/SettingsMenu';
import { TFunction } from 'i18next';

export const SETTINGS_PROFILE_MENU_ITEMS: (t: TFunction) => SettingsMenuItem[] = (t) => [
  {
    id: 'profiles',
    title: t('settings:menu.profiles.title'),
    description: t('settings:menu.profiles.desc'),
    icon: 'people-outline',
    href: '/settings/profiles',
  },
  {
    id: 'addons',
    title: t('settings:menu.addons.title'),
    description: t('settings:menu.addons.desc'),
    icon: 'extension-puzzle-outline',
    href: '/settings/addons',
  },
  {
    id: 'integrations',
    title: t('settings:menu.integrations.title'),
    description: t('settings:menu.integrations.desc'),
    icon: 'sync-outline',
    href: '/settings/integrations',
  },
  {
    id: 'home',
    title: t('settings:menu.home.title'),
    description: t('settings:menu.home.desc'),
    icon: 'home-outline',
    href: '/settings/home',
  },
  {
    id: 'playback',
    title: t('settings:menu.playback.title'),
    description: t('settings:menu.playback.desc'),
    icon: 'play-circle-outline',
    href: '/settings/playback',
  },
  {
    id: 'subtitles',
    title: t('settings:menu.subtitles.title'),
    description: t('settings:menu.subtitles.desc'),
    icon: 'text-outline',
    href: '/settings/subtitles',
  },
];

export const SETTINGS_GLOBAL_MENU_ITEMS: (t: TFunction) => SettingsMenuItem[] = (t) => [
  {
    id: 'ui',
    title: t('settings:menu.ui.title'),
    description: t('settings:menu.ui.desc'),
    icon: 'color-palette-outline',
    href: '/settings/ui',
  },
  {
    id: 'data',
    title: t('settings:menu.data.title'),
    description: t('settings:menu.data.desc'),
    icon: 'server-outline',
    href: '/settings/data',
  },
  {
    id: 'about',
    title: t('settings:menu.about.title'),
    description: t('settings:menu.about.desc'),
    icon: 'information-circle-outline',
    href: '/settings/about',
  },
];

/** Map settings page ID to route path */
export const SETTINGS_ROUTES: Record<string, string> = {
  home: '/settings/home',
  playback: '/settings/playback',
  profiles: '/settings/profiles',
  subtitles: '/settings/subtitles',
  ui: '/settings/ui',
  data: '/settings/data',
  addons: '/settings/addons',
  about: '/settings/about',
  integrations: '/settings/integrations',
};

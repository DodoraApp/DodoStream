import { Ionicons } from '@expo/vector-icons';

export interface NavItem {
    id: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    route: string;
    screenName: string; // For tab navigator
    location: 'top' | 'bottom';
}

export const NAV_ITEMS: NavItem[] = [
    {
        id: 'home',
        label: 'Home',
        icon: 'home',
        route: '/',
        screenName: 'index',
        location: 'top',
    },
    {
        id: 'search',
        label: 'Search',
        icon: 'search',
        route: '/search',
        screenName: 'search',
        location: 'top',
    },
    // {
    //     id: 'discover',
    //     label: 'Discover',
    //     icon: 'compass-outline',
    //     route: '/discover',
    //     screenName: 'discover',
    // },
    {
        id: 'library',
        label: 'Library',
        icon: 'library-outline',
        route: '/library',
        screenName: 'library',
        location: 'top',
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: 'settings-outline',
        route: '/settings',
        screenName: 'settings',
        location: 'bottom',
    },
];

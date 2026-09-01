import type { IoniconsIconName } from '@react-native-vector-icons/ionicons/static';

export interface NavItem {
  id: string;
  icon: IoniconsIconName;
  route: string;
  screenName: string; // For tab navigator
  location: 'top' | 'bottom';
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    icon: 'home',
    route: '/',
    screenName: 'index',
    location: 'top',
  },
  {
    id: 'search',
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
    icon: 'library-outline',
    route: '/library',
    screenName: 'library',
    location: 'top',
  },
  {
    id: 'settings',
    icon: 'settings-outline',
    route: '/settings',
    screenName: 'settings',
    location: 'bottom',
  },
];

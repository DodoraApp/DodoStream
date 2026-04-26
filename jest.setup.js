/* eslint-env jest */
/* global jest */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@d11/react-native-fast-image', () => {
  const React = require('react');
  const { View } = require('react-native');

  const FastImage = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref, testID: props.testID }, props.children)
  );
  FastImage.displayName = 'FastImage';
  FastImage.resizeMode = {
    contain: 'contain',
    cover: 'cover',
    stretch: 'stretch',
    center: 'center',
  };
  FastImage.priority = {
    low: 'low',
    normal: 'normal',
    high: 'high',
  };
  FastImage.cacheControl = {
    immutable: 'immutable',
    web: 'web',
    cacheOnly: 'cacheOnly',
  };
  FastImage.preload = jest.fn();
  FastImage.clearMemoryCache = jest.fn(() => Promise.resolve());
  FastImage.clearDiskCache = jest.fn(() => Promise.resolve());
  return {
    __esModule: true,
    default: FastImage,
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  const createIcon = (name) => (props) => React.createElement(Text, props, name);

  return {
    Ionicons: createIcon('Ionicons'),
    MaterialCommunityIcons: createIcon('MaterialCommunityIcons'),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: {
      changeLanguage: () => Promise.resolve(),
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}));

// Avoid native module errors for haptics in tests
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
  },
  NotificationFeedbackType: {
    Success: 'Success',
    Warning: 'Warning',
    Error: 'Error',
  },
}));

// LegendList is a virtualized list that doesn't render items in JSDOM.
// Mock it with a simple ScrollView + map so items are present in the tree.
jest.mock('@legendapp/list/react-native', () => {
  const React = require('react');
  const { ScrollView, View } = require('react-native');

  const LegendList = React.forwardRef(({ data, renderItem, keyExtractor, ...rest }, ref) =>
    React.createElement(
      ScrollView,
      { ...rest, ref },
      (data || []).map((item, index) =>
        React.createElement(
          View,
          { key: keyExtractor ? keyExtractor(item, index) : String(index) },
          renderItem({ item, index })
        )
      )
    )
  );
  LegendList.displayName = 'LegendList';

  return { LegendList };
});

// Moti ships ESM builds; mock to avoid Jest ESM transform issues.
jest.mock('moti', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MotiView = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref }, props.children)
  );

  return {
    MotiView,
    AnimatePresence: ({ children }) => children,
  };
});

// React Query schedules updates via notifyManager; wrap them in act() to avoid warnings.
try {
  const { act } = require('@testing-library/react-native');
  const { notifyManager } = require('@tanstack/query-core');
  notifyManager.setNotifyFunction((fn) => {
    act(() => {
      fn();
    });
  });
  notifyManager.setBatchNotifyFunction((callback) => {
    act(() => {
      callback();
    });
  });
} catch {
  // Optional in environments that don't include react-query.
}

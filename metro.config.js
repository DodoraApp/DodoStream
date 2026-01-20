const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const path = require("path");
const { withStorybook } = require('@storybook/react-native/metro/withStorybook');
const { withFacetpack } = require('@ecrindigital/facetpack');

/** @type {import('expo/metro-config').MetroConfig} */

const config = getSentryExpoConfig(__dirname);

module.exports = withFacetpack(withStorybook(config, {
  enabled: process.env.STORYBOOK_ENABLED === 'true',
  configPath: path.resolve(__dirname, "./.storybook"),
}));

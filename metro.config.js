const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

/** @type {import('expo/metro-config').MetroConfig} */

const config = getSentryExpoConfig(__dirname);

module.exports = config;
module.exports = function (api) {
  api.cache(true);
  let plugins = [];

  plugins.push('react-native-worklets/plugin');

  // Strip debug calls in production builds
  // For Expo: use caller.dev to detect production mode (when --dev false is used)
  const stripDebugLogs = process.env.STRIP_DEBUG_LOGS !== 'false';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && stripDebugLogs) {
    console.log("Babel: Stripping debug calls from production build");
    plugins.push('./plugins/babel-plugin-strip-debug-calls.js');
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};

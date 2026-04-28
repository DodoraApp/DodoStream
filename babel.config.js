module.exports = function (api) {
  api.cache(true);
  const plugins = [];

  plugins.push('react-native-worklets/plugin');

  if (process.env.NODE_ENV === 'production') {
    plugins.push('transform-remove-console');
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};

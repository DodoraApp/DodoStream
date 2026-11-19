export default {
  locales: ['en', 'de', 'pt', 'es'],
  extract: {
    input: 'src/**/*.{js,jsx,ts,tsx}',
    output: 'src/i18n/{{language}}/{{namespace}}.json',
  },
};

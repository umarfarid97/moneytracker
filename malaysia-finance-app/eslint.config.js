const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  { ignores: ['dist/*', 'node_modules/*'] },
  { files: ['scripts/**', '*.js'], languageOptions: { sourceType: 'commonjs', globals: { __dirname: 'readonly', require: 'readonly', module: 'readonly', process: 'readonly' } } },
  {
    // expo-notifications exports some enums in a way the import plugin cannot see.
    rules: { 'import/namespace': 'off' },
  },
  {
    files: ['__tests__/**', 'test-support/**'],
    languageOptions: { globals: { jest: 'readonly', describe: 'readonly', test: 'readonly', it: 'readonly', expect: 'readonly', beforeEach: 'readonly', afterEach: 'readonly', beforeAll: 'readonly', afterAll: 'readonly' } },
  },
];

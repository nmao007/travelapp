// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  // These rules check code for the React Compiler, which this app doesn't turn
  // on (no experiments.reactCompiler in app.json). They flag patterns that work
  // as written: resetting a sheet's state when it opens, Reanimated shared
  // values (`card.value = …`), and refs read for drag and timer bookkeeping.
  // Turn them back on together with the compiler.
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
]);

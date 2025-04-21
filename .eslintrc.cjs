module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended', // Use vue3-recommended for stricter rules
    'prettier', // Add prettier last to override other formatting rules
  ],
  parser: 'vue-eslint-parser', // Use vue-eslint-parser to parse <template>
  parserOptions: {
    parser: '@typescript-eslint/parser', // Use TypeScript parser for <script>
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
    'vue',
  ],
  rules: {
    // Add custom rules or override defaults here if needed
    // Example: enforce single quotes
    // 'quotes': ['error', 'single'],
    // Example: allow console.log during development but warn in production
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    // Recommended: disable prop-types rule as we use TypeScript
    'vue/prop-name-casing': 'off', // Allow both camelCase and kebab-case for props
    'vue/require-default-prop': 'off', // Not always necessary with TS
    'vue/multi-word-component-names': 'off', // Allow single-word component names if preferred (e.g., App.vue)
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // Warn about unused vars, allow underscore prefix
    '@typescript-eslint/no-explicit-any': 'warn', // Warn against using 'any' type
  },
  ignorePatterns: ['dist', 'node_modules', '*.cjs', '*.js'], // Ignore build outputs, dependencies, and config files
}; 
module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
  },
  extends: [
    'eslint:recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', 'build'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  globals: {
    React: 'writable',
  },
  rules: {
    'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]|_' }],
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
  },
}

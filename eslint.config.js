import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.recommended, prettier],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'grammars/**'],
  },
);

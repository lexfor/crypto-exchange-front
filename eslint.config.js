import eslintJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default tseslint.config(
	{
		ignores: ['node_modules'],
	},
	eslintJs.configs.recommended,
	{
		files: ['src/**/*.{ts,tsx}'],
		extends: [...tseslint.configs.recommendedTypeChecked],
		languageOptions: {
			parserOptions: {
				project: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: {
			react: reactPlugin,
			'react-hooks': reactHooksPlugin,
		},
		rules: {
			...reactPlugin.configs.recommended.rules,
			...reactHooksPlugin.configs.recommended.rules,

			'object-curly-spacing': ['error', 'always'],
			'@/quotes': ['error', 'single'],
			'react/prop-types': 'off',
			'react/react-in-jsx-scope': 'off',
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/await-thenable': 'error',

			'@/indent': ['error', 'tab', {}],
		},
		settings: {
			react: {
				version: 'detect',
			},
		},
	},

	{
		files: ['eslint.config.js', '*.config.js', '*.config.mjs', 'scripts/**/*.js'],
		extends: [
			...tseslint.configs.recommended,
		],
		rules: {
			'@typescript-eslint/no-var-requires': 'off',
			'object-curly-spacing': ['error', 'always'],
			'@/quotes': ['error', 'single'],
			'@/indent': ['error', 'tab', {}],
		},
	}
);
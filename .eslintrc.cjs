module.exports = {
	env: {
		browser: true,
		es2021: true,
		node: true,
	},
	extends: [
		'eslint:recommended',
		'plugin:react/recommended',
		'plugin:react-hooks/recommended',
	],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaFeatures: {
			jsx: true,
		},
		ecmaVersion: 'latest',
		sourceType: 'module',
	},
	plugins: [
		'react',
		'react-hooks',
		'@typescript-eslint',
	],
	rules: {
		'object-curly-spacing': ['error', 'always'],
		'quotes': ['error', 'single'],
		'react/prop-types': 'off',
		'react/react-in-jsx-scope': 'off',
		'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
		'indent': ['error', 'tab'],
	},
	settings: {
		react: {
			version: 'detect',
		},
	},
	ignorePatterns: ['node_modules/', 'build/'],
};

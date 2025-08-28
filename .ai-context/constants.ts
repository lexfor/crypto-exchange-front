export const FILE_ENCODING = 'utf-8';
export const JSON_INDENT = 2;

// Regular expressions
export const JSON_PATTERN = /\{[\s\S]*\}$/m;
export const LINE_SPLIT_PATTERN = /\r?\n/;

// File paths
export const AI_CONTEXT_DIR = '.ai-context';
export const CONFIG_FILENAME = 'config.json';
export const INDEX_FILENAME = 'index.json';

// Console messages
export const MESSAGES = {
    NO_STAGED_CHANGES: '✅ No staged changes.',
    NO_RAG_CONTEXT: '⚠️ No RAG context found. Did you build the index? (npm run ai:index)',
    INVALID_JSON: '❌ Local model did not return valid JSON. Aborting commit.',
    BLOCKERS_FOUND: '⛔ Blockers found. Commit aborted.',
    REVIEW_PASSED: '✅ AI review passed. Proceeding with commit.',
    NO_FILES_TO_INDEX: 'No files to index.',
    INDEXING_FAILED: 'Indexing failed:',
    UNEXPECTED_ERROR: 'Unexpected error:',
};

// Math constants
export const CONTEXT_SIZE_RATIO = 0.7;
export const VECTOR_EPSILON = 1e-8;

// Git commands
export const GIT_COMMANDS = {
    STAGED_CHANGES: 'git diff --cached',
};

// File formatting
export const CHUNK_SEPARATOR = '---\n';
export const FILE_HEADER_FORMAT = 'FILE: %s [%d-%d]';

// Index version
export const INDEX_VERSION = 1;

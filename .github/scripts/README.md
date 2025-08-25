# GitHub Scripts

This directory contains scripts used in GitHub Actions for the crypto exchange frontend project.

## Setup

Install dependencies for the scripts:

```bash
cd .github/scripts/
npm install
```

## Scripts

### PR Review Script

**File:** `pr_review_gemini.ts`

**Description:** Automated code review using Google's Gemini AI model. Analyzes all files in a pull request and provides comprehensive feedback with inline comments and general remarks.

**Usage in GitHub Actions:**
```bash
cd .github/scripts/
npm install
npm run review
```

**Required Environment Variables:**
- `GEMINI_API_KEY`: Google Gemini API key
- `GITHUB_TOKEN`: GitHub token with PR comment permissions
- `GITHUB_REPOSITORY`: Repository in format "owner/repo"
- `PR_NUMBER`: Pull request number to review

**Features:**
- ✅ Batch processing of all PR files for better context
- ✅ Inline comments on specific lines
- ✅ General feedback per file
- ✅ Comprehensive error logging
- ✅ English language prompts and responses

## Development

### Running the script directly

```bash
npm run review
```

### Building and running compiled version

```bash
npm run review:compiled
```

## Dependencies

- `@google/generative-ai`: Google Gemini AI client
- `@octokit/rest`: GitHub API client
- `typescript`: TypeScript compiler
- `@types/node`: Node.js type definitions

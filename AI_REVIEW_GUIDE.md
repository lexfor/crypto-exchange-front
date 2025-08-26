# 🤖 AI Code Review System

This project includes an automated AI code review system that activates before every Git commit, ensuring code quality and consistency.

## 🚀 How It Works

1. **Make Changes**: Edit your code as usual
2. **Stage Changes**: `git add <files>`
3. **Attempt Commit**: `git commit -m "your message"`
4. **Pre-commit Triggers**:
   - ✅ Runs ESLint and Prettier automatically
   - 🤖 Generates AI review prompt
   - ⏸️ Pauses commit for manual review
5. **Review Process**: Copy the generated prompt to your AI assistant
6. **Continue or Fix**: Approve to proceed or fix issues and retry

## 📋 Review Focus Areas

The AI review system checks for:

### 🔍 Code Quality
- TypeScript/React best practices
- Function structure and readability
- Variable naming consistency
- Error handling patterns

### 🏗️ Architecture & Design
- Component structure
- State management
- Dependency management
- SOLID principles

### 🔒 Security & Performance
- Security vulnerabilities
- Performance considerations
- Memory leak prevention
- Data validation

### 🧪 Testing & Maintainability
- Code testability
- Breaking changes documentation
- Backward compatibility
- Documentation updates

## 🛠️ Available Scripts

```bash
# Manual linting and formatting
npm run lint           # Check for linting errors
npm run lint:fix       # Fix linting errors automatically
npm run format         # Format code with Prettier
npm run format:check   # Check formatting without changes

# Manual AI review (without commit)
npm run ai-review      # Generate review prompt for staged changes
```

## 📁 Generated Files

- `reviews/` - Directory containing all generated review requests
- `reviews/review-TIMESTAMP.md` - Individual review files for tracking

## 🔧 Configuration

### ESLint Configuration (`.eslintrc.json`)
- Extends React App defaults
- Prettier integration
- TypeScript-specific rules
- Custom rules for code quality

### Prettier Configuration (`.prettierrc`)
- Consistent code formatting
- Single quotes preference
- 2-space indentation
- Trailing commas where valid

### Lint-staged Configuration (`package.json`)
- Auto-fixes linting errors on commit
- Auto-formats code with Prettier
- Processes TypeScript, JavaScript, CSS, and Markdown files

## 🚨 Troubleshooting

### Commit Blocked by ESLint
```bash
# Fix linting errors manually
npm run lint:fix

# Or fix specific file
npx eslint src/YourFile.tsx --fix
```

### Skip Pre-commit Hook (Emergency)
```bash
# Only use in emergency situations
git commit -m "your message" --no-verify
```

### Review Files Accumulating
```bash
# Clean up old review files
rm -rf reviews/
```

## 🎯 Best Practices

1. **Small Commits**: Make focused, small commits for better review quality
2. **Descriptive Messages**: Use clear commit messages
3. **Address Feedback**: Take AI suggestions seriously
4. **Regular Cleanup**: Periodically clean up review files
5. **Team Consistency**: Ensure all team members use the same process

## 📚 Example Workflow

```bash
# 1. Make changes to your code
vim src/components/Header.tsx

# 2. Stage your changes
git add src/components/Header.tsx

# 3. Attempt to commit
git commit -m "Add responsive navigation to header component"

# 4. Review the generated AI prompt (displayed in terminal)
# 5. Copy to your AI assistant for review
# 6. Respond 'y' to proceed or 'n' to cancel and make changes
```

## 🔄 Continuous Improvement

This system helps maintain:
- **Consistent Code Quality**: Automated checks catch issues early
- **Knowledge Sharing**: AI feedback educates on best practices
- **Documentation**: Review history tracks decision-making
- **Team Standards**: Enforces coding standards across the team

---

*For questions or improvements to this system, please discuss with the team or update this documentation.*

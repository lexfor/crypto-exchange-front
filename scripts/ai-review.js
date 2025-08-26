#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * AI Code Review Pre-commit Script
 * This script captures staged changes and generates a comprehensive review request
 */

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return output.trim().split('\n').filter(file => file.length > 0);
  } catch (error) {
    console.error('Error getting staged files:', error.message);
    return [];
  }
}

function getStagedDiff() {
  try {
    const output = execSync('git diff --cached', { encoding: 'utf8' });
    return output;
  } catch (error) {
    console.error('Error getting staged diff:', error.message);
    return '';
  }
}

function getProjectContext() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const readmePath = path.join(process.cwd(), 'README.md');
  
  let context = {
    projectName: 'Unknown',
    description: 'No description available',
    dependencies: {},
    scripts: {}
  };

  try {
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      context.projectName = packageJson.name || 'Unknown';
      context.description = packageJson.description || 'No description available';
      context.dependencies = packageJson.dependencies || {};
      context.scripts = packageJson.scripts || {};
    }
  } catch (error) {
    console.warn('Could not read package.json');
  }

  return context;
}

function analyzeChanges(stagedFiles, diff) {
  const analysis = {
    codeQuality: [],
    architecture: [],
    security: [],
    testing: [],
    summary: '',
    riskLevel: 'LOW'
  };

  const diffLines = diff.split('\n');
  const addedLines = diffLines.filter(line => line.startsWith('+')).length;
  const removedLines = diffLines.filter(line => line.startsWith('-')).length;
  const hasTypeScriptFiles = stagedFiles.some(file => file.endsWith('.tsx') || file.endsWith('.ts'));
  const hasComponentFiles = stagedFiles.some(file => file.includes('component') || file.endsWith('.tsx'));

  // Analyze Code Quality
  if (hasTypeScriptFiles) {
    if (diff.includes(': JSX.Element') || diff.includes(': React.FC')) {
      analysis.codeQuality.push('✅ Good TypeScript practices: explicit return types used');
    }
    if (diff.includes('const ') && !diff.includes('var ')) {
      analysis.codeQuality.push('✅ Modern JavaScript: using const/let instead of var');
    }
    if (diff.includes('import') && diff.includes('from ')) {
      analysis.codeQuality.push('✅ Proper ES6 imports used');
    }
  }

  // Check for potential issues
  if (diff.includes('any') && hasTypeScriptFiles) {
    analysis.codeQuality.push('⚠️ TypeScript: "any" type found - consider more specific typing');
    analysis.riskLevel = 'MEDIUM';
  }
  if (diff.includes('console.log') || diff.includes('console.error')) {
    if (stagedFiles.some(file => file.includes('script') || file.includes('build'))) {
      analysis.codeQuality.push('ℹ️ Console statements found - acceptable for build scripts');
    } else {
      analysis.codeQuality.push('⚠️ Console statements found - consider removing or using proper logging');
    }
  }

  // Architecture Analysis
  if (hasComponentFiles) {
    if (diff.includes('function ') && diff.includes('return')) {
      analysis.architecture.push('✅ Functional component pattern used');
    }
    if (diff.includes('useState') || diff.includes('useEffect')) {
      analysis.architecture.push('ℹ️ React hooks detected - ensure proper dependency arrays');
    }
  }

  // Security Analysis (skip for build/script files)
  const isBuildScript = stagedFiles.some(file => 
    file.includes('script') || file.includes('build') || file.includes('config')
  );
  
  if (!isBuildScript) {
    if (diff.includes('href=') && !diff.includes('rel="noopener noreferrer"')) {
      analysis.security.push('⚠️ External links without security attributes detected');
      analysis.riskLevel = 'MEDIUM';
    }
    if (diff.includes('dangerouslySetInnerHTML')) {
      analysis.security.push('🚨 Potentially dangerous HTML injection found');
      analysis.riskLevel = 'HIGH';
    }
    if (diff.includes('eval(') || diff.includes('Function(')) {
      analysis.security.push('🚨 Dynamic code execution detected - security risk');
      analysis.riskLevel = 'HIGH';
    }
  } else {
    analysis.security.push('ℹ️ Build/script file - security checks skipped');
  }

  // Testing & Maintainability
  const changeSize = addedLines + removedLines;
  if (changeSize > 50) {
    analysis.testing.push('⚠️ Large change detected - consider breaking into smaller commits');
    analysis.riskLevel = analysis.riskLevel === 'LOW' ? 'MEDIUM' : analysis.riskLevel;
  }
  if (stagedFiles.some(file => file.includes('test') || file.includes('spec'))) {
    analysis.testing.push('✅ Test files included in changes');
  } else if (hasComponentFiles) {
    analysis.testing.push('ℹ️ No test files found - consider adding tests for new functionality');
  }

  // Generate summary
  const fileTypes = [...new Set(stagedFiles.map(file => {
    if (file.endsWith('.tsx')) return 'React Components';
    if (file.endsWith('.ts')) return 'TypeScript';
    if (file.endsWith('.js')) return 'JavaScript';
    if (file.endsWith('.css')) return 'Styles';
    if (file.endsWith('.json')) return 'Config';
    return 'Other';
  }))];

  analysis.summary = `${fileTypes.join(', ')} changes with ${addedLines} additions and ${removedLines} deletions. Risk level: ${analysis.riskLevel}.`;

  return analysis;
}

function generateReviewPrompt(stagedFiles, diff, context) {
  const timestamp = new Date().toISOString();
  const analysis = analyzeChanges(stagedFiles, diff);
  
  return `# 🤖 AI Code Review Request
**Generated at:** ${timestamp}
**Project:** ${context.projectName}
**Risk Level:** ${analysis.riskLevel === 'HIGH' ? '🚨 HIGH' : analysis.riskLevel === 'MEDIUM' ? '⚠️ MEDIUM' : '✅ LOW'}

## 📋 Summary
${context.description}
**Change Analysis:** ${analysis.summary}

## 📁 Files Changed (${stagedFiles.length})
${stagedFiles.map(file => `- ${file}`).join('\n')}

## 🎯 Automated Review Analysis

### 🔍 Code Quality Assessment
${analysis.codeQuality.length > 0 ? analysis.codeQuality.map(item => `${item}`).join('\n') : 'ℹ️ No specific code quality issues detected'}

### 🏗️ Architecture & Design
${analysis.architecture.length > 0 ? analysis.architecture.map(item => `${item}`).join('\n') : 'ℹ️ Standard architectural patterns used'}

### 🔒 Security & Performance
${analysis.security.length > 0 ? analysis.security.map(item => `${item}`).join('\n') : '✅ No obvious security concerns detected'}

### 🧪 Testing & Maintainability
${analysis.testing.length > 0 ? analysis.testing.map(item => `${item}`).join('\n') : 'ℹ️ Standard maintainability practices followed'}

## 📝 Code Changes

\`\`\`diff
${diff}
\`\`\`

## 🤔 Questions for Review
1. Are there any potential bugs or edge cases?
2. Can any code be simplified or optimized?
3. Are there missing error handling scenarios?
4. Does this code follow our project's conventions?
5. Are there any security concerns?
6. Should any additional tests be written?

## 📦 Project Dependencies
\`\`\`json
${JSON.stringify(context.dependencies, null, 2)}
\`\`\`

---
**Next Steps:**
1. Review the code changes above
2. Provide feedback on each focus area
3. Suggest improvements or approve the changes
4. If approved, the commit will proceed

*This review was automatically generated by the pre-commit hook system.*
`;
}

function main() {
  console.log('🔍 Starting AI Code Review Process...\n');

  const stagedFiles = getStagedFiles();
  
  if (stagedFiles.length === 0) {
    console.log('ℹ️  No staged files found. Skipping review.');
    process.exit(0);
  }

  console.log(`📁 Found ${stagedFiles.length} staged file(s):`);
  stagedFiles.forEach(file => console.log(`   - ${file}`));
  console.log('');

  const diff = getStagedDiff();
  const context = getProjectContext();
  
  const reviewPrompt = generateReviewPrompt(stagedFiles, diff, context);
  
  // Create reviews directory if it doesn't exist
  const reviewsDir = path.join(process.cwd(), 'reviews');
  if (!fs.existsSync(reviewsDir)) {
    fs.mkdirSync(reviewsDir);
  }
  
  // Save review to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reviewFile = path.join(reviewsDir, `review-${timestamp}.md`);
  fs.writeFileSync(reviewFile, reviewPrompt);
  
  console.log(`📝 Review request generated: ${reviewFile}`);
  console.log('');
  console.log('🤖 AI REVIEW PROMPT:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(reviewPrompt);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🎯 Please copy the above prompt to your AI assistant for review.');
  console.log('');
  
  // Interactive prompt
  console.log('⏸️  COMMIT PAUSED FOR REVIEW');
  console.log('');
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('✅ Have you completed the AI review? Type "yes" to proceed, "no" to cancel: ', (answer) => {
      const response = answer.toLowerCase().trim();
      if (response === 'yes' || response === 'y') {
        console.log('✅ Review completed. Proceeding with commit...');
        rl.close();
        resolve(0);
      } else {
        console.log('❌ Commit cancelled. Please address review feedback and try again.');
        rl.close();
        resolve(1);
      }
    });
  }).then(exitCode => process.exit(exitCode));
}

if (require.main === module) {
  main();
}

module.exports = { getStagedFiles, getStagedDiff, getProjectContext, generateReviewPrompt };

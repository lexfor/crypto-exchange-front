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
    projectName: '',
    description: '',
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

function analyzeFileChanges(filePath, fileDiff) {
  const analysis = {
    filePath,
    fileType: getFileType(filePath),
    codeQuality: [],
    architecture: [],
    security: [],
    testing: [],
    riskLevel: 'LOW',
    addedLines: 0,
    removedLines: 0,
    summary: ''
  };

  const diffLines = fileDiff.split('\n');
  analysis.addedLines = diffLines.filter(line => line.startsWith('+')).length;
  analysis.removedLines = diffLines.filter(line => line.startsWith('-')).length;

  // File type specific analysis
  const isTypeScript = filePath.endsWith('.tsx') || filePath.endsWith('.ts');
  const isReactComponent = filePath.endsWith('.tsx') || filePath.includes('component');
  const isStyleFile = filePath.endsWith('.css') || filePath.endsWith('.scss') || filePath.endsWith('.less');
  const isConfigFile = filePath.includes('config') || filePath.endsWith('.json') || filePath.includes('package.json');
  const isBuildScript = filePath.includes('script') || filePath.includes('build') || filePath.includes('.husky');

  // TypeScript/JavaScript Analysis
  if (isTypeScript) {
    if (fileDiff.includes(': JSX.Element') || fileDiff.includes(': React.FC')) {
      analysis.codeQuality.push('✅ Explicit TypeScript return types used');
    }
    if (fileDiff.includes('any') && !isBuildScript) {
      analysis.codeQuality.push('⚠️ "any" type detected - consider more specific typing');
      analysis.riskLevel = 'MEDIUM';
    }
    if (fileDiff.includes('interface ') || fileDiff.includes('type ')) {
      analysis.codeQuality.push('✅ TypeScript interfaces/types defined');
    }
    if (fileDiff.includes('const ') && !fileDiff.includes('var ')) {
      analysis.codeQuality.push('✅ Modern const/let usage instead of var');
    }
  }

  // React Component Analysis
  if (isReactComponent) {
    if (fileDiff.includes('useState') || fileDiff.includes('useEffect')) {
      analysis.architecture.push('ℹ️ React hooks detected - verify dependency arrays');
    }
    if (fileDiff.includes('function ') && fileDiff.includes('return')) {
      analysis.architecture.push('✅ Functional component pattern used');
    }
    if (fileDiff.includes('className=')) {
      analysis.architecture.push('✅ Proper React className usage');
    }
    if (fileDiff.includes('onClick') || fileDiff.includes('onChange')) {
      analysis.architecture.push('ℹ️ Event handlers detected - ensure proper binding');
    }
  }

  // Security Analysis
  if (!isBuildScript && !isConfigFile) {
    if (fileDiff.includes('href=') && !fileDiff.includes('rel="noopener noreferrer"')) {
      analysis.security.push('⚠️ External links missing security attributes');
      analysis.riskLevel = 'MEDIUM';
    }
    if (fileDiff.includes('dangerouslySetInnerHTML')) {
      analysis.security.push('🚨 Dangerous HTML injection detected');
      analysis.riskLevel = 'HIGH';
    }
    if (fileDiff.includes('eval(') || fileDiff.includes('Function(')) {
      analysis.security.push('🚨 Dynamic code execution detected');
      analysis.riskLevel = 'HIGH';
    }
    if (fileDiff.includes('localStorage') || fileDiff.includes('sessionStorage')) {
      analysis.security.push('ℹ️ Browser storage usage - ensure data sanitization');
    }
  } else if (isBuildScript) {
    analysis.security.push('ℹ️ Build/script file - security checks skipped');
  }

  // Style File Analysis
  if (isStyleFile) {
    if (fileDiff.includes('!important')) {
      analysis.codeQuality.push('⚠️ !important usage detected - consider specificity');
    }
    if (fileDiff.includes('px') && fileDiff.includes('rem')) {
      analysis.codeQuality.push('ℹ️ Mixed px/rem units - ensure consistency');
    }
  }

  // Configuration File Analysis
  if (isConfigFile) {
    if (filePath.includes('package.json')) {
      if (fileDiff.includes('"dependencies"') || fileDiff.includes('"devDependencies"')) {
        analysis.testing.push('ℹ️ Package dependencies modified - verify compatibility');
      }
      if (fileDiff.includes('"scripts"')) {
        analysis.testing.push('ℹ️ NPM scripts modified - test execution');
      }
    }
  }

  // Console statements
  if (fileDiff.includes('console.log') || fileDiff.includes('console.error')) {
    if (isBuildScript) {
      analysis.codeQuality.push('ℹ️ Console statements in script file - acceptable');
    } else {
      analysis.codeQuality.push('⚠️ Console statements - consider proper logging');
    }
  }

  // Testing considerations
  const changeSize = analysis.addedLines + analysis.removedLines;
  if (changeSize > 30 && !isBuildScript && !isConfigFile) {
    analysis.testing.push('⚠️ Significant changes - consider adding tests');
  }

  if (isReactComponent && changeSize > 10) {
    analysis.testing.push('ℹ️ Component changes - verify existing tests still pass');
  }

  // Generate file summary
  analysis.summary = `${analysis.fileType}: +${analysis.addedLines}/-${analysis.removedLines} lines, Risk: ${analysis.riskLevel}`;

  return analysis;
}

async function performAutomatedAIReview(analysis, diff, stagedFiles) {
  console.log('🤖 Performing automated AI code review...');
  
  const aiReview = {
    approved: true,
    score: 0,
    feedback: [],
    recommendations: [],
    blockers: [],
    decision: 'APPROVE'
  };

  // Advanced Code Quality Analysis
  for (const fileAnalysis of analysis.fileAnalyses) {
    console.log(`🔍 Analyzing ${fileAnalysis.filePath}...`);
    
    // High risk patterns that block commits
    if (fileAnalysis.riskLevel === 'HIGH') {
      aiReview.blockers.push(`❌ ${fileAnalysis.filePath}: High risk changes detected`);
      aiReview.approved = false;
      aiReview.score -= 30;
    }
    
    // Security concerns
    if (fileAnalysis.security.some(item => item.includes('🚨'))) {
      aiReview.blockers.push(`🚨 ${fileAnalysis.filePath}: Security vulnerabilities found`);
      aiReview.approved = false;
      aiReview.score -= 50;
    }
    
    // Performance and quality scoring
    if (fileAnalysis.codeQuality.some(item => item.includes('✅'))) {
      aiReview.score += 10;
      aiReview.feedback.push(`✅ ${fileAnalysis.filePath}: Good coding practices detected`);
    }
    
    if (fileAnalysis.architecture.some(item => item.includes('✅'))) {
      aiReview.score += 10;
      aiReview.feedback.push(`✅ ${fileAnalysis.filePath}: Good architectural patterns`);
    }
    
    // Recommendations for improvements
    if (fileAnalysis.codeQuality.some(item => item.includes('⚠️'))) {
      aiReview.recommendations.push(`⚠️ ${fileAnalysis.filePath}: Consider addressing code quality warnings`);
      aiReview.score -= 5;
    }
    
    if (fileAnalysis.testing.some(item => item.includes('⚠️'))) {
      aiReview.recommendations.push(`ℹ️ ${fileAnalysis.filePath}: Consider adding tests for significant changes`);
    }
  }

  // Advanced pattern analysis with line numbers
  const issuesWithLines = findIssuesWithLineNumbers(diff, stagedFiles);
  
  for (const issue of issuesWithLines) {
    if (issue.severity === 'blocker') {
      aiReview.blockers.push(`🚨 ${issue.file}:${issue.line} - ${issue.message}: \`${issue.code.trim()}\``);
      aiReview.approved = false;
      aiReview.score -= 100;
    } else {
      aiReview.recommendations.push(`⚠️ ${issue.file}:${issue.line} - ${issue.message}: \`${issue.code.trim()}\``);
      aiReview.score -= 10;
    }
  }

  // File-specific intelligent analysis with line numbers
  for (const filePath of stagedFiles) {
    const fileDiff = getFileDiff(diff, filePath);
    
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      // Analyze TypeScript/React patterns with line numbers
      const tsIssues = analyzeTypeScriptPatterns(fileDiff, filePath);
      tsIssues.forEach(issue => {
        if (issue.severity === 'warning') {
          aiReview.recommendations.push(`⚠️ ${issue.file}:${issue.line} - ${issue.message}: \`${issue.code.trim()}\``);
          aiReview.score -= 5;
        } else {
          aiReview.feedback.push(`ℹ️ ${issue.file}:${issue.line} - ${issue.message}: \`${issue.code.trim()}\``);
        }
      });
    }
    
    if (filePath.includes('package.json')) {
      if (fileDiff.includes('"version"')) {
        aiReview.feedback.push(`ℹ️ ${filePath}: Version bump detected - ensure changelog is updated`);
      }
    }
  }

  // Determine final decision
  if (aiReview.score < -50 || aiReview.blockers.length > 0) {
    aiReview.decision = 'REJECT';
    aiReview.approved = false;
  } else if (aiReview.score < 0 || aiReview.recommendations.length > 2) {
    aiReview.decision = 'APPROVE_WITH_WARNINGS';
  } else {
    aiReview.decision = 'APPROVE';
  }

  return aiReview;
}

function findIssuesWithLineNumbers(diff, stagedFiles) {
  const issues = [];
  const suspiciousPatterns = [
    { pattern: /TODO|FIXME|HACK/i, message: 'TODO/FIXME comment found', severity: 'warning' },
    { pattern: /\.only\(|fdescribe|fit\(/i, message: 'Test isolation detected (only/fit)', severity: 'blocker' },
    { pattern: /console\.(?!error)/i, message: 'Console statement in production code', severity: 'warning' },
    { pattern: /debugger/i, message: 'Debugger statement found', severity: 'blocker' },
    { pattern: /password.*=.*['"]/i, message: 'Hardcoded credentials detected', severity: 'blocker' },
    { pattern: /api[_-]?key.*=.*['"]/i, message: 'Hardcoded API key detected', severity: 'blocker' },
    { pattern: /eval\(/i, message: 'Dangerous eval() usage', severity: 'blocker' },
    { pattern: /innerHTML\s*=/i, message: 'Potentially unsafe innerHTML usage', severity: 'warning' },
    { pattern: /document\.write/i, message: 'Deprecated document.write usage', severity: 'warning' },
    { pattern: /alert\(/i, message: 'Alert dialog found', severity: 'warning' },
    { pattern: /confirm\(/i, message: 'Confirm dialog found', severity: 'warning' }
  ];

  for (const filePath of stagedFiles) {
    const fileDiff = getFileDiff(diff, filePath);
    const lines = fileDiff.split('\n');
    let currentLineNumber = 0;
    let inAddedSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Track line numbers from diff headers
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
        if (match) {
          currentLineNumber = parseInt(match[1], 10) - 1;
        }
        continue;
      }
      
      // Skip file headers and metadata
      if (line.startsWith('diff --git') || line.startsWith('index ') || 
          line.startsWith('---') || line.startsWith('+++')) {
        continue;
      }
      
      // Track added lines (where issues matter most)
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentLineNumber++;
        const codeContent = line.substring(1); // Remove the '+' prefix
        
        // Skip empty lines and build script patterns
        if (codeContent.trim() === '' || filePath.includes('script') || filePath.includes('build')) {
          continue;
        }
        
        // Check for patterns in added lines
        for (const { pattern, message, severity } of suspiciousPatterns) {
          if (pattern.test(codeContent)) {
            issues.push({
              file: filePath,
              line: currentLineNumber,
              code: codeContent,
              message,
              severity,
              pattern: pattern.source
            });
          }
        }
      } else if (line.startsWith(' ')) {
        // Context line
        currentLineNumber++;
      } else if (line.startsWith('-')) {
        // Deleted line - don't increment current line number
        continue;
      }
    }
  }

  return issues;
}

function analyzeTypeScriptPatterns(fileDiff, filePath) {
  const issues = [];
  const lines = fileDiff.split('\n');
  let currentLineNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Track line numbers from diff headers
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
      if (match) {
        currentLineNumber = parseInt(match[1], 10) - 1;
      }
      continue;
    }
    
    // Skip file headers
    if (line.startsWith('diff --git') || line.startsWith('index ') || 
        line.startsWith('---') || line.startsWith('+++')) {
      continue;
    }
    
    // Analyze added lines
    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentLineNumber++;
      const codeContent = line.substring(1);
      
      // TypeScript/React specific patterns
      if (codeContent.includes('useEffect') && !codeContent.includes('[]') && !codeContent.includes('[')) {
        issues.push({
          file: filePath,
          line: currentLineNumber,
          code: codeContent,
          message: 'useEffect may need dependency array',
          severity: 'info'
        });
      }
      
      if (codeContent.includes(': any') && !filePath.includes('script')) {
        issues.push({
          file: filePath,
          line: currentLineNumber,
          code: codeContent,
          message: 'Consider replacing "any" with specific type',
          severity: 'warning'
        });
      }
      
      if (codeContent.includes('setState') && codeContent.includes('this.state')) {
        issues.push({
          file: filePath,
          line: currentLineNumber,
          code: codeContent,
          message: 'Consider using functional components with hooks',
          severity: 'info'
        });
      }
      
      if (codeContent.includes('// @ts-ignore') || codeContent.includes('// @ts-nocheck')) {
        issues.push({
          file: filePath,
          line: currentLineNumber,
          code: codeContent,
          message: 'TypeScript suppression comment - consider fixing the underlying issue',
          severity: 'warning'
        });
      }
      
    } else if (line.startsWith(' ')) {
      currentLineNumber++;
    }
  }

  return issues;
}

function getFileDiff(fullDiff, filePath) {
  const lines = fullDiff.split('\n');
  const fileStart = lines.findIndex(line => line.includes(`diff --git a/${filePath}`));
  if (fileStart === -1) return '';
  
  const nextFileStart = lines.findIndex((line, index) => 
    index > fileStart && line.startsWith('diff --git')
  );
  
  const fileEnd = nextFileStart === -1 ? lines.length : nextFileStart;
  return lines.slice(fileStart, fileEnd).join('\n');
}

function getFileType(filePath) {
  if (filePath.endsWith('.tsx')) return 'React Component';
  if (filePath.endsWith('.ts')) return 'TypeScript';
  if (filePath.endsWith('.js')) return 'JavaScript';
  if (filePath.endsWith('.jsx')) return 'React (JS)';
  if (filePath.endsWith('.css')) return 'CSS';
  if (filePath.endsWith('.scss') || filePath.endsWith('.sass')) return 'SCSS/Sass';
  if (filePath.endsWith('.json')) return 'JSON Config';
  if (filePath.includes('package.json')) return 'Package Config';
  if (filePath.includes('README')) return 'Documentation';
  if (filePath.includes('test') || filePath.includes('spec')) return 'Test File';
  if (filePath.includes('script')) return 'Build Script';
  return 'Other';
}

function parseGitDiffByFile(diff) {
  const fileChanges = {};
  const lines = diff.split('\n');
  let currentFile = null;
  let currentFileDiff = [];

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      // Save previous file if exists
      if (currentFile && currentFileDiff.length > 0) {
        fileChanges[currentFile] = currentFileDiff.join('\n');
      }
      
      // Extract file path from "diff --git a/path b/path"
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      currentFile = match ? match[2] : null;
      currentFileDiff = [line];
    } else if (currentFile) {
      currentFileDiff.push(line);
    }
  }

  // Don't forget the last file
  if (currentFile && currentFileDiff.length > 0) {
    fileChanges[currentFile] = currentFileDiff.join('\n');
  }

  return fileChanges;
}

function analyzeChanges(stagedFiles, diff) {
  const fileChanges = parseGitDiffByFile(diff);
  const fileAnalyses = [];
  let overallRiskLevel = 'LOW';

  // Analyze each file individually
  for (const filePath of stagedFiles) {
    const fileDiff = fileChanges[filePath] || '';
    const fileAnalysis = analyzeFileChanges(filePath, fileDiff);
    fileAnalyses.push(fileAnalysis);

    // Update overall risk level
    if (fileAnalysis.riskLevel === 'HIGH') {
      overallRiskLevel = 'HIGH';
    } else if (fileAnalysis.riskLevel === 'MEDIUM' && overallRiskLevel === 'LOW') {
      overallRiskLevel = 'MEDIUM';
    }
  }

  const totalAdded = fileAnalyses.reduce((sum, f) => sum + f.addedLines, 0);
  const totalRemoved = fileAnalyses.reduce((sum, f) => sum + f.removedLines, 0);

  // Generate overall summary
  const fileTypes = [...new Set(fileAnalyses.map(f => f.fileType))];
  const summary = `${fileTypes.join(', ')} changes with ${totalAdded} additions and ${totalRemoved} deletions. Overall risk: ${overallRiskLevel}.`;

  return {
    fileAnalyses,
    overallRiskLevel,
    totalAdded,
    totalRemoved,
    summary,
    fileTypes
  };
}

function generateReviewPrompt(stagedFiles, diff, context, analysis) {
  const timestamp = new Date().toISOString();
  
  // Generate per-file analysis section
  const fileAnalysisSection = analysis.fileAnalyses.map(fileAnalysis => {
    const riskIcon = fileAnalysis.riskLevel === 'HIGH' ? '🚨' : 
                     fileAnalysis.riskLevel === 'MEDIUM' ? '⚠️' : '✅';
    
    return `
### 📄 ${fileAnalysis.filePath}
**Type:** ${fileAnalysis.fileType} | **Risk:** ${riskIcon} ${fileAnalysis.riskLevel} | **Changes:** +${fileAnalysis.addedLines}/-${fileAnalysis.removedLines}

#### 🔍 Code Quality
${fileAnalysis.codeQuality.length > 0 ? fileAnalysis.codeQuality.map(item => `- ${item}`).join('\n') : '- ℹ️ No specific issues detected'}

#### 🏗️ Architecture
${fileAnalysis.architecture.length > 0 ? fileAnalysis.architecture.map(item => `- ${item}`).join('\n') : '- ℹ️ Standard patterns used'}

#### 🔒 Security
${fileAnalysis.security.length > 0 ? fileAnalysis.security.map(item => `- ${item}`).join('\n') : '- ✅ No security concerns'}

#### 🧪 Testing
${fileAnalysis.testing.length > 0 ? fileAnalysis.testing.map(item => `- ${item}`).join('\n') : '- ℹ️ Standard practices followed'}`;
  }).join('\n');
  
  return `# 🤖 AI Code Review Request
**Generated at:** ${timestamp}
**Project:** ${context.projectName}
**Overall Risk Level:** ${analysis.overallRiskLevel === 'HIGH' ? '🚨 HIGH' : analysis.overallRiskLevel === 'MEDIUM' ? '⚠️ MEDIUM' : '✅ LOW'}

## 📋 Summary
${context.description || 'No description available'}

**Change Analysis:** ${analysis.summary}

## 📁 Files Changed (${stagedFiles.length})
${stagedFiles.map(file => `- ${file}`).join('\n')}

## 🎯 Detailed File-by-File Analysis
${fileAnalysisSection}

## 📊 Overall Assessment

### Summary by Category
- **Code Quality:** ${analysis.fileAnalyses.reduce((acc, f) => acc + f.codeQuality.length, 0)} items reviewed
- **Architecture:** ${analysis.fileAnalyses.reduce((acc, f) => acc + f.architecture.length, 0)} items reviewed  
- **Security:** ${analysis.fileAnalyses.reduce((acc, f) => acc + f.security.length, 0)} items reviewed
- **Testing:** ${analysis.fileAnalyses.reduce((acc, f) => acc + f.testing.length, 0)} items reviewed

### Risk Distribution
${analysis.fileAnalyses.map(f => `- ${f.filePath}: ${f.riskLevel}`).join('\n')}

### Change Volume
- **Total Lines Added:** ${analysis.totalAdded}
- **Total Lines Removed:** ${analysis.totalRemoved}
- **File Types:** ${analysis.fileTypes.join(', ')}

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

async function main() {
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
  const analysis = analyzeChanges(stagedFiles, diff);
  
  const reviewPrompt = generateReviewPrompt(stagedFiles, diff, context, analysis);
  
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
  console.log('🎯 Performing automated AI review...');
  console.log('');
  
  // Perform automated AI analysis
  const aiReview = await performAutomatedAIReview(analysis, diff, stagedFiles);
  
  // Display AI review results
  console.log('🤖 AI REVIEW RESULTS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log(`📊 Review Score: ${aiReview.score > 0 ? '✅' : aiReview.score < -20 ? '❌' : '⚠️'} ${aiReview.score}/100`);
  console.log(`🎯 Decision: ${aiReview.decision === 'APPROVE' ? '✅ APPROVED' : 
                               aiReview.decision === 'APPROVE_WITH_WARNINGS' ? '⚠️ APPROVED WITH WARNINGS' : 
                               '❌ REJECTED'}`);
  console.log('');
  
  // Show feedback
  if (aiReview.feedback.length > 0) {
    console.log('💬 AI Feedback:');
    aiReview.feedback.forEach(item => console.log(`  ${item}`));
    console.log('');
  }
  
  // Show recommendations
  if (aiReview.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    aiReview.recommendations.forEach(item => console.log(`  ${item}`));
    console.log('');
  }
  
  // Show blockers
  if (aiReview.blockers.length > 0) {
    console.log('🚫 Blocking Issues:');
    aiReview.blockers.forEach(item => console.log(`  ${item}`));
    console.log('');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Auto-proceed based on AI decision
  if (aiReview.approved) {
    if (aiReview.decision === 'APPROVE_WITH_WARNINGS') {
      console.log('⚠️ AI APPROVED with warnings - proceeding with commit...');
      console.log('💡 Consider addressing the recommendations in future commits.');
    } else {
      console.log('✅ AI APPROVED - proceeding with commit...');
    }
    console.log('');
    process.exit(0);
  } else {
    console.log('❌ AI REJECTED the commit due to blocking issues.');
    console.log('🔧 Please address the issues above and try committing again.');
    console.log('');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error in AI review process:', error.message);
    process.exit(1);
  });
}

module.exports = { getStagedFiles, getStagedDiff, getProjectContext, generateReviewPrompt };


#!/usr/bin/env node

import { execSync } from 'child_process';

// ANSI color codes for highlighting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m'
};

// Helper function to highlight lines containing "app/ui/src/"
function highlightStacktraceLine(line) {
  if (line.includes('app/ui/src/')) {
    return `${colors.bgCyan}${colors.bright}${colors.white}${line}${colors.reset}`;
  }
  return line;
}

// Helper function to process and highlight stacktrace messages
function processStacktraceMessage(message) {
  return message
    .trim()
    .split('\n')
    .map(line => highlightStacktraceLine(line))
    .join('\n');
}

console.log('Running tests and showing only failures...\n');

try {
  // Run Jest with JSON output to capture all results
  const result = execSync('npx jest --json --silent', { 
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  const testResults = JSON.parse(result);
  
  // Filter to only show failed tests
  const failedTests = [];
  
  testResults.testResults.forEach(suite => {
    if (suite.status === 'failed') {
      failedTests.push({
        file: suite.name,
        failures: suite.assertionResults.filter(test => test.status === 'failed')
      });
    }
  });
  
  if (failedTests.length === 0) {
    console.log('✅ All tests passed!');
  } else {
    console.log(`❌ ${failedTests.length} test suite(s) failed:\n`);
    
    failedTests.forEach(suite => {
      console.log(`📁 ${suite.file}`);
      suite.failures.forEach(test => {
        console.log(`  ❌ ${test.fullName}`);
        if (test.failureMessages && test.failureMessages.length > 0) {
          test.failureMessages.forEach(msg => {
            const highlightedMsg = processStacktraceMessage(msg);
            console.log(`     ${highlightedMsg.replace(/\n/g, '\n     ')}`);
          });
        }
      });
      console.log('');
    });
  }
  
} catch (error) {
  // If the command fails, it might be because there are test failures
  // Try to parse the error output
  if (error.stdout) {
    try {
      const testResults = JSON.parse(error.stdout);
      
      const failedTests = [];
      testResults.testResults.forEach(suite => {
        if (suite.status === 'failed') {
          failedTests.push({
            file: suite.name,
            failures: suite.assertionResults.filter(test => test.status === 'failed')
          });
        }
      });
      
      if (failedTests.length > 0) {
        console.log(`❌ ${failedTests.length} test suite(s) failed:\n`);
        
        failedTests.forEach(suite => {
          console.log(`📁 ${suite.file}`);
          suite.failures.forEach(test => {
            console.log(`  ❌ ${test.fullName}`);
            if (test.failureMessages && test.failureMessages.length > 0) {
              test.failureMessages.forEach(msg => {
                const highlightedMsg = processStacktraceMessage(msg);
                console.log(`     ${highlightedMsg.replace(/\n/g, '\n     ')}`);
              });
            }
          });
          console.log('');
        });
      }
    } catch (parseError) {
      console.error('Failed to parse test results:', error.message);
    }
    process.exit(1);
  } else {
    console.error('Test execution failed:', error.message);
    process.exit(1);

  }
} 
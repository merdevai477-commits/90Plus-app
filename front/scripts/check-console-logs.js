#!/usr/bin/env node

/**
 * Script to check for console.log statements in production code
 * Run: node scripts/check-console-logs.js
 */

const fs = require('fs');
const path = require('path');

const EXCLUDED_DIRS = ['node_modules', 'dist', '__tests__', '__mocks__', 'docs'];
const EXCLUDED_FILES = ['.test.ts', '.test.tsx', 'check-console-logs.js'];

let foundConsoleLog = false;
let totalFiles = 0;
let filesWithConsoleLog = 0;

function shouldExclude(filePath) {
  return EXCLUDED_DIRS.some(dir => filePath.includes(dir)) ||
         EXCLUDED_FILES.some(file => filePath.endsWith(file));
}

function checkFile(filePath) {
  if (shouldExclude(filePath)) return;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let hasConsoleLog = false;
  
  lines.forEach((line, index) => {
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    
    // Check for console.log
    if (line.includes('console.log')) {
      if (!hasConsoleLog) {
        console.log(`\n❌ Found console.log in: ${filePath}`);
        hasConsoleLog = true;
        filesWithConsoleLog++;
      }
      console.log(`   Line ${index + 1}: ${line.trim()}`);
      foundConsoleLog = true;
    }
  });
  
  totalFiles++;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      checkFile(filePath);
    }
  });
}

console.log('🔍 Checking for console.log statements...\n');

walkDir(path.join(__dirname, '..'));

console.log(`\n📊 Summary:`);
console.log(`   Total files checked: ${totalFiles}`);
console.log(`   Files with console.log: ${filesWithConsoleLog}`);

if (foundConsoleLog) {
  console.log('\n⚠️  Please replace console.log with logger service:');
  console.log('   import { logger } from "./services/logger";');
  console.log('   logger.debug("message");');
  process.exit(1);
} else {
  console.log('\n✅ No console.log statements found!');
  process.exit(0);
}

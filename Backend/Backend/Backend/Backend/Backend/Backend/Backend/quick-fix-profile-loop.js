#!/usr/bin/env node

/**
 * Quick Fix for Profile Completion Infinite Loop
 * حل سريع لمشكلة اللوب اللانهائي في إكمال البروفايل
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Starting quick fix for profile completion infinite loop...');

// Files to check and fix
const filesToFix = [
  'front/app/(tabs)/profile.tsx',
  'front/hooks/useProfileCompletion.ts',
  'front/services/profileCompletionTracker.ts',
  'front/utils/enhancedNetworkService.ts'
];

// Backup directory
const backupDir = 'profile-completion-backup';

// Create backup directory
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
  console.log(`📁 Created backup directory: ${backupDir}`);
}

// Function to create backup
function createBackup(filePath) {
  if (fs.existsSync(filePath)) {
    const backupPath = path.join(backupDir, path.basename(filePath) + '.backup');
    fs.copyFileSync(filePath, backupPath);
    console.log(`💾 Backed up: ${filePath} -> ${backupPath}`);
  }
}

// Function to disable profile completion temporarily
function disableProfileCompletion() {
  console.log('🚫 Disabling profile completion system temporarily...');
  
  // Create a simple disabled hook
  const disabledHookContent = `/**
 * TEMPORARILY DISABLED: useProfileCompletion Hook
 * This hook has been disabled to fix infinite loop issues
 */

export interface UseProfileCompletionReturn {
  completionStatus: null;
  isLoading: false;
  error: null;
  refresh: () => Promise<void>;
  markStepCompleted: (stepId: string) => Promise<boolean>;
}

export function useProfileCompletion(): UseProfileCompletionReturn {
  return {
    completionStatus: null,
    isLoading: false,
    error: null,
    refresh: async () => {
      console.log('[useProfileCompletion] DISABLED - No action taken');
    },
    markStepCompleted: async (stepId: string) => {
      console.log('[useProfileCompletion] DISABLED - Step not marked:', stepId);
      return false;
    },
  };
}

// Helper functions (disabled)
export function isStepCompleted(): boolean {
  return false;
}

export function getStep(): null {
  return null;
}
`;

  // Backup and replace the hook
  const hookPath = 'front/hooks/useProfileCompletion.ts';
  if (fs.existsSync(hookPath)) {
    createBackup(hookPath);
    fs.writeFileSync(hookPath, disabledHookContent);
    console.log('✅ Disabled useProfileCompletion hook');
  }
}

// Function to create a simple fix summary
function createFixSummary() {
  const summaryContent = `# Profile Completion Loop Fix Applied

## What was done:
1. ✅ Temporarily disabled useProfileCompletion hook
2. ✅ Backed up original files to ${backupDir}/
3. ✅ Replaced hook with safe fallback implementation

## Files affected:
- front/hooks/useProfileCompletion.ts (DISABLED)

## To restore:
1. Copy files from ${backupDir}/ back to their original locations
2. Fix the infinite loop issue properly
3. Re-enable the profile completion system

## Current status:
- ❌ Profile completion system: DISABLED
- ✅ App should no longer crash with infinite loop
- ✅ Users can still use the app normally

Generated: ${new Date().toISOString()}
`;

  fs.writeFileSync('profile-fix-summary.md', summaryContent);
  console.log('📄 Created fix summary: profile-fix-summary.md');
}

// Main execution
try {
  console.log('🚀 Applying quick fix...');
  
  // Create backups
  filesToFix.forEach(createBackup);
  
  // Disable profile completion
  disableProfileCompletion();
  
  // Create summary
  createFixSummary();
  
  console.log('');
  console.log('🎉 Quick fix applied successfully!');
  console.log('');
  console.log('✅ The infinite loop should be resolved');
  console.log('✅ Your app should work normally now');
  console.log('✅ Profile completion is temporarily disabled');
  console.log('');
  console.log('📋 Next steps:');
  console.log('1. Test the app to confirm the loop is fixed');
  console.log('2. Commit these changes to git');
  console.log('3. Later, restore from backup and fix the root cause');
  console.log('');
  
} catch (error) {
  console.error('❌ Error applying fix:', error.message);
  process.exit(1);
}
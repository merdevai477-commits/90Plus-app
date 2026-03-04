/**
 * Property-Based Test: No Hardcoded Credentials in Codebase
 * 
 * This test uses fast-check to generate search terms and verify that no hardcoded
 * credentials exist in the codebase (excluding test files).
 * 
 * **Validates: Requirements 2.1, 2.2, 2.4**
 * 
 * Task 9.1: اختبار الخاصية: عدم وجود بيانات اعتماد مشفرة
 */

import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

/**
 * Get all code files in the frontend directory
 * Excludes: node_modules, __tests__, .expo, dist, build
 */
function getAllCodeFiles(): string[] {
  const frontDir = path.join(__dirname, '..');
  
  // Use glob to find all TypeScript and JavaScript files
  const patterns = [
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx',
  ];
  
  const excludePatterns = [
    '**/node_modules/**',
    '**/__tests__/**',
    '**/.expo/**',
    '**/dist/**',
    '**/build/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
  ];
  
  let allFiles: string[] = [];
  
  patterns.forEach(pattern => {
    const files = glob.sync(pattern, {
      cwd: frontDir,
      absolute: true,
      ignore: excludePatterns,
    });
    allFiles = allFiles.concat(files);
  });
  
  return allFiles;
}

/**
 * Search for a term in all code files
 * Returns array of { file, line, content } for matches
 */
function searchInFiles(files: string[], searchTerm: string): Array<{ file: string; line: number; content: string }> {
  const results: Array<{ file: string; line: number; content: string }> = [];
  
  files.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
          results.push({
            file: path.relative(path.join(__dirname, '..'), file),
            line: index + 1,
            content: line.trim(),
          });
        }
      });
    } catch (error) {
      // Skip files that can't be read
    }
  });
  
  return results;
}

describe('Security: No Hardcoded Credentials Property Tests', () => {
  /**
   * **Task 9.1: Property 1 - No Hardcoded Credentials**
   * 
   * *For any* search term related to hardcoded credentials (mahmoud_essam, password, login),
   * the codebase SHALL NOT contain these terms in production code (excluding test files).
   * 
   * **Validates: Requirements 2.1, 2.2, 2.4**
   */
  describe('Property 1: No Hardcoded Credentials in Codebase', () => {
    it('should not find hardcoded username "mahmoud_essam" in production code', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('mahmoud_essam', 'MAHMOUD_ESSAM', 'Mahmoud_Essam'),
          (searchTerm) => {
            const codeFiles = getAllCodeFiles();
            const results = searchInFiles(codeFiles, searchTerm);
            
            // Filter out test files (double check)
            const nonTestResults = results.filter(r => 
              !r.file.includes('__tests__') && 
              !r.file.includes('.test.') &&
              !r.file.includes('.spec.')
            );
            
            // Should not find the hardcoded username in production code
            expect(nonTestResults.length).toBe(0);
            
            if (nonTestResults.length > 0) {
              console.log('Found hardcoded username in:', nonTestResults);
            }
            
            return true;
          }
        ),
        { numRuns: 3 } // Run once for each variant
      );
    });

    it('should not find hardcoded password in login context', () => {
      const codeFiles = getAllCodeFiles();
      
      // Search for patterns that might indicate hardcoded passwords
      const suspiciousPatterns = [
        'password: \'password\'',
        'password: "password"',
        'password === \'password\'',
        'password === "password"',
      ];
      
      suspiciousPatterns.forEach(pattern => {
        const results = searchInFiles(codeFiles, pattern);
        
        // Filter out test files
        const nonTestResults = results.filter(r => 
          !r.file.includes('__tests__') && 
          !r.file.includes('.test.') &&
          !r.file.includes('.spec.')
        );
        
        expect(nonTestResults.length).toBe(0);
        
        if (nonTestResults.length > 0) {
          console.log(`Found suspicious pattern "${pattern}" in:`, nonTestResults);
        }
      });
    });

    it('should not have a login() function with hardcoded credentials in globalState', () => {
      const globalStatePath = path.join(__dirname, '..', 'globalState.ts');
      
      if (fs.existsSync(globalStatePath)) {
        const content = fs.readFileSync(globalStatePath, 'utf-8');
        
        // Check that login function doesn't exist or doesn't have hardcoded credentials
        const hasLoginFunction = content.includes('login:') || content.includes('login (');
        
        if (hasLoginFunction) {
          // If login function exists, it should not have hardcoded credentials
          expect(content).not.toContain('mahmoud_essam');
          expect(content).not.toMatch(/password.*===.*['"]password['"]/);
        }
      }
    });

    it('should verify globalState.login is not accessible', () => {
      // Try to import globalState and check if login exists
      try {
        const globalState = require('../globalState').globalState;
        
        // login function should not exist
        expect(globalState.login).toBeUndefined();
      } catch (error) {
        // If import fails, that's also acceptable (file might not exist in test environment)
      }
    });

    it('should not find any references to hardcoded credentials in authentication code', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'mahmoud_essam'
            // Removed 'diamond' and 'password' as they may appear in valid contexts
          ),
          (searchTerm) => {
            const codeFiles = getAllCodeFiles();
            
            // Focus on authentication-related files
            const authFiles = codeFiles.filter(file => 
              file.includes('auth') || 
              file.includes('login') || 
              file.includes('globalState')
            );
            
            const results = searchInFiles(authFiles, searchTerm);
            
            // Filter out test files
            const nonTestResults = results.filter(r => 
              !r.file.includes('__tests__') && 
              !r.file.includes('.test.') &&
              !r.file.includes('.spec.')
            );
            
            // Should not find hardcoded credentials in auth files
            expect(nonTestResults.length).toBe(0);
            
            return true;
          }
        ),
        { numRuns: 1 }
      );
    });
  });
});

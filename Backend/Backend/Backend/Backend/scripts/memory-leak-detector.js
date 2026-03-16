/**
 * 🧠 MEMORY LEAK DETECTOR
 * 
 * Scans codebase for common memory leak patterns:
 * - Timers without cleanup
 * - WebSocket listeners without removal
 * - Event emitters without cleanup
 * - Stream handlers without cleanup
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class MemoryLeakDetector {
  constructor() {
    this.leaks = [];
    this.warnings = [];
    this.filesChecked = 0;
    this.srcDir = path.join(__dirname, '../src');
  }

  /**
   * Check for setInterval without clearInterval
   */
  checkIntervals(content, filePath) {
    const intervalMatches = content.match(/setInterval\s*\(/g) || [];
    const clearMatches = content.match(/clearInterval\s*\(/g) || [];

    if (intervalMatches.length > clearMatches.length) {
      this.warnings.push({
        file: filePath,
        issue: `Found ${intervalMatches.length} setInterval but only ${clearMatches.length} clearInterval`,
        pattern: 'setInterval without clearInterval',
        severity: 'HIGH',
      });
    }
  }

  /**
   * Check for setTimeout without clearTimeout
   */
  checkTimeouts(content, filePath) {
    const timeoutMatches = content.match(/setTimeout\s*\(/g) || [];
    const clearMatches = content.match(/clearTimeout\s*\(/g) || [];

    // Only warn if there are many timeouts without clears (some are intentional)
    if (timeoutMatches.length > 10 && clearMatches.length === 0) {
      this.warnings.push({
        file: filePath,
        issue: `Found ${timeoutMatches.length} setTimeout but no clearTimeout`,
        pattern: 'setTimeout without clearTimeout',
        severity: 'MEDIUM',
      });
    }
  }

  /**
   * Check for event listeners without removal
   */
  checkEventListeners(content, filePath) {
    const onMatches = content.match(/\.on\s*\(/g) || [];
    const removeMatches = content.match(/\.removeListener\s*\(|\.removeAllListeners\s*\(|\.off\s*\(/g) || [];

    if (onMatches.length > 5 && removeMatches.length === 0) {
      this.warnings.push({
        file: filePath,
        issue: `Found ${onMatches.length} event listeners but no removal`,
        pattern: '.on() without .removeListener() or .off()',
        severity: 'HIGH',
      });
    }
  }

  /**
   * Check for WebSocket listeners without cleanup
   */
  checkWebSocketListeners(content, filePath) {
    if (content.includes('WebSocket') || content.includes('ws.on')) {
      const hasCleanup = content.includes('removeAllListeners') || 
                        content.includes('close()') ||
                        content.includes('destroy()');
      
      if (!hasCleanup) {
        this.warnings.push({
          file: filePath,
          issue: 'WebSocket usage without cleanup method',
          pattern: 'WebSocket without cleanup',
          severity: 'HIGH',
        });
      }
    }
  }

  /**
   * Check for stream handlers without cleanup
   */
  checkStreamHandlers(content, filePath) {
    if (content.includes('createReadStream') || content.includes('createWriteStream')) {
      const hasCleanup = content.includes('.destroy()') || 
                        content.includes('.end()') ||
                        content.includes('.close()');
      
      if (!hasCleanup) {
        this.warnings.push({
          file: filePath,
          issue: 'Stream usage without cleanup',
          pattern: 'Stream without cleanup',
          severity: 'MEDIUM',
        });
      }
    }
  }

  /**
   * Check for uncaught promise rejections
   */
  checkUncaughtPromises(content, filePath) {
    // Check for promises without .catch() or try/catch
    const promiseMatches = content.match(/new Promise\s*\(/g) || [];
    const catchMatches = content.match(/\.catch\s*\(|try\s*{/g) || [];

    if (promiseMatches.length > catchMatches.length) {
      this.warnings.push({
        file: filePath,
        issue: `Found ${promiseMatches.length} promises but only ${catchMatches.length} error handlers`,
        pattern: 'Promise without .catch() or try/catch',
        severity: 'MEDIUM',
      });
    }
  }

  /**
   * Analyze a single file
   */
  analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(this.srcDir, filePath);

    this.filesChecked++;

    this.checkIntervals(content, relativePath);
    this.checkTimeouts(content, relativePath);
    this.checkEventListeners(content, relativePath);
    this.checkWebSocketListeners(content, relativePath);
    this.checkStreamHandlers(content, relativePath);
    this.checkUncaughtPromises(content, relativePath);
  }

  /**
   * Recursively scan directory
   */
  scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and dist
        if (entry.name !== 'node_modules' && entry.name !== 'dist') {
          this.scanDirectory(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        this.analyzeFile(fullPath);
      }
    }
  }

  /**
   * Print results
   */
  printResults() {
    console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}Files Checked: ${this.filesChecked}${colors.reset}`);
    console.log(`${colors.red}Critical Leaks: ${this.leaks.length}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${this.warnings.length}${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    if (this.leaks.length > 0) {
      console.log(`${colors.red}❌ CRITICAL MEMORY LEAKS:${colors.reset}\n`);
      this.leaks.forEach((leak, i) => {
        console.log(`${i + 1}. ${colors.red}[${leak.severity}]${colors.reset} ${leak.file}`);
        console.log(`   Pattern: ${colors.cyan}${leak.pattern}${colors.reset}`);
        console.log(`   Issue: ${leak.issue}\n`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(`${colors.yellow}⚠️  POTENTIAL MEMORY LEAKS:${colors.reset}\n`);
      
      // Group by severity
      const high = this.warnings.filter(w => w.severity === 'HIGH');
      const medium = this.warnings.filter(w => w.severity === 'MEDIUM');

      if (high.length > 0) {
        console.log(`${colors.red}HIGH PRIORITY:${colors.reset}\n`);
        high.forEach((w, i) => {
          console.log(`${i + 1}. ${w.file}`);
          console.log(`   Pattern: ${colors.cyan}${w.pattern}${colors.reset}`);
          console.log(`   Issue: ${w.issue}\n`);
        });
      }

      if (medium.length > 0) {
        console.log(`${colors.yellow}MEDIUM PRIORITY:${colors.reset}\n`);
        medium.forEach((w, i) => {
          console.log(`${i + 1}. ${w.file}`);
          console.log(`   Pattern: ${colors.cyan}${w.pattern}${colors.reset}`);
          console.log(`   Issue: ${w.issue}\n`);
        });
      }
    }

    if (this.leaks.length === 0 && this.warnings.length === 0) {
      console.log(`${colors.green}✅ No obvious memory leaks detected!${colors.reset}\n`);
    }
  }

  /**
   * Run the detector
   */
  run() {
    try {
      console.log(`${colors.blue}🧠 Memory Leak Detector${colors.reset}`);
      console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
      console.log(`${colors.cyan}Scanning: ${this.srcDir}${colors.reset}\n`);

      this.scanDirectory(this.srcDir);
      this.printResults();

      // Exit with error if there are critical leaks
      if (this.leaks.length > 0) {
        console.log(`${colors.red}❌ Build failed due to critical memory leaks.${colors.reset}\n`);
        process.exit(1);
      }

      // Warnings don't fail the build, but should be reviewed
      if (this.warnings.length > 0) {
        console.log(`${colors.yellow}⚠️  Review warnings above to prevent potential memory leaks.${colors.reset}\n`);
      }

      console.log(`${colors.green}✅ Memory leak detection passed!${colors.reset}\n`);
      process.exit(0);
    } catch (error) {
      console.error(`${colors.red}❌ Error running memory leak detector:${colors.reset}`, error);
      process.exit(1);
    }
  }
}

// Run the script
const detector = new MemoryLeakDetector();
detector.run();

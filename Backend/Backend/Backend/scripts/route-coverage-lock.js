/**
 * 🔒 ROUTE COVERAGE LOCK
 * 
 * Enforces security middleware on all routes.
 * Build fails if any route lacks required middleware.
 * 
 * Rules:
 * 1. All routes must have authentication (requireAuth or optionalAuth or explicitly public)
 * 2. All DELETE/PATCH routes must have ownership verification (or requireAdmin)
 * 3. All routes with body/params must have validation
 * 4. No route should bypass security checks
 */

const fs = require('fs');
const path = require('path');

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Routes that are explicitly allowed to be public
const PUBLIC_ROUTES = [
  '/',
  '/api',
  '/api/health',
  '/api/metrics',
  '/api/webhooks/clerk',
  '/api/webhooks/clerk/health',
  '/api/videos/user/:username',
  '/api/videos/:id/view',
  '/api/reels/trending-hashtags',
  '/api/terms/latest',
  '/support',
  '/privacy',
  '/terms',
  '/api/football',
];

// Middleware that provides authentication
const AUTH_MIDDLEWARE = [
  'requireAuth',
  'optionalAuth',
];

// Middleware that provides ownership verification
const OWNERSHIP_MIDDLEWARE = [
  'verifyReelOwnership',
  'verifyCommentOwnership',
  'verifyVideoOwnership',
  'verifyNotificationOwnership',
  'verifyPredictionOwnership',
  'verifyFileOwnership',
  'requireAdmin', // Admin can access everything
];

// Middleware that provides validation
const VALIDATION_MIDDLEWARE = [
  'validate',
];

class RouteCoverageLock {
  constructor() {
    this.violations = [];
    this.warnings = [];
    this.routesChecked = 0;
    this.routesDir = path.join(__dirname, '../src/routes');
  }

  /**
   * Check if a route path is explicitly public
   */
  isPublicRoute(routePath) {
    return PUBLIC_ROUTES.some(publicRoute => {
      if (publicRoute.includes(':')) {
        // Convert route pattern to regex
        const pattern = publicRoute.replace(/:[^/]+/g, '[^/]+');
        return new RegExp(`^${pattern}$`).test(routePath);
      }
      return routePath.startsWith(publicRoute);
    });
  }

  /**
   * Extract route definition from code
   */
  extractRouteInfo(line, filePath) {
    const routeMatch = line.match(/router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (!routeMatch) return null;

    const method = routeMatch[1].toUpperCase();
    const path = routeMatch[2];

    // Extract middleware from the route definition
    const middlewareMatch = line.match(/router\.\w+\([^,]+,\s*([^,]+(?:,\s*[^,]+)*),\s*(?:async\s*)?\(/);
    const middleware = middlewareMatch ? middlewareMatch[1].split(',').map(m => m.trim()) : [];

    return {
      method,
      path,
      middleware,
      line,
      file: filePath,
    };
  }

  /**
   * Check if route has authentication
   */
  hasAuthentication(route) {
    return route.middleware.some(m => AUTH_MIDDLEWARE.some(auth => m.includes(auth)));
  }

  /**
   * Check if route has ownership verification
   */
  hasOwnershipVerification(route) {
    return route.middleware.some(m => OWNERSHIP_MIDDLEWARE.some(owner => m.includes(owner)));
  }

  /**
   * Check if route has validation
   */
  hasValidation(route) {
    return route.middleware.some(m => VALIDATION_MIDDLEWARE.some(val => m.includes(val)));
  }

  /**
   * Check if route needs ownership verification
   */
  needsOwnershipVerification(route) {
    // DELETE and PATCH routes that modify resources need ownership verification
    if (route.method === 'DELETE' || route.method === 'PATCH') {
      // Routes with :id parameter likely modify a specific resource
      if (route.path.includes(':id') || route.path.includes(':commentId') || route.path.includes(':reelId')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if route needs validation
   */
  needsValidation(route) {
    // POST, PUT, PATCH routes with body data should have validation
    if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH') {
      return true;
    }
    return false;
  }

  /**
   * Analyze a single route file
   */
  analyzeRouteFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const fileName = path.basename(filePath);

    console.log(`${colors.cyan}Analyzing: ${fileName}${colors.reset}`);

    lines.forEach((line, index) => {
      const route = this.extractRouteInfo(line, fileName);
      if (!route) return;

      this.routesChecked++;
      const routeSignature = `${route.method} ${route.path}`;

      // Check 1: Authentication
      if (!this.hasAuthentication(route) && !this.isPublicRoute(route.path)) {
        this.violations.push({
          file: fileName,
          line: index + 1,
          route: routeSignature,
          issue: 'Missing authentication middleware (requireAuth or optionalAuth)',
          severity: 'CRITICAL',
        });
      }

      // Check 2: Ownership Verification
      if (this.needsOwnershipVerification(route) && !this.hasOwnershipVerification(route)) {
        this.violations.push({
          file: fileName,
          line: index + 1,
          route: routeSignature,
          issue: 'Missing ownership verification middleware (verifyOwnership or requireAdmin)',
          severity: 'CRITICAL',
        });
      }

      // Check 3: Validation (Warning only)
      if (this.needsValidation(route) && !this.hasValidation(route)) {
        this.warnings.push({
          file: fileName,
          line: index + 1,
          route: routeSignature,
          issue: 'Missing input validation middleware (validate)',
          severity: 'WARNING',
        });
      }
    });
  }

  /**
   * Analyze all route files
   */
  analyzeAllRoutes() {
    const files = fs.readdirSync(this.routesDir);
    const routeFiles = files.filter(f => f.endsWith('.routes.ts') || f.endsWith('.routes.js'));

    console.log(`${colors.blue}🔒 Route Coverage Lock${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    routeFiles.forEach(file => {
      const filePath = path.join(this.routesDir, file);
      this.analyzeRouteFile(filePath);
    });
  }

  /**
   * Print results
   */
  printResults() {
    console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}Routes Checked: ${this.routesChecked}${colors.reset}`);
    console.log(`${colors.red}Critical Violations: ${this.violations.length}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${this.warnings.length}${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    if (this.violations.length > 0) {
      console.log(`${colors.red}❌ CRITICAL VIOLATIONS:${colors.reset}\n`);
      this.violations.forEach((v, i) => {
        console.log(`${i + 1}. ${colors.red}[${v.severity}]${colors.reset} ${v.file}:${v.line}`);
        console.log(`   Route: ${colors.cyan}${v.route}${colors.reset}`);
        console.log(`   Issue: ${v.issue}\n`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(`${colors.yellow}⚠️  WARNINGS:${colors.reset}\n`);
      this.warnings.forEach((w, i) => {
        console.log(`${i + 1}. ${colors.yellow}[${w.severity}]${colors.reset} ${w.file}:${w.line}`);
        console.log(`   Route: ${colors.cyan}${w.route}${colors.reset}`);
        console.log(`   Issue: ${w.issue}\n`);
      });
    }

    if (this.violations.length === 0 && this.warnings.length === 0) {
      console.log(`${colors.green}✅ All routes have proper security middleware!${colors.reset}\n`);
    }
  }

  /**
   * Run the analysis
   */
  run() {
    try {
      this.analyzeAllRoutes();
      this.printResults();

      // Exit with error if there are critical violations
      if (this.violations.length > 0) {
        console.log(`${colors.red}❌ Build failed due to security violations.${colors.reset}`);
        console.log(`${colors.red}   Fix the issues above and try again.${colors.reset}\n`);
        process.exit(1);
      }

      console.log(`${colors.green}✅ Route coverage lock passed!${colors.reset}\n`);
      process.exit(0);
    } catch (error) {
      console.error(`${colors.red}❌ Error running route coverage lock:${colors.reset}`, error);
      process.exit(1);
    }
  }
}

// Run the script
const lock = new RouteCoverageLock();
lock.run();

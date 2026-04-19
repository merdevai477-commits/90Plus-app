/**
 * Search Diagnostics Utility
 * Tests all search functionality to identify issues
 */

import { getApiUrl } from '../config/api.config';
import { AuthService, ReelsService } from '../src/services/authService';

export interface SearchDiagnosticResult {
  endpoint: string;
  status: 'success' | 'error' | 'timeout';
  responseTime: number;
  error?: string;
  data?: any;
}

export class SearchDiagnostics {
  private static API_URL = getApiUrl();

  /**
   * Test all search endpoints
   */
  static async runFullDiagnostics(token: string): Promise<SearchDiagnosticResult[]> {
    const results: SearchDiagnosticResult[] = [];
    
    // Test queries
    const testQueries = ['messi', 'real madrid', 'barcelona', 'test'];
    
    for (const query of testQueries) {
      // Test user search
      results.push(await this.testUserSearch(token, query));
      
      // Test reels search
      results.push(await this.testReelsSearch(token, query));
      
      // Test hashtags search
      results.push(await this.testHashtagsSearch(token, query));
    }
    
    // Test trending hashtags (no auth required)
    results.push(await this.testTrendingHashtags());
    
    return results;
  }

  /**
   * Test user search endpoint
   */
  private static async testUserSearch(token: string, query: string): Promise<SearchDiagnosticResult> {
    const startTime = Date.now();
    
    try {
      const users = await AuthService.searchUsers(token, query, 5);
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: `/clerk/search?q=${query}`,
        status: 'success',
        responseTime,
        data: { count: users.length, users: users.slice(0, 2) }
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: `/clerk/search?q=${query}`,
        status: responseTime > 10000 ? 'timeout' : 'error',
        responseTime,
        error: error.message
      };
    }
  }

  /**
   * Test reels search endpoint
   */
  private static async testReelsSearch(token: string, query: string): Promise<SearchDiagnosticResult> {
    const startTime = Date.now();
    
    try {
      const result = await ReelsService.searchReels(token, query, 5, 'reels');
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: `/reels/search?q=${query}&type=reels`,
        status: 'success',
        responseTime,
        data: { 
          reelsCount: result.reels?.length || 0, 
          hashtagsCount: result.hashtags?.length || 0 
        }
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: `/reels/search?q=${query}&type=reels`,
        status: responseTime > 10000 ? 'timeout' : 'error',
        responseTime,
        error: error.message
      };
    }
  }

  /**
   * Test hashtags search endpoint
   */
  private static async testHashtagsSearch(token: string, query: string): Promise<SearchDiagnosticResult> {
    const startTime = Date.now();
    
    try {
      const result = await ReelsService.searchReels(token, query, 5, 'hashtags');
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: `/reels/search?q=${query}&type=hashtags`,
        status: 'success',
        responseTime,
        data: { 
          hashtagsCount: result.hashtags?.length || 0 
        }
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: `/reels/search?q=${query}&type=hashtags`,
        status: responseTime > 10000 ? 'timeout' : 'error',
        responseTime,
        error: error.message
      };
    }
  }

  /**
   * Test trending hashtags endpoint
   */
  private static async testTrendingHashtags(): Promise<SearchDiagnosticResult> {
    const startTime = Date.now();
    
    try {
      const hashtags = await AuthService.getTrendingHashtags();
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: '/reels/trending-hashtags',
        status: 'success',
        responseTime,
        data: { count: hashtags.length, hashtags: hashtags.slice(0, 3) }
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: '/reels/trending-hashtags',
        status: responseTime > 10000 ? 'timeout' : 'error',
        responseTime,
        error: error.message
      };
    }
  }

  /**
   * Test API connectivity
   */
  static async testApiConnectivity(): Promise<SearchDiagnosticResult> {
    const startTime = Date.now();
    
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.API_URL}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        return {
          endpoint: '/health',
          status: 'success',
          responseTime,
          data: { status: response.status }
        };
      } else {
        return {
          endpoint: '/health',
          status: 'error',
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // Check if it's an abort error (timeout)
      const isTimeout = error.name === 'AbortError' || responseTime > 5000;
      
      return {
        endpoint: '/health',
        status: isTimeout ? 'timeout' : 'error',
        responseTime,
        error: isTimeout ? 'Request timeout' : error.message
      };
    }
  }

  /**
   * Generate diagnostic report
   */
  static generateReport(results: SearchDiagnosticResult[]): string {
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const timeoutCount = results.filter(r => r.status === 'timeout').length;
    
    let report = `🔍 Search Diagnostics Report\n`;
    report += `================================\n`;
    report += `✅ Successful: ${successCount}\n`;
    report += `❌ Errors: ${errorCount}\n`;
    report += `⏰ Timeouts: ${timeoutCount}\n`;
    report += `📊 Total Tests: ${results.length}\n\n`;
    
    // Group by status
    const errors = results.filter(r => r.status === 'error');
    const timeouts = results.filter(r => r.status === 'timeout');
    const successes = results.filter(r => r.status === 'success');
    
    if (errors.length > 0) {
      report += `❌ ERRORS:\n`;
      errors.forEach(result => {
        report += `  • ${result.endpoint}: ${result.error} (${result.responseTime}ms)\n`;
      });
      report += `\n`;
    }
    
    if (timeouts.length > 0) {
      report += `⏰ TIMEOUTS:\n`;
      timeouts.forEach(result => {
        report += `  • ${result.endpoint}: ${result.error} (${result.responseTime}ms)\n`;
      });
      report += `\n`;
    }
    
    if (successes.length > 0) {
      report += `✅ SUCCESSFUL:\n`;
      successes.forEach(result => {
        report += `  • ${result.endpoint}: ${result.responseTime}ms\n`;
        if (result.data) {
          report += `    Data: ${JSON.stringify(result.data)}\n`;
        }
      });
    }
    
    return report;
  }
}
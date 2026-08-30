/**
 * Circuit Breaker Service
 * Prevents hammering the server when it's down
 * 
 * Issue #1: Backend 500 Errors - Circuit Breaker Pattern
 * - Opens circuit after 3 consecutive failures
 * - Stays open for 30 seconds
 * - Returns cached data when circuit is open
 */

import { logger } from './logger';
import { isAbortError } from '../utils/isAbortError';

interface CircuitState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  lastSuccessTime: number;
}

class CircuitBreakerService {
  private circuits = new Map<string, CircuitState>();
  private readonly FAILURE_THRESHOLD = 5; // Increased from 3 to 5 for Railway cold starts
  private readonly OPEN_DURATION = 30000; // 30 seconds
  private readonly HALF_OPEN_TIMEOUT = 5000; // 5 seconds

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const circuit = this.getCircuit(key);

    // Check circuit state
    if (circuit.state === 'OPEN') {
      const timeSinceFailure = Date.now() - circuit.lastFailureTime;
      
      if (timeSinceFailure < this.OPEN_DURATION) {
        logger.debug(`[CircuitBreaker] ⛔ Circuit OPEN for "${key}" (${Math.ceil((this.OPEN_DURATION - timeSinceFailure) / 1000)}s remaining)`);
        
        // Try fallback if available
        if (fallback) {
          try {
            return await fallback();
          } catch (fallbackError) {
            throw new Error(`Circuit breaker is open for "${key}". Service temporarily unavailable.`);
          }
        }
        
        throw new Error(`Circuit breaker is open for "${key}". Service temporarily unavailable.`);
      }
      
      // Transition to HALF_OPEN
      circuit.state = 'HALF_OPEN';
      logger.debug(`[CircuitBreaker] 🔄 Circuit HALF_OPEN for "${key}" - testing...`);
    }

    // Execute function
    try {
      const result = await fn();
      
      // Success - reset circuit
      this.recordSuccess(key);
      
      return result;
    } catch (error) {
      const message = String((error as Error)?.message ?? '');
      if (
        !isAbortError(error) &&
        !message.includes('timed out') &&
        !message.includes('timeout')
      ) {
        this.recordFailure(key);
      }
      
      // If circuit just opened and fallback available, try it
      const updatedCircuit = this.getCircuit(key);
      if (updatedCircuit.state === 'OPEN' && fallback) {
        logger.debug(`[CircuitBreaker] 🔄 Circuit opened, trying fallback for "${key}"`);
        try {
          return await fallback();
        } catch (fallbackError) {
          // Fallback also failed, throw original error
          throw error;
        }
      }
      
      throw error;
    }
  }

  /**
   * Get or create circuit state
   */
  private getCircuit(key: string): CircuitState {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
        lastSuccessTime: Date.now(),
      });
    }
    return this.circuits.get(key)!;
  }

  /**
   * Record a successful execution
   */
  private recordSuccess(key: string): void {
    const circuit = this.getCircuit(key);
    
    if (circuit.state === 'HALF_OPEN') {
      logger.debug(`[CircuitBreaker] ✅ Circuit CLOSED for "${key}" - service recovered`);
    }
    
    circuit.failures = 0;
    circuit.state = 'CLOSED';
    circuit.lastSuccessTime = Date.now();
  }

  /**
   * Record a failed execution
   */
  private recordFailure(key: string): void {
    const circuit = this.getCircuit(key);
    
    circuit.failures++;
    circuit.lastFailureTime = Date.now();

    if (circuit.failures >= this.FAILURE_THRESHOLD) {
      circuit.state = 'OPEN';
      logger.warn(`[CircuitBreaker] ⛔ Circuit OPEN for "${key}" after ${circuit.failures} failures`);
    } else {
      logger.debug(`[CircuitBreaker] ⚠️ Failure ${circuit.failures}/${this.FAILURE_THRESHOLD} for "${key}"`);
    }
  }

  /**
   * Check if circuit is open
   */
  isOpen(key: string): boolean {
    const circuit = this.getCircuit(key);
    
    if (circuit.state === 'OPEN') {
      const timeSinceFailure = Date.now() - circuit.lastFailureTime;
      return timeSinceFailure < this.OPEN_DURATION;
    }
    
    return false;
  }

  /**
   * Manually reset a circuit
   */
  reset(key: string): void {
    this.circuits.delete(key);
    logger.debug(`[CircuitBreaker] 🔄 Circuit reset for "${key}"`);
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    this.circuits.clear();
    logger.debug('[CircuitBreaker] 🔄 All circuits reset');
  }

  /**
   * Get status of all circuits
   */
  getStatus(): Record<string, CircuitState> {
    const status: Record<string, CircuitState> = {};
    this.circuits.forEach((state, key) => {
      status[key] = { ...state };
    });
    return status;
  }
}

export const circuitBreakerService = new CircuitBreakerService();
export default circuitBreakerService;

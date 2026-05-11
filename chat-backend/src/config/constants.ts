export const CONSTANTS = {
  // AI Models
  MODELS: {
    FAST: 'llama-3.1-8b-instant',          // Groq
    BALANCED: 'google/gemma-2-27b-it',      // OpenRouter
    COMPLEX: 'nvidia/nemotron-4-340b-instruct', // OpenRouter
    FALLBACK: 'google/gemini-2.5-flash',    // OpenRouter
  },
  
  // Cache TTLs
  CACHE: {
    QA_TTL_SECONDS: 60 * 60 * 24 * 30, // 30 days
    SIMILARITY_THRESHOLD: 0.85,
  },
  
  // Queue Settings
  QUEUE: {
    CONCURRENCY: 10,
    TIMEOUT_MS: 60000, // 60 seconds
  },
  
  // Rate Limiting
  RATE_LIMIT: {
    GLOBAL_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    GLOBAL_MAX_REQUESTS: 100,
    CHAT_WINDOW_MS: 60 * 1000,        // 1 minute
    CHAT_MAX_REQUESTS: 20,
  },
  
  // AI Timeouts
  AI: {
    REQUEST_TIMEOUT_MS: 30000, // 30 seconds
    MAX_RETRIES: 2,
  }
};

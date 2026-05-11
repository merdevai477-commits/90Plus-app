import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from './logger.service.js';
import { CONSTANTS } from '../config/constants.js';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderConfig {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  GROQ: {
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: env.GROQ_API_KEY || '',
    model: CONSTANTS.MODELS.FAST,
  },
  OPENROUTER_GEMMA: {
    name: 'OpenRouter (Gemma 27B)',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: env.OPENROUTER_API_KEY || '',
    model: CONSTANTS.MODELS.BALANCED,
  },
  OPENROUTER_NEMOTRON: {
    name: 'OpenRouter (Nemotron 120B)',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: env.OPENROUTER_API_KEY || '',
    model: CONSTANTS.MODELS.COMPLEX,
  },
  OPENROUTER_GEMINI: {
    name: 'OpenRouter (Gemini Flash)',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: env.OPENROUTER_API_KEY || '',
    model: CONSTANTS.MODELS.FALLBACK,
  },
};

const FALLBACK_CHAIN = [
  PROVIDERS.GROQ,
  PROVIDERS.OPENROUTER_GEMMA,
  PROVIDERS.OPENROUTER_NEMOTRON,
  PROVIDERS.OPENROUTER_GEMINI,
];

class AIOrchestrator {
  /**
   * Smart routing logic based on question length
   */
  private selectPrimaryProvider(question: string): ProviderConfig[] {
    const wordCount = question.trim().split(/\s+/).length;
    let primary: ProviderConfig;

    if (wordCount < 5) {
      primary = PROVIDERS.GROQ;
    } else if (wordCount >= 5 && wordCount <= 15) {
      primary = PROVIDERS.OPENROUTER_GEMMA;
    } else {
      primary = PROVIDERS.OPENROUTER_NEMOTRON;
    }

    // Return primary first, then the rest of the chain excluding the primary
    return [primary, ...FALLBACK_CHAIN.filter((p) => p.name !== primary.name)];
  }

  /**
   * Generates a streaming response with automatic fallback
   */
  async *streamChat(
    question: string,
    history: Message[],
    systemPrompt: string
  ): AsyncGenerator<{ token: string; done: boolean; modelUsed?: string }> {
    const providers = this.selectPrimaryProvider(question);
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: question },
    ];

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < providers.length; attempt++) {
      const provider = providers[attempt];
      logger.info(`🤖 Attempting AI generation with: ${provider.name} (${provider.model})`);

      try {
        const client = new OpenAI({
          apiKey: provider.apiKey,
          baseURL: provider.baseURL,
          timeout: CONSTANTS.AI.REQUEST_TIMEOUT_MS,
          maxRetries: CONSTANTS.AI.MAX_RETRIES,
          defaultHeaders: {
            'HTTP-Referer': env.FRONTEND_URL,
            'X-Title': '90Plus AI Chat',
          },
        });

        const stream = await client.chat.completions.create({
          model: provider.model,
          messages,
          stream: true,
          temperature: 0.4,
          max_tokens: 500,
        });

        // If we got here, connection was successful
        let isFirstToken = true;
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            if (isFirstToken) {
               // Include model name on first token for analytics tracking
               yield { token: content, done: false, modelUsed: provider.name };
               isFirstToken = false;
            } else {
               yield { token: content, done: false };
            }
          }
        }

        yield { token: '', done: true };
        logger.info(`✅ Successfully generated stream using ${provider.name}`);
        return; // Success, exit the generator
      } catch (error: any) {
        lastError = error;
        logger.warn(`⚠️ Provider ${provider.name} failed: ${error.message}`);
        // Fallback to the next provider in the loop
        continue;
      }
    }

    // If all providers failed
    logger.error('❌ All AI providers failed in fallback chain', lastError);
    yield {
      token: 'عذراً، أواجه مشكلة في الاتصال بالخوادم حالياً. أرجو المحاولة بعد قليل.',
      done: true,
    };
  }
}

export const aiOrchestrator = new AIOrchestrator();

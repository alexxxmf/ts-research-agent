import axios, { AxiosInstance } from 'axios';
import type {
  LLMProvider as ILLMProvider,
  LLMGenerateOptions,
  ModelInfo,
  LLMError
} from '../types/index.js';

// Model pricing per 1M tokens (prompt, completion)
// Updated: 2025-12-09
const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  'meta-llama/llama-3.1-8b-instruct': { prompt: 0.02, completion: 0.03 },
  'google/gemini-2.5-flash-preview-09-2025': { prompt: 0.30, completion: 2.50 },
  'deepseek/deepseek-chat': { prompt: 0.30, completion: 1.20 },
  'deepseek/deepseek-chat-v3.1': { prompt: 0.15, completion: 0.75 },
  'deepseek/deepseek-reasoner': { prompt: 0.55, completion: 2.19 },
  'openai/gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
  'qwen/qwen-2.5-72b-instruct': { prompt: 0.35, completion: 0.40 },
  // Fallback for old model IDs
  'google/gemini-flash-1.5': { prompt: 0.30, completion: 2.50 }
};

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LLMProvider implements ILLMProvider {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/research-agent',
        'X-Title': 'Research Agent'
      },
      timeout: 120000 // 2 minutes
    });
  }

  /**
   * Generate completion from OpenRouter
   */
  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<string> {
    const {
      model = 'meta-llama/llama-3.1-8b-instruct',
      temperature = 0.7,
      maxTokens = 4096,
      systemPrompt
    } = options;

    const messages = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    messages.push({
      role: 'user',
      content: prompt
    });

    let lastError: Error | null = null;
    const maxRetries = 3;
    const baseDelay = 100;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.client.post<OpenRouterResponse>('/chat/completions', {
          model,
          messages,
          temperature,
          max_tokens: maxTokens
        });

        const content = response.data.choices[0]?.message?.content;

        if (!content) {
          throw new Error('Empty response from LLM');
        }

        return content.trim();
      } catch (error: any) {
        lastError = error;

        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt);

          if (attempt < maxRetries - 1) {
            await this.sleep(delay);
            continue;
          }
        }

        // Handle server errors with retry
        if (error.response?.status >= 500 && attempt < maxRetries - 1) {
          await this.sleep(baseDelay * Math.pow(2, attempt));
          continue;
        }

        // Don't retry on client errors (400-499 except 429)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          break;
        }

        // Retry on network errors
        if (attempt < maxRetries - 1) {
          await this.sleep(baseDelay * Math.pow(2, attempt));
          continue;
        }
      }
    }

    // If we get here, all retries failed
    const errorMessage = lastError?.message || 'Unknown LLM error';
    const errorDetails = (lastError as any)?.response?.data || {};

    throw {
      name: 'LLMError',
      message: `LLM generation failed after ${maxRetries} attempts: ${errorMessage}`,
      code: 'LLM_ERROR',
      details: errorDetails
    } as LLMError;
  }

  /**
   * Estimate token count (rough approximation)
   * ~4 characters per token on average
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get model pricing information
   */
  getModelInfo(modelId: string): ModelInfo {
    const pricing = MODEL_PRICING[modelId] || { prompt: 0, completion: 0 };

    return {
      id: modelId,
      pricing
    };
  }

  /**
   * Calculate cost for a completion
   */
  calculateCost(modelId: string, promptTokens: number, completionTokens: number): number {
    const info = this.getModelInfo(modelId);
    const promptCost = (promptTokens / 1_000_000) * info.pricing.prompt;
    const completionCost = (completionTokens / 1_000_000) * info.pricing.completion;
    return promptCost + completionCost;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

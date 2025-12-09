import type { CostBreakdown } from '../types/index.js';

interface UsageEntry {
  step: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

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

export class CostEstimator {
  private usageLog: UsageEntry[] = [];
  private enabled: boolean;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  /**
   * Log token usage for a step
   */
  logUsage(step: string, model: string, promptTokens: number, completionTokens: number): void {
    if (!this.enabled) return;

    this.usageLog.push({
      step,
      model,
      promptTokens,
      completionTokens
    });
  }

  /**
   * Calculate cost for a specific model and token counts
   */
  calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = MODEL_PRICING[model] || { prompt: 0, completion: 0 };
    const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
    const completionCost = (completionTokens / 1_000_000) * pricing.completion;
    return promptCost + completionCost;
  }

  /**
   * Estimate tokens in text (rough approximation)
   * ~4 characters per token on average
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate cost breakdown report
   */
  getBreakdown(): CostBreakdown | undefined {
    if (!this.enabled || this.usageLog.length === 0) return undefined;

    const breakdown = this.usageLog.map(entry => {
      const cost = this.calculateCost(entry.model, entry.promptTokens, entry.completionTokens);
      const tokens = entry.promptTokens + entry.completionTokens;

      return {
        step: entry.step,
        model: entry.model,
        tokens,
        cost
      };
    });

    const totalTokens = breakdown.reduce((sum, entry) => sum + entry.tokens, 0);
    const estimatedCost = breakdown.reduce((sum, entry) => sum + entry.cost, 0);

    return {
      totalTokens,
      estimatedCost,
      breakdown
    };
  }

  /**
   * Format cost breakdown as human-readable string
   */
  formatBreakdown(): string {
    const breakdown = this.getBreakdown();
    if (!breakdown) return '';

    let output = '\n💰 Cost Breakdown:\n';
    output += '─'.repeat(60) + '\n';

    breakdown.breakdown.forEach(entry => {
      const costStr = `$${entry.cost.toFixed(4)}`;
      const tokensStr = entry.tokens.toLocaleString();
      output += `  ${entry.step.padEnd(20)} | ${entry.model.padEnd(25)} | ${tokensStr.padStart(8)} tokens | ${costStr}\n`;
    });

    output += '─'.repeat(60) + '\n';
    output += `  Total: ${breakdown.totalTokens.toLocaleString()} tokens | $${breakdown.estimatedCost.toFixed(4)}\n`;

    return output;
  }

  /**
   * Reset usage log
   */
  reset(): void {
    this.usageLog = [];
  }

  /**
   * Get total cost so far
   */
  getTotalCost(): number {
    const breakdown = this.getBreakdown();
    return breakdown?.estimatedCost ?? 0;
  }

  /**
   * Get total tokens so far
   */
  getTotalTokens(): number {
    const breakdown = this.getBreakdown();
    return breakdown?.totalTokens ?? 0;
  }
}

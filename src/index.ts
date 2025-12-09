/**
 * Research Agent - Deep research powered by SearXNG, Jina.ai, and OpenRouter
 *
 * A TypeScript library for conducting deep, multi-round research with configurable depth levels.
 *
 * @packageDocumentation
 */

// Main exports
export { ResearchAgent, createResearchAgent } from './ResearchAgent.js';

// Type exports
export type {
  // Configuration
  ResearchAgentConfig,
  ModelConfig,
  SearchConfig,
  PersistenceConfig,

  // Research
  ResearchOptions,
  ResearchResult,
  ResearchMetadata,
  ResearchDepth,

  // Progress tracking
  ProgressEvent,
  ProgressCallback,
  ProgressStage,

  // Models and agents
  ModelTier,
  AgentType,

  // Results
  CostBreakdown,
  SearchResult,
  ScrapedContent,

  // Providers (for advanced usage)
  LLMProvider,
  SearchProvider,
  ScraperProvider,
  CacheProvider,

  // Errors
  ResearchAgentError,
  RateLimitError,
  SearchError,
  LLMError
} from './types/index.js';

// Constants
export { DEFAULT_MODELS, DEFAULT_AGENT_TIERS, DEPTH_CONFIGS } from './types/index.js';

// Version
export const VERSION = '1.0.0';

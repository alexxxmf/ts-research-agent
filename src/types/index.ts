// ============================================================================
// Core Configuration Types
// ============================================================================

export type ModelTier = 'small' | 'medium' | 'large';
export type AgentType = 'planner' | 'parser' | 'summarizer' | 'evaluator' | 'filter' | 'reporter';
export type ResearchDepth = 'shallow' | 'normal' | 'deep';

export interface ModelConfig {
  // Option 1: Simple tier selection (uses defaults)
  tiers?: {
    planner?: ModelTier;
    parser?: ModelTier;
    summarizer?: ModelTier;
    evaluator?: ModelTier;
    filter?: ModelTier;
    reporter?: ModelTier;
  };

  // Option 2: Override with specific OpenRouter model IDs
  customModels?: {
    planner?: string;
    parser?: string;
    summarizer?: string;
    evaluator?: string;
    filter?: string;
    reporter?: string;
  };

  // Option 3: Override the default tier mappings globally
  tierModels?: {
    small?: string;
    medium?: string;
    large?: string;
  };
}

export interface SearchConfig {
  instances: string[];
  priorityOrder?: boolean;
  maxRetries?: number;
  timeout?: number;
}

export interface PersistenceConfig {
  enabled: boolean;
  storagePath: string;
  cacheDuration?: number;
  resumable?: boolean;
}

export interface ResearchAgentConfig {
  openRouterKey: string;
  searxngConfig: SearchConfig;
  model?: ModelConfig;
  depth?: ResearchDepth;
  persistence?: PersistenceConfig;
  maxConcurrentScrapes?: number;
}

// ============================================================================
// Research Options & Results
// ============================================================================

export interface ResearchOptions {
  depth?: ResearchDepth;
  onProgress?: ProgressCallback;
  enableCostTracking?: boolean;
  customPrompts?: Partial<PromptSet>;
  signal?: AbortSignal; // Allow cancellation
  allowPartialResults?: boolean; // Return partial results on error
}

export interface ResearchResult {
  report: string;
  metadata: ResearchMetadata;
}

export interface ResearchMetadata {
  queriesExecuted: string[];
  sourcesScraped: number;
  totalDuration: number;
  rounds: number;
  costs?: CostBreakdown;
  partial?: boolean; // Indicates if result is partial due to error
  error?: string; // Error message if partial result
}

export interface CostBreakdown {
  totalTokens: number;
  estimatedCost: number;
  breakdown: Array<{
    step: string;
    model: string;
    tokens: number;
    cost: number;
  }>;
}

// ============================================================================
// Progress Tracking
// ============================================================================

export type ProgressStage = 'planning' | 'searching' | 'scraping' | 'summarizing' | 'evaluating' | 'reporting';

export interface ProgressEvent {
  stage: ProgressStage;
  message: string;
  progress: number;
  details?: any;
}

export type ProgressCallback = (event: ProgressEvent) => void;

// ============================================================================
// Search & Scraping Types
// ============================================================================

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}

export interface ScrapedContent {
  title: string;
  url: string;
  content: string;
  cached?: boolean;
  qualityScore?: number; // 0-100 score based on content quality
  duplicate?: boolean; // Flag if URL was seen before
}

export interface RankedSource {
  index: number;
  relevance: 'high' | 'medium' | 'low';
  reason: string;
}

// ============================================================================
// LLM Response Types (JSON schemas)
// ============================================================================

export interface PlanningResponse {
  analysis: string;
  queries: Array<{
    query: string;
    purpose: string;
    priority: number;
  }>;
  synthesis_note: string;
}

export interface EvaluationResponse {
  summary: string;
  gaps: Array<{
    type: 'entity' | 'conceptual';
    description: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  follow_up_queries: Array<{
    query: string;
    rationale: string;
    priority: number;
  }>;
  goal_met: boolean;
}

export interface FilteringResponse {
  ranked_sources: Array<{
    index: number;
    relevance: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  excluded: Array<{
    index: number;
    reason: string;
  }>;
}

export interface SummaryResponse {
  summary: string;
  key_takeaway: string;
  relevance: 'high' | 'medium' | 'low';
}

// ============================================================================
// Provider Interfaces
// ============================================================================

export interface LLMProvider {
  generate(prompt: string, options?: LLMGenerateOptions): Promise<string>;
  estimateTokens(text: string): number;
  getModelInfo(modelId: string): ModelInfo;
}

export interface LLMGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ModelInfo {
  id: string;
  pricing: {
    prompt: number;
    completion: number;
  };
}

export interface SearchProvider {
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

export interface ScraperProvider {
  scrape(url: string): Promise<string>;
  scrapeMany(results: SearchResult[]): Promise<ScrapedContent[]>;
}

// ============================================================================
// Caching Types
// ============================================================================

export interface CacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

export interface SessionState {
  id: string;
  query: string;
  currentRound: number;
  executedQueries: string[];
  scrapedUrls: string[];
  summaries: string[];
  updatedAt: number;
}

// ============================================================================
// Depth Configuration
// ============================================================================

export interface DepthConfig {
  initialQueries: { min: number; max: number };
  resultsPerQuery: { min: number; max: number };
  maxRounds: number;
  modelTierBoost: number;
}

export const DEPTH_CONFIGS: Record<ResearchDepth, DepthConfig> = {
  shallow: {
    initialQueries: { min: 2, max: 3 },
    resultsPerQuery: { min: 3, max: 5 },
    maxRounds: 1,
    modelTierBoost: 0
  },
  normal: {
    initialQueries: { min: 3, max: 5 },
    resultsPerQuery: { min: 5, max: 8 },
    maxRounds: 2,
    modelTierBoost: 0
  },
  deep: {
    initialQueries: { min: 5, max: 7 },
    resultsPerQuery: { min: 8, max: 12 },
    maxRounds: 3,
    modelTierBoost: 1
  }
};

// ============================================================================
// Default Model Mappings
// ============================================================================

export const DEFAULT_MODELS: Record<ModelTier, string> = {
  small: 'meta-llama/llama-3.1-8b-instruct',  // $0.02/$0.03 per 1M tokens
  medium: 'google/gemini-2.5-flash-preview-09-2025',  // $0.30/$2.50 per 1M tokens
  large: 'deepseek/deepseek-chat'  // $0.30/$1.20 per 1M tokens
};

export const DEFAULT_AGENT_TIERS: Record<AgentType, ModelTier> = {
  planner: 'medium',
  parser: 'small',
  summarizer: 'small',
  evaluator: 'medium',
  filter: 'small',
  reporter: 'large'
};

// ============================================================================
// Prompt Set
// ============================================================================

export interface PromptSet {
  planning: string;
  summarizer: string;
  evaluator: string;
  filter: string;
  reporter: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class ResearchAgentError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'ResearchAgentError';
  }
}

export class RateLimitError extends ResearchAgentError {
  constructor(message: string, details?: any) {
    super(message, 'RATE_LIMIT', details);
    this.name = 'RateLimitError';
  }
}

export class SearchError extends ResearchAgentError {
  constructor(message: string, details?: any) {
    super(message, 'SEARCH_ERROR', details);
    this.name = 'SearchError';
  }
}

export class LLMError extends ResearchAgentError {
  constructor(message: string, details?: any) {
    super(message, 'LLM_ERROR', details);
    this.name = 'LLMError';
  }
}

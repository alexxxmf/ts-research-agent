import type {
  ResearchAgentConfig,
  ResearchOptions,
  ResearchResult,
  SearchConfig
} from './types/index.js';
import { LLMProvider } from './providers/LLMProvider.js';
import { SearchProvider } from './providers/SearchProvider.js';
import { ScraperProvider } from './providers/ScraperProvider.js';
import { Cache } from './utils/Cache.js';
import { Pipeline } from './orchestrator/Pipeline.js';

/**
 * Main ResearchAgent class
 *
 * A deep research agent that uses SearXNG for search, Jina.ai for scraping,
 * and OpenRouter for LLM-powered analysis and report generation.
 *
 * @example
 * ```typescript
 * const agent = new ResearchAgent({
 *   openRouterKey: 'your-key',
 *   searxngConfig: {
 *     instances: ['https://searx.example.com'],
 *   }
 * });
 *
 * const result = await agent.research('What are the benefits of using creatine?', {
 *   depth: 'normal',
 *   onProgress: (event) => console.log(event.message)
 * });
 *
 * console.log(result.report);
 * ```
 */
export class ResearchAgent {
  private llm: LLMProvider;
  private search: SearchProvider;
  private scraper: ScraperProvider;
  private cache: Cache;
  private pipeline: Pipeline;
  private config: ResearchAgentConfig;

  constructor(config: ResearchAgentConfig) {
    this.validateConfig(config);
    this.config = config;

    // Initialize providers
    this.llm = new LLMProvider(config.openRouterKey);
    this.search = new SearchProvider(config.searxngConfig);
    this.scraper = new ScraperProvider(config.maxConcurrentScrapes ?? 20);
    this.cache = new Cache(config.persistence);

    // Initialize pipeline
    this.pipeline = new Pipeline(
      this.llm,
      this.search,
      this.scraper,
      this.cache,
      config.model
    );
  }

  /**
   * Execute a research query
   *
   * @param query - The research question or topic
   * @param options - Research options (depth, progress callback, etc.)
   * @returns Research result with report and metadata
   */
  async research(query: string, options: ResearchOptions = {}): Promise<ResearchResult> {
    if (!query || query.trim().length === 0) {
      throw new Error('Research query cannot be empty');
    }

    const depth = options.depth || this.config.depth || 'normal';
    const enableCostTracking = options.enableCostTracking ?? false;

    const result = await this.pipeline.execute(query, {
      ...options,
      depth,
      enableCostTracking
    });

    return result;
  }

  /**
   * Close and cleanup resources
   */
  close(): void {
    this.cache.close();
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: ResearchAgentConfig): void {
    if (!config.openRouterKey || config.openRouterKey.trim().length === 0) {
      throw new Error('OpenRouter API key is required');
    }

    if (!config.searxngConfig || !config.searxngConfig.instances || config.searxngConfig.instances.length === 0) {
      throw new Error('At least one SearXNG instance must be provided');
    }

    // Validate instances are URLs
    config.searxngConfig.instances.forEach(instance => {
      try {
        new URL(instance);
      } catch (error) {
        throw new Error(`Invalid SearXNG instance URL: ${instance}`);
      }
    });

    // Validate persistence config if enabled
    if (config.persistence?.enabled && !config.persistence?.storagePath) {
      throw new Error('storagePath is required when persistence is enabled');
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ResearchAgentConfig {
    return { ...this.config };
  }

  /**
   * Update SearXNG instances
   */
  updateSearchInstances(instances: string[]): void {
    if (!instances || instances.length === 0) {
      throw new Error('At least one SearXNG instance must be provided');
    }

    this.config.searxngConfig.instances = instances;
    this.search = new SearchProvider(this.config.searxngConfig);

    // Recreate pipeline with new search provider
    this.pipeline = new Pipeline(
      this.llm,
      this.search,
      this.scraper,
      this.cache,
      this.config.model
    );
  }
}

// Export default instance creator for convenience
export function createResearchAgent(config: ResearchAgentConfig): ResearchAgent {
  return new ResearchAgent(config);
}

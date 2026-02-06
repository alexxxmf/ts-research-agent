# Coding Conventions

**Analysis Date:** 2026-02-06

## Naming Patterns

**Files:**
- PascalCase for class-based files: `ResearchAgent.ts`, `LLMProvider.ts`, `Cache.ts`
- camelCase for utility/helper files: `prompts.ts`, `constants.ts`, `types.ts`
- Index files export all public types/classes: `src/types/index.ts`, `src/index.ts`
- Example: `src/providers/LLMProvider.ts`, `src/utils/Cache.ts`, `src/orchestrator/Pipeline.ts`

**Classes:**
- PascalCase: `ResearchAgent`, `LLMProvider`, `SearchProvider`, `ScraperProvider`, `Cache`, `Pipeline`, `RateLimiter`, `CostEstimator`, `QualityScorer`, `ConsoleFormatter`
- Example from `src/providers/LLMProvider.ts`: class implements interface with `implements ILLMProvider` pattern

**Functions:**
- camelCase for regular functions and methods: `generateSimpleDateContext()`, `categorizeModelsByPrice()`, `searchModels()`, `fetchAvailableModels()`
- Static utility methods in classes: `QualityScorer.scoreContent()`, `ConsoleFormatter.success()`, `ConsoleFormatter.warning()`
- Private methods prefixed with underscore: `private sleep()`, `private calculateCost()`, `private hashPrompt()`, `private cleanup()`
- Example from `src/ResearchAgent.ts`: `async research()`, `private validateConfig()`, `getConfig()`, `updateSearchInstances()`

**Variables:**
- camelCase for all variables: `openRouterKey`, `searxngConfig`, `maxConcurrentScrapes`, `enableCostTracking`, `onProgress`, `maxRetries`, `lastError`, `totalRetryCount`
- SCREAMING_SNAKE_CASE for constants: `JINA_BASE`, `DEFAULT_MODELS`, `DEFAULT_AGENT_TIERS`, `MODEL_PRICING`, `DEPTH_CONFIGS`
- Example from `src/providers/ScraperProvider.ts`: `const JINA_BASE = 'https://r.jina.ai/'`
- Example from `src/types/index.ts`: `export const DEFAULT_MODELS`, `export const DEPTH_CONFIGS`

**Types/Interfaces:**
- PascalCase for all types and interfaces: `ResearchAgentConfig`, `SearchConfig`, `PersistenceConfig`, `ResearchOptions`, `ResearchResult`, `ProgressEvent`, `LLMProvider`, `CacheProvider`
- Suffix pattern: Config types end in `Config`, Provider types end in `Provider`, Response types end in `Response`
- Union types in type aliases: `type ResearchDepth = 'shallow' | 'normal' | 'deep'`, `type ProgressStage = 'planning' | 'searching' | ...`
- Example from `src/types/index.ts`: `export interface ResearchAgentConfig`, `export type ResearchDepth`

## Code Style

**Formatting:**
- No explicit formatter configured (no .prettierrc or eslint config found)
- 2-space indentation (inferred from source files)
- Semicolons used throughout
- Trailing commas in multi-line objects/arrays
- Single quotes for strings: `'https://openrouter.ai/api/v1'`
- Template literals for string interpolation: `` `${variable}` ``

**Linting:**
- No explicit linting tool configured (no .eslintrc file)
- Strict TypeScript mode enabled in `tsconfig.json`:
  - `"strict": true`
  - `"forceConsistentCasingInFileNames": true`
  - `"isolatedModules": true`
  - `"declaration": true` (generates .d.ts files)

**Import Organization:**
- Order: Standard library → Third-party → Internal type imports → Internal imports
- Example from `src/providers/LLMProvider.ts`:
  ```typescript
  import axios, { AxiosInstance } from 'axios';
  import type {
    LLMProvider as ILLMProvider,
    LLMGenerateOptions,
    ModelInfo,
    LLMError
  } from '../types/index.js';
  ```
- Pattern: `import type { ... }` for type-only imports, separated from runtime imports
- ES6 module imports with `.js` extensions: `from './ResearchAgent.js'`, `from '../types/index.js'`
- Import interfaces with `as I` suffix when implementing: `LLMProvider as ILLMProvider`

**Path Aliases:**
- Relative imports only, no path aliases configured
- Consistent use of `../` for parent directories and `./` for same-directory imports
- Example: `from '../types/index.js'`, `from './utils/Cache.js'`

## Error Handling

**Patterns:**
- Custom error classes extend base `ResearchAgentError`: `RateLimitError`, `SearchError`, `LLMError`
- Error class pattern in `src/types/index.ts`:
  ```typescript
  export class ResearchAgentError extends Error {
    constructor(message: string, public code: string, public details?: any) {
      super(message);
      this.name = 'ResearchAgentError';
    }
  }
  ```
- Throw custom error objects with `code` and `details` properties:
  ```typescript
  throw {
    name: 'LLMError',
    message: `LLM generation failed after ${maxRetries} attempts: ${errorMessage}`,
    code: 'LLM_ERROR',
    details: errorDetails
  } as LLMError;
  ```
- Try-catch blocks with graceful degradation:
  - Cache errors logged but don't crash: `console.warn('Cache get error:', error); return null;`
  - Search failures retry across multiple instances before throwing
  - Scrape failures fall back to snippet content: `result.snippet || 'Content unavailable'`
- Validation errors thrown with descriptive messages:
  ```typescript
  if (!config.openRouterKey || config.openRouterKey.trim().length === 0) {
    throw new Error('OpenRouter API key is required');
  }
  ```
- Partial result recovery in Pipeline: `allowPartialResults` flag allows returning partial results on error

## Logging

**Framework:** Console methods (`console.log`, `console.warn`, `console.error`)

**Patterns:**
- Structured console output with emoji indicators:
  - `✅` for success: `console.log(`✅ Search succeeded for "${query}" after ${totalRetryCount} retries`)`
  - `⚠️` for warnings: `console.log(`⚠️ Search retry ${totalRetryCount}...`)`
  - `❌` for errors: `console.error(`❌ Search failed for "${query}"...`)`
- ConsoleFormatter utility for consistent stage-based logging in `src/utils/ConsoleFormatter.ts`:
  - `ConsoleFormatter.success()`, `ConsoleFormatter.warning()`, `ConsoleFormatter.info()`, `ConsoleFormatter.stat()`
  - ANSI color codes for terminal output (detects color support)
- Progress callbacks passed to Pipeline for user-facing messages:
  ```typescript
  onProgress({ stage: 'planning', message: 'Analyzing query...', progress: 10 });
  ```
- Silent failures for non-critical operations (cache, scraping fallbacks)
- Verbose logging after multiple retries (>2) to avoid log spam:
  ```typescript
  if (totalRetryCount > 2) {
    console.log(`⚠️ Search retry...`);
  }
  ```

## Comments

**When to Comment:**
- Function documentation: JSDoc blocks with `@param`, `@returns` annotations
- Complex logic requiring explanation: Inline comments for retry logic, scoring algorithms
- Section dividers for grouping related code: `// ============================================================================`
- Example from `src/utils/Cache.ts`: `// Check if cache is still valid`
- Example from `src/providers/LLMProvider.ts`: `// Handle rate limiting`, `// Retry on network errors`

**JSDoc/TSDoc:**
- All public methods documented with JSDoc blocks
- Format: `/** Comment here */` on line before method
- Examples from `src/ResearchAgent.ts`:
  ```typescript
  /**
   * Execute a research query
   *
   * @param query - The research question or topic
   * @param options - Research options (depth, progress callback, etc.)
   * @returns Research result with report and metadata
   */
  async research(query: string, options: ResearchOptions = {}): Promise<ResearchResult>
  ```
- Package-level documentation in `src/index.ts`:
  ```typescript
  /**
   * Research Agent - Deep research powered by SearXNG, Jina.ai, and OpenRouter
   *
   * @packageDocumentation
   */
  ```

## Function Design

**Size:** Functions typically 20-50 lines; larger orchestration functions (Pipeline.execute) up to 200+ lines with clear step markers

**Parameters:**
- Typed parameters with `type` imports: `query: string`, `options: ResearchOptions = {}`
- Optional parameters with `?`: `limit?: number`, `ttl?: number`
- Default values: `limit: number = 10`, `temperature = 0.7`
- Destructuring for complex config: `const { model = 'llama-3.1', temperature = 0.7, maxTokens = 4096 } = options`

**Return Values:**
- Explicit return types: `async research(...): Promise<ResearchResult>`
- Typed returns with unions: `Promise<SearchResult[]>`, `Promise<string | null>`
- Null for cache misses: `return null` instead of undefined
- Typed objects returned: `return { id, pricing }`

## Module Design

**Exports:**
- Barrel export pattern in `src/index.ts` - exports all public APIs from one location
- Type and class exports separated:
  ```typescript
  export { ResearchAgent, createResearchAgent } from './ResearchAgent.js';
  export type { ResearchAgentConfig, ModelConfig, ... } from './types/index.js';
  ```
- Constants exported alongside types: `export { DEFAULT_MODELS, DEFAULT_AGENT_TIERS, DEPTH_CONFIGS }`
- Example from `src/index.ts`: Re-exports and re-types for public API surface

**Barrel Files:**
- `src/index.ts` - main public API
- `src/types/index.ts` - all type definitions and constants centralized
- `src/config/prompts.ts` - prompt templates (not a barrel, single-purpose)

**Organization by Responsibility:**
- `providers/` - External service integrations (LLM, Search, Scraper)
- `utils/` - Shared utilities (Cache, RateLimiter, CostEstimator, QualityScorer, ConsoleFormatter)
- `orchestrator/` - Pipeline coordination (Pipeline.ts orchestrates providers)
- `config/` - Configuration and prompts
- `types/` - All TypeScript definitions

---

*Convention analysis: 2026-02-06*

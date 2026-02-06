# Architecture

**Analysis Date:** 2026-02-06

## Pattern Overview

**Overall:** Multi-stage orchestration pipeline with provider abstraction layer

The system implements a configurable research pipeline that decomposes complex questions into iterative search-scrape-analyze cycles. Each cycle feeds into the next through gap evaluation, enabling depth-based research execution. The architecture separates concerns into providers (external services), orchestrator (pipeline logic), and utilities (cross-cutting concerns).

**Key Characteristics:**
- **Provider abstraction**: Pluggable interfaces for LLM, search, scraping, and caching allow swapping implementations
- **Multi-round research**: Configurable depth (shallow/normal/deep) controls iteration count and model tier selection
- **State management**: Tracked across rounds via session state, deduplication sets, and summary accumulation
- **Error resilience**: Partial result recovery with fallback report generation; per-step error isolation
- **Cost tracking**: Optional token/cost estimation across all LLM calls with per-step breakdown

## Layers

**Presentation/Configuration:**
- Purpose: Public API surface for instantiation and execution
- Location: `src/ResearchAgent.ts`, `src/index.ts`
- Contains: ResearchAgent class, configuration validation, type exports
- Depends on: Providers, Pipeline, types
- Used by: End-user code (applications importing the library)

**Orchestration:**
- Purpose: Coordinates the full research pipeline workflow
- Location: `src/orchestrator/Pipeline.ts`
- Contains: Multi-round execution loop, progress tracking, cost estimation, error recovery
- Depends on: All providers, utilities (Cache, CostEstimator, QualityScorer), config/prompts
- Used by: ResearchAgent class

**Provider Layer:**
- Purpose: Abstracts external service integrations
- Location: `src/providers/` directory
  - `LLMProvider.ts`: OpenRouter API integration (all models)
  - `SearchProvider.ts`: SearXNG integration with failover/retry
  - `ScraperProvider.ts`: Jina.ai integration with rate limiting
- Depends on: axios for HTTP, RateLimiter utility
- Used by: Pipeline, ResearchAgent

**Type System:**
- Purpose: Centralized type definitions and configuration schemas
- Location: `src/types/index.ts`
- Contains: Configuration interfaces, response types, error classes, depth configs
- Depends on: None
- Used by: All layers for type safety

**Utilities:**
- Purpose: Cross-cutting concerns and helper functionality
- Location: `src/utils/` directory
  - `Cache.ts` (242 lines): SQLite-backed caching for URLs and LLM responses
  - `CostEstimator.ts` (136 lines): Token counting and pricing calculation
  - `QualityScorer.ts` (180 lines): Content quality assessment
  - `RateLimiter.ts` (78 lines): Concurrency/rate limiting for Jina.ai
  - `ConsoleFormatter.ts` (145 lines): Formatted console output
  - `ModelFetcher.ts` (155 lines): OpenRouter model list fetching
- Depends on: better-sqlite3 (Cache), axios (ModelFetcher)
- Used by: Pipeline and providers

**Configuration:**
- Purpose: Prompt templates for LLM steps
- Location: `src/config/prompts.ts` (212 lines)
- Contains: Planning, summarizer, evaluator, filter, reporter prompts with date context
- Depends on: None
- Used by: Pipeline for LLM generation

## Data Flow

**Research Execution Flow:**

1. **Initialization** → `ResearchAgent.research()` called with query and options
2. **Pipeline Setup** → `Pipeline.execute()` validates depth config, resets state (seenUrls, costEstimator)
3. **Planning** → `planQueries()` generates initial search queries via LLM
4. **Multi-round Loop** (controlled by `DEPTH_CONFIGS[depth].maxRounds`):
   - **Search** → `executeSearches()` queries SearXNG (with 2s delay between queries)
   - **Scrape** → `scrapeResults()` fetches content via Jina.ai, checks cache, deduplicates URLs
   - **Summarize** → `summarizeContent()` summarizes each scraped item via LLM
   - **Evaluate** (round > 0) → `evaluateGaps()` analyzes summaries, generates follow-up queries or marks goal_met
5. **Filter & Rank** → `filterAndRank()` reorders sources by relevance
6. **Report** → `generateReport()` synthesizes top 10 sources into final report
7. **Return** → Metadata includes queries, source count, duration, round count, costs (optional)

**Error Handling:**
- Try-catch wraps entire `execute()` method
- On error: If `allowPartialResults=true` and content exists, generates report from collected sources
- Fallback: `createBasicSummary()` creates markdown list of sources if report generation fails
- Returns partial result with `metadata.partial=true` and error message

**State Management:**
- `seenUrls` Set: Tracks URLs across rounds to flag duplicates
- `allSummaries` array: Accumulates summaries for gap evaluation
- `allScrapedContent` array: Accumulates all scraped items (sorted by quality)
- `executedQueries` array: Tracks all queries executed
- Session data (optional): Via Cache, for resumability

## Key Abstractions

**Provider Pattern:**
- Purpose: Decouple external service implementations
- Interfaces defined: `LLMProvider`, `SearchProvider`, `ScraperProvider`, `CacheProvider`
- Examples:
  - `src/providers/LLMProvider.ts` implements LLMProvider for OpenRouter
  - `src/providers/SearchProvider.ts` implements SearchProvider for SearXNG
- Pattern: Each provider encapsulates retry logic, error handling, config defaults

**Depth Configuration:**
- Purpose: Control research breadth/cost based on user preference
- Definition: `DEPTH_CONFIGS` in `src/types/index.ts`
  - `shallow`: 2-3 queries, 3-5 results/query, 1 round, small models
  - `normal`: 3-5 queries, 5-8 results/query, 2 rounds, medium models
  - `deep`: 5-7 queries, 8-12 results/query, 3 rounds, large models
- Used in: Pipeline to control loop bounds and model tier selection

**Model Configuration:**
- Purpose: Flexible model assignment with three levels of override
- Examples: `src/types/index.ts` (DEFAULT_MODELS, DEFAULT_AGENT_TIERS)
- Pattern: customModels > tiers > tierModels > defaults
- Agents: planner, parser, summarizer, evaluator, filter, reporter

**Quality Scoring:**
- Purpose: Rank content by relevance and quality
- Location: `src/utils/QualityScorer.ts`
- Inputs: title, URL, content
- Outputs: 0-100 score based on content length, keyword presence, domain

## Entry Points

**`src/index.ts`:**
- Exports: ResearchAgent class, type definitions, constants
- Triggers: Imported by applications
- Responsibilities: Package public API

**`src/ResearchAgent.ts`:**
- Location: Main class constructor and `.research()` method
- Triggers: `new ResearchAgent(config)` or `createResearchAgent(config)`
- Responsibilities:
  - Validate configuration (API keys, SearXNG instances)
  - Initialize providers and cache
  - Delegate to Pipeline
  - Cleanup resources via `.close()`

**`src/orchestrator/Pipeline.ts`:**
- Location: `.execute()` method
- Triggers: Called by ResearchAgent.research()
- Responsibilities:
  - Execute multi-round research loop
  - Manage progress callbacks
  - Track costs
  - Handle partial results on error

## Error Handling

**Strategy:** Defensive with graceful degradation

**Patterns:**

1. **Configuration Validation** (ResearchAgent constructor)
   - Validates `openRouterKey` not empty
   - Validates `searxngConfig.instances` array not empty
   - Validates instance URLs are valid
   - Throws `Error` with clear message

2. **Provider-Level Retry** (all providers)
   - LLMProvider: 3 retries with exponential backoff for OpenRouter calls
   - SearchProvider: Retries same instance, then failover to next instance
   - ScraperProvider: 3 retries per URL, respects 429 retry-after headers

3. **Pipeline-Level Recovery**
   - Catches any error in `execute()` try-catch
   - If `allowPartialResults=true` and `allScrapedContent.length > 0`:
     - Attempts to generate report from collected sources
     - Falls back to `createBasicSummary()` if report generation fails
     - Returns partial result with error message in metadata

4. **JSON Parsing Fallbacks**
   - Planning, evaluation, filtering, summary: all have try-catch around JSON.parse
   - Fallback values provided (e.g., single query, empty gaps, original order)

5. **Custom Error Classes** (in `src/types/index.ts`)
   - `ResearchAgentError`: Base class with code and details
   - `RateLimitError`: Specific to rate limiting
   - `SearchError`: Search provider failures
   - `LLMError`: LLM generation failures

## Cross-Cutting Concerns

**Logging:**
- Console-based output via `ConsoleFormatter` utility
- Levels: `.warning()`, `.info()`, `.stat()`
- Used for: Progress messages, retry logs, quality stats, cost tracking

**Validation:**
- Query validation: `QualityScorer.validateQuery()` checks for empty/malformed queries
- Configuration validation: `ResearchAgent` validates all required fields
- Response validation: JSON parsing with fallbacks for LLM responses

**Authentication:**
- OpenRouter: API key passed to `LLMProvider` constructor, used in axios Bearer token
- SearXNG: No authentication (public instances or self-hosted)
- Jina.ai: No authentication (free tier, rate limited by concurrency)

**Rate Limiting:**
- Jina.ai: `RateLimiter` enforces max concurrent scrapes (default 20)
- SearXNG: 2-second delay between queries in executeSearches()
- LLM calls: No rate limiting (OpenRouter manages it)

**Caching:**
- Search content: SQLite table `search_cache` (url → content)
- LLM responses: SQLite table `llm_cache` (prompt_hash → response)
- TTL: Configurable via `PersistenceConfig.cacheDuration` (default 24 hours)
- Cleanup: Automatic expiry of old entries on cache init

---

*Architecture analysis: 2026-02-06*

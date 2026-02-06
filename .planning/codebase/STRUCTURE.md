# Codebase Structure

**Analysis Date:** 2026-02-06

## Directory Layout

```
ts-research-agent/
├── src/                            # Source code (TypeScript)
│   ├── index.ts                    # Public API exports
│   ├── ResearchAgent.ts            # Main class and config validation
│   ├── prompts.ts                  # Legacy prompts file (deprecated)
│   ├── orchestrator/               # Pipeline orchestration
│   │   └── Pipeline.ts             # Multi-round research execution
│   ├── providers/                  # External service abstractions
│   │   ├── LLMProvider.ts          # OpenRouter integration
│   │   ├── SearchProvider.ts       # SearXNG integration
│   │   └── ScraperProvider.ts      # Jina.ai integration
│   ├── types/                      # Type definitions and config
│   │   └── index.ts                # All TypeScript interfaces and constants
│   ├── config/                     # Configuration and prompts
│   │   └── prompts.ts              # LLM prompt templates
│   └── utils/                      # Cross-cutting utilities
│       ├── Cache.ts                # SQLite-backed caching
│       ├── CostEstimator.ts        # Token pricing calculation
│       ├── QualityScorer.ts        # Content quality assessment
│       ├── RateLimiter.ts          # Concurrency control
│       ├── ConsoleFormatter.ts     # Console output formatting
│       └── ModelFetcher.ts         # OpenRouter model listing
├── examples/                       # Usage examples
│   ├── basic-usage.ts              # Basic depth levels example
│   └── advanced-features.ts        # Advanced config example
├── scripts/                        # Build and utility scripts
│   └── fetch-models.ts             # Fetch available models from OpenRouter
├── .planning/                      # Planning documents
│   └── codebase/                   # Generated codebase analysis
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── .env.example                    # Environment variable template
├── README.md                       # Project documentation
└── SEARXNG_INSTANCES.md            # SearXNG setup guide
```

## Directory Purposes

**`src/`**
- Purpose: All TypeScript source code for the library
- Contains: Classes, types, utilities
- Key files: All application logic lives here
- Compiles to: `dist/` directory

**`src/orchestrator/`**
- Purpose: Pipeline coordination and execution logic
- Contains: Multi-round research workflow, state tracking, progress callbacks
- Key files: `Pipeline.ts` (550 lines, the core execution engine)

**`src/providers/`**
- Purpose: Abstractions for external services
- Contains: HTTP clients, retry logic, error handling per service
- Key files:
  - `LLMProvider.ts`: OpenRouter API with model pricing
  - `SearchProvider.ts`: SearXNG with failover and retry (218 lines)
  - `ScraperProvider.ts`: Jina.ai with rate limiting (124 lines)

**`src/types/`**
- Purpose: Centralized type system and configuration schemas
- Contains: All TypeScript interfaces, error classes, depth/model configs
- Key files: `index.ts` (335 lines, defines all public types)

**`src/config/`**
- Purpose: System configuration and prompts
- Contains: LLM prompt templates with date context
- Key files: `prompts.ts` (212 lines, defines planning/summarizer/evaluator/filter/reporter prompts)

**`src/utils/`**
- Purpose: Reusable helper utilities across all layers
- Contains: Caching, cost estimation, quality scoring, rate limiting, formatting
- Key files (by size):
  - `Cache.ts` (242 lines): SQLite database, three tables (search_cache, llm_cache, sessions)
  - `QualityScorer.ts` (180 lines): Content quality and query validation
  - `ConsoleFormatter.ts` (145 lines): Colored console output
  - `CostEstimator.ts` (136 lines): Token counting and pricing
  - `ModelFetcher.ts` (155 lines): Fetches available models from OpenRouter
  - `RateLimiter.ts` (78 lines): Concurrency queue for Jina.ai scraping

**`examples/`**
- Purpose: Runnable example code showing library usage
- Contains: Three depth levels (shallow/normal/deep), custom models, progress tracking
- Key files:
  - `basic-usage.ts`: Demonstrates all depth levels
  - `advanced-features.ts`: Custom model configuration, cost tracking

**`scripts/`**
- Purpose: Build and development utilities
- Key files: `fetch-models.ts` fetches model list from OpenRouter API

## Key File Locations

**Entry Points:**
- `src/index.ts`: Public API (exports ResearchAgent, all types, constants)
- `src/ResearchAgent.ts`: Main class instantiation, config validation
- `examples/basic-usage.ts`: Library usage examples

**Configuration:**
- `package.json`: Dependencies, build/run scripts, version
- `tsconfig.json`: TypeScript compiler options (ES2022, strict mode, declaration maps)
- `.env.example`: Required environment variables (OPENROUTER_API_KEY, SEARXNG_URL)

**Core Logic:**
- `src/orchestrator/Pipeline.ts`: Multi-round research execution (550 lines)
- `src/types/index.ts`: Type definitions and constants (335 lines)
- `src/providers/LLMProvider.ts`: LLM integration (177 lines)
- `src/providers/SearchProvider.ts`: Search integration (218 lines)

**Testing:**
- None detected in codebase (no test files present)

## Naming Conventions

**Files:**
- PascalCase for class-containing files: `ResearchAgent.ts`, `LLMProvider.ts`, `Cache.ts`
- camelCase for utility files: `index.ts`, `prompts.ts`
- Directory names: lowercase, plural for collections: `providers/`, `utils/`, `examples/`

**Functions:**
- camelCase: `executeSearches()`, `scrapeResults()`, `generateReport()`, `planQueries()`
- Public methods expose camelCase: `research()`, `close()`, `getConfig()`, `updateSearchInstances()`
- Private methods prefix with underscore: `_sleep()`, `_initializeDatabase()`, `_getModelForAgent()`

**Variables:**
- camelCase: `seenUrls`, `allScrapedContent`, `executedQueries`, `costEstimator`
- Constants UPPER_SNAKE_CASE: `MODEL_PRICING`, `DEPTH_CONFIGS`, `DEFAULT_MODELS`, `DEFAULT_AGENT_TIERS`
- Abbreviations kept short: `llm`, `db`, `api`, `config`, `cache`

**Types:**
- PascalCase interfaces: `ResearchAgent`, `LLMProvider`, `SearchResult`, `ScrapedContent`
- Suffix with `Config` for configuration: `ResearchAgentConfig`, `SearchConfig`, `ModelConfig`
- Suffix with `Response` for LLM responses: `PlanningResponse`, `EvaluationResponse`, `FilteringResponse`
- Union types (lowercase): `ModelTier`, `AgentType`, `ResearchDepth`, `ProgressStage`

## Where to Add New Code

**New Feature (e.g., new research step):**
- Primary code: `src/orchestrator/Pipeline.ts` (add method, integrate into execute loop)
- Types: Update `src/types/index.ts` (add new request/response interfaces)
- Prompts: Add to `src/config/prompts.ts` if LLM-powered
- Tests: Would go to `src/__tests__/orchestrator/Pipeline.test.ts` (if testing exists)

**New External Provider (e.g., Bing Search instead of SearXNG):**
- Implementation: Create `src/providers/NewProviderName.ts`
- Interface: Implement existing interface or extend it in `src/types/index.ts`
- Integration: Update `ResearchAgent.ts` constructor to accept config
- Example: Add to `examples/` showing usage

**New Utility Function:**
- Implementation: Add to existing `src/utils/UtilityName.ts` or create new file if distinct
- Naming: Follow camelCase with descriptive name
- Integration: Import in Pipeline or providers as needed
- Example: `scoreContent()` is in `QualityScorer.ts`

**New Configuration Option:**
- Add to interface in `src/types/index.ts` (e.g., `ResearchAgentConfig`)
- Add default value in `src/ResearchAgent.ts` constructor validation
- Document in JSDoc comment above interface
- Example: `maxConcurrentScrapes` is part of `ResearchAgentConfig`

## Special Directories

**`dist/`:**
- Purpose: Compiled JavaScript output
- Generated: Yes (via `npm run build` with TypeScript compiler)
- Committed: No (in .gitignore)
- Structure: Mirrors `src/` structure with .js and .d.ts files

**`.planning/`:**
- Purpose: GSD phase planning and documentation
- Generated: Yes (by GSD orchestrator)
- Committed: Yes (for tracking decisions)
- Contains: `codebase/` subdirectory with ARCHITECTURE.md, STRUCTURE.md, etc.

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (via `npm install`)
- Committed: No (in .gitignore)
- Key dependencies: axios, better-sqlite3, dotenv, tsx, typescript

## Import Paths

**Absolute imports:** Not configured (no path aliases in tsconfig.json)
- Use relative paths: `import { Cache } from '../utils/Cache.js'`
- From root: `import { Pipeline } from './orchestrator/Pipeline.js'` (from src/)

**ESM imports with `.js` extension required:**
- `import type { ResearchAgentConfig } from '../types/index.js'`
- Reason: `"type": "module"` in package.json, output format ESNext

**Re-exports from index.ts:**
- Public API re-exported: `export { ResearchAgent } from './ResearchAgent.js'`
- Bulk type exports: `export type { ResearchAgentConfig, ... } from './types/index.js'`

## Module Export Pattern

**ResearchAgent (main export):**
```typescript
// src/index.ts
export { ResearchAgent, createResearchAgent } from './ResearchAgent.js';
export type { ResearchAgentConfig, ResearchOptions, ResearchResult, ... } from './types/index.js';
export { DEFAULT_MODELS, DEFAULT_AGENT_TIERS, DEPTH_CONFIGS } from './types/index.js';
```

**Providers (not exported):**
- Used internally only
- No need to import from outside library
- Instantiated by ResearchAgent and Pipeline

**Utilities (not exported):**
- Internal only (Cache, CostEstimator, RateLimiter, etc.)
- Could be exported for advanced use cases but currently not

---

*Structure analysis: 2026-02-06*

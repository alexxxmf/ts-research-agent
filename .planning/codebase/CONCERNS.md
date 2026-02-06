# Technical Concerns

**Analysis Date:** 2026-02-06

## Technical Debt

### No Testing Infrastructure

**Severity:** High
**Location:** Entire codebase

**Issue:** No test files, test framework, or test configuration exist in the codebase.

**Impact:**
- Changes cannot be verified automatically
- Regression risk on any modification
- No confidence in refactoring

**Recommendation:** Add Vitest or Jest with unit tests for providers and utilities first.

### Missing ESLint/Prettier Configuration

**Severity:** Medium
**Location:** Project root

**Issue:** No linting or formatting configuration files (`.eslintrc`, `.prettierrc`).

**Impact:**
- Code style inconsistencies may accumulate
- No automated style enforcement
- Potential for preventable bugs (unused variables, etc.)

**Recommendation:** Add ESLint with TypeScript plugin and Prettier for consistent formatting.

### Unused Import in ModelFetcher

**Severity:** Low
**Location:** `src/utils/ModelFetcher.ts:3`

**Issue:** `join` is imported from `path` but never used.

```typescript
import { join } from 'path';  // unused
```

**Recommendation:** Remove unused import.

## Security Considerations

### API Key Exposure Risk

**Severity:** Medium
**Location:** `src/providers/LLMProvider.ts`, `src/ResearchAgent.ts`

**Issue:** API keys passed through constructor and stored in memory. No rotation or refresh mechanism.

**Current Mitigation:**
- Keys loaded from environment variables (`.env` file)
- `.env` is gitignored
- Example file (`.env.example`) contains no actual secrets

**Recommendation:** Consider adding key validation on construction to fail fast on invalid keys.

### No Input Sanitization for User Queries

**Severity:** Low
**Location:** `src/orchestrator/Pipeline.ts`

**Issue:** User queries are passed directly to LLM prompts. While prompt injection is unlikely to cause harm in this research context, queries are used in console output.

**Current Mitigation:**
- Research agent is a library, not a public-facing API
- LLM responses are parsed, not executed

**Recommendation:** Document that users should not use untrusted input directly.

### SQLite Database Not Encrypted

**Severity:** Low
**Location:** `src/utils/Cache.ts`

**Issue:** SQLite database stores cached content and LLM responses in plaintext.

**Current Mitigation:**
- Cache is local to the machine
- No sensitive user data stored (research content only)
- Cache TTL limits data persistence

**Recommendation:** Acceptable for current use case. Note in documentation.

## Performance Concerns

### Sequential LLM Calls in Pipeline

**Severity:** Medium
**Location:** `src/orchestrator/Pipeline.ts:summarizeContent()`

**Issue:** Summarization calls LLM sequentially for each scraped item. With 10+ sources, this creates a bottleneck.

**Impact:**
- Total duration increases linearly with source count
- Shallow depth: ~10 sources = ~10 LLM calls sequential
- Deep depth: ~30+ sources = significant delay

**Recommendation:** Consider parallel summarization with concurrency limit (e.g., 3-5 concurrent calls).

### Cache Not Shared Across Instances

**Severity:** Low
**Location:** `src/utils/Cache.ts`

**Issue:** Each `ResearchAgent` instance creates its own cache connection. Multiple instances don't share cache hits.

**Impact:**
- Duplicate work if running multiple agents
- Memory overhead for multiple connections

**Current Mitigation:**
- Typical use is single agent per process
- SQLite file on disk is shared (concurrent reads work)

### Rate Limiter Queue Could Grow Large

**Severity:** Low
**Location:** `src/utils/RateLimiter.ts`

**Issue:** No maximum queue size. If scrape requests arrive faster than processing, queue grows unbounded.

**Impact:**
- Memory growth under heavy load
- Delayed processing for queued items

**Current Mitigation:**
- Pipeline controls request volume via depth config
- Practical limit is ~30 URLs per research session

**Recommendation:** Add optional max queue size with rejection.

## Fragile Areas

### JSON Parsing Without Validation

**Severity:** Medium
**Location:** `src/orchestrator/Pipeline.ts` (multiple methods)

**Issue:** LLM responses are parsed with `JSON.parse()` inside try-catch, but the structure is not validated against expected schema.

**Locations:**
- `planQueries()` - expects `{ analysis, queries, synthesis_note }`
- `evaluateGaps()` - expects `{ assessment, follow_up_queries, goal_met }`
- `filterAndRank()` - expects `{ rankings, filtered, reasoning }`

**Impact:**
- LLM returns malformed JSON → fallback to defaults (safe)
- LLM returns valid JSON with wrong structure → runtime errors possible

**Current Mitigation:**
- Fallback values on parse failure
- LLM prompts specify expected format clearly

**Recommendation:** Add Zod or similar runtime validation for LLM response structures.

### Public SearXNG Instances Unreliable

**Severity:** Medium
**Location:** `src/providers/SearchProvider.ts`, `examples/basic-usage.ts`

**Issue:** Public SearXNG instances frequently block automated access, rate limit, or go offline.

**Impact:**
- Research fails if all instances unavailable
- User experience depends on external infrastructure

**Current Mitigation:**
- Failover logic tries multiple instances
- README recommends self-hosting SearXNG
- Docker command provided for local instance

**Recommendation:** Document that local SearXNG is required for reliable operation.

### Hardcoded Model IDs May Become Stale

**Severity:** Low
**Location:** `src/types/index.ts` (DEFAULT_MODELS)

**Issue:** Default model IDs are hardcoded. OpenRouter may deprecate or rename models.

```typescript
export const DEFAULT_MODELS = {
  small: 'meta-llama/llama-3.1-8b-instruct',
  medium: 'google/gemini-2.5-flash',
  large: 'deepseek/deepseek-chat'
};
```

**Impact:**
- Research fails if default model unavailable
- Users must manually specify models

**Current Mitigation:**
- `scripts/fetch-models.ts` can check available models
- Users can override via config

**Recommendation:** Add model availability check on initialization with fallback.

## Known Issues

### No Session Resume Without Persistence

**Severity:** Low
**Location:** `src/orchestrator/Pipeline.ts`

**Issue:** Session state (seenUrls, allSummaries, executedQueries) is not persisted mid-research. If process crashes, work is lost.

**Current State:**
- `PersistenceConfig` allows session storage
- Not implemented in current Pipeline version

**Impact:**
- Deep research (~3 rounds, 30+ sources) takes 5-10 minutes
- Crash loses all progress

**Recommendation:** Implement periodic session checkpointing.

### Cost Estimation Is Approximate

**Severity:** Low
**Location:** `src/utils/CostEstimator.ts`

**Issue:** Token estimation uses ~4 chars/token approximation. Actual costs may differ.

**Current Mitigation:**
- Costs are labeled as "estimated"
- Metadata includes `estimatedCost` field name

**Recommendation:** Document that costs are approximate in API docs.

## Dependency Concerns

### better-sqlite3 Native Dependencies

**Severity:** Medium
**Location:** `package.json`

**Issue:** `better-sqlite3` requires native compilation. May fail on some systems.

**Impact:**
- `npm install` may fail without build tools
- Windows users may need extra setup
- Docker builds need native dependencies

**Current Mitigation:**
- Persistence is optional (can run without cache)
- Node 18+ usually has prebuilt binaries

**Recommendation:** Document build requirements or consider sqlite3 WASM alternative.

### Axios Without Request/Response Interceptors

**Severity:** Low
**Location:** `src/providers/LLMProvider.ts`, `src/providers/SearchProvider.ts`

**Issue:** Axios is used directly without global interceptors for logging or error transformation.

**Current Mitigation:**
- Each provider handles errors locally
- Retry logic implemented per-provider

**Recommendation:** Acceptable for current size. Consider interceptors if adding more providers.

---

*Concerns analysis: 2026-02-06*

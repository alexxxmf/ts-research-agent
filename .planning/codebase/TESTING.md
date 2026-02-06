# Testing Patterns

**Analysis Date:** 2026-02-06

## Test Framework

**Status:** No testing framework configured

**Current State:**
- No test files found in codebase (searched for `*.test.ts`, `*.spec.ts`)
- No test runners configured (jest, vitest, mocha, etc.)
- No test dependencies in `package.json`
- No test configuration files (.jestrc, vitest.config.ts, etc.)
- `tsconfig.json` excludes test files: `"exclude": ["node_modules", "dist", "examples", "**/*.test.ts"]`

**Implication:** Testing must be added from scratch if implemented.

## Test File Organization

**Recommended Patterns (for future implementation):**

**Location:**
- Co-located with source files (same directory): `src/providers/__tests__/LLMProvider.test.ts` or `src/providers/LLMProvider.test.ts`
- Alternative centralized structure: `tests/unit/`, `tests/integration/`

**Naming:**
- Suffix convention: `*.test.ts` or `*.spec.ts`
- Mirror source structure: `src/providers/LLMProvider.ts` → `src/providers/LLMProvider.test.ts`

**Suggested Structure for Unit Tests:**
```
src/
├── providers/
│   ├── LLMProvider.ts
│   ├── LLMProvider.test.ts
│   ├── SearchProvider.ts
│   ├── SearchProvider.test.ts
│   └── ScraperProvider.test.ts
├── utils/
│   ├── Cache.test.ts
│   ├── QualityScorer.test.ts
│   ├── RateLimiter.test.ts
│   └── CostEstimator.test.ts
└── orchestrator/
    └── Pipeline.test.ts
```

## Test Structure

**Recommended Test Suite Organization (for future implementation):**

Based on patterns used in source code organization, follow this structure:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'; // or jest
import { LLMProvider } from './LLMProvider';

describe('LLMProvider', () => {
  let provider: LLMProvider;

  beforeEach(() => {
    provider = new LLMProvider('test-api-key');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generate', () => {
    it('should return content from LLM', async () => {
      // Test implementation
    });

    it('should retry on rate limit', async () => {
      // Test implementation
    });

    it('should throw LLMError after max retries', async () => {
      // Test implementation
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens at ~4 chars per token', () => {
      // Test implementation
    });
  });
});
```

**Patterns:**
- Group related tests with `describe()` blocks
- Arrange-Act-Assert structure within each `it()` test
- Use `beforeEach()` for setup (fixture creation)
- Use `afterEach()` for cleanup (mocks, database cleanup)
- One responsibility per test

## Mocking

**Recommended Framework:** Vitest or Jest with built-in mock support

**Patterns (for future implementation):**

**Mocking External Services:**
```typescript
// Mock axios for API calls
vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
    get: vi.fn()
  }
}));

// Mock database (better-sqlite3)
vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => ({
    exec: vi.fn(),
    prepare: vi.fn(),
    close: vi.fn()
  }))
}));
```

**Mocking Provider Instances:**
```typescript
const mockLLMProvider = {
  generate: vi.fn(),
  estimateTokens: vi.fn(),
  getModelInfo: vi.fn()
};

const mockSearchProvider = {
  search: vi.fn()
};

const mockScraperProvider = {
  scrape: vi.fn(),
  scrapeMany: vi.fn()
};
```

**What to Mock:**
- External API calls (OpenRouter, SearXNG, Jina.ai) - essential for fast, isolated tests
- File system operations (better-sqlite3 database)
- Network requests and timeouts
- Rate limiters and timing functions
- Console output for verifying log behavior

**What NOT to Mock:**
- Core logic classes (ResearchAgent, Pipeline) - test them with mocked dependencies
- Type definitions and data structures
- Pure utility functions (QualityScorer scoring algorithms) - test logic paths instead
- Error classes (should test real instances)

## Fixtures and Factories

**Recommended Pattern for Test Data:**

```typescript
// fixtures/models.ts - Test model data
export const mockOpenRouterResponse = {
  choices: [{
    message: {
      content: '{"analysis":"test","queries":[],"synthesis_note":"test"}'
    }
  }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 200,
    total_tokens: 300
  }
};

// fixtures/searchResults.ts - Sample search results
export const mockSearchResults = [
  {
    title: 'Test Article',
    url: 'https://example.com/article',
    snippet: 'This is a test snippet'
  }
];

// factories/testData.ts - Factory functions
export function createResearchAgentConfig(overrides = {}) {
  return {
    openRouterKey: 'test-key',
    searxngConfig: {
      instances: ['https://searx.example.com']
    },
    ...overrides
  };
}

export function createProgressEvent(overrides = {}) {
  return {
    stage: 'planning' as const,
    message: 'Test message',
    progress: 50,
    ...overrides
  };
}
```

**Location:**
- `tests/fixtures/` - Static test data files
- `tests/factories/` - Factory functions for creating test objects
- `src/__fixtures__/` - Alternative co-located fixtures (less ideal for this project)

## Coverage

**Recommendations for Target Coverage:**

Coverage should be implemented once testing is added. Suggested targets based on codebase importance:

**Files to prioritize (critical functionality):**
- `src/providers/LLMProvider.ts` - Core API integration, 80%+ coverage
- `src/providers/SearchProvider.ts` - Retry logic, failover, 80%+ coverage
- `src/orchestrator/Pipeline.ts` - Main orchestration, 70%+ coverage
- `src/utils/QualityScorer.ts` - Scoring algorithms, 85%+ coverage
- `src/utils/Cache.ts` - Data persistence, 75%+ coverage

**Files to moderate coverage:**
- `src/utils/RateLimiter.ts` - Concurrency control, 70%+ coverage
- `src/utils/CostEstimator.ts` - Cost calculations, 75%+ coverage
- `src/ResearchAgent.ts` - Configuration validation, 75%+ coverage

**Files with lower coverage needs:**
- `src/utils/ConsoleFormatter.ts` - UI/logging, 50%+ coverage
- `src/config/prompts.ts` - Template strings, snapshot tests only
- `src/index.ts` - Re-exports, minimal coverage needed

**View Coverage (future):**
```bash
npm test -- --coverage                    # Generate coverage report
npm test -- --coverage --reporter=html    # HTML coverage report
npm test -- --coverage.reporter=text      # Terminal coverage report
```

## Test Types

**Unit Tests:**
- Scope: Individual classes and functions in isolation
- Approach: Mock all external dependencies (APIs, database, file system)
- Examples: Test LLMProvider.generate() with mocked axios, test QualityScorer.scoreContent()
- Location: `src/providers/LLMProvider.test.ts`, `src/utils/QualityScorer.test.ts`
- Expected tests:
  - `LLMProvider.generate()` - success, retry logic, error handling, rate limiting
  - `SearchProvider.search()` - instance failover, retry logic, response parsing
  - `Cache.get/set()` - cache hit/miss, expiration, database errors
  - `QualityScorer.scoreContent()` - scoring algorithm edge cases, domain reputation
  - `RateLimiter.add()` - concurrent request limiting, queue processing

**Integration Tests:**
- Scope: Multiple components working together (without external APIs)
- Approach: Mock external services, test component interactions
- Examples: Pipeline with mocked providers, full cache workflow
- Location: `tests/integration/` or `src/orchestrator/Pipeline.integration.test.ts`
- Expected tests:
  - `Pipeline.execute()` with mocked LLM, Search, Scraper
  - Cache integration with Pipeline state persistence
  - Error recovery and partial result handling
  - Progress callback flow through Pipeline stages

**E2E Tests:**
- Status: Not currently implemented, optional
- Framework: Would require test SearXNG, OpenRouter, Jina.ai instances
- Approach: Real external API calls with test queries
- Challenge: Cost (OpenRouter charges per token), rate limits, flakiness
- Recommendation: Use sparingly for critical paths or mock service replicas

## Common Patterns

**Async Testing:**

```typescript
// Using async/await (preferred)
it('should fetch models from OpenRouter', async () => {
  const models = await fetchAvailableModels('test-key');
  expect(models).toHaveLength(5);
});

// Using Promise.then() alternative
it('should handle errors', () => {
  return provider.generate('test').catch(error => {
    expect(error.code).toBe('LLM_ERROR');
  });
});

// Using done callback (less preferred)
it('should complete within timeout', (done) => {
  provider.generate('test').then(() => {
    done();
  }).catch(done);
});
```

**Error Testing:**

```typescript
// Expect thrown errors
it('should throw validation error on empty query', () => {
  expect(() => {
    new ResearchAgent({ openRouterKey: '', searxngConfig: { instances: [] } });
  }).toThrow('OpenRouter API key is required');
});

// Expect async rejection
it('should reject on network failure', async () => {
  vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

  await expect(provider.scrape('https://example.com')).rejects.toThrow('Network error');
});

// Expect custom error codes
it('should include error code in rejection', async () => {
  const mockError = {
    name: 'SearchError',
    message: 'Search failed',
    code: 'SEARCH_ERROR',
    details: { query: 'test' }
  };

  vi.mocked(axios.get).mockRejectedValue(mockError);

  try {
    await provider.search('test');
  } catch (error: any) {
    expect(error.code).toBe('SEARCH_ERROR');
    expect(error.details.query).toBe('test');
  }
});
```

**Retry Logic Testing:**

```typescript
// Test exponential backoff
it('should retry with exponential backoff', async () => {
  const mockFn = vi.fn()
    .mockRejectedValueOnce(new Error('Attempt 1'))
    .mockRejectedValueOnce(new Error('Attempt 2'))
    .mockResolvedValueOnce('Success');

  const result = await provider.executeWithRetry(mockFn, 3);

  expect(result).toBe('Success');
  expect(mockFn).toHaveBeenCalledTimes(3);
  // Verify delay calculations if needed
});

// Test max retry limit
it('should throw after max retries', async () => {
  vi.mocked(axios.get).mockRejectedValue(new Error('Always fails'));

  await expect(provider.generate('test')).rejects.toThrow(/after 3 attempts/);
});
```

**Rate Limiter Testing:**

```typescript
it('should limit concurrent requests', async () => {
  const limiter = new RateLimiter(2, 50); // Max 2 concurrent
  let concurrent = 0;
  let maxConcurrent = 0;

  const fn = async () => {
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise(r => setTimeout(r, 10));
    concurrent--;
  };

  await Promise.all([
    limiter.add(() => fn()),
    limiter.add(() => fn()),
    limiter.add(() => fn()),
    limiter.add(() => fn())
  ]);

  expect(maxConcurrent).toBeLessThanOrEqual(2);
});
```

---

*Testing analysis: 2026-02-06*

# Codebase Concerns

**Analysis Date:** 2026-02-06

## Tech Debt

**Fragile JSON Parsing Without Schema Validation:**
- Issue: Multiple locations parse LLM responses as JSON without schema validation. If the LLM returns invalid JSON or deviates from expected format, parsing fails silently with fallback behavior.
- Files: `src/orchestrator/Pipeline.ts` (lines 250, 386, 409, 437), `src/utils/Cache.ts` (line 202)
- Impact: Silent failures with minimal fallback data. For example, if evaluateGaps() fails to parse (line 409), the fallback returns `goal_met: true` which stops research prematurely.
- Fix approach: Implement JSON schema validation (e.g., using `zod` or `ajv`) before parsing LLM responses. Differentiate between parse errors and unexpected formats. Log specific parse failures for debugging.

**Loose Type Safety with `any` Type:**
- Issue: 33 instances of `catch (error: any)` throughout codebase. This defeats TypeScript's type checking and masks actual error types.
- Files: `src/providers/SearchProvider.ts` (line 55), `src/providers/ScraperProvider.ts` (line 72), `src/providers/LLMProvider.ts` (line 99), `src/orchestrator/Pipeline.ts` (line 199), and 8+ other locations
- Impact: Difficult to determine what errors are expected vs. unexpected. Error handling may miss critical issues. Harder to add proper error recovery.
- Fix approach: Create explicit error types or use discriminated unions. Import specific error classes from libraries (e.g., `import { AxiosError }`). Catch specific error types instead of `any`.

**Hardcoded Model Pricing Data Duplicated:**
- Issue: Model pricing is duplicated across two files and manually maintained. Comments say "Updated: 2025-12-09" but this becomes stale.
- Files: `src/providers/LLMProvider.ts` (lines 11-21), `src/utils/CostEstimator.ts` (lines 12-22)
- Impact: Cost estimates become inaccurate over time. New models not added automatically. Risk of using wrong pricing for billing purposes.
- Fix approach: Centralize pricing in single source (e.g., `src/config/pricing.ts`). Implement automatic model fetching from OpenRouter API (script exists at `src/utils/ModelFetcher.ts` but not integrated). Cache pricing with TTL.

**No Test Coverage:**
- Issue: Zero test files in codebase. No unit tests, integration tests, or E2E tests.
- Files: No `*.test.ts`, `*.spec.ts`, or test directories found anywhere
- Impact: Refactoring is risky. Edge cases in research pipeline not validated. Quality scorer heuristics untested. Error recovery paths untested.
- Fix approach: Add Jest or Vitest configuration. Create unit tests for utilities (RateLimiter, QualityScorer, Cache). Add integration tests for Pipeline with mocked providers. Target 60%+ coverage.

**Unused Import in ModelFetcher:**
- Issue: `join` is imported from `path` but never used
- Files: `src/utils/ModelFetcher.ts` (line 3)
- Impact: Minimal - just unused code, but indicates lack of linting
- Fix approach: Remove unused import or use it if intended

## Known Bugs

**Search Results Deduplication Bug:**
- Symptoms: Duplicate URLs may still appear in results despite deduplication logic
- Files: `src/orchestrator/Pipeline.ts` (lines 303-308, 336)
- Trigger: Multiple search rounds with overlapping results
- Details: Deduplication happens per-batch in scrapeResults(), but `seenUrls` set is updated asynchronously while new results are being added to array. If batch processing is fast, duplicates can slip through before set is updated in next round.
- Workaround: Filter results in scrapeResults() and add to seenUrls before returning to ensure atomic updates

**Incomplete Error Message in Scraper Fallback:**
- Symptoms: When Jina.ai scraping fails, fallback uses snippet which might be empty string or undefined, resulting in "Content unavailable"
- Files: `src/providers/ScraperProvider.ts` (lines 37-45)
- Trigger: Network errors or timeouts on scraping
- Details: Falls back to `result.snippet || 'Content unavailable'` but snippet may be empty string (falsy), and empty content still gets added to results
- Workaround: Explicitly check `result.snippet ? result.snippet : 'Content unavailable'`

**Token Estimation Accuracy Issues:**
- Symptoms: Cost estimates significantly off from actual costs
- Files: `src/providers/LLMProvider.ts` (line 149), `src/utils/CostEstimator.ts` (line 61)
- Details: Both use `Math.ceil(text.length / 4)` but OpenRouter uses proper token counting. 4 chars/token is rough approximation.
- Workaround: Use actual token counts from OpenRouter API responses in usage field instead of estimates

## Security Considerations

**API Keys in Error Messages:**
- Risk: OpenRouter API key is stored in config and passed through components. Error responses from API calls might leak the key in stack traces.
- Files: `src/ResearchAgent.ts` (line 49), `src/providers/LLMProvider.ts` (line 41)
- Current mitigation: Error messages don't explicitly log the key, but response error details from OpenRouter could contain sensitive headers
- Recommendations: Never log full error response objects from LLM provider. Redact Authorization header from error details. Create custom error wrapper that sanitizes responses. Use environment variables only, never store keys in memory longer than needed.

**No Input Sanitization on Search Queries:**
- Risk: User queries are passed directly to SearXNG without sanitization. Malicious queries could cause issues (though SearXNG is relatively safe).
- Files: `src/orchestrator/Pipeline.ts` (lines 88-95), `src/utils/QualityScorer.ts` (lines 148-179)
- Current mitigation: Query validation in QualityScorer rejects obviously bad queries, but doesn't sanitize or escape
- Recommendations: Add URL-encoding in SearchProvider.search() before sending to SearXNG. Validate for injection patterns. Limit query length strictly (already limited to 200 chars).

**Better-sqlite3 Injection Risk Minimal:**
- Risk: Cache uses parameterized queries which is good, but JSON.parse() on cached data without validation could be exploited if cache is compromised
- Files: `src/utils/Cache.ts` (lines 67-85, 146-169, 202)
- Current mitigation: Queries are parameterized, preventing SQL injection. JSON data comes from own cache.
- Recommendations: Add JSON schema validation on cached responses before parsing. Consider encrypting sensitive cached data.

## Performance Bottlenecks

**Inefficient Queue Processing in RateLimiter:**
- Problem: Rate limiter processes one item at a time with sleep delays, limiting throughput
- Files: `src/utils/RateLimiter.ts` (lines 33-46)
- Cause: Sleep logic runs synchronously before each item, causing cascading delays. Timer is re-evaluated per item.
- Impact: With 20 concurrent items and 50ms min interval, max throughput is 20 items/second but actual throughput may be lower due to processing overhead
- Improvement path: Use a single scheduled timer that processes items at fixed intervals rather than sleeping per-item. Consider using node's built-in `scheduler` API for better performance.

**Sequential Summarization Makes Pipeline Slow:**
- Problem: Each source is summarized individually, making N API calls for N sources
- Files: `src/orchestrator/Pipeline.ts` (lines 375-394)
- Cause: Loop calls LLM sequentially for each item without parallelization
- Impact: For 10 sources, 10 LLM API calls sequentially when 2-3 well-structured batched calls could summarize them all
- Improvement path: Batch multiple sources into single prompt. Add concurrency limit (3-5 parallel calls). Add fallback for cases where batching fails. Could reduce time by 5-10x.

**Content Size Not Limited Before Caching:**
- Problem: Large scraped content stored in SQLite without truncation
- Files: `src/orchestrator/Pipeline.ts` (line 354), `src/utils/Cache.ts` (lines 91-102)
- Cause: Content is fully cached without size limits or truncation
- Impact: Cache database grows unbounded. Cold starts slow down as cache queries scan large blobs. Database could grow to hundreds of MB over time.
- Improvement path: Implement content truncation before caching (e.g., first 100KB). Add cache size limit with warning. Implement LRU eviction policy.

**No Index on URL in Cache Search:**
- Problem: Cache uses URL lookups but may not have optimal indexing
- Files: `src/utils/Cache.ts` (lines 67-69)
- Impact: Cache queries slow down as table grows
- Improvement path: Ensure indexes are created on url columns (already done at line 47)

## Fragile Areas

**Pipeline State Management During Cancellation:**
- Files: `src/orchestrator/Pipeline.ts` (lines 69-74, 101-170)
- Why fragile: AbortSignal is checked periodically but not all operations respect it. If a long operation (scrapeMany batch, LLM generation) is in progress when signal fires, it continues to completion.
- Safe modification: Wrap long-running operations (scrapeMany, generateWithCache) with AbortSignal support. Pass signal down to provider calls. Add timeouts that can be cancelled.
- Test coverage: No tests for cancellation scenarios. Need tests for: request cancellation mid-scrape, mid-summarization, mid-report generation.

**Evaluation Loop Follow-up Query Generation:**
- Files: `src/orchestrator/Pipeline.ts` (lines 115-133)
- Why fragile: Evaluation response is parsed and follow-up queries mapped to different structure. If evaluator response schema changes, silent fallback returns empty queries and research stops.
- Safe modification: Use schema validation before line 127-132. Log when follow-up queries are truncated to 3 (line 128). Add exhaustiveness checking.
- Test coverage: Test evaluator response parsing with various formats. Test edge case where evaluator returns >3 queries. Test when evaluator returns valid JSON but wrong structure.

**Model Selection Fallback Chain:**
- Files: `src/orchestrator/Pipeline.ts` (lines 483-498)
- Why fragile: `DEFAULT_MODELS` or `DEFAULT_AGENT_TIERS` could be missing entries, causing undefined to be passed to LLM, which would fail the API call
- Safe modification: Add exhaustiveness check using TypeScript's `satisfies` keyword. Use switch statement to catch all agent types. Validate all agent types have entries at startup.
- Test coverage: Test all agent types (planner, parser, summarizer, evaluator, filter, reporter) with missing config. Verify defaults exist for each.

**Deduplication Across Rounds:**
- Files: `src/orchestrator/Pipeline.ts` (lines 33, 303-331)
- Why fragile: `seenUrls` set tracks URLs but deduplication flag is set before content is actually fetched. If scrape fails, duplicate flag remains but content is different.
- Safe modification: Move duplicate check to after successful scrape. Mark URL as "attempted" vs "successfully scraped" differently.
- Test coverage: Test deduplication when scraping fails partway through batch.

## Scaling Limits

**Memory Growth with Large Research Sessions:**
- Current capacity: `allScrapedContent` array holds all content in memory. With 10 rounds × 5 results × 50KB average = 2.5MB per session
- Limit: Array-based storage becomes problematic with 50+ rounds or very large sources (100KB+ each). No pagination in report generation.
- Scaling path: Implement streaming results instead of accumulating. Use temporary disk-backed storage for large sessions (e.g., temp SQLite table). Implement pagination in report generation.

**SearXNG Instance Management Has No Health Checks:**
- Current capacity: Round-robin/priority order works for 3-5 instances, but `getNextInstance()` has no health checking
- Limit: Dead instances still tried on rotation, adding latency. No fallback if all instances are down simultaneously.
- Scaling path: Implement instance health monitoring. Track response times and error rates. Remove unhealthy instances temporarily. Add exponential backoff for failed instances.

**Cache Database File Growth Unbounded:**
- Current capacity: Better-sqlite3 database grows with each query cached, no size limits enforced
- Limit: Single database file can grow to hundreds of MB, slowing all queries. Cleanup job only runs on init.
- Scaling path: Implement WAL mode (already available). Add size-based eviction (e.g., max 100MB). Add periodic cleanup task. Consider sharding cache by domain.

## Dependencies at Risk

**Axios ^1.13.2 - Active but Monitor for Security:**
- Risk: Version 1.13.2 is from 2024, but dependency is core to HTTP functionality. Security patches released regularly.
- Impact: Network requests fail entirely if Axios has vulnerability
- Migration plan: Add security audit task (`npm audit` in CI). Update to latest 1.x version regularly. Monitor axios GitHub for security advisories.

**Better-sqlite3 ^12.4.1 - Native Module Compatibility:**
- Risk: Native module that requires compilation. Breaking changes between Node versions can cause build failures.
- Impact: Deployment to different environments may fail if binary not available. Windows users may need extra setup.
- Migration plan: Pre-build binaries as part of CI/CD. Document Node version requirements clearly (currently requires >=18). Consider fallback to sqlite3 WASM if compatibility issues arise.

**No Pinned Versions in Package.json:**
- Risk: DevDependencies use `^` which allows minor/patch versions to float. A bad minor version update could break builds.
- Impact: CI/CD pipelines may fail unexpectedly with fresh installs. Inconsistent environments between machines.
- Migration plan: Lock all dependencies with npm ci instead of npm install. Consider pre-committing lockfile (likely already done). Add `npm audit --production` to CI pipeline.

## Missing Critical Features

**No Streaming Support for Large Reports:**
- Problem: Final report generated as single string in memory. Large sessions produce 100KB+ reports that must fit in memory.
- Blocks: Reports cannot be progressively written to file/stream. No way to generate partial reports mid-research or stream to client.
- Impact: Out-of-memory errors on very large research sessions (50+ sources)
- Recommendation: Add streaming report generator that yields chunks instead of returning full string. Support writing to file or stream.

**No Structured Output Format:**
- Problem: Research report is markdown string only. No structured data output (JSON, etc.).
- Blocks: Downstream tools can't parse results programmatically. Cost tracking and metadata require manual parsing.
- Impact: Integration with other tools/platforms difficult. Machine-readable export not available.
- Recommendation: Add JSON output format with all metadata. Export structured results alongside markdown report.

**No Resume/Checkpoint Mechanism:**
- Problem: If research is interrupted, all progress is lost
- Blocks: Long research sessions (deep depth, 10+ minutes) cannot be resumed. No way to recover partial results after network failure.
- Impact: Wasted API costs when interrupted (partial results not recoverable)
- Recommendation: Implement session checkpointing. Save state after each round to cache. Allow resuming from last checkpoint with deduplication.

## Test Coverage Gaps

**Untested URL Deduplication:**
- What's not tested: Deduplication across multiple rounds, edge cases with similar URLs (www vs non-www, trailing slash, query params)
- Files: `src/orchestrator/Pipeline.ts` (lines 33, 303-308)
- Risk: Duplicate URLs appearing in final report, wasting API calls and confusing readers
- Priority: High - affects core pipeline reliability

**Untested Quality Scorer Heuristics:**
- What's not tested: Quality scoring with edge cases (very short/long content, non-English text, encoded content, markdown vs plain text)
- Files: `src/utils/QualityScorer.ts` (lines 50-142)
- Risk: Low-quality or spam content not filtered. High-quality content incorrectly penalized by readability metrics.
- Priority: High - directly impacts report quality

**Untested Error Recovery Paths:**
- What's not tested: Partial result behavior when LLM fails, search fails, scraper fails. Fallback chains not exercised.
- Files: `src/orchestrator/Pipeline.ts` (lines 199-235)
- Risk: Unknown behavior in failure scenarios. Silent failures with wrong fallback data. allowPartialResults logic untested.
- Priority: Critical - production reliability depends on this

**Untested Cache Expiration:**
- What's not tested: Cache TTL enforcement, cleanup job behavior, concurrent access to cache, expired data handling
- Files: `src/utils/Cache.ts` (lines 73-79, 158-162, 212-224)
- Risk: Stale data served from cache. Memory leaks if cleanup doesn't run. Race conditions on concurrent access.
- Priority: Medium - affects long-running deployments

**Untested Rate Limiter Queue:**
- What's not tested: Queue overflow, rejections when maxConcurrent exceeded, delays under high load, queue ordering
- Files: `src/utils/RateLimiter.ts` (lines 20-61)
- Risk: Rate limiter bypassed under load. SearXNG/Jina rate limits hit unexpectedly. Items processed out of order.
- Priority: High - impacts API integration reliability

**Untested Cost Estimation:**
- What's not tested: Cost calculation accuracy, token estimation vs actual, pricing data freshness, cost breakdown formatting
- Files: `src/utils/CostEstimator.ts` (lines 49-62, 95-109)
- Risk: Cost estimates wildly off from actual. Billing surprises for users. Formatted cost string has bugs.
- Priority: Medium - affects user trust but not core functionality

---

*Concerns audit: 2026-02-06*

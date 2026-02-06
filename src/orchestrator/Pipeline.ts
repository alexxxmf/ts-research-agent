import type {
  ResearchResult,
  ResearchOptions,
  ResearchDepth,
  ProgressCallback,
  ModelConfig,
  AgentType,
  ModelTier,
  PlanningResponse,
  EvaluationResponse,
  FilteringResponse,
  SummaryResponse,
  ScrapedContent,
  SearchResult
} from '../types/index.js';
import { DEPTH_CONFIGS, DEFAULT_MODELS, DEFAULT_AGENT_TIERS } from '../types/index.js';
import { LLMProvider } from '../providers/LLMProvider.js';
import { SearchProvider } from '../providers/SearchProvider.js';
import { ScraperProvider } from '../providers/ScraperProvider.js';
import { Cache } from '../utils/Cache.js';
import { CostEstimator } from '../utils/CostEstimator.js';
import { QualityScorer } from '../utils/QualityScorer.js';
import { ConsoleFormatter } from '../utils/ConsoleFormatter.js';
import { PROMPTS } from '../config/prompts.js';

export class Pipeline {
  private llm: LLMProvider;
  private search: SearchProvider;
  private scraper: ScraperProvider;
  private cache: Cache;
  private costEstimator: CostEstimator;
  private modelConfig: ModelConfig;
  private seenUrls: Set<string> = new Set(); // Track URLs for deduplication

  constructor(
    llm: LLMProvider,
    search: SearchProvider,
    scraper: ScraperProvider,
    cache: Cache,
    modelConfig: ModelConfig = {}
  ) {
    this.llm = llm;
    this.search = search;
    this.scraper = scraper;
    this.cache = cache;
    this.modelConfig = modelConfig;
    this.costEstimator = new CostEstimator(false); // Will be enabled per-request
  }

  async execute(query: string, options: ResearchOptions = {}): Promise<ResearchResult> {
    const startTime = Date.now();
    const depth = options.depth || 'normal';
    const onProgress = options.onProgress || (() => {});
    const enableCostTracking = options.enableCostTracking ?? false;
    const signal = options.signal;
    const allowPartialResults = options.allowPartialResults ?? true;

    this.seenUrls.clear();
    this.costEstimator = new CostEstimator(enableCostTracking);

    const depthConfig = DEPTH_CONFIGS[depth];
    const executedQueries: string[] = [];
    const allSummaries: string[] = [];

    const checkCancellation = () => {
      if (signal?.aborted) {
        throw new Error('Research cancelled by user');
      }
    };

    let allScrapedContent: ScrapedContent[] = [];
    let currentRound = 0;
    let partialError: string | undefined;

    try {
      // Step 1: Planning
      checkCancellation();
      onProgress({ stage: 'planning', message: 'Analyzing query and generating search strategy...', progress: 10 });
      const plan = await this.planQueries(query);

      // Validate and filter queries
      const validQueries = plan.queries.filter(q => {
        const validation = QualityScorer.validateQuery(q.query);
        if (!validation.valid) {
          console.log(ConsoleFormatter.warning(`Skipping invalid query: "${q.query}" - ${validation.reason}`));
          return false;
        }
        return true;
      });

      const initialQueries = validQueries.slice(0, depthConfig.initialQueries.max);

      // Step 2: Execute searches

      for (let round = 0; round < depthConfig.maxRounds; round++) {
        checkCancellation();
        currentRound = round + 1;
        const queries = round === 0 ? initialQueries : [];

        if (queries.length === 0 && round > 0) {
          // Need evaluation to generate follow-ups
          checkCancellation();
          onProgress({
            stage: 'evaluating',
            message: `Round ${currentRound}: Analyzing gaps...`,
            progress: 30 + (round * 20)
          });

          const evaluation = await this.evaluateGaps(query, allSummaries);

        if (evaluation.goal_met || evaluation.follow_up_queries.length === 0) {
          onProgress({
            stage: 'evaluating',
            message: 'Research goal met, proceeding to final report...',
            progress: 70
          });
          break;
        }

        // Map follow-up queries to match the expected format
        queries.push(
          ...evaluation.follow_up_queries.slice(0, 3).map(q => ({
            query: q.query,
            purpose: q.rationale,
            priority: q.priority
          }))
        );
      }

        if (queries.length === 0) break;

        // Execute searches
        checkCancellation();
        onProgress({
          stage: 'searching',
          message: `Round ${currentRound}: Executing ${queries.length} search queries...`,
          progress: 25 + (round * 20)
        });

        const roundResults = await this.executeSearches(queries.map(q => q.query), depthConfig.resultsPerQuery.max);
        executedQueries.push(...queries.map(q => q.query));

        // Scrape content
        checkCancellation();
        onProgress({
          stage: 'scraping',
          message: `Round ${currentRound}: Fetching content from ${roundResults.length} sources...`,
          progress: 40 + (round * 20)
        });

        const scrapedContent = await this.scrapeResults(roundResults);
        allScrapedContent.push(...scrapedContent);

        // Summarize content
        checkCancellation();
        onProgress({
          stage: 'summarizing',
          message: `Round ${currentRound}: Synthesizing content...`,
          progress: 55 + (round * 20)
        });

        const summaries = await this.summarizeContent(query, scrapedContent);
        allSummaries.push(...summaries);
      }

      // Step 3: Filter and rank sources
      checkCancellation();
      onProgress({ stage: 'evaluating', message: 'Ranking sources by relevance...', progress: 85 });
      const rankedContent = await this.filterAndRank(query, allScrapedContent);

      // Step 4: Generate final report
      checkCancellation();
      onProgress({ stage: 'reporting', message: 'Generating final research report...', progress: 95 });
      const report = await this.generateReport(query, rankedContent);

      const totalDuration = Date.now() - startTime;
      const costs = this.costEstimator.getBreakdown();

      onProgress({ stage: 'reporting', message: 'Research complete!', progress: 100 });

      return {
        report,
        metadata: {
          queriesExecuted: executedQueries,
          sourcesScraped: allScrapedContent.length,
          totalDuration,
          rounds: currentRound,
          costs
        }
      };

    } catch (error: any) {
      partialError = error.message || 'Unknown error';
      console.error(ConsoleFormatter.warning(`Research error: ${partialError}`));

      // If we have partial results and user allows it, return what we have
      if (allowPartialResults && allScrapedContent.length > 0) {
        console.log(ConsoleFormatter.info(`Returning partial results with ${allScrapedContent.length} sources`));

        // Try to generate a report from what we have
        let report = '';
        try {
          const rankedContent = allScrapedContent.slice(0, 10);
          report = await this.generateReport(query, rankedContent);
        } catch (reportError) {
          // If even report generation fails, create a basic summary
          report = this.createBasicSummary(query, allScrapedContent);
        }

        const totalDuration = Date.now() - startTime;
        const costs = this.costEstimator.getBreakdown();

        return {
          report,
          metadata: {
            queriesExecuted: executedQueries,
            sourcesScraped: allScrapedContent.length,
            totalDuration,
            rounds: currentRound,
            costs,
            partial: true,
            error: partialError
          }
        };
      }

      // No partial results or user doesn't allow them - throw
      throw error;
    }
  }

  private async planQueries(query: string): Promise<PlanningResponse> {
    const prompt = PROMPTS.planning();
    const fullPrompt = `${prompt}\n\nRESEARCH QUERY: ${query}`;

    const model = this.getModelForAgent('planner');
    const response = await this.generateWithCache('planning', model, fullPrompt);

    try {
      return JSON.parse(response) as PlanningResponse;
    } catch (error) {
      // Fallback: extract queries manually
      console.warn('Failed to parse planning response, using fallback');
      return {
        analysis: 'Query analysis',
        queries: [{ query, purpose: 'Main search', priority: 1 }],
        synthesis_note: 'Direct search'
      };
    }
  }

  private async executeSearches(queries: string[], limitPerQuery: number): Promise<SearchResult[]> {
    const allResults: SearchResult[][] = [];

    // Execute searches sequentially with delay to avoid rate limiting
    for (let i = 0; i < queries.length; i++) {
      const result = await this.search.search(queries[i], limitPerQuery);
      allResults.push(result);

      // Add delay between searches (except for last one)
      if (i < queries.length - 1) {
        await this.sleep(2000); // 2 second delay between searches
      }
    }

    const uniqueResults = new Map<string, SearchResult>();
    allResults.flat().forEach(result => {
      if (!uniqueResults.has(result.url)) {
        uniqueResults.set(result.url, result);
      }
    });

    return Array.from(uniqueResults.values());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async scrapeResults(results: SearchResult[]): Promise<ScrapedContent[]> {
    const scrapedContent: ScrapedContent[] = [];

    for (const result of results) {
      const isDuplicate = this.seenUrls.has(result.url);
      if (!isDuplicate) {
        this.seenUrls.add(result.url);
      }

      const cached = await this.cache.get(result.url);

      if (cached) {
        const qualityScore = QualityScorer.scoreContent(result.title, result.url, cached);
        scrapedContent.push({
          title: result.title,
          url: result.url,
          content: cached,
          cached: true,
          qualityScore,
          duplicate: isDuplicate
        });
      } else {
        // Will be scraped in batch below
        scrapedContent.push({
          title: result.title,
          url: result.url,
          content: '',
          cached: false,
          duplicate: isDuplicate
        });
      }
    }

    const uncachedResults = results.filter((_, i) => !scrapedContent[i].cached);
    if (uncachedResults.length > 0) {
      const freshlyScraped = await this.scraper.scrapeMany(uncachedResults);

      // Merge back, add quality scores, and cache
      let uncachedIndex = 0;
      for (let i = 0; i < scrapedContent.length; i++) {
        if (!scrapedContent[i].cached) {
          const scraped = freshlyScraped[uncachedIndex];
          const qualityScore = QualityScorer.scoreContent(scraped.title, scraped.url, scraped.content);

          scrapedContent[i] = {
            ...scraped,
            qualityScore,
            duplicate: scrapedContent[i].duplicate
          };

          await this.cache.set(scrapedContent[i].url, scrapedContent[i].content);
          uncachedIndex++;
        }
      }
    }

    const avgQuality = scrapedContent.reduce((sum, item) => sum + (item.qualityScore || 0), 0) / scrapedContent.length;
    const duplicateCount = scrapedContent.filter(item => item.duplicate).length;

    if (duplicateCount > 0) {
      console.log(ConsoleFormatter.stat(`Scraped ${scrapedContent.length} sources (${duplicateCount} duplicates, avg quality: ${avgQuality.toFixed(0)}%)`));
    }

    // Sort by quality score (descending) - highest quality sources first
    return scrapedContent.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
  }

  private async summarizeContent(query: string, content: ScrapedContent[]): Promise<string[]> {
    const summaries: string[] = [];

    for (const item of content) {
      const prompt = PROMPTS.summarizer();
      const fullPrompt = `${prompt}\n\nRESEARCH TOPIC: ${query}\n\nSOURCE CONTENT:\n${item.content.slice(0, 8000)}`; // Limit content size

      const model = this.getModelForAgent('summarizer');
      const response = await this.generateWithCache(`summarize-${item.url}`, model, fullPrompt);

      try {
        const summary = JSON.parse(response) as SummaryResponse;
        summaries.push(`[${item.title}](${item.url})\n${summary.summary}\nKey takeaway: ${summary.key_takeaway}\n`);
      } catch (error) {
        // Fallback: use raw response
        summaries.push(`[${item.title}](${item.url})\n${response}\n`);
      }
    }

    return summaries;
  }

  private async evaluateGaps(query: string, summaries: string[]): Promise<EvaluationResponse> {
    const prompt = PROMPTS.evaluator();
    const summariesText = summaries.join('\n---\n');
    const fullPrompt = `${prompt}\n\nRESEARCH GOAL: ${query}\n\nSUMMARIES SO FAR:\n${summariesText}`;

    const model = this.getModelForAgent('evaluator');
    const response = await this.generateWithCache('evaluation', model, fullPrompt);

    try {
      return JSON.parse(response) as EvaluationResponse;
    } catch (error) {
      console.warn('Failed to parse evaluation response');
      return {
        summary: 'Evaluation complete',
        gaps: [],
        follow_up_queries: [],
        goal_met: true
      };
    }
  }

  private async filterAndRank(query: string, content: ScrapedContent[]): Promise<ScrapedContent[]> {
    const prompt = PROMPTS.filter();

    const sourcesList = content
      .map((item, i) => `${i}. [${item.title}](${item.url})\n   Snippet: ${item.content.slice(0, 200)}...`)
      .join('\n');

    const fullPrompt = `${prompt}\n\nRESEARCH TOPIC: ${query}\n\nSOURCES:\n${sourcesList}`;

    const model = this.getModelForAgent('filter');
    const response = await this.generateWithCache('filter', model, fullPrompt);

    try {
      const filtering = JSON.parse(response) as FilteringResponse;

      // Reorder content based on ranking
      const ranked = filtering.ranked_sources
        .filter(r => r.index < content.length)
        .map(r => content[r.index]);

      return ranked;
    } catch (error) {
      console.warn('Failed to parse filtering response, using original order');
      return content;
    }
  }

  private async generateReport(query: string, content: ScrapedContent[]): Promise<string> {
    const prompt = PROMPTS.reporter();

    // Limit content to avoid token limit (max ~50K characters per source, ~10 sources max)
    const MAX_CONTENT_LENGTH = 50000; // ~12.5K tokens per source
    const MAX_SOURCES = 10;

    const limitedContent = content
      .slice(0, MAX_SOURCES)
      .map(item => ({
        ...item,
        content: item.content.slice(0, MAX_CONTENT_LENGTH)
      }));

    const sourcesList = limitedContent
      .map((item, i) => `[${i + 1}] ${item.title}\nURL: ${item.url}\nContent:\n${item.content}\n`)
      .join('\n---\n');

    const fullPrompt = `${prompt}\n\nRESEARCH TOPIC: ${query}\n\nSOURCES (ranked by relevance):\n${sourcesList}`;

    const model = this.getModelForAgent('reporter');
    const response = await this.generateWithCache('report', model, fullPrompt);

    return response;
  }

  private getModelForAgent(agentType: AgentType): string {
    // Check custom models first
    if (this.modelConfig.customModels?.[agentType]) {
      return this.modelConfig.customModels[agentType]!;
    }

    // Get tier for agent
    const tier = this.modelConfig.tiers?.[agentType] || DEFAULT_AGENT_TIERS[agentType];

    // Check custom tier mappings
    if (this.modelConfig.tierModels?.[tier]) {
      return this.modelConfig.tierModels[tier]!;
    }

    // Use default mapping
    return DEFAULT_MODELS[tier];
  }

  private async generateWithCache(step: string, model: string, prompt: string): Promise<string> {
    const cached = await this.cache.getCachedLLM(prompt, model);
    if (cached) {
      return cached;
    }

    const promptTokens = this.llm.estimateTokens(prompt);
    const response = await this.llm.generate(prompt, { model });
    const completionTokens = this.llm.estimateTokens(response);

    this.costEstimator.logUsage(step, model, promptTokens, completionTokens);
    await this.cache.cacheLLM(prompt, model, response);

    return response;
  }

  private createBasicSummary(query: string, content: ScrapedContent[]): string {
    const sources = content
      .slice(0, 10)
      .map((item, i) => `${i + 1}. [${item.title}](${item.url})`)
      .join('\n');

    return `# Partial Research Results: ${query}

**Note:** This is a partial result due to an error during research. The following sources were collected before the error occurred.

## Sources Found

${sources}

## Summary

Research was interrupted after collecting ${content.length} source${content.length === 1 ? '' : 's'}. Please review the sources above for information related to: ${query}

---
*This is a partial result. Consider re-running the research or manually reviewing the sources listed above.*
`;
  }
}

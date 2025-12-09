import axios, { AxiosInstance } from 'axios';
import type { SearchProvider as ISearchProvider, SearchResult, SearchConfig, SearchError } from '../types/index.js';

interface SearXNGResult {
  title: string;
  url: string;
  content?: string;
}

interface SearXNGResponse {
  results: SearXNGResult[];
}

export class SearchProvider implements ISearchProvider {
  private config: SearchConfig;
  private currentInstanceIndex: number = 0;

  constructor(config: SearchConfig) {
    this.config = {
      instances: config.instances,
      priorityOrder: config.priorityOrder ?? false,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 10000
    };

    if (!this.config.instances || this.config.instances.length === 0) {
      throw new Error('At least one SearXNG instance must be provided');
    }
  }

  /**
   * Search using SearXNG with failover/rotation logic
   */
  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    const instances = this.config.instances;
    const maxRetries = this.config.maxRetries!;
    let lastError: Error | null = null;
    let totalRetryCount = 0;

    // Try each instance
    for (let instanceAttempt = 0; instanceAttempt < instances.length; instanceAttempt++) {
      const instanceUrl = this.getNextInstance();

      // Retry same instance multiple times before moving to next
      for (let retry = 0; retry < maxRetries; retry++) {
        try {
          const results = await this.executeSearch(instanceUrl, query, limit);

          // If we succeeded after retries, log success
          if (totalRetryCount > 2) {
            console.log(`✅ Search succeeded for "${query}" after ${totalRetryCount} retries`);
          }

          return results;
        } catch (error: any) {
          lastError = error;
          totalRetryCount++;

          // If it's a retryable error and we have retries left
          if (this.isRetryableError(error) && retry < maxRetries - 1) {
            // Exponential backoff: 500ms, 1s, 2s, 4s, 8s...
            const delay = 500 * Math.pow(2, retry);

            // Log to console after 2+ retries
            if (totalRetryCount > 2) {
              const errorMsg = this.getErrorMessage(error);
              console.log(`⚠️  Search retry ${totalRetryCount} for "${query}" - ${errorMsg} - waiting ${delay}ms before retry...`);
            }

            await this.sleep(delay);
            continue;
          }

          // If it's a server error (500+), try next instance
          if (error.response?.status >= 500) {
            if (totalRetryCount > 2) {
              console.log(`⚠️  Server error ${error.response.status} from ${instanceUrl}, trying next instance...`);
            }
            break; // Move to next instance
          }

          // For other errors, break and try next instance
          break;
        }
      }
    }

    // All instances and retries failed
    const errorMsg = this.getErrorMessage(lastError);
    console.error(`❌ Search failed for "${query}" after ${totalRetryCount} total retries: ${errorMsg}`);

    throw {
      name: 'SearchError',
      message: `Search failed across all instances after ${totalRetryCount} retries: ${errorMsg}`,
      code: 'SEARCH_ERROR',
      details: { query, totalRetries: totalRetryCount, lastError: errorMsg }
    } as SearchError;
  }

  /**
   * Execute search against a specific instance
   */
  private async executeSearch(instanceUrl: string, query: string, limit: number): Promise<SearchResult[]> {
    const client = axios.create({
      timeout: this.config.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',  // ONLY accept JSON
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1'
      }
    });

    const searchUrl = new URL(`${instanceUrl}/search`);
    searchUrl.searchParams.append('q', query);
    searchUrl.searchParams.append('format', 'json');
    searchUrl.searchParams.append('safesearch', '0');

    const response = await client.get<SearXNGResponse>(searchUrl.toString());

    // Debug logging
    if (!response.data) {
      console.error('No response data from SearXNG');
      throw new Error('Invalid response from SearXNG: No data');
    }

    if (!response.data.results) {
      console.error('No results field in response:', JSON.stringify(response.data).slice(0, 200));
      throw new Error('Invalid response from SearXNG: No results field');
    }

    if (!Array.isArray(response.data.results)) {
      console.error('Results is not an array:', typeof response.data.results);
      throw new Error('Invalid response from SearXNG: Results is not an array');
    }

    // Map results and limit
    const results: SearchResult[] = response.data.results
      .slice(0, limit)
      .map(result => ({
        title: result.title,
        url: result.url,
        snippet: result.content
      }));

    return results;
  }

  /**
   * Get next instance based on priority order or round-robin
   */
  private getNextInstance(): string {
    if (this.config.priorityOrder) {
      // Priority order: always try first, then second, etc.
      const instance = this.config.instances[this.currentInstanceIndex];
      this.currentInstanceIndex = (this.currentInstanceIndex + 1) % this.config.instances.length;
      return instance;
    } else {
      // Random rotation
      const randomIndex = Math.floor(Math.random() * this.config.instances.length);
      return this.config.instances[randomIndex];
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors (no response)
    if (!error.response) {
      return true;
    }

    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // Rate limiting
    if (error.response?.status === 429) {
      return true;
    }

    // Server errors
    if (error.response?.status >= 500) {
      return true;
    }

    return false;
  }

  /**
   * Get human-readable error message
   */
  private getErrorMessage(error: any): string {
    if (!error) return 'Unknown error';

    if (error.response) {
      const status = error.response.status;
      if (status === 429) return 'Rate limited (429)';
      if (status === 403) return 'Access forbidden (403)';
      if (status >= 500) return `Server error (${status})`;
      return `HTTP ${status}`;
    }

    if (error.code === 'ECONNABORTED') return 'Request timeout';
    if (error.code === 'ETIMEDOUT') return 'Connection timeout';
    if (error.code === 'ECONNREFUSED') return 'Connection refused';
    if (error.code === 'ENOTFOUND') return 'Host not found';

    return error.message || 'Network error';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

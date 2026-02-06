import axios from 'axios';
import type { ScraperProvider as IScraperProvider, ScrapedContent, SearchResult } from '../types/index.js';
import { RateLimiter } from '../utils/RateLimiter.js';

const JINA_BASE = 'https://r.jina.ai/';

export class ScraperProvider implements IScraperProvider {
  private rateLimiter: RateLimiter;
  private maxRetries: number = 3;
  private timeout: number = 30000; // 30 seconds per scrape

  constructor(maxConcurrent: number = 20) {
    // Jina.ai free tier: 20 requests per second
    this.rateLimiter = new RateLimiter(maxConcurrent, 50); // 50ms = 20/sec
  }

  async scrape(url: string): Promise<string> {
    return this.rateLimiter.add(() => this.executeScrape(url));
  }

  async scrapeMany(results: SearchResult[]): Promise<ScrapedContent[]> {
    const scrapePromises = results.map(async (result) => {
      try {
        const content = await this.scrape(result.url);
        return {
          title: result.title,
          url: result.url,
          content,
          cached: false
        };
      } catch (error) {
        // Fallback to snippet if scraping fails
        return {
          title: result.title,
          url: result.url,
          content: result.snippet || 'Content unavailable',
          cached: false
        };
      }
    });

    return Promise.all(scrapePromises);
  }

  private async executeScrape(url: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await axios.get(`${JINA_BASE}${url}`, {
          timeout: this.timeout,
          headers: {
            'Accept': 'text/plain',
            'X-Return-Format': 'markdown'
          }
        });

        if (!response.data || typeof response.data !== 'string') {
          throw new Error('Invalid response from Jina.ai');
        }

        return response.data;
      } catch (error: any) {
        lastError = error;

        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * Math.pow(2, attempt);

          if (attempt < this.maxRetries - 1) {
            await this.sleep(delay);
            continue;
          }
        }

        // Handle server errors
        if (error.response?.status >= 500 && attempt < this.maxRetries - 1) {
          await this.sleep(1000 * Math.pow(2, attempt));
          continue;
        }

        // Handle timeouts
        if (error.code === 'ECONNABORTED' && attempt < this.maxRetries - 1) {
          await this.sleep(1000 * Math.pow(2, attempt));
          continue;
        }

        // Don't retry on client errors
        if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
          break;
        }

        // Retry on network errors
        if (!error.response && attempt < this.maxRetries - 1) {
          await this.sleep(1000 * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw new Error(`Failed to scrape ${url}: ${lastError?.message}`);
  }

  getStats() {
    return this.rateLimiter.getStats();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

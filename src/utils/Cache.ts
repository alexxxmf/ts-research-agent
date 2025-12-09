import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import type { CacheProvider, PersistenceConfig } from '../types/index.js';

export class Cache implements CacheProvider {
  private db: Database.Database | null = null;
  private enabled: boolean;
  private cacheDuration: number;

  constructor(config?: PersistenceConfig) {
    this.enabled = config?.enabled ?? false;
    this.cacheDuration = (config?.cacheDuration ?? 24) * 60 * 60 * 1000; // Convert hours to ms

    if (this.enabled && config?.storagePath) {
      this.initializeDatabase(config.storagePath);
    }
  }

  /**
   * Initialize SQLite database
   */
  private initializeDatabase(storagePath: string): void {
    try {
      this.db = new Database(storagePath);

      // Create tables
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS search_cache (
          url TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          scraped_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS llm_cache (
          prompt_hash TEXT PRIMARY KEY,
          response TEXT NOT NULL,
          model TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          state TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_search_scraped ON search_cache(scraped_at);
        CREATE INDEX IF NOT EXISTS idx_llm_created ON llm_cache(created_at);
        CREATE INDEX IF NOT EXISTS idx_session_updated ON sessions(updated_at);
      `);

      // Clean up old entries
      this.cleanup();
    } catch (error) {
      console.warn('Failed to initialize cache database:', error);
      this.enabled = false;
    }
  }

  /**
   * Get cached value
   */
  async get(key: string): Promise<string | null> {
    if (!this.enabled || !this.db) return null;

    try {
      const row = this.db
        .prepare('SELECT content, scraped_at FROM search_cache WHERE url = ?')
        .get(key) as { content: string; scraped_at: number } | undefined;

      if (!row) return null;

      // Check if cache is still valid
      const age = Date.now() - row.scraped_at;
      if (age > this.cacheDuration) {
        // Expired, delete it
        this.db.prepare('DELETE FROM search_cache WHERE url = ?').run(key);
        return null;
      }

      return row.content;
    } catch (error) {
      console.warn('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached value
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.enabled || !this.db) return;

    try {
      const now = Date.now();
      this.db
        .prepare('INSERT OR REPLACE INTO search_cache (url, content, scraped_at) VALUES (?, ?, ?)')
        .run(key, value, now);
    } catch (error) {
      console.warn('Cache set error:', error);
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    if (!this.enabled || !this.db) return;

    try {
      this.db.exec('DELETE FROM search_cache; DELETE FROM llm_cache; DELETE FROM sessions;');
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  /**
   * Cache LLM response
   */
  async cacheLLM(prompt: string, model: string, response: string): Promise<void> {
    if (!this.enabled || !this.db) return;

    try {
      const hash = this.hashPrompt(prompt, model);
      const now = Date.now();

      this.db
        .prepare('INSERT OR REPLACE INTO llm_cache (prompt_hash, response, model, created_at) VALUES (?, ?, ?, ?)')
        .run(hash, response, model, now);
    } catch (error) {
      console.warn('LLM cache error:', error);
    }
  }

  /**
   * Get cached LLM response
   */
  async getCachedLLM(prompt: string, model: string): Promise<string | null> {
    if (!this.enabled || !this.db) return null;

    try {
      const hash = this.hashPrompt(prompt, model);
      const row = this.db
        .prepare('SELECT response, created_at FROM llm_cache WHERE prompt_hash = ?')
        .get(hash) as { response: string; created_at: number } | undefined;

      if (!row) return null;

      // Check if cache is still valid
      const age = Date.now() - row.created_at;
      if (age > this.cacheDuration) {
        this.db.prepare('DELETE FROM llm_cache WHERE prompt_hash = ?').run(hash);
        return null;
      }

      return row.response;
    } catch (error) {
      console.warn('LLM cache get error:', error);
      return null;
    }
  }

  /**
   * Save session state
   */
  async saveSession(id: string, state: any): Promise<void> {
    if (!this.enabled || !this.db) return;

    try {
      const now = Date.now();
      const stateJson = JSON.stringify(state);

      this.db
        .prepare('INSERT OR REPLACE INTO sessions (id, state, updated_at) VALUES (?, ?, ?)')
        .run(id, stateJson, now);
    } catch (error) {
      console.warn('Session save error:', error);
    }
  }

  /**
   * Load session state
   */
  async loadSession(id: string): Promise<any | null> {
    if (!this.enabled || !this.db) return null;

    try {
      const row = this.db
        .prepare('SELECT state FROM sessions WHERE id = ?')
        .get(id) as { state: string } | undefined;

      if (!row) return null;

      return JSON.parse(row.state);
    } catch (error) {
      console.warn('Session load error:', error);
      return null;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    if (!this.enabled || !this.db) return;

    try {
      const cutoff = Date.now() - this.cacheDuration;

      this.db.prepare('DELETE FROM search_cache WHERE scraped_at < ?').run(cutoff);
      this.db.prepare('DELETE FROM llm_cache WHERE created_at < ?').run(cutoff);
      // Don't auto-cleanup sessions
    } catch (error) {
      console.warn('Cache cleanup error:', error);
    }
  }

  /**
   * Hash prompt and model for caching
   */
  private hashPrompt(prompt: string, model: string): string {
    return createHash('sha256').update(`${model}:${prompt}`).digest('hex');
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

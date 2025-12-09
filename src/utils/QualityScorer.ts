/**
 * Quality scoring for scraped content
 * Scores content 0-100 based on various heuristics
 */

export interface QualityFactors {
  contentLength: number;
  hasTitle: number;
  domainReputation: number;
  readability: number;
}

export class QualityScorer {
  private static REPUTABLE_DOMAINS = new Set([
    // Academic & Research
    'edu', 'ac.uk', 'scholar.google.com', 'researchgate.net', 'arxiv.org', 'pubmed.ncbi.nlm.nih.gov',
    'nature.com', 'science.org', 'sciencedirect.com', 'springer.com', 'wiley.com',

    // Government & Organizations
    'gov', 'nih.gov', 'cdc.gov', 'who.int', 'un.org', 'europa.eu',

    // Reputable News & Media
    'nytimes.com', 'wsj.com', 'bbc.com', 'reuters.com', 'apnews.com', 'theguardian.com',

    // Tech & Documentation
    'github.com', 'stackoverflow.com', 'medium.com', 'dev.to', 'mozilla.org', 'w3.org'
  ]);

  /**
   * Score content quality from 0-100
   */
  static scoreContent(title: string, url: string, content: string): number {
    const factors: QualityFactors = {
      contentLength: this.scoreContentLength(content),
      hasTitle: title.length > 0 ? 25 : 0,
      domainReputation: this.scoreDomainReputation(url),
      readability: this.scoreReadability(content)
    };

    // Weighted sum
    const score =
      factors.contentLength * 0.35 +
      factors.hasTitle * 0.15 +
      factors.domainReputation * 0.30 +
      factors.readability * 0.20;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Score based on content length (sweet spot: 1000-10000 chars)
   */
  private static scoreContentLength(content: string): number {
    const length = content.length;

    if (length < 200) return 10; // Too short
    if (length < 500) return 30;
    if (length < 1000) return 50;
    if (length < 3000) return 80;
    if (length < 10000) return 100; // Ideal range
    if (length < 30000) return 90; // Still good
    if (length < 100000) return 70; // Getting long
    return 50; // Very long, possibly dump/spam
  }

  /**
   * Score domain reputation
   */
  private static scoreDomainReputation(url: string): number {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Check TLD
      if (hostname.endsWith('.edu') || hostname.endsWith('.ac.uk') || hostname.endsWith('.gov')) {
        return 100; // Academic/Government
      }

      // Check against reputable domains
      for (const domain of this.REPUTABLE_DOMAINS) {
        if (hostname.includes(domain)) {
          return 90;
        }
      }

      // Check for suspicious patterns
      if (hostname.split('.').length > 4) return 30; // Too many subdomains
      if (/\d{3,}/.test(hostname)) return 20; // Many numbers (spam-like)
      if (hostname.length > 50) return 20; // Suspiciously long

      // Default for unknown domains
      return 60;
    } catch {
      return 0; // Invalid URL
    }
  }

  /**
   * Score readability (simple heuristics)
   */
  private static scoreReadability(content: string): number {
    // Remove extra whitespace for analysis
    const normalized = content.replace(/\s+/g, ' ').trim();

    if (normalized.length === 0) return 0;

    // Calculate metrics
    const sentences = normalized.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    const avgWordsPerSentence = words.length / Math.max(1, sentences.length);
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / Math.max(1, words.length);

    // Good readability: 15-25 words/sentence, 4-6 chars/word
    let score = 50; // Base score

    // Sentence length score
    if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 30) {
      score += 25;
    } else if (avgWordsPerSentence < 5 || avgWordsPerSentence > 50) {
      score -= 15; // Too short or too long
    }

    // Word length score
    if (avgWordLength >= 4 && avgWordLength <= 7) {
      score += 25;
    } else if (avgWordLength < 3 || avgWordLength > 10) {
      score -= 15;
    }

    // Penalty for excessive special characters (possible spam/encoding issues)
    const specialCharRatio = (normalized.match(/[^\w\s.,!?;:()\-'"]/g) || []).length / normalized.length;
    if (specialCharRatio > 0.1) {
      score -= 30;
    }

    // Check for paragraph structure
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) {
      score += 10; // Has paragraph structure
    }

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Validate query quality
   */
  static validateQuery(query: string): { valid: boolean; reason?: string } {
    const trimmed = query.trim();

    // Length checks
    if (trimmed.length < 3) {
      return { valid: false, reason: 'Query too short (minimum 3 characters)' };
    }
    if (trimmed.length > 200) {
      return { valid: false, reason: 'Query too long (maximum 200 characters)' };
    }

    // Content checks
    if (/^[^a-zA-Z0-9]+$/.test(trimmed)) {
      return { valid: false, reason: 'Query contains only special characters' };
    }

    // Check for excessive repetition (spam-like)
    const words = trimmed.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length > 3 && uniqueWords.size / words.length < 0.4) {
      return { valid: false, reason: 'Query has too much repetition' };
    }

    // Check for overly broad queries
    const broadTerms = ['what', 'how', 'why', 'when', 'where', 'who'];
    const isBroad = words.length <= 2 && broadTerms.some(term => words.includes(term));
    if (isBroad) {
      return { valid: false, reason: 'Query too broad (single question word)' };
    }

    return { valid: true };
  }
}

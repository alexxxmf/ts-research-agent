# Research Agent

A powerful, cost-effective deep research agent built with TypeScript. Uses SearXNG for search, Jina.ai for content scraping, and OpenRouter for LLM-powered analysis and report generation.

## Features

- 🔍 **Multi-round research** with configurable depth (shallow, normal, deep)
- 🌐 **Free-tier friendly** - Uses SearXNG (open-source search) and Jina.ai (20 req/s free)
- 💰 **Cost-optimized** - DeepSeek and other affordable models via OpenRouter (~$0.15-0.30 per research)
- 📊 **Comprehensive reports** - Generates publication-ready Markdown reports with citations
- ⚡ **Smart caching** - Optional SQLite caching to avoid redundant API calls
- 🔄 **Failover & rate limiting** - Robust error handling and automatic retries
- 📈 **Progress tracking** - Real-time progress callbacks
- 💵 **Cost estimation** - Optional token and cost tracking

## Installation

```bash
npm install research-agent
```

## Prerequisites

### Set Up SearXNG (Required)

For reliable searches, **self-host SearXNG locally** (recommended, otherwise you will be heavily rate-limited or not even allowed because of requesting JSON).

Make sure to allow `JSON` in your personal instance and set `delimiter: false`.

> **Why self-host?** Public SearXNG instances often block programmatic API access. Self-hosting ensures reliable, unlimited access.
>
> **Included:** 40+ search engines (Google, Bing, DuckDuckGo, Brave, Scholar, GitHub, etc.) with Redis caching for performance.
>

### Get OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai/)
2. Create an API key at [openrouter.ai/keys](https://openrouter.ai/keys)
3. Add credits to your account (~$5 is plenty for testing)

## Quick Start

```typescript
import { ResearchAgent } from 'research-agent';

const agent = new ResearchAgent({
  openRouterKey: 'your-openrouter-api-key',
  searxngConfig: {
    instances: ['http://localhost:8080']  // Your local SearXNG instance or you could deploy it to some cheap VPS, probably for 3/5 a month more than enough 1/2gb ram
  }
});

const result = await agent.research('What are the benefits of creatine?', {
  depth: 'normal',
  enableCostTracking: true,
  onProgress: (event) => {
    console.log(`[${event.stage}] ${event.message}`);
  }
});

console.log(result.report);
console.log(`Cost: $${result.metadata.costs?.estimatedCost}`);

agent.close();
```

## Configuration

### Basic Configuration

```typescript
interface ResearchAgentConfig {
  openRouterKey: string;           // Required: Your OpenRouter API key
  searxngConfig: SearchConfig;     // Required: SearXNG instance configuration
  depth?: 'shallow' | 'normal' | 'deep';  // Default: 'normal'
  model?: ModelConfig;             // Optional: Custom model configuration
  persistence?: PersistenceConfig; // Optional: Enable caching
  maxConcurrentScrapes?: number;   // Default: 20
}
```

### SearXNG Configuration

```typescript
interface SearchConfig {
  instances: string[];      // Array of SearXNG instance URLs
  priorityOrder?: boolean;  // false = random rotation, true = failover (default: false)
  maxRetries?: number;      // Max retries per instance (default: 3)
  timeout?: number;         // Request timeout in ms (default: 10000)
}
```

### Model Configuration

The library supports three tiers of models (small, medium, large) for different agents:

```typescript
const agent = new ResearchAgent({
  openRouterKey: 'your-key',
  searxngConfig: { instances: ['...'] },
  model: {
    // Option 1: Use tier system (recommended)
    tiers: {
      planner: 'medium',      // Default: 'medium'
      parser: 'small',        // Default: 'small'
      summarizer: 'small',    // Default: 'small'
      evaluator: 'medium',    // Default: 'medium'
      filter: 'small',        // Default: 'small'
      reporter: 'large'       // Default: 'large'
    },

    // Option 2: Override default tier mappings
    tierModels: {
      small: 'meta-llama/llama-3.1-8b-instruct',
      medium: 'google/gemini-2.5-flash-preview-09-2025',
      large: 'deepseek/deepseek-chat'
    },

    // Option 3: Specify exact models per agent
    customModels: {
      reporter: 'openai/gpt-4o-mini'
    }
  }
});
```

**Default Model Tiers (Updated 2025-12-09):**
- **Small**: `meta-llama/llama-3.1-8b-instruct` (~$0.02-0.03/1M tokens)
- **Medium**: `google/gemini-2.5-flash-preview-09-2025` (~$0.30-2.50/1M tokens)
- **Large**: `deepseek/deepseek-chat` (~$0.30-1.20/1M tokens)

### Persistence (Caching)

Enable caching to save money and speed up repeated queries:

```typescript
const agent = new ResearchAgent({
  openRouterKey: 'your-key',
  searxngConfig: { instances: ['...'] },
  persistence: {
    enabled: true,
    storagePath: './research-cache.db',  // Required if enabled
    cacheDuration: 24,                   // Hours (default: 24)
    resumable: false                     // Enable session resumption (default: false)
  }
});
```

## Research Depth Levels

| Depth | Initial Queries | Results per Query | Max Rounds | Use Case |
|-------|----------------|-------------------|------------|----------|
| **shallow** | 2-3 | 3-5 | 1 | Quick overview, simple questions |
| **normal** | 3-5 | 5-8 | 2 | Standard research, balanced depth |
| **deep** | 5-7 | 8-12 | 3 | Comprehensive analysis, complex topics |

## API

### `ResearchAgent`

#### Constructor

```typescript
new ResearchAgent(config: ResearchAgentConfig)
```

#### Methods

##### `research(query, options?)`

Execute a research query.

```typescript
async research(
  query: string,
  options?: {
    depth?: 'shallow' | 'normal' | 'deep';
    onProgress?: (event: ProgressEvent) => void;
    enableCostTracking?: boolean;
    customPrompts?: Partial<PromptSet>;
  }
): Promise<ResearchResult>
```

**Returns:**

```typescript
interface ResearchResult {
  report: string;              // Markdown research report
  metadata: {
    queriesExecuted: string[]; // All queries executed
    sourcesScraped: number;    // Number of sources scraped
    totalDuration: number;     // Duration in ms
    rounds: number;            // Number of research rounds
    costs?: {                  // Cost breakdown (if enabled)
      totalTokens: number;
      estimatedCost: number;   // USD
      breakdown: Array<{
        step: string;
        model: string;
        tokens: number;
        cost: number;
      }>;
    };
  };
}
```

##### `close()`

Close database connections and cleanup resources.

```typescript
agent.close()
```

## Examples

### Basic Usage

```typescript
import { ResearchAgent } from 'research-agent';

const agent = new ResearchAgent({
  openRouterKey: process.env.OPENROUTER_API_KEY!,
  searxngConfig: {
    instances: ['https://searx.tiekoetter.com']
  }
});

const result = await agent.research(
  'What is the current state of quantum computing?'
);

console.log(result.report);
agent.close();
```

### With Progress Tracking

```typescript
const result = await agent.research(
  'How does intermittent fasting affect longevity?',
  {
    depth: 'deep',
    enableCostTracking: true,
    onProgress: (event) => {
      const emoji = {
        planning: '🧠',
        searching: '🔍',
        scraping: '📄',
        summarizing: '✍️',
        evaluating: '🔬',
        reporting: '📊'
      }[event.stage];

      console.log(`${emoji} ${event.message} (${event.progress}%)`);
    }
  }
);
```

### Custom Models for Better Quality

```typescript
const agent = new ResearchAgent({
  openRouterKey: process.env.OPENROUTER_API_KEY!,
  searxngConfig: {
    instances: ['https://searx.tiekoetter.com']
  },
  model: {
    tiers: {
      planner: 'large',
      evaluator: 'large',
      reporter: 'large'
    }
  }
});
```

### With Caching (Recommended)

```typescript
const agent = new ResearchAgent({
  openRouterKey: process.env.OPENROUTER_API_KEY!,
  searxngConfig: {
    instances: ['https://searx.tiekoetter.com']
  },
  persistence: {
    enabled: true,
    storagePath: './cache/research.db',
    cacheDuration: 48 // 2 days
  }
});
```

## Environment Variables

Create a `.env` file:

```env
OPENROUTER_API_KEY=your-openrouter-api-key
```

## Cost Optimization Tips

1. **Use caching** - Enable persistence to avoid redundant API calls
2. **Start with shallow** - Test queries with `depth: 'shallow'` first
3. **Use tier system** - Default tiers are already optimized for cost
4. **Track costs** - Enable `enableCostTracking` to monitor spending
5. **Limit concurrent scrapes** - Lower `maxConcurrentScrapes` if hitting rate limits

## Public SearXNG Instances

Some reliable public instances:

- `https://searx.tiekoetter.com`
- `https://searx.be`
- `https://search.bus-hit.me`
- `https://searx.work`
- `https://searx.fmac.xyz`

For more instances, see: [searx.space](https://searx.space/)

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                      ResearchAgent                     │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Planning   │→ │  Searching   │→ │   Scraping   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         ↓                                   ↓          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Summarizing  │← │  Evaluating  │← │  Filtering   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         ↓                                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │                   Final Report                   │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘

Providers:
  • LLMProvider (OpenRouter)
  • SearchProvider (SearXNG with failover)
  • ScraperProvider (Jina.ai with rate limiting)
  • Cache (SQLite, optional)
```

## Requirements

- Node.js >= 18.0.0
- OpenRouter API key
- Access to SearXNG instance(s)

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Roadmap

- [ ] Add support for custom scraping providers
- [ ] Implement more advanced caching strategies
- [ ] Add support for local LLM providers
- [ ] Create web interface
- [ ] Add citation verification
- [ ] Support for images and charts in reports

## Utilities

### Fetch Available Models

The library includes a utility to fetch and explore all available models from OpenRouter:

```bash
npm run fetch-models
```

This will:
- Fetch all available models from OpenRouter
- Categorize them by price tier
- Show recommended models for the research agent
- Save the full list to `openrouter-models.json`

You can use this to:
- Discover new models
- Check current pricing
- Find alternatives to default models
- Update model IDs if they change

Example output:
```
🔍 Fetching available models from OpenRouter...
✅ Found 339 models

📊 Price Tiers:
  Small (<$0.10/1M): 45 models
  Medium ($0.10-$0.50/1M): 28 models
  Large (>$0.50/1M): 266 models

💡 Recommended Models:
  Small: meta-llama/llama-3.1-8b-instruct
  Medium: google/gemini-2.5-flash-preview-09-2025
  Large: deepseek/deepseek-chat

✅ Saved 339 models to ./openrouter-models.json
```

## Support

For issues, questions, or contributions:
- GitHub Issues: [github.com/yourusername/research-agent](https://github.com/yourusername/research-agent)

---

Built with ❤️ using TypeScript

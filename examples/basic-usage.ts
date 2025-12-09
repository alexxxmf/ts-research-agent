import { ResearchAgent } from '../src/index.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Basic usage example
 */
async function basicExample() {
  console.log('🔬 Basic Research Example\n');

  // NOTE: Many public SearXNG instances block API access
  // For reliable results, self-host SearXNG locally:
  // docker run -d -p 8080:8080 searxng/searxng:latest
  // Then use: 'http://localhost:8080'
  //
  // See SEARXNG_INSTANCES.md for setup guide

  const agent = new ResearchAgent({
    openRouterKey: process.env.OPENROUTER_API_KEY!,
    searxngConfig: {
      instances: [
        process.env.SEARXNG_URL || 'http://localhost:8080',  // Use env var or localhost
        // Backup public instances (may be blocked):
        'https://searx.fmac.xyz',
        'https://search.ononoki.org'
      ],
      priorityOrder: true,  // Try localhost first, then failover
      maxRetries: 2,
      timeout: 15000
    }
  });

  const result = await agent.research('What are the benefits of using creatine for muscle building?', {
    depth: 'shallow',
    enableCostTracking: true,
    onProgress: (event) => {
      console.log(`[${event.stage}] ${event.message} (${event.progress}%)`);
    }
  });

  console.log('\n📄 Research Report:\n');
  console.log(result.report);

  console.log('\n📊 Metadata:');
  console.log(`  - Queries executed: ${result.metadata.queriesExecuted.length}`);
  console.log(`  - Sources scraped: ${result.metadata.sourcesScraped}`);
  console.log(`  - Duration: ${(result.metadata.totalDuration / 1000).toFixed(2)}s`);
  console.log(`  - Rounds: ${result.metadata.rounds}`);

  if (result.metadata.costs) {
    console.log(`\n💰 Cost: $${result.metadata.costs.estimatedCost.toFixed(4)}`);
  }

  agent.close();
}

/**
 * Advanced usage with custom model configuration
 */
async function advancedExample() {
  console.log('🔬 Advanced Research Example with Custom Models\n');

  const agent = new ResearchAgent({
    openRouterKey: process.env.OPENROUTER_API_KEY!,
    searxngConfig: {
      instances: ['https://searx.tiekoetter.com'],
      priorityOrder: true, // Failover mode
      maxRetries: 3
    },
    depth: 'deep',
    model: {
      tiers: {
        planner: 'large',    // Use better model for planning
        evaluator: 'large',  // Use better model for evaluation
        reporter: 'large'    // Use best model for final report
      }
    },
    persistence: {
      enabled: true,
      storagePath: './research-cache.db',
      cacheDuration: 24, // 24 hours
      resumable: false
    },
    maxConcurrentScrapes: 15 // Be more conservative
  });

  const result = await agent.research('How does intermittent fasting affect metabolic health and longevity?', {
    enableCostTracking: true,
    onProgress: (event) => {
      const emoji = {
        planning: '🧠',
        searching: '🔍',
        scraping: '📄',
        summarizing: '✍️',
        evaluating: '🔬',
        reporting: '📊'
      }[event.stage] || '⚙️';

      console.log(`${emoji} [${event.stage}] ${event.message}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log(result.report);
  console.log('='.repeat(80));

  console.log('\n📊 Research Metadata:');
  console.log(`  Queries: ${result.metadata.queriesExecuted.join(', ')}`);
  console.log(`  Sources: ${result.metadata.sourcesScraped}`);
  console.log(`  Duration: ${(result.metadata.totalDuration / 1000).toFixed(2)}s`);
  console.log(`  Rounds: ${result.metadata.rounds}`);

  if (result.metadata.costs) {
    console.log('\n💰 Cost Breakdown:');
    result.metadata.costs.breakdown.forEach(entry => {
      console.log(`  ${entry.step}: ${entry.tokens.toLocaleString()} tokens ($${entry.cost.toFixed(4)}) - ${entry.model}`);
    });
    console.log(`  Total: $${result.metadata.costs.estimatedCost.toFixed(4)}`);
  }

  agent.close();
}

/**
 * Custom tier models example
 */
async function customTierModelsExample() {
  console.log('🔬 Custom Tier Models Example\n');

  const agent = new ResearchAgent({
    openRouterKey: process.env.OPENROUTER_API_KEY!,
    searxngConfig: {
      instances: ['https://searx.tiekoetter.com']
    },
    model: {
      // Override the default tier to model mappings
      tierModels: {
        small: 'meta-llama/llama-3.1-8b-instruct',
        medium: 'qwen/qwen-2.5-72b-instruct',
        large: 'openai/gpt-4o-mini'
      }
    }
  });

  const result = await agent.research('What is the current state of quantum computing?', {
    depth: 'normal',
    enableCostTracking: true
  });

  console.log(result.report);
  agent.close();
}

// Run examples
async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    // Choose which example to run
    const exampleType = process.argv[2] || 'basic';

    switch (exampleType) {
      case 'basic':
        await basicExample();
        break;
      case 'advanced':
        await advancedExample();
        break;
      case 'custom':
        await customTierModelsExample();
        break;
      default:
        console.error('Unknown example type. Use: basic, advanced, or custom');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

/**
 * Advanced Features Example
 *
 * Demonstrates:
 * 1. AbortSignal support for cancellation
 * 2. Partial results on error
 * 3. Quality scoring (automatic)
 * 4. Deduplication (automatic)
 * 5. Query validation (automatic)
 */

import { ResearchAgent } from '../src/ResearchAgent.js';
import { ConsoleFormatter } from '../src/utils/ConsoleFormatter.js';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENROUTER_API_KEY;
const searxngUrl = process.env.SEARXNG_URL || 'http://192.168.1.189:8080';

if (!apiKey) {
  console.error('❌ Error: OPENROUTER_API_KEY not found in .env');
  process.exit(1);
}

const agent = new ResearchAgent({
  openRouterKey: apiKey,
  searxngConfig: {
    instances: [searxngUrl],
    priorityOrder: true,
    maxRetries: 3
  },
  model: {
    tierModels: {
      small: 'meta-llama/llama-3.1-8b-instruct',
      medium: 'google/gemini-2.5-flash-preview-09-2025',
      large: 'deepseek/deepseek-chat'
    }
  },
  maxConcurrentScrapes: 20,
  depth: 'normal'
});

async function demonstrateCancellation() {
  console.log('\n🔴 Demo 1: Cancellation Support\n');
  console.log('Starting research with 3-second timeout...\n');

  const controller = new AbortController();

  // Cancel after 3 seconds
  const timeout = setTimeout(() => {
    console.log('\n⏰ 3 seconds elapsed, cancelling research...\n');
    controller.abort();
  }, 3000);

  try {
    const result = await agent.research(
      'history of quantum computing',
      {
        depth: 'deep', // This would take a while
        signal: controller.signal,
        allowPartialResults: true, // Try to get partial results
        enableCostTracking: true
      }
    );

    clearTimeout(timeout);
    console.log('✅ Research completed (before cancellation)');
    console.log(`Sources: ${result.metadata.sourcesScraped}`);
    console.log(`Cost: $${result.metadata.costs?.estimatedCost.toFixed(4) || '0'}`);

  } catch (error: any) {
    clearTimeout(timeout);
    if (error.message.includes('cancelled')) {
      console.log('✅ Cancellation worked! Research was aborted.');
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function demonstratePartialResults() {
  console.log('\n🟡 Demo 2: Partial Results on Error\n');
  console.log('Research with error recovery enabled...\n');

  try {
    const result = await agent.research(
      'benefits of sleep for athletic performance',
      {
        depth: 'normal',
        allowPartialResults: true, // Enable partial results
        enableCostTracking: true,
        onProgress: (event) => {
          console.log(ConsoleFormatter.format(event.stage, event.message, event.progress));
        }
      }
    );

    if (result.metadata.partial) {
      console.log('\n⚠️  Got partial results due to error:');
      console.log(`Error: ${result.metadata.error}`);
      console.log(`Sources collected: ${result.metadata.sourcesScraped}`);
    } else {
      console.log('\n✅ Research completed successfully');
    }

    console.log(`\nCost: $${result.metadata.costs?.estimatedCost.toFixed(4) || '0'}`);
    console.log(`Duration: ${(result.metadata.totalDuration / 1000).toFixed(1)}s`);
    console.log(`\nReport (first 500 chars):\n${result.report.slice(0, 500)}...`);

  } catch (error: any) {
    console.error(`❌ Complete failure: ${error.message}`);
  }
}

async function demonstrateQualityFeatures() {
  console.log('\n🟢 Demo 3: Quality Scoring & Deduplication\n');
  console.log('Research with automatic quality assessment...\n');

  try {
    const result = await agent.research(
      'machine learning applications in healthcare',
      {
        depth: 'shallow', // Quick demo
        enableCostTracking: true,
        onProgress: (event) => {
          console.log(ConsoleFormatter.format(event.stage, event.message, event.progress));
        }
      }
    );

    console.log('\n✅ Research completed');
    console.log(`\nMetadata:`);
    console.log(`- Sources: ${result.metadata.sourcesScraped}`);
    console.log(`- Queries: ${result.metadata.queriesExecuted.length}`);
    console.log(`- Rounds: ${result.metadata.rounds}`);
    console.log(`- Duration: ${(result.metadata.totalDuration / 1000).toFixed(1)}s`);
    console.log(`- Cost: $${result.metadata.costs?.estimatedCost.toFixed(4) || '0'}`);

    console.log(`\n📝 Report:\n${result.report}`);

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Advanced Features Demo\n');
  console.log('═'.repeat(60));

  const demos = process.argv[2];

  switch (demos) {
    case 'cancel':
      await demonstrateCancellation();
      break;

    case 'partial':
      await demonstratePartialResults();
      break;

    case 'quality':
      await demonstrateQualityFeatures();
      break;

    default:
      console.log('\nUsage: npm run example:advanced [cancel|partial|quality]');
      console.log('\nExamples:');
      console.log('  npm run example:advanced cancel   # Demo cancellation');
      console.log('  npm run example:advanced partial  # Demo partial results');
      console.log('  npm run example:advanced quality  # Demo quality features');
      break;
  }
}

main();

#!/usr/bin/env node

/**
 * CLI script to fetch available models from OpenRouter
 *
 * Usage:
 *   tsx scripts/fetch-models.ts
 *   tsx scripts/fetch-models.ts --output ./models.json
 */

import { fetchAndSaveModels } from '../src/utils/ModelFetcher.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error('❌ Error: OPENROUTER_API_KEY environment variable is required');
    console.error('   Set it in your .env file or export it:');
    console.error('   export OPENROUTER_API_KEY=your-key');
    process.exit(1);
  }

  const outputPath = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : './openrouter-models.json';

  try {
    await fetchAndSaveModels(apiKey, outputPath);
    console.log('\n✅ Done!');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();

import axios from 'axios';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Model information from OpenRouter API
 */
interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  architecture?: {
    modality: string;
  };
  top_provider?: {
    max_completion_tokens: number;
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

/**
 * Fetch all available models from OpenRouter
 */
export async function fetchAvailableModels(apiKey: string): Promise<OpenRouterModel[]> {
  try {
    const response = await axios.get<OpenRouterModelsResponse>(
      'https://openrouter.ai/api/v1/models',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    return response.data.data;
  } catch (error: any) {
    throw new Error(`Failed to fetch models: ${error.message}`);
  }
}

/**
 * Filter models by pricing (for tier suggestions)
 */
export function categorizeModelsByPrice(models: OpenRouterModel[]) {
  const textModels = models.filter(m =>
    m.architecture?.modality === 'text' ||
    m.architecture?.modality === 'text+image' ||
    !m.architecture?.modality
  );

  const sortedByPrice = textModels
    .map(m => ({
      id: m.id,
      name: m.name,
      promptPrice: parseFloat(m.pricing.prompt),
      completionPrice: parseFloat(m.pricing.completion),
      contextLength: m.context_length
    }))
    .sort((a, b) => a.promptPrice - b.promptPrice);

  // Categorize into tiers based on price
  const small = sortedByPrice.filter(m => m.promptPrice <= 0.1);
  const medium = sortedByPrice.filter(m => m.promptPrice > 0.1 && m.promptPrice <= 0.5);
  const large = sortedByPrice.filter(m => m.promptPrice > 0.5);

  return { small, medium, large };
}

/**
 * Search for models by name
 */
export function searchModels(models: OpenRouterModel[], query: string): OpenRouterModel[] {
  const lowerQuery = query.toLowerCase();
  return models.filter(m =>
    m.id.toLowerCase().includes(lowerQuery) ||
    m.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get recommended models for research agent
 */
export function getRecommendedModels(models: OpenRouterModel[]) {
  // Search for specific models we want
  const deepseek = searchModels(models, 'deepseek-chat');
  const gemini = searchModels(models, 'gemini');
  const llama = searchModels(models, 'llama-3.1-8b');

  return {
    small: llama.find(m => m.id.includes('8b-instruct'))?.id || 'meta-llama/llama-3.1-8b-instruct',
    medium: gemini.find(m => m.id.includes('flash') && m.id.includes('1.5'))?.id ||
            gemini.find(m => m.id.includes('flash'))?.id ||
            'google/gemini-flash-1.5',
    large: deepseek.find(m => m.id.includes('deepseek-chat'))?.id || 'deepseek/deepseek-chat'
  };
}

/**
 * Save models list to JSON file
 */
export function saveModelsToFile(models: OpenRouterModel[], outputPath: string = './openrouter-models.json'): void {
  const data = {
    fetchedAt: new Date().toISOString(),
    totalModels: models.length,
    models: models.map(m => ({
      id: m.id,
      name: m.name,
      pricing: {
        prompt: m.pricing.prompt,
        completion: m.pricing.completion
      },
      contextLength: m.context_length,
      modality: m.architecture?.modality
    }))
  };

  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`✅ Saved ${models.length} models to ${outputPath}`);
}

/**
 * CLI utility to fetch and save models
 */
export async function fetchAndSaveModels(apiKey: string, outputPath?: string): Promise<void> {
  console.log('🔍 Fetching available models from OpenRouter...');

  const models = await fetchAvailableModels(apiKey);
  console.log(`✅ Found ${models.length} models`);

  // Categorize by price
  const categorized = categorizeModelsByPrice(models);
  console.log('\n📊 Price Tiers:');
  console.log(`  Small (<$0.10/1M): ${categorized.small.length} models`);
  console.log(`  Medium ($0.10-$0.50/1M): ${categorized.medium.length} models`);
  console.log(`  Large (>$0.50/1M): ${categorized.large.length} models`);

  // Get recommendations
  const recommended = getRecommendedModels(models);
  console.log('\n💡 Recommended Models:');
  console.log(`  Small: ${recommended.small}`);
  console.log(`  Medium: ${recommended.medium}`);
  console.log(`  Large: ${recommended.large}`);

  // Save to file
  if (outputPath) {
    saveModelsToFile(models, outputPath);
  }
}

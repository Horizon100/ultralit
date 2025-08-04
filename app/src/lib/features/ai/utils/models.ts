//src/lib/features/ai/utils/models.ts

import type { AIModel, AIProviderType, SelectableAIModel } from '$lib/types/types';
import { localModelsService, localModelsStore } from '$lib/stores/localModelStore';

export const availableModels: AIModel[] = [
	// OpenAI - Updated models
	{
		id: 'gpt-4o',
		name: 'GPT-4o',
		provider: 'openai' as AIProviderType,
		api_key: '',
		base_url: 'https://api.openai.com/v1',
		api_type: 'gpt-4o',
		api_version: '',
		description: 'Most advanced GPT-4 model with vision capabilities',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: 'models',
		collectionName: 'models'
	},
	{
		id: 'gpt-4o-mini',
		name: 'GPT-4o Mini',
		provider: 'openai' as AIProviderType,
		api_key: '',
		base_url: 'https://api.openai.com/v1',
		api_type: 'gpt-4o-mini',
		api_version: '',
		description: 'Faster, more affordable GPT-4 model',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: 'models',
		collectionName: 'models'
	},
	{
		id: 'gpt-3.5-turbo',
		name: 'GPT-3.5 Turbo',
		provider: 'openai' as AIProviderType,
		api_key: '',
		base_url: 'https://api.openai.com/v1',
		api_type: 'gpt-3.5-turbo',
		api_version: '',
		description: 'Fast and affordable GPT-3.5 model',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: 'models',
		collectionName: 'models'
	},
	// Anthropic - Updated models
	{
		id: 'claude-3-5-sonnet',
		name: 'Claude 3.5 Sonnet',
		provider: 'anthropic' as AIProviderType,
		api_key: '',
		base_url: 'https://api.anthropic.com/v1',
		api_type: 'claude-3-5-sonnet-20241022',
		api_version: '2023-06-01',
		description: 'Most capable Claude model with enhanced reasoning',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: 'models',
		collectionName: 'models'
	},
	{
		id: 'claude-3-5-haiku',
		name: 'Claude 3.5 Haiku',
		provider: 'anthropic' as AIProviderType,
		api_key: '',
		base_url: 'https://api.anthropic.com/v1',
		api_type: 'claude-3-5-haiku-20241022',
		api_version: '2023-06-01',
		description: 'Fastest Claude model for simple tasks',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: 'models',
		collectionName: 'models'
	},
	{
		id: 'claude-3-opus',
		name: 'Claude 3 Opus',
		provider: 'anthropic' as AIProviderType,
		api_key: '',
		base_url: 'https://api.anthropic.com/v1',
		api_type: 'claude-3-opus-20240229',
		api_version: '2023-06-01',
		description: 'Most powerful Claude model for complex tasks',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: 'models',
		collectionName: 'models'
	},
	// DeepSeek - Updated models
	{
		id: 'deepseek-chat',
		name: 'DeepSeek Chat',
		provider: 'deepseek' as AIProviderType,
		api_key: '',
		base_url: 'https://api.deepseek.com/v1',
		api_type: 'deepseek-chat',
		api_version: 'v1',
		description: 'DeepSeek conversational model',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: 'models',
		collectionName: 'models'
	},
	{
		id: 'deepseek-coder',
		name: 'DeepSeek Coder',
		provider: 'deepseek' as AIProviderType,
		api_key: '',
		base_url: 'https://api.deepseek.com/v1',
		api_type: 'deepseek-coder',
		api_version: 'v1',
		description: 'DeepSeek specialized coding model',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: 'models',
		collectionName: 'models'
	},
	// Grok - Updated models
	{
		id: 'grok-beta',
		name: 'Grok Beta',
		provider: 'grok' as AIProviderType,
		api_key: '',
		base_url: 'https://api.x.ai/v1',
		api_type: 'grok-beta',
		api_version: 'v1',
		description: 'X.AI Grok model with real-time knowledge',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: 'models',
		collectionName: 'models'
	}
];

// Add local models as SelectableAIModel (since they don't need all AIModel properties)
export const localDefaultModels: SelectableAIModel[] = [
	{
		id: 'qwen2.5:0.5b',
		name: 'Qwen 2.5 0.5B',
		provider: 'local' as AIProviderType,
		description: 'Small, fast local model for basic tasks',
		api_type: 'qwen2.5:0.5b',
		parameters: '0.5B',
		size: 397821319
	},
	{
		id: 'llama3.2:1b',
		name: 'Llama 3.2 1B',
		provider: 'local' as AIProviderType,
		description: 'Efficient local model for general use',
		api_type: 'llama3.2:1b',
		parameters: '1B',
		size: 1321098329
	},
	{
		id: 'deepseek-r1:1.5b',
		name: 'DeepSeek R1 1.5B',
		provider: 'local' as AIProviderType,
		description: 'Local reasoning model',
		api_type: 'deepseek-r1:1.5b',
		parameters: '1.5B',
		size: 1117322768
	}
];

// Convert local model to AIModel format for compatibility
function createLocalAIModel(localModel: SelectableAIModel): AIModel {
	return {
		id: localModel.id,
		name: localModel.name,
		provider: localModel.provider,
		api_key: '', // Local models don't need API keys
		base_url: 'http://localhost:11434',
		api_type: localModel.api_type || localModel.id,
		api_version: 'v1',
		description: localModel.description || '',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: 'local_models',
		collectionName: 'local_models'
	};
}

// Create a default local model
export const defaultLocalModel: AIModel = createLocalAIModel(localDefaultModels[0]);

export async function getRuntimeDefaultModel(): Promise<SelectableAIModel> {
	// Check if local server is available
	const localAvailable = await checkLocalServerAvailability();

	if (localAvailable) {
		console.log('🎯 Using local model as default');
		return {
			id: localDefaultModels[0].id,
			name: localDefaultModels[0].name,
			provider: 'local' as AIProviderType,
			api_type: localDefaultModels[0].api_type,
			description: localDefaultModels[0].description,
			parameters: localDefaultModels[0].parameters,
			size: localDefaultModels[0].size
		};
	}

	// Fall back to API models - prioritize DeepSeek as it's most cost-effective
	console.log('🎯 Local not available, using API model as default');
	const fallbackModel =
		availableModels.find((model) => model.provider === 'deepseek') ||
		availableModels.find((model) => model.provider === 'anthropic') ||
		availableModels.find((model) => model.provider === 'openai') ||
		availableModels[0];

	return {
		id: fallbackModel.id,
		name: fallbackModel.name,
		provider: fallbackModel.provider,
		api_type: fallbackModel.api_type,
		description: fallbackModel.description
	};
}

// Static default for backwards compatibility
export const defaultModel: AIModel =
	availableModels.find((model) => model.provider === 'deepseek') ||
	availableModels.find((model) => model.provider === 'anthropic') ||
	availableModels[0];

// Dynamic default model selection based on availability
export async function getDefaultModel(): Promise<AIModel> {
	const runtimeDefault = await getRuntimeDefaultModel();
	if (runtimeDefault.provider === 'local') {
		return defaultLocalModel;
	}
	return createLocalAIModel(runtimeDefault);
}

// Helper function to get all models (both API and local)
export function getAllAvailableModels(): (AIModel | SelectableAIModel)[] {
	const localAsAIModels = localDefaultModels.map(createLocalAIModel);
	return [...localAsAIModels, ...availableModels];
}

// Helper function to check if local server is available
export async function checkLocalServerAvailability(): Promise<boolean> {
    try {
        const status = await localModelsService.checkStatus();
        return status === 'online';
    } catch (error) {
        console.log('Local server not available:', error);
        return false;
    }
}
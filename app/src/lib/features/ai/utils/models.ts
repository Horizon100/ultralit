import type { AIModel, ProviderType, SelectableAIModel } from '$lib/types/types';

export const availableModels: AIModel[] = [
	{
		id: 'gpt-3.5-turbo',
		name: 'GPT-3.5 Turbo',
		provider: 'openai' as ProviderType,
		api_key: '',
		base_url: 'https://api.openai.com/v1',
		api_type: 'gpt-3.5-turbo',
		api_version: '',
		description:
			'Most capable GPT-3.5 model and optimized for chat at 1/10th the cost of text-davinci-003.',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: 'models',
		collectionName: 'models'
	},
	{
		id: 'claude-3-haiku',
		name: 'Claude 3 Haiku',
		provider: 'anthropic' as ProviderType,
		api_key: '',
		base_url: 'https://api.anthropic.com/v1',
		api_type: 'claude-3-haiku-20240307',
		api_version: '2024-03-07',
		description: 'Fastest Claude model for simple tasks',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: 'models',
		collectionName: 'models'
	},
	{
		id: 'deepseek-deepseek-chat',
		name: 'Deepseek Chat',
		provider: 'deepseek' as ProviderType,
		api_key: '',
		base_url: 'https://api.deepseek.com/v1',
		api_type: 'deepseek-chat',
		api_version: 'v1',
		description: 'Deepseek Chat Model',
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
		provider: 'local' as ProviderType,
		description: 'Small, fast local model for basic tasks',
		api_type: 'qwen2.5:0.5b',
		parameters: '0.5B',
		size: 397821319
	},
	{
		id: 'llama3.2:1b',
		name: 'Llama 3.2 1B',
		provider: 'local' as ProviderType,
		description: 'Efficient local model for general use',
		api_type: 'llama3.2:1b',
		parameters: '1B',
		size: 1321098329
	},
	{
		id: 'deepseek-r1:1.5b',
		name: 'DeepSeek R1 1.5B',
		provider: 'local' as ProviderType,
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
			provider: 'local' as ProviderType,
			api_type: localDefaultModels[0].api_type,
			description: localDefaultModels[0].description,
			parameters: localDefaultModels[0].parameters,
			size: localDefaultModels[0].size
		};
	}
	
	// Fall back to API models
	console.log('🎯 Local not available, using API model as default');
	const fallbackModel = availableModels.find((model) => model.provider === 'deepseek') || // Changed order: deepseek first
						 availableModels.find((model) => model.provider === 'anthropic') ||
						 availableModels[0];
	
	return {
		id: fallbackModel.id,
		name: fallbackModel.name,
		provider: fallbackModel.provider,
		api_type: fallbackModel.api_type,
		description: fallbackModel.description
	};
}

// Static default for backwards compatibility (but prefer getRuntimeDefaultModel)
export const defaultModel: AIModel = 
	availableModels.find((model) => model.provider === 'local') || 
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
		const response = await fetch('/api/ai/local/models', {
			method: 'GET',
			timeout: 5000 // 5 second timeout
		} as any);
		
		if (!response.ok) return false;
		
		const data = await response.json();
		return data.success && data.data?.models?.length > 0;
	} catch (error) {
		console.log('Local server not available:', error);
		return false;
	}
}


import type { AIModel, ProviderType } from '$lib/types/types';

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
		api_type: 'claude-3-haiku-20240307', // Changed from 'claude-3-opus'
		api_version: '2024-03-07', // Changed from '2024-02-29'
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

export const defaultModel: AIModel =
	availableModels.find((model) => model.provider === 'anthropic') ||
	availableModels.find((model) => model.provider === 'deepseek') ||
	availableModels[0];

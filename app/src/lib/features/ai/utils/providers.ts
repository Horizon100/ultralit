import type { AIModel, AIProviderType, SelectableAIModel } from '$lib/types/types';
import openaiIcon from '$lib/assets/icons/providers/openai.svg';
import anthropicIcon from '$lib/assets/icons/providers/anthropic.svg';
import googleIcon from '$lib/assets/icons/providers/google.svg';
import grokIcon from '$lib/assets/icons/providers/x.svg';
import deepseekIcon from '$lib/assets/icons/providers/deepseek.svg';
import ollamaIcon from '$lib/assets/icons/providers/ollama.svg';

import { fetchTryCatch, isFailure, clientTryCatch } from '$lib/utils/errorUtils';
export interface ProviderConfig {
	name: string;
	icon: string;
	fetchModels: (apiKey: string) => Promise<AIModel[]>;
	validateApiKey: (apiKey: string) => Promise<boolean>;
}

interface OpenAIModel {
	id: string;
	created: number;
}

interface ModelListResponse {
	data: OpenAIModel[];
}

const handleFetchError = (providerName: string) => (error: unknown) => {
	const errorObj = error as { response?: { status?: number }; message?: string };
	if (errorObj.response?.status === 401) {
		throw new Error(`Invalid API key for ${providerName}`);
	}
	const message = errorObj.message || 'Unknown error';
	throw new Error(`Failed to fetch ${providerName} models: ${message}`);
};

export const providers: Record<AIProviderType, ProviderConfig> = {
	local: {
		name: 'Local Models', // Static name in the providers config
		icon: ollamaIcon,
		validateApiKey: async (): Promise<boolean> => {
			try {
				const response = await fetch('/api/ai/local/models');
				const result = await response.json();
				return result.success && result.data?.models?.length > 0;
			} catch {
				return false;
			}
		},
		fetchModels: async (): Promise<AIModel[]> => {
			try {
				const response = await fetch('/api/ai/local/models');
				const result = await response.json();

				if (result.success && result.data?.models) {
					return result.data.models.map((model: AIModel) => ({
						id: `local-${model.api_type}`,
						name: model.name,
						provider: 'local' as AIProviderType,
						api_key: '', // Local models don't need API keys
						base_url: 'http://localhost:11434',
						api_type: model.api_type,
						api_version: 'v1',
						description: `${model.parameters} - ${model.families?.join(', ') || 'Local Model'}`,
						user: [],
						created: new Date().toISOString(),
						updated: new Date().toISOString(),
						collectionId: 'local_models',
						collectionName: 'local_models'
					}));
				}

				return [];
			} catch (error) {
				console.error('Error fetching local models:', error);
				return [];
			}
		}
	},
	openai: {
		name: 'OpenAI',
		icon: openaiIcon,
		validateApiKey: async (apiKey: string): Promise<boolean> => {
			try {
				const response = await fetch('https://api.openai.com/v1/models', {
					headers: { Authorization: `Bearer ${apiKey}` }
				});
				return response.status === 200;
			} catch {
				return false;
			}
		},
		fetchModels: async (apiKey: string): Promise<AIModel[]> => {
			const result = await clientTryCatch(
				(async () => {
					const fetchResult = await fetchTryCatch<ModelListResponse>(
						'https://api.openai.com/v1/models',
						{
							headers: { Authorization: `Bearer ${apiKey}` }
						}
					);

					if (isFailure(fetchResult)) {
						throw new Error(`Failed to fetch OpenAI models: ${fetchResult.error}`);
					}

					const data = fetchResult.data;
					return data.data
						.filter(
							(model: OpenAIModel) => model.id.includes('gpt') && !model.id.includes('instruct')
						)
						.map((model: OpenAIModel) => ({
							id: `openai-${model.id}`,
							name: model.id,
							provider: 'openai' as AIProviderType,
							api_key: apiKey,
							base_url: 'https://api.openai.com/v1',
							api_type: model.id,
							api_version: '',
							description: `OpenAI ${model.id} model`,
							user: [],
							created: new Date(model.created * 1000).toISOString(),
							updated: new Date().toISOString(),
							collectionId: 'models',
							collectionName: 'models'
						}));
				})(),
				'Fetching OpenAI models'
			);

			if (isFailure(result)) {
				throw new Error(result.error);
			}

			return result.data;
		}
	},
	anthropic: {
		name: 'Claude',
		icon: anthropicIcon,
		validateApiKey: async (apiKey: string): Promise<boolean> => {
			try {
				const response = await fetch('https://api.anthropic.com/v1/messages', {
					method: 'POST',
					headers: {
						'x-api-key': apiKey,
						'anthropic-version': '2023-06-01'
					}
				});
				return response.status !== 401;
			} catch {
				return false;
			}
		},
		fetchModels: async (apiKey: string): Promise<AIModel[]> => {
			const result = await clientTryCatch(
				(async () => {
					return [
						{
							id: 'anthropic-claude-3-opus',
							name: 'Claude 3 Opus',
							provider: 'anthropic' as AIProviderType,
							api_key: apiKey,
							base_url: 'https://api.anthropic.com/v1',
							api_type: 'claude-3-opus-20240229',
							api_version: '2024-02-29',
							description: 'Most capable Claude model for complex tasks',
							user: [],
							created: new Date().toISOString(),
							updated: new Date().toISOString(),
							collectionId: 'models',
							collectionName: 'models'
						},
						{
							id: 'anthropic-claude-3-sonnet',
							name: 'Claude 3 Sonnet',
							provider: 'anthropic' as AIProviderType,
							api_key: apiKey,
							base_url: 'https://api.anthropic.com/v1',
							api_type: 'claude-3-sonnet-20240229',
							api_version: '2024-02-29',
							description: 'Balanced model for most tasks',
							user: [],
							created: new Date().toISOString(),
							updated: new Date().toISOString(),
							collectionId: 'models',
							collectionName: 'models'
						},
						{
							id: 'anthropic-claude-3-haiku',
							name: 'Claude 3 Haiku',
							provider: 'anthropic' as AIProviderType,
							api_key: apiKey,
							base_url: 'https://api.anthropic.com/v1',
							api_type: 'claude-3-haiku-20240307',
							api_version: '2024-03-07',
							description: 'Fastest Claude model for simple tasks',
							user: [],
							created: new Date().toISOString(),
							updated: new Date().toISOString(),
							collectionId: 'models',
							collectionName: 'models'
						}
					];
				})(),
				'Fetching Anthropic models'
			);

			if (isFailure(result)) {
				throw new Error(result.error);
			}

			return result.data;
		}
	},
	google: {
		name: 'Gemini',
		icon: googleIcon,
		validateApiKey: async (): Promise<boolean> => {
			return false;
		},
		fetchModels: async (apiKey: string): Promise<AIModel[]> => {
			return [
				{
					id: 'google-gemini-pro',
					name: 'Gemini Pro',
					provider: 'google',
					api_key: apiKey,
					base_url: 'https://generativelanguage.googleapis.com/v1',
					api_type: 'gemini-pro',
					api_version: 'v1',
					description: 'Google Gemini Pro model',
					user: [],
					created: new Date().toISOString(),
					updated: new Date().toISOString(),
					collectionId: 'models',
					collectionName: 'models'
				}
			];
		}
	},
	grok: {
		name: 'Grok',
		icon: grokIcon,
		validateApiKey: async (apiKey: string): Promise<boolean> => {
			try {
				const response = await fetch('https://api.x.ai/v1/models', {
					headers: { Authorization: `Bearer ${apiKey}` }
				});
				// Accept 200 or 429 as valid (429 means key is valid but rate limited)
				return response.status === 200 || response.status === 429;
			} catch {
				return false;
			}
		},
		fetchModels: async (apiKey: string): Promise<AIModel[]> => {
			const result = await clientTryCatch(
				(async () => {
					const fetchResult = await fetchTryCatch<ModelListResponse>('https://api.x.ai/v1/models', {
						headers: { Authorization: `Bearer ${apiKey}` }
					});

					if (isFailure(fetchResult)) {
						// Check if it's a rate limit error
						if (fetchResult.error.includes('429') || fetchResult.error.includes('rate limit')) {
							console.warn('Grok API rate limited, returning default models');
							return [
								{
									id: 'grok-grok-1',
									name: 'Grok-1',
									provider: 'grok' as AIProviderType,
									api_key: apiKey,
									base_url: 'https://api.x.ai/v1',
									api_type: 'grok-1',
									api_version: '',
									description: 'Grok-1 model by X.AI',
									user: [],
									created: new Date().toISOString(),
									updated: new Date().toISOString(),
									collectionId: 'models',
									collectionName: 'models'
								},
								{
									id: 'grok-grok-beta',
									name: 'Grok Beta',
									provider: 'grok' as AIProviderType,
									api_key: apiKey,
									base_url: 'https://api.x.ai/v1',
									api_type: 'grok-beta',
									api_version: '',
									description: 'Grok Beta model by X.AI',
									user: [],
									created: new Date().toISOString(),
									updated: new Date().toISOString(),
									collectionId: 'models',
									collectionName: 'models'
								}
							];
						}

						throw new Error(`Failed to fetch Grok models: ${fetchResult.error}`);
					}

					const data = fetchResult.data;
					return data.data.map((model: OpenAIModel) => ({
						id: `grok-${model.id}`,
						name: model.id,
						provider: 'grok' as AIProviderType,
						api_key: apiKey,
						base_url: 'https://api.x.ai/v1',
						api_type: model.id,
						api_version: '',
						description: `Grok ${model.id} model`,
						user: [],
						created: new Date(model.created * 1000).toISOString(),
						updated: new Date().toISOString(),
						collectionId: 'models',
						collectionName: 'models'
					}));
				})(),
				'Fetching Grok models'
			);

			if (isFailure(result)) {
				if (result.error.includes('429') || result.error.includes('rate limit')) {
					console.warn('Grok API rate limited, returning minimal fallback models');
					return [
						{
							id: 'grok-grok-1',
							name: 'Grok-1',
							provider: 'grok' as AIProviderType,
							api_key: apiKey,
							base_url: 'https://api.x.ai/v1',
							api_type: 'grok-1',
							api_version: '',
							description: 'Grok-1 model by X.AI',
							user: [],
							created: new Date().toISOString(),
							updated: new Date().toISOString(),
							collectionId: 'models',
							collectionName: 'models'
						}
					];
				}

				throw new Error(result.error);
			}

			return result.data;
		}
	},
	deepseek: {
		name: 'Deepseek',
		icon: deepseekIcon,
		validateApiKey: async (apiKey: string): Promise<boolean> => {
			try {
				const response = await fetch('https://api.deepseek.com/v1/models', {
					headers: { Authorization: `Bearer ${apiKey}` }
				});
				return response.status === 200;
			} catch {
				return false;
			}
		},
		fetchModels: async (apiKey: string): Promise<AIModel[]> => {
			const result = await clientTryCatch(
				(async () => {
					const fetchResult = await fetchTryCatch<ModelListResponse>(
						'https://api.deepseek.com/v1/models',
						{
							headers: { Authorization: `Bearer ${apiKey}` }
						}
					);

					if (isFailure(fetchResult)) {
						throw new Error(`Failed to fetch Deepseek models: ${fetchResult.error}`);
					}

					const data = fetchResult.data;
					return data.data.map((model: OpenAIModel) => ({
						id: `deepseek-${model.id}`,
						name: model.id,
						provider: 'deepseek' as AIProviderType,
						api_key: apiKey,
						base_url: 'https://api.deepseek.com/v1',
						api_type: model.id,
						api_version: '',
						description: `Deepseek ${model.id} model`,
						user: [],
						created: new Date().toISOString(),
						updated: new Date().toISOString(),
						collectionId: 'models',
						collectionName: 'models'
					}));
				})(),
				'Fetching Deepseek models'
			);

			if (isFailure(result)) {
				throw new Error(result.error);
			}

			return result.data;
		}
	}
};

export const fetchAllProviderModels = async (
	selectedProviders: AIProviderType[],
	apiKeys: Record<AIProviderType, string>
): Promise<AIModel[]> => {
	const result = await clientTryCatch(
		(async () => {
			const modelPromises = selectedProviders.map(async (provider) => {
				// Local provider doesn't need API key
				if (provider === 'local') {
					const providerResult = await clientTryCatch(
						providers[provider].fetchModels(''), // Local doesn't use API key
						`Fetching models for ${provider}`
					);

					if (isFailure(providerResult)) {
						console.error(`Error fetching ${provider} models:`, providerResult.error);
						return [];
					}

					return providerResult.data;
				}

				// For other providers, check API key
				if (!apiKeys[provider]) {
					return [];
				}

				const providerResult = await clientTryCatch(
					providers[provider].fetchModels(apiKeys[provider]),
					`Fetching models for ${provider}`
				);

				if (isFailure(providerResult)) {
					console.error(`Error fetching ${provider} models:`, providerResult.error);
					return [];
				}

				return providerResult.data;
			});

			const results = await Promise.all(modelPromises);
			return results.flat();
		})(),
		'Fetching models from all providers'
	);

	if (isFailure(result)) {
		console.error('Error fetching models from providers:', result.error);
		return [];
	}

	return result.data;
};

export function getProviderFromModel(modelName: string): AIProviderType {
	const model = modelName.toLowerCase();

	if (
		model.includes('qwen') ||
		model.includes('llama') ||
		model.includes('tinyllama') ||
		model.includes('deepseek-r1') ||
		model.includes('ollama') ||
		model.includes('local')
	) {
		return 'local';
	}

	if (model.includes('gpt') || model.includes('o1') || model.includes('openai')) {
		return 'openai';
	}

	if (model.includes('claude') || model.includes('anthropic')) {
		return 'anthropic';
	}

	if (model.includes('gemini') || model.includes('bard') || model.includes('google')) {
		return 'google';
	}

	if (model.includes('grok') || model.includes('x-ai')) {
		return 'grok';
	}

	if (model.includes('deepseek')) {
		return 'deepseek';
	}

	return 'openai';
}

export function getProviderIcon(provider: AIProviderType): string {
	switch (provider) {
		case 'local':
			return ollamaIcon;
		case 'openai':
			return openaiIcon;
		case 'anthropic':
			return anthropicIcon;
		case 'google':
			return googleIcon;
		case 'grok':
			return grokIcon;
		case 'deepseek':
			return deepseekIcon;
		default:
			return openaiIcon;
	}
}

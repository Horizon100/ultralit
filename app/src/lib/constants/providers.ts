import type { AIModel } from '$lib/types/types';
import openaiIcon from '$lib/assets/icons/providers/openai.svg';
import anthropicIcon from '$lib/assets/icons/providers/anthropic.svg';
import googleIcon from '$lib/assets/icons/providers/google.svg';
import grokIcon from '$lib/assets/icons/providers/x.svg';
import deepseekIcon from '$lib/assets/icons/providers/deepseek.svg'; 

export interface ProviderConfig {
	name: string;
	icon: string;
	fetchModels: (apiKey: string) => Promise<AIModel[]>;
	validateApiKey: (apiKey: string) => Promise<boolean>;
}

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'grok' | 'deepseek';

const handleFetchError = (provider: string) => (error: any) => {
	if (error.response?.status === 401) {
		throw new Error('Invalid API key');
	}
	throw new Error(`Failed to fetch models: ${error.message}`);
};

export const providers: Record<ProviderType, ProviderConfig> = {
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
			try {
				const response = await fetch('https://api.openai.com/v1/models', {
					headers: { Authorization: `Bearer ${apiKey}` }
				});

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const data = await response.json();
				return data.data
					.filter((model: any) => model.id.includes('gpt') && !model.id.includes('instruct'))
					.map((model: any) => ({
						id: `openai-${model.id}`,
						name: model.id,
						provider: 'openai' as ProviderType,
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
			} catch (error) {
				throw handleFetchError('OpenAI')(error);
			}
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
			try {
				return [
					{
						id: 'anthropic-claude-3-opus',
						name: 'Claude 3 Opus',
						provider: 'anthropic',
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
						provider: 'anthropic',
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
						provider: 'anthropic',
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
			} catch (error) {
				throw handleFetchError('Anthropic')(error);
			}
		}
	},
	google: {
		name: 'Gemini',
		icon: googleIcon,
		validateApiKey: async (apiKey: string): Promise<boolean> => {
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
			try {
				const response = await fetch('https://api.x.ai/v1/models', {
					headers: { Authorization: `Bearer ${apiKey}` }
				});

				if (response.status === 429) {
					// Rate limited - return hardcoded models instead of failing
					console.warn('Grok API rate limited, returning default models');
					return [
						{
							id: 'grok-grok-1',
							name: 'Grok-1',
							provider: 'grok' as ProviderType,
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
							provider: 'grok' as ProviderType,
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

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const data = await response.json();
				return data.data.map((model: any) => ({
					id: `grok-${model.id}`,
					name: model.id,
					provider: 'grok' as ProviderType,
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
			} catch (error) {
				// If we get rate limited or any error, return fallback models
				if (error.message?.includes('429') || error.message?.includes('rate limit')) {
					console.warn('Grok API rate limited, returning default models');
					return [
						{
							id: 'grok-grok-1',
							name: 'Grok-1',
							provider: 'grok' as ProviderType,
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
				throw handleFetchError('Grok')(error);
			}
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
			try {
				const response = await fetch('https://api.deepseek.com/v1/models', {
					headers: { Authorization: `Bearer ${apiKey}` }
				});

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const data = await response.json();
				return data.data.map((model: any) => ({
					id: `deepseek-${model.id}`,
					name: model.id,
					provider: 'deepseek' as ProviderType,
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
			} catch (error) {
				throw handleFetchError('Deepseek')(error);
			}
		}
	}
};
export const fetchAllProviderModels = async (
	selectedProviders: ProviderType[],
	apiKeys: Record<ProviderType, string>
): Promise<AIModel[]> => {
	const modelPromises = selectedProviders.map(async (provider) => {
		if (!apiKeys[provider]) {
			return [];
		}
		try {
			return await providers[provider].fetchModels(apiKeys[provider]);
		} catch (error) {
			console.error(`Error fetching ${provider} models:`, error);
			return [];
		}
	});

	const results = await Promise.all(modelPromises);
	return results.flat();
};

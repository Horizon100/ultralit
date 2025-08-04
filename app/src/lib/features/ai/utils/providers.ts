//src/lib/features/ai/utils/providers.ts

import type { AIModel, AIProviderType, SelectableAIModel } from '$lib/types/types';
import openaiIcon from '$lib/assets/icons/providers/openai.svg';
import anthropicIcon from '$lib/assets/icons/providers/anthropic.svg';
import googleIcon from '$lib/assets/icons/providers/google.svg';
import grokIcon from '$lib/assets/icons/providers/x.svg';
import deepseekIcon from '$lib/assets/icons/providers/deepseek.svg';
import ollamaIcon from '$lib/assets/icons/providers/ollama.svg';
import { localModelsService } from '$lib/stores/localModelStore';

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
        name: 'Local Models',
        icon: ollamaIcon,
        validateApiKey: async (): Promise<boolean> => {
            try {
                const status = await localModelsService.checkStatus();
                return status === 'online';
            } catch {
                return false;
            }
        },
        fetchModels: async (): Promise<AIModel[]> => {
            try {
                // Use the centralized service instead of direct fetch
                const models = await localModelsService.getModels();
                
                return models.map((model: SelectableAIModel) => ({
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
                // Return current OpenAI models directly since the API sometimes has issues
                // and we know the current model names
                return [
                    {
                        id: 'openai-gpt-4o',
                        name: 'GPT-4o',
                        provider: 'openai' as AIProviderType,
                        api_key: apiKey,
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
                        id: 'openai-gpt-4o-mini',
                        name: 'GPT-4o Mini',
                        provider: 'openai' as AIProviderType,
                        api_key: apiKey,
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
                        id: 'openai-gpt-4-turbo',
                        name: 'GPT-4 Turbo',
                        provider: 'openai' as AIProviderType,
                        api_key: apiKey,
                        base_url: 'https://api.openai.com/v1',
                        api_type: 'gpt-4-turbo',
                        api_version: '',
                        description: 'High-performance GPT-4 model',
                        user: [],
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                        collectionId: 'models',
                        collectionName: 'models'
                    },
                    {
                        id: 'openai-gpt-3.5-turbo',
                        name: 'GPT-3.5 Turbo',
                        provider: 'openai' as AIProviderType,
                        api_key: apiKey,
                        base_url: 'https://api.openai.com/v1',
                        api_type: 'gpt-3.5-turbo',
                        api_version: '',
                        description: 'Fast and affordable GPT-3.5 model',
                        user: [],
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                        collectionId: 'models',
                        collectionName: 'models'
                    }
                ];
            })(),
            'Fetching OpenAI models'
        );

        if (isFailure(result)) {
            throw new Error(result.error);
        }

        return result.data;
    }
},

deepseek: {
    name: 'DeepSeek',
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
                // Return current DeepSeek models directly
                return [
                    {
                        id: 'deepseek-deepseek-chat',
                        name: 'DeepSeek Chat',
                        provider: 'deepseek' as AIProviderType,
                        api_key: apiKey,
                        base_url: 'https://api.deepseek.com/v1',
                        api_type: 'deepseek-chat',
                        api_version: '',
                        description: 'DeepSeek conversational model - highly capable and cost-effective',
                        user: [],
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                        collectionId: 'models',
                        collectionName: 'models'
                    },
                    {
                        id: 'deepseek-deepseek-coder',
                        name: 'DeepSeek Coder',
                        provider: 'deepseek' as AIProviderType,
                        api_key: apiKey,
                        base_url: 'https://api.deepseek.com/v1',
                        api_type: 'deepseek-coder',
                        api_version: '',
                        description: 'DeepSeek specialized coding model',
                        user: [],
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                        collectionId: 'models',
                        collectionName: 'models'
                    },
                    {
                        id: 'deepseek-deepseek-reasoner',
                        name: 'DeepSeek Reasoner',
                        provider: 'deepseek' as AIProviderType,
                        api_key: apiKey,
                        base_url: 'https://api.deepseek.com/v1',
                        api_type: 'deepseek-reasoner',
                        api_version: '',
                        description: 'DeepSeek reasoning model with enhanced logical capabilities',
                        user: [],
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                        collectionId: 'models',
                        collectionName: 'models'
                    }
                ];
            })(),
            'Fetching DeepSeek models'
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
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-haiku-20241022',
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'test' }]
                })
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
                        id: 'anthropic-claude-3-5-sonnet',
                        name: 'Claude 3.5 Sonnet',
                        provider: 'anthropic' as AIProviderType,
                        api_key: apiKey,
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
                        id: 'anthropic-claude-3-5-haiku',
                        name: 'Claude 3.5 Haiku',
                        provider: 'anthropic' as AIProviderType,
                        api_key: apiKey,
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
                        id: 'anthropic-claude-3-opus',
                        name: 'Claude 3 Opus',
                        provider: 'anthropic' as AIProviderType,
                        api_key: apiKey,
                        base_url: 'https://api.anthropic.com/v1',
                        api_type: 'claude-3-opus-20240229',
                        api_version: '2023-06-01',
                        description: 'Most powerful Claude model for complex tasks',
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

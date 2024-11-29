import type { AIModel } from '$lib/types';
import openaiIcon from '$lib/assets/icons/providers/openai.svg';
import anthropicIcon from '$lib/assets/icons/providers/anthropic.svg';
import googleIcon from '$lib/assets/icons/providers/google.svg';
import grokIcon from '$lib/assets/icons/providers/x.svg';

export interface ProviderConfig {
    name: string;
    icon: string;
    fetchModels: (apiKey: string) => Promise<AIModel[]>;
}

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'grok';

export const providers: Record<ProviderType, ProviderConfig> = {
    openai: {
        name: 'OpenAI',
        icon: openaiIcon,
        fetchModels: async (apiKey: string) => {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            const data = await response.json();
            return data.data
                .filter((model: any) => model.id.includes('gpt'))
                .map((model: any) => ({
                    id: model.id,
                    name: model.id,
                    api_key: apiKey,
                    base_url: 'https://api.openai.com/v1',
                    api_type: model.id,
                    api_version: '',
                    description: model.description || '',
                    user: [],
                    created: model.created,
                    updated: '',
                    collectionId: '',
                    collectionName: ''
                }));
        }
    },
    anthropic: {
        name: 'Claude',
        icon: anthropicIcon,
        fetchModels: async (apiKey: string) => {
            return [{
                id: 'claude-3-opus',
                name: 'Claude 3 Opus',
                api_key: apiKey,
                base_url: 'https://api.anthropic.com/v1',
                api_type: 'claude-3-opus',
                api_version: 'v1',
                description: 'Most capable Claude model',
                user: [],
                created: '',
                updated: '',
                collectionId: '',
                collectionName: ''
            }] as AIModel[];
        }
    },
    google: {
        name: 'Gemini',
        icon: googleIcon,
        fetchModels: async (apiKey: string) => {
            return [] as AIModel[];
        }
    },
    grok: {
        name: 'Grok',
        icon: grokIcon,
        fetchModels: async (apiKey: string) => {
            return [] as AIModel[];
        }
    }
};
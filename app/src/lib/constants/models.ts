import type { AIModel } from '$lib/types';

export const availableModels: AIModel[] = [
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    api_key: '',
    base_url: 'https://api.openai.com/v1',
    api_type: 'gpt-3.5-turbo',
    api_version: '',
    description: 'Most capable GPT-3.5 model and optimized for chat at 1/10th the cost of text-davinci-003.',
    user: [],
    created: '',
    updated: '',
  },
  {
    id: 'gpt-3.5-turbo-16k',
    name: 'GPT-3.5 Turbo 16K',
    api_key: '',
    base_url: 'https://api.openai.com/v1',
    api_type: 'gpt-3.5-turbo',
    api_version: '',
    description: 'Same capabilities as the standard GPT-3.5 Turbo model but with 4x the context length.',
    user: [],
    created: '',
    updated: '',
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    api_key: '',
    base_url: 'https://api.openai.com/v1',
    api_type: 'gpt-4',
    api_version: '',
    description: 'More capable than any GPT-3.5 model, able to do more complex tasks, and optimized for chat.',
    user: [],
    created: '',
    updated: '',
  },
  {
    id: 'gpt-4-32k',
    name: 'GPT-4 32K',
    api_key: '',
    base_url: 'https://api.openai.com/v1',
    api_type: 'gpt-4',
    api_version: '',
    description: 'Same capabilities as the standard GPT-4 model but with 4x the context length.',
    user: [],
    created: '',
    updated: '',
  },
];

export const defaultModel: AIModel = availableModels[0];
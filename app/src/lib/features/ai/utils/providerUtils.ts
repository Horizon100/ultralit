import type { ProviderType } from '$lib/types/types';

import OpenAIIcon from '$lib/assets/icons/providers/openai.svg';
import AnthropicIcon from '$lib/assets/icons/providers/anthropic.svg';
import GoogleIcon from '$lib/assets/icons/providers/google.svg';
import DeepSeekIcon from '$lib/assets/icons/providers/deepseek.svg';
import XIcon from '$lib/assets/icons/providers/x.svg';


export function getProviderFromModel(modelName: string): ProviderType {
	const model = modelName.toLowerCase();
	
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


export function getProviderIcon(provider: ProviderType): string {
	switch (provider) {
		case 'openai':
			return OpenAIIcon;
		case 'anthropic':
			return AnthropicIcon;
		case 'google':
			return GoogleIcon;
		case 'grok':
			return XIcon;
		case 'deepseek':
			return DeepSeekIcon;
		default:
			return OpenAIIcon;
	}
}
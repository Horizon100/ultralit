// src/lib/types/types.localModels.ts
import type { AIMessage } from '$lib/types/types';

export interface MessageContext {
	type: 'code' | 'creative' | 'factual' | 'chat' | 'json';
	confidence: number;
	language?: string;
	complexity: 'simple' | 'medium' | 'complex';
}

export interface LocalAIModel {
	id: string;
	name: string;
	provider: 'local';
	api_type: string;
	size: number;
	parameters: string;
	families: string[];
	available: boolean;
	modified_at: string;
}

export interface LocalModelParams {
	model: string;
	prompt: string;
	stream?: boolean;
	max_tokens?: number;
	temperature?: number;
	top_p?: number;
	top_k?: number;
	system?: string;
	context?: number[];
	keep_alive?: string;
	seed?: number;
	repeat_penalty?: number;
	stop?: string[];
	format?: 'json' | '';
}

export interface OllamaModel {
	name: string;
	model: string;
	modified_at: string;
	size: number;
	digest: string;
	details: {
		parent_model?: string;
		format: string;
		family: string;
		families?: string[];
		parameter_size: string;
		quantization_level: string;
	};
}

export interface OllamaModelsResponse {
	models: OllamaModel[];
}
export interface LocalAIRequest {
	messages: AIMessage[];
	model?: string;
	userId: string;
	stream?: boolean;
	// Context continuity
	context?: number[];
	// Generation parameters
	temperature?: number;
	max_tokens?: number;
	system?: string;
}

export interface OllamaResponse {
	model: string;
	created_at: string;
	response: string;
	done: boolean;
	context?: number[];
	total_duration?: number;
	load_duration?: number;
	prompt_eval_count?: number;
	prompt_eval_duration?: number;
	eval_count?: number;
	eval_duration?: number;
}

export interface GenerateRequest {
	prompt: string;
	model?: string;
	system?: string;
	// Optional parameter overrides
	temperature?: number;
	max_tokens?: number;
	stream?: boolean;
	// Auto-optimization
	auto_optimize?: boolean;
}

export interface OllamaGenerateResponse {
	model: string;
	created_at: string;
	response: string;
	done: boolean;
	context?: number[];
	total_duration?: number;
	load_duration?: number;
	prompt_eval_count?: number;
	prompt_eval_duration?: number;
	eval_count?: number;
	eval_duration?: number;
}

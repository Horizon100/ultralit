// src/routes/api/ai/local/chat/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import type { LocalAIRequest, OllamaResponse } from '$lib/types/types.localModels';
import { env } from '$env/dynamic/private';

interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

interface OllamaMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

const OLLAMA_BASE_URL = dev ? env.OLLAMA_DEV_URL : env.OLLAMA_PROD_URL;

export const POST: RequestHandler = async (event) => {
	try {
		const { request, locals, fetch } = event;
		const body = await request.json();
		if (!OLLAMA_BASE_URL) {
			console.error('❌ OLLAMA_BASE_URL is not configured');
			throw new Error(
				'Ollama server URL is not configured. Please check your environment variables.'
			);
		}
		console.log('🤖 Local AI Chat - Request received:', {
			model: body.model,
			userId: body.userId,
			messageCount: body.messages?.length,
			ollamaUrl: OLLAMA_BASE_URL
		});

		if (!body.messages || !Array.isArray(body.messages)) {
			throw new Error('Messages array is required');
		}

		if (!body.model) {
			throw new Error('Model is required');
		}

		const {
			messages,
			model,
			userId,
			temperature = 0.7,
			max_tokens = 4096,
			stream = false,
			system = null
		} = body;

		const ollamaMessages: OllamaMessage[] = messages.map((msg: ChatMessage) => {
			let role = 'user';
			if (msg.role === 'assistant') role = 'assistant';
			else if (msg.role === 'system') role = 'system';

			return {
				role,
				content: msg.content
			};
		});

		if (system && !ollamaMessages.some((m: OllamaMessage) => m.role === 'system')) {
			ollamaMessages.unshift({
				role: 'system',
				content: system
			});
		}
		const modelName = typeof model === 'string' ? model : model.api_type || model.id || model.name;

		const ollamaRequest = {
			model: modelName,
			messages: ollamaMessages,
			stream: false,
			options: {
				temperature: temperature,
				num_predict: max_tokens,
				top_p: 0.9,
				top_k: 40
			}
		};

		console.log('🤖 Local AI Chat - Sending to Ollama:', {
			url: `${OLLAMA_BASE_URL}/api/chat`,
			model: modelName,
			messageCount: ollamaMessages.length,
			temperature: temperature
		});

		const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(ollamaRequest),
			signal: AbortSignal.timeout(120000)
		});

		if (!ollamaResponse.ok) {
			const errorText = await ollamaResponse.text();
			console.error('❌ Ollama API error:', ollamaResponse.status, errorText);

			if (ollamaResponse.status === 404) {
				throw new Error(
					`Model "${model}" not found in Ollama. Please pull the model first with: ollama pull ${model}`
				);
			} else if (ollamaResponse.status === 400) {
				throw new Error(`Bad request to Ollama: ${errorText}`);
			} else if (ollamaResponse.status === 500) {
				throw new Error('Ollama server error. Please check if Ollama is running properly.');
			} else {
				throw new Error(`Ollama API error (${ollamaResponse.status}): ${errorText}`);
			}
		}

		const ollamaData: OllamaResponse = await ollamaResponse.json();
		console.log('🤖 Local AI Chat - Ollama response received:', {
			model: ollamaData.model,
			done: ollamaData.done,
			responseLength: ollamaData.response?.length || 0
		});

		let responseText = '';
		if (ollamaData.message && ollamaData.message.content) {
			responseText = ollamaData.message.content;
		} else if (ollamaData.response) {
			responseText = ollamaData.response;
		} else {
			console.error('❌ Unexpected Ollama response format:', ollamaData);
			throw new Error('Could not extract response from Ollama');
		}

		if (!responseText || responseText.trim().length === 0) {
			throw new Error('Ollama returned empty response');
		}

		console.log('🎯 Local AI Chat - Response extracted:', {
			length: responseText.length,
			preview: responseText.substring(0, 100) + (responseText.length > 100 ? '...' : '')
		});

		return json({
			response: responseText,
			model: model,
			provider: 'local',
			usage: {
				prompt_tokens: ollamaData.prompt_eval_count || 0,
				completion_tokens: ollamaData.eval_count || 0,
				total_tokens: (ollamaData.prompt_eval_count || 0) + (ollamaData.eval_count || 0)
			},
			timing: {
				total_duration: ollamaData.total_duration,
				load_duration: ollamaData.load_duration,
				prompt_eval_duration: ollamaData.prompt_eval_duration,
				eval_duration: ollamaData.eval_duration
			}
		});
	} catch (error) {
		console.error('❌ Local AI Chat error:', error);

		let message = 'Local AI chat completion error';
		if (error instanceof Error) {
			if (error.name === 'AbortError') {
				message = 'Request timeout - the model took too long to respond';
			} else if (error.message.includes('fetch')) {
				message =
					'Cannot connect to Ollama server. Please ensure Ollama is running on ' + OLLAMA_BASE_URL;
			} else {
				message = error.message;
			}
		}

		return json(
			{
				success: false,
				error: message
			},
			{ status: 500 }
		);
	}
};

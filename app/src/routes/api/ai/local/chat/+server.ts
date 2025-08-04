// src/routes/api/ai/local/chat/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { apiTryCatch } from '$lib/utils/errorUtils';
import { env } from '$env/dynamic/private';

interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

const OLLAMA_BASE_URL = dev ? env.OLLAMA_DEV_URL : env.OLLAMA_PROD_URL;

export const POST: RequestHandler = async (event) =>
	apiTryCatch(async () => {
		const { request, fetch } = event;
		const body = await request.json();
		
		if (!OLLAMA_BASE_URL) {
			throw new Error('Ollama server URL is not configured');
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

		// Convert chat messages to a single prompt for the generate API
		let promptText = '';
		
		// Add system message first if provided
		if (system) {
			promptText += `System: ${system}\n\n`;
		}

		// Add system messages from the conversation
		const systemMessages = messages.filter((msg: ChatMessage) => msg.role === 'system');
		systemMessages.forEach((msg: ChatMessage) => {
			promptText += `System: ${msg.content}\n\n`;
		});

		// Add conversation history
		const conversationMessages = messages.filter((msg: ChatMessage) => msg.role !== 'system');
		conversationMessages.forEach((msg: ChatMessage, index: number) => {
			if (msg.role === 'user') {
				promptText += `Human: ${msg.content}\n\n`;
			} else if (msg.role === 'assistant') {
				promptText += `Assistant: ${msg.content}\n\n`;
			}
		});

		// Add final prompt for the assistant to respond
		promptText += 'Assistant: ';

		const modelName = typeof model === 'string' ? model : model.api_type || model.id || model.name;

		// Use the generate API instead of chat API
		const ollamaRequest = {
			model: modelName,
			prompt: promptText,
			stream: false,
			options: {
				temperature: temperature,
				num_predict: max_tokens,
				top_p: 0.9,
				top_k: 40,
				stop: ['Human:', 'System:'] // Stop tokens to prevent the model from continuing the conversation
			}
		};

		console.log('🤖 Local AI Chat - Using generate API with prompt:', {
			url: `${OLLAMA_BASE_URL}/api/generate`,
			model: modelName,
			promptLength: promptText.length,
			temperature: temperature
		});

		// Add timeout and better error handling
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 120000);

		try {
const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'curl/7.68.0',
        'Accept': '*/*',
        'Host': 'localhost:11434'
    },
    body: JSON.stringify(ollamaRequest),
    signal: controller.signal
});

			clearTimeout(timeoutId);

			console.log('🤖 Ollama generate response status:', ollamaResponse.status);

			if (!ollamaResponse.ok) {
				const errorText = await ollamaResponse.text();
				console.error('❌ Ollama generate API error:', ollamaResponse.status, errorText);

				if (ollamaResponse.status === 404) {
					throw new Error(
						`Model "${modelName}" not found in Ollama. Please pull the model first with: ollama pull ${modelName}`
					);
				} else if (ollamaResponse.status === 400) {
					throw new Error(`Bad request to Ollama: ${errorText}`);
				} else if (ollamaResponse.status === 500) {
					throw new Error('Ollama server error. Please check if Ollama is running properly.');
				} else {
					throw new Error(`Ollama API error (${ollamaResponse.status}): ${errorText}`);
				}
			}

			const ollamaData = await ollamaResponse.json();
			console.log('🤖 Local AI Chat - Ollama generate response received:', {
				model: ollamaData.model,
				done: ollamaData.done,
				responseLength: ollamaData.response?.length || 0
			});

			let responseText = ollamaData.response || '';

			if (!responseText || responseText.trim().length === 0) {
				throw new Error('Ollama returned empty response');
			}

			// Clean up the response (remove any trailing stop tokens)
			responseText = responseText.trim();

			console.log('🎯 Local AI Chat - Response extracted:', {
				length: responseText.length,
				preview: responseText.substring(0, 100) + (responseText.length > 100 ? '...' : '')
			});

			return {
				response: responseText,
				model: modelName,
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
			};

		} catch (error) {
			clearTimeout(timeoutId);
			
			if (error.name === 'AbortError') {
				throw new Error('Request timeout - the model took too long to respond');
			}
			
			throw error;
		}

	}, 'Local AI chat completion error');
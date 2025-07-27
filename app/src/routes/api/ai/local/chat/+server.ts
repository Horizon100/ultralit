// src/routes/api/ai/local/chat/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';
import { dev } from '$app/environment';
import type { LocalAIRequest, OllamaResponse } from '$lib/types/types.localModels';
import { OLLAMA_DEV_URL, OLLAMA_PROD_URL } from '$env/static/private';

const OLLAMA_BASE_URL = dev ? OLLAMA_DEV_URL : OLLAMA_PROD_URL;

export const POST: RequestHandler = async (event) =>
	apiTryCatch(async () => {
		const { request, locals } = event;
		const body = await request.json();

		console.log('🤖 Local AI Chat - Request received:', {
			model: body.model,
			userId: body.userId,
			messageCount: body.messages?.length
		});

		// Validate required fields
		if (!body.messages || !Array.isArray(body.messages)) {
			throw new Error('Messages array is required');
		}

		if (!body.model) {
			throw new Error('Model is required');
		}

		// Extract parameters with defaults
		const {
			messages,
			model,
			userId,
			temperature = 0.7,
			max_tokens = 4096,
			stream = false,
			system = null
		} = body;

		// Convert messages to Ollama format
		const ollamaMessages = messages.map((msg: any) => {
			let role = 'user';
			if (msg.role === 'assistant') role = 'assistant';
			else if (msg.role === 'system') role = 'system';
			
			return {
				role,
				content: msg.content
			};
		});

		// Add system message if provided
		if (system && !ollamaMessages.some(m => m.role === 'system')) {
			ollamaMessages.unshift({
				role: 'system',
				content: system
			});
		}

		// Prepare Ollama request
		const ollamaRequest = {
			model: model,
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
			model: model,
			messageCount: ollamaMessages.length,
			temperature: temperature
		});

		try {
			// Make request to Ollama
			const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(ollamaRequest),
				signal: AbortSignal.timeout(120000) // 2 minute timeout for chat
			});

			if (!ollamaResponse.ok) {
				const errorText = await ollamaResponse.text();
				console.error('❌ Ollama API error:', ollamaResponse.status, errorText);
				
				if (ollamaResponse.status === 404) {
					throw new Error(`Model "${model}" not found in Ollama. Please pull the model first with: ollama pull ${model}`);
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

			// Extract response from Ollama format
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

			// Return response in expected format
			return {
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
			};

		} catch (error) {
			console.error('❌ Local AI Chat - Request failed:', error);
			
			if (error instanceof Error) {
				// Handle specific error types
				if (error.name === 'AbortError') {
					throw new Error('Request timeout - the model took too long to respond');
				} else if (error.message.includes('fetch')) {
					throw new Error('Cannot connect to Ollama server. Please ensure Ollama is running on ' + OLLAMA_BASE_URL);
				}
				
				// Re-throw the original error if it's already user-friendly
				throw error;
			} else {
				throw new Error('Unknown error occurred while processing request');
			}
		}

	}, 'Local AI chat completion error');
// src/routes/api/ai/local/models/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';
import { dev } from '$app/environment';
import type { OllamaModel, OllamaModelsResponse, LocalAIModel } from '$lib/types/types.localModels';
import { OLLAMA_DEV_URL, OLLAMA_PROD_URL } from '$env/static/private';

const OLLAMA_BASE_URL = dev ? OLLAMA_DEV_URL : OLLAMA_PROD_URL;

export const GET: RequestHandler = async (event) =>
	apiTryCatch(async () => {
		console.log('🔍 Local AI Models - Fetching available models from:', OLLAMA_BASE_URL);

		try {
			// Test connection and get models
			const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				},
				// Add timeout for network issues
				signal: AbortSignal.timeout(10000) // 10 second timeout
			});

			if (!response.ok) {
				throw new Error(`Ollama server responded with status: ${response.status}`);
			}

			const data: OllamaModelsResponse = await response.json();
			console.log('🔍 Local AI Models - Raw response:', data);

			// Transform Ollama models to match your app's model interface
			const localModels: LocalAIModel[] = data.models.map((model) => ({
				id: `local-${model.name.replace(':', '-')}`,
				name: model.name,
				provider: 'local',
				api_type: model.name,
				size: model.size,
				parameters: model.details.parameter_size,
				families: model.details.families || [model.details.family],
				available: true,
				modified_at: model.modified_at
			}));

			console.log('🔍 Local AI Models - Transformed models:', localModels.length);

			// Return data object - apiTryCatch will wrap it with json()
			return {
				success: true,
				models: localModels,
				server_info: {
					url: OLLAMA_BASE_URL,
					status: 'connected',
					model_count: localModels.length
				}
			};
		} catch (error) {
			console.error('🔍 Local AI Models - Connection error:', error);

			// Throw error - let apiTryCatch handle the error response
			throw new Error(error instanceof Error ? error.message : 'Unknown connection error');
		}
	}, 'Error fetching local AI models');

// Health check for local AI server
export const POST: RequestHandler = async (event) =>
	apiTryCatch(async () => {
		const { request } = event;
		const body = await request.json();

		// Allow custom Ollama URL for testing
		const customUrl = body.url || OLLAMA_BASE_URL;

		try {
			const response = await fetch(`${customUrl}/api/tags`, {
				method: 'GET',
				signal: AbortSignal.timeout(5000) // 5 second timeout for health check
			});

			const isHealthy = response.ok;
			const data = isHealthy ? await response.json() : null;

			return json({
				healthy: isHealthy,
				url: customUrl,
				status: response.status,
				model_count: data?.models?.length || 0,
				timestamp: new Date().toISOString()
			});
		} catch (error) {
			return json(
				{
					healthy: false,
					url: customUrl,
					error: error instanceof Error ? error.message : 'Connection failed',
					timestamp: new Date().toISOString()
				},
				{ status: 503 }
			);
		}
	}, 'Error checking local AI server health');

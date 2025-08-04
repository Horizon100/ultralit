// src/routes/api/ai/local/models/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';
import { dev } from '$app/environment';
import type { OllamaModel, OllamaModelsResponse } from '$lib/types/types.localModels';
import { env } from '$env/dynamic/private';

const OLLAMA_BASE_URL = dev ? env.OLLAMA_DEV_URL : env.OLLAMA_PROD_URL;

// Simple server-side cache
let serverCache = {
    data: null as any,
    timestamp: 0,
    isHealthy: false
};

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache
const HEALTH_CHECK_INTERVAL = 30 * 1000; // 30 seconds for health checks

export const GET: RequestHandler = async (event) =>
    apiTryCatch(async () => {
        const now = Date.now();
        
        // Return cached data if still valid and server was healthy
        if (
            serverCache.data && 
            serverCache.isHealthy &&
            (now - serverCache.timestamp) < CACHE_TTL
        ) {
            console.log('🚀 Returning cached local models');
            return serverCache.data;
        }

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
                serverCache.isHealthy = false;
                throw new Error(`Ollama server responded with status: ${response.status}`);
            }

            const data: OllamaModelsResponse = await response.json();
            console.log('🔍 Local AI Models - Raw response:', data);

            // Transform Ollama models to match your app's model interface
            const localModels = data.models.map((model) => ({
                id: `local-${model.name.replace(':', '-')}`,
                name: model.name,
                provider: 'local',
                api_type: model.name,
                size: model.size,
                parameters: model.details.parameter_size,
                families: model.details.families || [model.details.family],
                available: true,
                modified_at: model.modified_at,
                context_length: 4096, // Default context length
                description: `Local model: ${model.name}`
            }));

            console.log('🔍 Local AI Models - Transformed models:', localModels.length);

            const result = {
                success: true,
                models: localModels,
                server_info: {
                    url: OLLAMA_BASE_URL,
                    status: 'connected',
                    model_count: localModels.length
                }
            };

            // Cache the successful result
            serverCache.data = result;
            serverCache.timestamp = now;
            serverCache.isHealthy = true;

            return result;
        } catch (error) {
            console.error('🔍 Local AI Models - Connection error:', error);
            
            // Mark server as unhealthy
            serverCache.isHealthy = false;
            
            // If we have stale cache data and server is down, return it with warning
            if (serverCache.data && (now - serverCache.timestamp) < (CACHE_TTL * 3)) {
                console.log('🚨 Server down, returning stale cached data');
                return {
                    ...serverCache.data,
                    server_info: {
                        ...serverCache.data.server_info,
                        status: 'disconnected',
                        warning: 'Using cached data - server unreachable'
                    }
                };
            }

            // Throw error - let apiTryCatch handle the error response
            throw new Error(error instanceof Error ? error.message : 'Unknown connection error');
        }
    }, 'Error fetching local AI models');

// Health check for local AI server with caching
export const POST: RequestHandler = async (event) =>
    apiTryCatch(async () => {
        const { request } = event;
        const body = await request.json();
        const now = Date.now();

        // Allow custom Ollama URL for testing
        const customUrl = body.url || OLLAMA_BASE_URL;

        // Return cached health status if recent
        if (
            customUrl === OLLAMA_BASE_URL && 
            (now - serverCache.timestamp) < HEALTH_CHECK_INTERVAL
        ) {
            return json({
                healthy: serverCache.isHealthy,
                url: customUrl,
                status: serverCache.isHealthy ? 200 : 503,
                cached: true,
                timestamp: new Date().toISOString()
            });
        }

        try {
            const response = await fetch(`${customUrl}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000) // 5 second timeout for health check
            });

            const isHealthy = response.ok;
            const data = isHealthy ? await response.json() : null;

            // Update cache if checking default URL
            if (customUrl === OLLAMA_BASE_URL) {
                serverCache.isHealthy = isHealthy;
                if (!isHealthy) {
                    // Clear cached models if server is down
                    serverCache.data = null;
                }
            }

            return json({
                healthy: isHealthy,
                url: customUrl,
                status: response.status,
                model_count: data?.models?.length || 0,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            // Update cache if checking default URL
            if (customUrl === OLLAMA_BASE_URL) {
                serverCache.isHealthy = false;
                serverCache.data = null;
            }

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
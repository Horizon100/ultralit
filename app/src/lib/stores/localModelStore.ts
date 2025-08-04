//  src/lib/stores/localModelsStore.ts

import { writable } from 'svelte/store';
import type { SelectableAIModel } from '$lib/types/types';

interface LocalModelsState {
    models: SelectableAIModel[];
    status: 'online' | 'offline' | 'unknown' | 'loading';
    lastFetched: number | null;
    isLoading: boolean;
}

const initialState: LocalModelsState = {
    models: [],
    status: 'unknown',
    lastFetched: null,
    isLoading: false
};

export const localModelsStore = writable<LocalModelsState>(initialState);

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

let pendingRequest: Promise<void> | null = null;

export const localModelsService = {
    async loadModels(force = false): Promise<SelectableAIModel[]> {
        return new Promise((resolve, reject) => {
            localModelsStore.update(state => {
                const now = Date.now();
                
                // Return cached data if available and not forced
                if (!force && 
                    state.models.length > 0 && 
                    state.lastFetched && 
                    (now - state.lastFetched) < CACHE_DURATION) {
                    console.log('🚀 Using cached local models from store');
                    resolve(state.models);
                    return state;
                }

                // If already loading, wait for the existing request
                if (state.isLoading && pendingRequest) {
                    console.log('🔄 Local models already loading, waiting...');
                    pendingRequest.then(() => {
                        localModelsStore.subscribe(currentState => {
                            resolve(currentState.models);
                        })();
                    }).catch(reject);
                    return state;
                }

                // Start new request
                state.isLoading = true;
                console.log('🔄 Loading local models...');

                pendingRequest = (async () => {
                    try {
                        const response = await fetch('/api/ai/local/models');
                        const result = await response.json();

                        console.log('🔍 Raw API response:', result);

                        // Handle different response structures
                        let models = [];
                        let serverStatus = 'offline';

                        if (result.success) {
                            // Check for nested data structure
                            if (result.data?.data?.models) {
                                // Structure: { success: true, data: { data: { models: [...] } } }
                                models = result.data.data.models;
                                serverStatus = result.data.data.server_info?.status === 'connected' ? 'online' : 'offline';
                            } else if (result.data?.models) {
                                // Structure: { success: true, data: { models: [...] } }
                                models = result.data.models;
                                serverStatus = result.data.server_info?.status === 'connected' ? 'online' : 'offline';
                            } else if (result.models) {
                                // Structure: { success: true, models: [...] }
                                models = result.models;
                                serverStatus = result.server_info?.status === 'connected' ? 'online' : 'offline';
                            }
                        }

                        console.log('🔍 Parsed models:', models);
                        console.log('🔍 Server status:', serverStatus);

                        if (models && Array.isArray(models)) {
                            const transformedModels = models.map((model: any) => ({
                                id: model.api_type || model.id || model.name,
                                name: model.name,
                                provider: 'local' as const,
                                context_length: model.context_length || 4096,
                                description: model.description || `Local model: ${model.name}`,
                                api_type: model.api_type || model.name,
                                size: model.size,
                                parameters: model.parameters,
                                families: model.families || [],
                                available: true
                            }));

                            localModelsStore.set({
                                models: transformedModels,
                                status: serverStatus,
                                lastFetched: now,
                                isLoading: false
                            });

                            console.log(`✅ Loaded ${transformedModels.length} local models, status: ${serverStatus}`);
                            resolve(transformedModels);
                        } else {
                            console.warn('No valid models array found in response');
                            localModelsStore.set({
                                models: [],
                                status: 'offline',
                                lastFetched: now,
                                isLoading: false
                            });
                            resolve([]);
                        }
                    } catch (error) {
                        console.error('Error loading local models:', error);
                        localModelsStore.set({
                            models: [],
                            status: 'offline',
                            lastFetched: now,
                            isLoading: false
                        });
                        reject(error);
                    } finally {
                        pendingRequest = null;
                    }
                })();

                return state;
            });
        });
    },

    async getModels(): Promise<SelectableAIModel[]> {
        return this.loadModels(false);
    },

    async checkStatus(): Promise<'online' | 'offline'> {
        try {
            const models = await this.loadModels(false);
            return models.length > 0 ? 'online' : 'offline';
        } catch {
            return 'offline';
        }
    },

    clearCache() {
        localModelsStore.set(initialState);
        pendingRequest = null;
        console.log('🗑️ Cleared local models cache');
    }
};
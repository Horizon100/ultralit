import { writable, get } from 'svelte/store';
import type { AIModel } from '$lib/types';
import type { ProviderType } from '$lib/constants/providers';
import { pb, checkPocketBaseConnection } from '$lib/pocketbase';
import { defaultModel } from '$lib/constants/models';
import { browser } from '$app/environment';

interface ModelState {
    models: AIModel[];
    selectedModel: AIModel;
    selectedProvider: ProviderType | null;
    updateStatus: string;
    isOffline: boolean;
}

const getFromStorage = <T>(key: string, defaultValue: T): T => {
    if (!browser) return defaultValue;
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    try {
        return JSON.parse(stored);
    } catch {
        return defaultValue;
    }
};

const setInStorage = (key: string, value: any): void => {
    if (!browser) return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn('Error saving to localStorage:', error);
    }
};

const createModelStore = () => {
    const initialState: ModelState = {
        models: [],
        selectedModel: defaultModel,
        selectedProvider: null,
        updateStatus: '',
        isOffline: false
    };

    const { subscribe, set, update } = writable<ModelState>(initialState);

    const saveModelToPocketBase = async (model: AIModel, userId: string): Promise<AIModel | null> => {
        try {
            // Check if model already exists for this user
            const existingModels = await pb.collection('models').getFullList<AIModel>({
                filter: `api_type = "${model.api_type}" && provider = "${model.provider}" && user ~ "${userId}"`,
            });
    
            // If model exists, return the existing one
            if (existingModels.length > 0) {
                const existingModel = existingModels[0];
                // Optionally update the existing model if needed
                const updatedModel = await pb.collection('models').update(existingModel.id, {
                    name: model.name,
                    api_key: model.api_key,
                    base_url: model.base_url,
                    description: model.description || '',
                    api_version: model.api_version || ''
                });
                return updatedModel as AIModel;
            }
    
            // If no existing model found, create new one
            const modelData = {
                name: model.name,
                api_key: model.api_key,
                base_url: model.base_url,
                api_type: model.api_type,
                provider: model.provider,
                description: model.description || '',
                user: [userId],
                api_version: model.api_version || ''
            };
    
            const savedModel = await pb.collection('models').create(modelData);
            return savedModel as AIModel;
        } catch (error) {
            console.error('Error saving model to PocketBase:', error);
            return null;
        }
    };

    return {
        subscribe,
        
        async loadModels(userId: string) {
            try {
                const isConnected = await checkPocketBaseConnection();
                if (!isConnected) throw new Error('PocketBase not available');

                const records = await pb.collection('models').getFullList({
                    filter: `user ~ "${userId}"`,
                    sort: '-created'
                });
                
                update(state => ({
                    ...state,
                    models: records as AIModel[],
                    isOffline: false,
                    updateStatus: ''
                }));

                return true;
            } catch (error) {
                console.warn('Failed to load models:', error);
                update(state => ({ ...state, isOffline: true }));
                return false;
            }
        },

        async setSelectedModel(userId: string, model: AIModel) {
            try {
                // Get or create the model in PocketBase
                let savedModel = model;
                const currentState = get({ subscribe });
                
                // Only save to PocketBase if it's not already in our models list
                if (!currentState.models.find(m => 
                    m.api_type === model.api_type && 
                    m.provider === model.provider
                )) {
                    const newModel = await saveModelToPocketBase(model, userId);
                    if (newModel) {
                        savedModel = newModel;
                    }
                } else {
                    // If it exists in our list, find it
                    savedModel = currentState.models.find(m => 
                        m.api_type === model.api_type && 
                        m.provider === model.provider
                    ) || model;
                }
        
                // Update user's selected model
                await pb.collection('users').update(userId, {
                    selected_model: savedModel.id
                });
        
                // Update store state
                update(state => {
                    const updatedModels = state.models.some(m => m.id === savedModel.id)
                        ? state.models
                        : [...state.models, savedModel];
                    
                    return {
                        ...state,
                        selectedModel: savedModel,
                        models: updatedModels,
                        isOffline: false,
                        updateStatus: 'Model selected successfully'
                    };
                });
        
                return true;
            } catch (error) {
                console.error('Error setting selected model:', error);
                update(state => ({ ...state, isOffline: true }));
                return false;
            }
        },

        async setSelectedProvider(userId: string, provider: ProviderType) {
            try {
                await pb.collection('users').update(userId, {
                    selected_provider: provider
                });
                
                update(state => ({
                    ...state,
                    selectedProvider: provider,
                    isOffline: false,
                    updateStatus: ''
                }));

                return true;
            } catch (error) {
                console.error('Error setting selected provider:', error);
                update(state => ({ ...state, isOffline: true }));
                return false;
            }
        },

        reset() {
            set(initialState);
        }
    };
};

export const modelStore = createModelStore();
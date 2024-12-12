import { writable, get } from 'svelte/store';
import type { AIModel } from '$lib/types';
import type { ProviderType } from '$lib/constants/providers';
import { pb, checkPocketBaseConnection } from '$lib/pocketbase';
import { defaultModel } from '$lib/constants/models';
// import { browser } from '$app/environment';

export interface ModelState {
    models: AIModel[];
    selectedModel: AIModel['api_type'];
    selectedProvider: ProviderType | null;
    updateStatus: string;
    isOffline: boolean;
}

// const getFromStorage = <T>(key: string, defaultValue: T): T => {
//     if (!browser) return defaultValue;
//     const stored = localStorage.getItem(key);
//     if (!stored) return defaultValue;
//     try {
//         return JSON.parse(stored);
//     } catch {
//         return defaultValue;
//     }
// };

// const setInStorage = (key: string, value: any): void => {
//     if (!browser) return;
//     try {
//         localStorage.setItem(key, JSON.stringify(value));
//     } catch (error) {
//         console.warn('Error saving to localStorage:', error);
//     }
// };

const createModelStore = () => {
    const initialState: ModelState = {
        models: [],
        selectedModel: '',
        selectedProvider: null,
        updateStatus: '',
        isOffline: false
    };

    const { subscribe, set, update } = writable<ModelState>(initialState);

    const saveModelToPocketBase = async (model: AIModel, userId: string): Promise<AIModel | null> => {
        console.log('Saving model to PocketBase:', { model, userId });
        try {
            const existingModels = await pb.collection('models').getFullList<AIModel>({
                filter: `api_type = "${model.api_type}" && provider = "${model.provider}" && user ~ "${userId}"`,
            });
    
            console.log('Existing models found:', existingModels);
    
            if (existingModels.length > 0) {
                const existingModel = existingModels[0];
                console.log('Updating existing model:', existingModel.id);
                const updatedModel = await pb.collection('models').update(existingModel.id, {
                    name: model.name,
                    api_key: model.api_key,
                    base_url: model.base_url,
                    description: model.description || '',
                    api_version: model.api_version || ''
                });
                console.log('Model updated successfully:', updatedModel);
                return updatedModel as AIModel;
            }
    
            console.log('Creating a new model in PocketBase...');
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
            console.log('Model created successfully:', savedModel);
            return savedModel as AIModel;
        } catch (error) {
            console.error('Error saving model to PocketBase:', error, 'Model Data:', model);
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
            console.log('setSelectedModel called with:', { userId, model });
            try {

                // Get or create the model in PocketBase
                let savedModel = model;
                const currentState = get({ subscribe });
                
                console.log('Current state of models:', currentState.models);
                // Use the correct API endpoint for updating users
                await pb.collection('users').update(userId, {
                    selected_model: savedModel.id
                }, {
                    // Add these options to handle potential CORS issues
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
                    }
                });
        
                // Only save to PocketBase if it's not already in our models list
                const existingModel = currentState.models.find(m => 
                    m.api_type === model.api_type && 
                    m.provider === model.provider
                );
        
                if (!existingModel) {
                    console.log('Model not found in local state. Attempting to save to PocketBase...');
                    const newModel = await saveModelToPocketBase(model, userId);
                    if (newModel) {
                        console.log('New model saved to PocketBase:', newModel);
                        savedModel = newModel;
                    } else {
                        console.warn('Failed to save new model to PocketBase.');
                    }
                } else {
                    console.log('Model already exists in local state:', existingModel);
                    savedModel = existingModel;
                }
        
                console.log('Updating user\'s selected model in PocketBase...');
                await pb.collection('users').update(userId, {
                    selected_model: savedModel.id
                });
                console.log('User\'s selected model updated successfully.');
        
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
                console.log('Store state updated with selected model:', savedModel);
        
                return true;
            } catch (error) {
                console.error('Error setting selected model:', error, 'Model:', model, 'UserId:', userId);
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

import { writable, get } from 'svelte/store';
import type { AIModel } from '$lib/types';
import { fetchUserModelPreferences, updateUserModelPreferences, getDefaultModelPreferences } from '$lib/pocketbase';
import type { ProviderType } from '$lib/constants/providers';
export const currentModel = writable(null); // Or initialize with a default model if needed
interface ModelState {
    models: AIModel[];
    selectedProvider: ProviderType | null;
    selectedModel: string | null; // Single model for compatibility
    updateStatus: string;
}

function createModelStore() {
    const { subscribe, set, update } = writable<ModelState>({
        models: [],
        selectedProvider: null,
        selectedModel: null, // Single selected model
        updateStatus: ''
    });

    return {
      
        subscribe,
        // Load user preferences or set defaults if none exist
        loadModels: async (userId: string) => {
            const prefs = await fetchUserModelPreferences(userId);
            if (!prefs.provider || !prefs.model) {
                const defaults = getDefaultModelPreferences();
                await updateUserModelPreferences(userId, defaults.provider, defaults.model);
                update(state => ({
                    ...state,
                    selectedProvider: defaults.provider,
                    selectedModel: defaults.model
                }));
                return defaults;
            }

            update(state => ({
                ...state,
                selectedProvider: prefs.provider as ProviderType,
                selectedModel: prefs.model
            }));
            return prefs;
        },
        // Set the selected provider
        setSelectedProvider: async (userId: string, provider: ProviderType) => {
            try {
                update(state => ({ ...state, selectedProvider: provider }));

                const state = get(modelStore); // Fetch current state
                await updateUserModelPreferences(userId, provider, state.selectedModel!);
            } catch (error) {
                console.error('Error updating selected provider:', error);
            }
        },
        // Set the selected model
        setSelectedModel: async (userId: string, model: string) => {
          try {
              update(state => ({ ...state, selectedModel: model }));
      
              const state = get(modelStore); // Fetch current state
              if (state.selectedProvider) {
                  await updateUserModelPreferences(userId, state.selectedProvider, model);
              }
          } catch (error) {
              console.error('Error updating selected model:', error);
          }
      },
        addModel: (model: AIModel) => update(state => ({
            ...state,
            models: [...state.models, model],
            updateStatus: 'Model added successfully'
        })),
        updateModel: (id: string, changes: Partial<AIModel>) => update(state => ({
            ...state,
            models: state.models.map(m => (m.id === id ? { ...m, ...changes } : m)),
            updateStatus: 'Model updated successfully'
        })),
        removeModel: (id: string) => update(state => ({
            ...state,
            models: state.models.filter(m => m.id !== id),
            updateStatus: 'Model removed successfully'
        })),
        reset: () => set({
            models: [],
            selectedProvider: null,
            selectedModel: null,
            updateStatus: ''
        })
    };
}

export const modelStore = createModelStore();
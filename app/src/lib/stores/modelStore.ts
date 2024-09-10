import { writable } from 'svelte/store';
import type { AIModel } from '$lib/types';
import { fetchUserModels } from '$lib/pocketbase';

function createModelStore() {
  const { subscribe, set, update } = writable<{models: AIModel[], updateStatus: string}>({models: [], updateStatus: ''});
  
  return {
    subscribe,
    loadModels: async (userId: string) => {
      try {
        const models = await fetchUserModels(userId);
        set({ models, updateStatus: 'Models loaded successfully' });
        setTimeout(() => update(state => ({ ...state, updateStatus: '' })), 3000);
      } catch (error) {
        console.error('Error loading models:', error);
        set({ models: [], updateStatus: 'Failed to load models' });
        setTimeout(() => update(state => ({ ...state, updateStatus: '' })), 3000);
      }
    },
    addModel: (model: AIModel) => update(state => ({
      models: [...state.models, model],
      updateStatus: 'Model added successfully'
    })),
    updateModel: (id: string, changes: Partial<AIModel>) => update(state => ({
      models: state.models.map(m => m.id === id ? { ...m, ...changes } : m),
      updateStatus: 'Model updated successfully'
    })),
    removeModel: (id: string) => update(state => ({
      models: state.models.filter(m => m.id !== id),
      updateStatus: 'Model removed successfully'
    })),
    reset: () => set({ models: [], updateStatus: '' })
  };
}

export const modelStore = createModelStore();
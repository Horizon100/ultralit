import { writable } from 'svelte/store';
import type { Actions } from '$lib/types/types';
import { fetchUserActions } from '$lib/pocketbase';

function createActionStore() {
  const { subscribe, set, update } = writable<{actions: Actions[], updateStatus: string}>({actions: [], updateStatus: ''});
  
  return {
    subscribe,
    loadActions: async (userId: string) => {
      try {
        const actions = await fetchUserActions(userId);
        set({ actions, updateStatus: 'Actions loaded successfully' });
        setTimeout(() => update(state => ({ ...state, updateStatus: '' })), 3000);
      } catch (error) {
        console.error('Error loading actions:', error);
        set({ actions: [], updateStatus: 'Failed to load actions' });
        setTimeout(() => update(state => ({ ...state, updateStatus: '' })), 3000);
      }
    },
    addAction: (action: Actions) => update(state => ({
      actions: [...state.actions, action],
      updateStatus: 'Action added successfully'
    })),
    updateAction: (id: string, changes: Partial<Actions>) => update(state => ({
      actions: state.actions.map(a => a.id === id ? { ...a, ...changes } : a),
      updateStatus: 'Action updated successfully'
    })),
    removeAction: (id: string) => update(state => ({
      actions: state.actions.filter(a => a.id !== id),
      updateStatus: 'Action removed successfully'
    })),
    reset: () => set({ actions: [], updateStatus: '' })
  };
}

export const actionStore = createActionStore();
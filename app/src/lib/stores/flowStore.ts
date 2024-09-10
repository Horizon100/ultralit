import { writable } from 'svelte/store';
import type { Workflows } from '$lib/types';
import { fetchUserFlows } from '$lib/pocketbase';

function createFlowStore() {
  const { subscribe, set, update } = writable<{flows: Workflows[], updateStatus: string}>({flows: [], updateStatus: ''});
  
  return {
    subscribe,
    loadFlows: async (userId: string) => {
      try {
        const flows = await fetchUserFlows(userId);
        set({ flows, updateStatus: 'Flows loaded successfully' });
        setTimeout(() => update(state => ({ ...state, updateStatus: '' })), 3000);
      } catch (error) {
        console.error('Error loading flows:', error);
        set({ flows: [], updateStatus: 'Failed to load flows' });
        setTimeout(() => update(state => ({ ...state, updateStatus: '' })), 3000);
      }
    },
    addFlow: (flow: Workflows) => update(state => ({
      flows: [...state.flows, flow],
      updateStatus: 'Flow added successfully'
    })),
    updateFlow: (id: string, changes: Partial<Workflows>) => update(state => ({
      flows: state.flows.map(f => f.id === id ? { ...f, ...changes } : f),
      updateStatus: 'Flow updated successfully'
    })),
    removeFlow: (id: string) => update(state => ({
      flows: state.flows.filter(f => f.id !== id),
      updateStatus: 'Flow removed successfully'
    })),
    reset: () => set({ flows: [], updateStatus: '' })
  };
}

export const flowStore = createFlowStore();
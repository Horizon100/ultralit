import { writable } from 'svelte/store';
import type { Actions } from '$lib/types/types';
import { createAction, updateAction, deleteAction, fetchActions } from '$lib/clients/actionClient';

function createActionStore() {
	const { subscribe, set, update } = writable<{ actions: Actions[]; updateStatus: string }>({
		actions: [],
		updateStatus: ''
	});

	return {
		subscribe,
		loadActions: async (): Promise<Actions[]> => {
			try {
				const actions = await fetchActions();
				set({ actions, updateStatus: 'Actions loaded successfully' });
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return actions;
			} catch (error) {
				console.error('Error loading actions:', error);
				set({ actions: [], updateStatus: 'Failed to load actions' });
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw error;
			}
		},
		addAction: async (actionData: Partial<Actions>) => {
			try {
				const newAction = await createAction(actionData);
				update((state) => ({
					actions: [...state.actions, newAction],
					updateStatus: 'Action added successfully'
				}));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return newAction;
			} catch (error) {
				console.error('Error adding action:', error);
				update((state) => ({ ...state, updateStatus: 'Failed to add action' }));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw error;
			}
		},
		updateAction: async (id: string, changes: Partial<Actions>) => {
			try {
				const updatedAction = await updateAction(id, changes);
				update((state) => ({
					actions: state.actions.map((a) => (a.id === id ? updatedAction : a)),
					updateStatus: 'Action updated successfully'
				}));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return updatedAction;
			} catch (error) {
				console.error('Error updating action:', error);
				update((state) => ({ ...state, updateStatus: 'Failed to update action' }));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw error;
			}
		},
		removeAction: async (id: string) => {
			try {
				await deleteAction(id);
				update((state) => ({
					actions: state.actions.filter((a) => a.id !== id),
					updateStatus: 'Action removed successfully'
				}));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
			} catch (error) {
				console.error('Error removing action:', error);
				update((state) => ({ ...state, updateStatus: 'Failed to remove action' }));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw error;
			}
		},
		reset: () => set({ actions: [], updateStatus: '' })
	};
}

export const actionStore = createActionStore();
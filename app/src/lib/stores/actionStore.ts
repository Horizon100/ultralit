import { writable } from 'svelte/store';
import type { Actions } from '$lib/types/types';
import { createAction, updateAction, deleteAction, fetchActions } from '$lib/clients/actionClient';
import { clientTryCatch, isFailure } from '$lib/utils/errorUtils';

function createActionStore() {
	const { subscribe, set, update } = writable<{ actions: Actions[]; updateStatus: string }>({
		actions: [],
		updateStatus: ''
	});

	return {
		subscribe,
		loadActions: async (): Promise<Actions[]> => {
			const result = await clientTryCatch(
				(async () => {
					const fetchResult = await fetchActions();

					// Handle if fetchActions returns a Result type
					let actions: Actions[];
					if (
						fetchResult &&
						typeof fetchResult === 'object' &&
						'success' in fetchResult &&
						'data' in fetchResult &&
						'error' in fetchResult &&
						typeof (fetchResult as { success: unknown }).success === 'boolean'
					) {
						// This is a Result type
						const resultType = fetchResult as { success: boolean; data: Actions[]; error: unknown };
						if (!resultType.success) {
							throw new Error(String(resultType.error));
						}
						actions = resultType.data;
					} else {
						// This is the actual data
						actions = fetchResult as unknown as Actions[];
					}

					set({ actions, updateStatus: 'Actions loaded successfully' });
					setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
					return actions;
				})(),
				'Loading actions'
			);

			if (isFailure(result)) {
				set({ actions: [], updateStatus: result.error });
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw new Error(result.error);
			}

			return result.data;
		},

		addAction: async (actionData: Partial<Actions>) => {
			const result = await clientTryCatch(
				(async () => {
					const createResult = await createAction(actionData);

					// Handle if createAction returns a Result type
					let newAction: Actions;
					if (
						createResult &&
						typeof createResult === 'object' &&
						'success' in createResult &&
						'data' in createResult &&
						'error' in createResult &&
						typeof (createResult as { success: unknown }).success === 'boolean'
					) {
						// This is a Result type
						const resultType = createResult as { success: boolean; data: Actions; error: unknown };
						if (!resultType.success) {
							throw new Error(String(resultType.error));
						}
						newAction = resultType.data;
					} else {
						// This is the actual data
						newAction = createResult as unknown as Actions;
					}

					update((state) => ({
						actions: [...state.actions, newAction],
						updateStatus: 'Action added successfully'
					}));
					setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
					return newAction;
				})(),
				'Adding action'
			);

			if (isFailure(result)) {
				update((state) => ({ ...state, updateStatus: result.error }));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw new Error(result.error);
			}

			return result.data;
		},

		updateAction: async (id: string, changes: Partial<Actions>) => {
			const result = await clientTryCatch(
				(async () => {
					const updateResult = await updateAction(id, changes);

					// Handle if updateAction returns a Result type
					let updatedAction: Actions;
					if (
						updateResult &&
						typeof updateResult === 'object' &&
						'success' in updateResult &&
						'data' in updateResult &&
						'error' in updateResult &&
						typeof (updateResult as { success: unknown }).success === 'boolean'
					) {
						// This is a Result type
						const resultType = updateResult as { success: boolean; data: Actions; error: unknown };
						if (!resultType.success) {
							throw new Error(String(resultType.error));
						}
						updatedAction = resultType.data;
					} else {
						// This is the actual data
						updatedAction = updateResult as unknown as Actions;
					}

					update((state) => ({
						actions: state.actions.map((a) => (a.id === id ? updatedAction : a)),
						updateStatus: 'Action updated successfully'
					}));
					setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
					return updatedAction;
				})(),
				`Updating action ${id}`
			);

			if (isFailure(result)) {
				update((state) => ({ ...state, updateStatus: result.error }));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw new Error(result.error);
			}

			return result.data;
		},

		removeAction: async (id: string) => {
			const result = await clientTryCatch(
				(async () => {
					const deleteResult = await deleteAction(id);

					// Handle if deleteAction returns a Result type
					if (
						deleteResult &&
						typeof deleteResult === 'object' &&
						'success' in deleteResult &&
						'data' in deleteResult &&
						'error' in deleteResult &&
						typeof (deleteResult as { success: unknown }).success === 'boolean'
					) {
						// This is a Result type
						const resultType = deleteResult as { success: boolean; data: unknown; error: unknown };
						if (!resultType.success) {
							throw new Error(String(resultType.error));
						}
					}

					update((state) => ({
						actions: state.actions.filter((a) => a.id !== id),
						updateStatus: 'Action removed successfully'
					}));
					setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
					return true;
				})(),
				`Removing action ${id}`
			);

			if (isFailure(result)) {
				update((state) => ({ ...state, updateStatus: result.error }));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw new Error(result.error);
			}
		},

		reset: () => set({ actions: [], updateStatus: '' })
	};
}

export const actionStore = createActionStore();

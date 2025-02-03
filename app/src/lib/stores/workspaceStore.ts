// workspaceStore.ts
import { writable } from 'svelte/store';
import type { Workspaces } from '$lib/types/types';
import { debounce } from 'lodash-es';
import { updateWorkspace as updateWorkspaceAPI, getWorkspaces } from '$lib/clients/workspaceClient';
import { browser } from '$app/environment';

function createWorkspaceStore() {
	const initialWorkspaces = browser
		? JSON.parse(localStorage.getItem('userWorkspaces') || '[]')
		: [];
	const initialCurrentWorkspaceId = browser
		? localStorage.getItem('currentWorkspaceId') || null
		: null;

	const { subscribe, set, update } = writable<{
		workspaces: Workspaces[];
		currentWorkspaceId: string | null;
		updateStatus: string;
	}>({
		workspaces: initialWorkspaces,
		currentWorkspaceId: initialCurrentWorkspaceId,
		updateStatus: ''
	});

	if (browser) {
		subscribe((state) => {
			localStorage.setItem('userWorkspaces', JSON.stringify(state.workspaces));
			if (state.currentWorkspaceId) {
				localStorage.setItem('currentWorkspaceId', state.currentWorkspaceId);
			} else {
				localStorage.removeItem('currentWorkspaceId');
			}
		});
	}

	const debouncedUpdateWorkspace = debounce(async (id: string, changes: Partial<Workspaces>) => {
		try {
			const updatedWorkspace = await updateWorkspaceAPI(id, changes);
			update((state) => ({
				...state,
				workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, ...updatedWorkspace } : w)),
				updateStatus: 'Workspace updated successfully'
			}));
			setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
		} catch (error) {
			console.error('Failed to update workspace in backend:', error);
			update((state) => ({ ...state, updateStatus: 'Failed to update workspace' }));
			setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
		}
	}, 300);

	return {
		subscribe,
		loadWorkspaces: async (userId: string): Promise<Workspaces[]> => {
			try {
				const workspaces = await getWorkspaces(userId);
				update((state) => ({
					...state,
					workspaces,
					currentWorkspaceId:
						state.currentWorkspaceId || (workspaces.length > 0 ? workspaces[0].id : null),
					updateStatus: 'Workspaces loaded successfully'
				}));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return workspaces;
			} catch (error) {
				console.error('Error loading workspaces:', error);
				set({
					workspaces: [],
					currentWorkspaceId: null,
					updateStatus: 'Failed to load workspaces'
				});
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return [];
			}
		},
		addWorkspace: (workspace: Workspaces) =>
			update((state) => ({
				...state,
				workspaces: [...state.workspaces, workspace],
				updateStatus: 'Workspace added successfully'
			})),
		updateWorkspace: (id: string, changes: Partial<Workspaces>) => {
			update((state) => ({
				...state,
				workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, ...changes } : w)),
				updateStatus: 'Updating workspace...'
			}));

			debouncedUpdateWorkspace(id, changes);
		},
		removeWorkspace: (id: string) =>
			update((state) => ({
				...state,
				workspaces: state.workspaces.filter((w) => w.id !== id),
				updateStatus: 'Workspace removed successfully'
			})),
		setCurrentWorkspace: (id: string) =>
			update((state) => ({
				...state,
				currentWorkspaceId: id,
				updateStatus: 'Current workspace updated'
			})),
		reset: () => set({ workspaces: [], currentWorkspaceId: null, updateStatus: '' })
	};
}

export const workspaceStore = createWorkspaceStore();

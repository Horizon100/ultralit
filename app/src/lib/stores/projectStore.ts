import { writable, derived, get } from 'svelte/store';
import type { Projects, ProjectStoreState, User } from '$lib/types/types';
import { debounce } from 'lodash-es';
import {
	fetchProjects,
	createProject,
	updateProject,
	addCollaboratorToProject,
	removeCollaboratorFromProject,
	fetchProjectCollaborators
} from '$lib/clients/projectClient';

function createProjectStore() {
	const store = writable<ProjectStoreState>({
		threads: [],
		currentProjectId: null,
		messages: [],
		updateStatus: '',
		isProjectLoaded: false,
		searchQuery: '',
		namingProjectId: null,
		currentProject: null,
		filteredProject: [],
		isEditingProjectName: false,
		editedProjectdName: '',
		owner: null,
		collaborators: []
	});

	const { subscribe, update } = store;

	const debouncedUpdateProject = debounce(async (id: string, changes: Partial<Projects>) => {
		try {
			const updatedProject = await updateProject(id, changes);
			store.update((state) => ({
				...state,
				threads: state.threads.map((t) => (t.id === id ? { ...t, ...updatedProject } : t)),
				updateStatus: 'Project updated successfully'
			}));
			setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
		} catch (error) {
			console.error('Failed to update project:', error);
			store.update((state) => ({ ...state, updateStatus: 'Failed to update project' }));
			setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
		}
	}, 300);

	return {
		subscribe,
		update,
		loadProjects: async (): Promise<Projects[]> => {
			try {
				const projects = await fetchProjects();
				store.update((state) => ({
					...state,
					threads: projects,
					isProjectLoaded: true,
					updateStatus: 'Projects loaded successfully'
				}));
				return projects;
			} catch (error) {
				console.error('Error loading projects:', error);
				return [];
			}
		},

		addProject: async (projectData: Partial<Projects>): Promise<Projects | null> => {
			try {
				const newProject = await createProject(projectData);
				const updatedProjects = await fetchProjects();
				store.update((state) => ({
					...state,
					threads: updatedProjects,
					isProjectLoaded: true,
					updateStatus: 'Project added successfully'
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return newProject;
			} catch (error) {
				console.error('Error adding project:', error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to add project' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}
		},

		updateProject: async (id: string, changes: Partial<Projects>) => {
			try {
				const updatedProject = await updateProject(id, changes);
				store.update((state) => ({
					...state,
					threads: state.threads.map((t) => (t.id === id ? { ...t, ...updatedProject } : t)),
					updateStatus: 'Project updated successfully'
				}));
				return updatedProject;
			} catch (error) {
				console.error('Failed to update project:', error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to update project' }));
				throw error;
			}
		},

		setCurrentProject: (id: string | null) => {
			store.update((state) => ({
				...state,
				currentProjectId: id,
				currentProject: state.threads.find((p) => p.id === id) || null
			}));
		},

		setSearchQuery: (query: string) => {
			store.update((state) => ({
				...state,
				searchQuery: query
			}));
		},

		reset: () => {
			store.update((state) => ({
				...state,
				currentProjectId: null,
				currentProject: null,
				messages: [],
				updateStatus: '',
				isProjectLoaded: false
			}));
		},
		loadCollaborators: async (projectId: string) => {
			try {
			if (!projectId) return [];
			
			store.update(state => ({
				...state,
				updateStatus: 'Loading collaborators...'
			}));
			
			let collaborators = await fetchProjectCollaborators(projectId);
			
			console.log('Loaded collaborators:', collaborators);
			
			if (!Array.isArray(collaborators)) {
				console.error('Expected array of collaborators but got:', collaborators);
				collaborators = [];
			}
			
			store.update((state) => ({
				...state,
				collaborators,
				updateStatus: collaborators.length > 0 
				? 'Collaborators loaded successfully' 
				: 'No collaborators found'
			}));
			setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
			return collaborators;
			} catch (error) {
			console.error('Error loading collaborators:', error);
			store.update((state) => ({ 
				...state, 
				collaborators: [],
				updateStatus: 'Failed to load collaborators: ' + (error instanceof Error ? error.message : String(error))
			}));
			setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
			return [];
			}
		},
		addCollaborator: async (projectId: string, userId: string) => {
			try {
				const updatedProject = await addCollaboratorToProject(projectId, userId);
				const collaborators = await fetchProjectCollaborators(projectId);
				
				store.update((state) => ({
					...state,
					collaborators,
					threads: state.threads.map((t) => (t.id === projectId ? { ...t, ...updatedProject } : t)),
					updateStatus: 'Collaborator added successfully'
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return updatedProject;
			} catch (error) {
				console.error('Error adding collaborator:', error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to add collaborator' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw error;
			}
		},

		removeCollaborator: async (projectId: string, userId: string) => {
			try {
				const updatedProject = await removeCollaboratorFromProject(projectId, userId);
				const collaborators = await fetchProjectCollaborators(projectId);
				
				store.update((state) => ({
					...state,
					collaborators,
					threads: state.threads.map((t) => (t.id === projectId ? { ...t, ...updatedProject } : t)),
					updateStatus: 'Collaborator removed successfully'
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return updatedProject;
			} catch (error) {
				console.error('Error removing collaborator:', error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to remove collaborator' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw error;
			}
		},
		getCurrentProject: derived(
			store,
			($store) => $store.threads.find((p) => p.id === $store.currentProjectId) || null
		),

		getSearchedProjects: derived(store, ($store) => {
			const query = $store.searchQuery.toLowerCase().trim();
			if (!query) return $store.threads;

			return $store.threads.filter(
				(project) =>
					project.name?.toLowerCase().includes(query) ||
					project.description?.toLowerCase().includes(query)
			);
		}),

		isSearchActive: derived(store, ($store) => $store.searchQuery.trim().length > 0),

		isProjectLoaded: derived(store, ($store) => $store.isProjectLoaded)
	};
}

export const projectStore = createProjectStore();

export function getProjectStore() {
	return get(projectStore);
}

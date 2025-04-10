import { writable, derived, get } from 'svelte/store';
import type { Projects, ProjectStoreState, User } from '$lib/types/types';
import { debounce } from 'lodash-es';
import {
	fetchProjects,
	createProject,
	updateProject,
	deleteProject,
	addCollaboratorToProject,
	removeCollaboratorFromProject,
	fetchProjectCollaborators
} from '$lib/clients/projectClient';
import { pb } from '$lib//pocketbase';

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

	// Create the store object with all methods
	const storeObj = {
		subscribe,
		update,
		
		loadProjects: async (): Promise<Projects[]> => {
			try {
				const currentUserId = pb.authStore.model?.id;
				if (!currentUserId) {
					throw new Error('User not authenticated');
				}
				
				const projects = await fetchProjects();
				
				// Filter projects based on permissions
				const filteredProjects = projects.filter(project => {
					return project.owner === currentUserId || 
						(Array.isArray(project.collaborators) && project.collaborators.includes(currentUserId));
				});
				
				store.update((state) => ({
					...state,
					threads: filteredProjects,
					isProjectLoaded: true,
					updateStatus: 'Projects loaded successfully'
				}));
				
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return filteredProjects;
			} catch (error) {
				console.error('Error loading projects:', error);
				store.update((state) => ({ 
					...state, 
					updateStatus: 'Failed to load projects',
					isProjectLoaded: false
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return [];
			}
		},

		addProject: async (projectData: Partial<Projects>): Promise<Projects | null> => {
			try {
				const currentUserId = pb.authStore.model?.id;
				if (!currentUserId) {
					throw new Error('User not authenticated');
				}
				
				// Ensure owner is set to current user if not specified
				const dataWithOwner: Partial<Projects> = {
					...projectData,
					owner: currentUserId, // Always set owner to current user
				};
				
				const newProject = await createProject(dataWithOwner);
				
				// Reload projects using storeObj reference instead of this
				await storeObj.loadProjects();
				
				store.update((state) => ({
					...state,
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

		deleteProject: async (projectId: string): Promise<boolean> => {
			try {
				const currentUserId = pb.authStore.model?.id;
				if (!currentUserId) {
					throw new Error('User not authenticated');
				}
				
				// Get the current project to check permissions
				const project = get(store).threads.find(p => p.id === projectId);
				if (!project) {
					throw new Error('Project not found');
				}
				
				// Add debugging
				console.log('Deleting project:', {
					projectId,
					currentUserId,
					projectOwner: project.owner,
					isOwner: currentUserId === project.owner
				});
				
				// Verify user has permission to delete the project (owner only)
				if (currentUserId !== project.owner) {
					throw new Error('Unauthorized to delete this project: only the owner can delete projects');
				}
				
				// Delete the project
				await deleteProject(projectId);
				
				// Update the store by removing the deleted project
				store.update((state) => ({
					...state,
					threads: state.threads.filter(p => p.id !== projectId),
					// If the deleted project was the current project, reset current project
					currentProjectId: state.currentProjectId === projectId ? null : state.currentProjectId,
					currentProject: state.currentProjectId === projectId ? null : state.currentProject,
					updateStatus: 'Project deleted successfully'
				}));
				
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return true;
			} catch (error) {
				console.error('Failed to delete project:', error);
				store.update((state) => ({ 
					...state, 
					updateStatus: 'Failed to delete project: ' + (error instanceof Error ? error.message : String(error))
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return false;
			}
		},

		updateProject: async (id: string, changes: Partial<Projects>) => {
			try {
				const currentUserId = pb.authStore.model?.id;
				if (!currentUserId) {
					throw new Error('User not authenticated');
				}
				
				// Get the current project to check permissions
				const project = get(store).threads.find(p => p.id === id);
				if (!project) {
					throw new Error('Project not found');
				}
				
				// Verify user has permission to update the project
				if (project.owner !== currentUserId && 
					!(Array.isArray(project.collaborators) && project.collaborators.includes(currentUserId))) {
					throw new Error('Unauthorized to update this project');
				}
				
				const updatedProject = await updateProject(id, changes);
				store.update((state) => ({
					...state,
					threads: state.threads.map((t) => (t.id === id ? { ...t, ...updatedProject } : t)),
					updateStatus: 'Project updated successfully'
				}));
				
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return updatedProject;
			} catch (error) {
				console.error('Failed to update project:', error);
				store.update((state) => ({ ...state, updateStatus: 'Failed to update project' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw error;
			}
		},

		setCurrentProject: async (id: string | null) => {
			try {
				if (!id) {
					store.update((state) => ({
						...state,
						currentProjectId: null,
						currentProject: null,
						collaborators: []
					}));
					return;
				}
				
				const currentUserId = pb.authStore.model?.id;
				if (!currentUserId) {
					throw new Error('User not authenticated');
				}
				
				// Get the current project from the store
				const project = get(store).threads.find(p => p.id === id);
				
				// If project not in store, try to fetch it directly
				let currentProject = project;
				if (!currentProject) {
					try {
						// Attempt to fetch the project directly
						const fetchedProject = await pb.collection('projects').getOne(id, {
							expand: 'last_message,owner,collaborators',
							$autoCancel: false
						});
						
						// Verify user has permission to access this project
						const isOwner = fetchedProject.owner === currentUserId;
						const isCollaborator = Array.isArray(fetchedProject.collaborators) && 
								fetchedProject.collaborators.includes(currentUserId);
						
						if (!isOwner && !isCollaborator) {
							throw new Error('Unauthorized to access this project');
						}
						
						currentProject = fetchedProject;
					} catch (error) {
						console.error('Failed to fetch project:', error);
						throw new Error('Project not found or unauthorized');
					}
				}
				
				// If we get here, we have permission to access the project
				store.update((state) => ({
					...state,
					currentProjectId: id,
					currentProject
				}));
				
				// Load collaborators - use storeObj reference instead of 'this'
				try {
					await storeObj.loadCollaborators(id);
				} catch (err) {
					console.error('Failed to load collaborators:', err);
					// Continue anyway even if collaborator loading fails
				}
				
			} catch (error) {
				console.error('Error setting current project:', error);
				store.update((state) => ({
					...state,
					currentProjectId: null,
					currentProject: null,
					collaborators: [],
					updateStatus: 'Failed to set current project'
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw error;
			}
		},
		
		loadCollaborators: async (projectId: string) => {
			try {
				if (!projectId) return [];
				
				const currentUserId = pb.authStore.model?.id;
				if (!currentUserId) {
					throw new Error('User not authenticated');
				}
				
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
				isProjectLoaded: false,
				collaborators: []
			}));
		},
		
		addCollaborator: async (projectId: string, userId: string) => {
			try {
				const currentUserId = pb.authStore.model?.id;
				if (!currentUserId) {
					throw new Error('User not authenticated');
				}
				
				// Get the current project to check permissions
				const project = get(store).threads.find(p => p.id === projectId);
				if (!project) {
					throw new Error('Project not found');
				}
				
				// Only the owner should be able to add collaborators
				if (project.owner !== currentUserId) {
					throw new Error('Only the project owner can add collaborators');
				}
				
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
				const currentUserId = pb.authStore.model?.id;
				if (!currentUserId) {
					throw new Error('User not authenticated');
				}
				
				// Get the current project to check permissions
				const project = get(store).threads.find(p => p.id === projectId);
				if (!project) {
					throw new Error('Project not found');
				}
				
				// Only the owner should be able to remove collaborators
				// Or users can remove themselves
				if (project.owner !== currentUserId && userId !== currentUserId) {
					throw new Error('Only the project owner can remove collaborators');
				}
				
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
			($store) => $store.threads.find((p) => p.id === $store.currentProjectId) || $store.currentProject
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

	return storeObj;
}

export const projectStore = createProjectStore();

export function getProjectStore() {
	return get(projectStore);
}
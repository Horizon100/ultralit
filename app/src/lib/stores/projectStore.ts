import { writable, derived, get } from 'svelte/store';
import type { Projects, ProjectStoreState } from '$lib/types/types';
import {
	fetchProjects,
	createProject,
	updateProject,
	deleteProject,
	addCollaboratorToProject,
	removeCollaboratorFromProject,
	fetchProjectCollaborators
} from '$lib/clients/projectClient';
import { currentUser } from '$lib/pocketbase';
import { 
	storageTryCatch, 
	fetchTryCatch, 
	clientTryCatch, 
	validationTryCatch,
	isSuccess, 
	isFailure 
} from '$lib/utils/errorUtils';

const STORAGE_KEY = 'currentProjectId';

// Helper functions for localStorage persistence
function saveCurrentProjectToStorage(projectId: string | null): void {
	if (typeof window === 'undefined') return;
	
	storageTryCatch(
		() => {
			if (projectId) {
				localStorage.setItem(STORAGE_KEY, projectId);
				console.log('Saved current project to localStorage:', projectId);
			} else {
				localStorage.removeItem(STORAGE_KEY);
				console.log('Removed current project from localStorage');
			}
		},
		undefined,
		'Error saving current project to storage'
	);
}

function loadCurrentProjectFromStorage(): string | null {
	if (typeof window === 'undefined') return null;
	
	return storageTryCatch(
		() => {
			const projectId = localStorage.getItem(STORAGE_KEY);
			if (projectId) {
				console.log('Loaded current project from localStorage:', projectId);
			}
			return projectId;
		},
		null,
		'Error loading current project from storage'
	);
}

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
			const loadResult = await clientTryCatch(
				(async () => {
					const user = get(currentUser);
					if (!user) {
						throw new Error('User not authenticated');
					}

					const projects = await fetchProjects();

					// Filter projects based on permissions
					const filteredProjects = projects.filter((project) => {
						return (
							project.owner === user.id ||
							(Array.isArray(project.collaborators) && project.collaborators.includes(user.id))
						);
					});

					store.update((state) => ({
						...state,
						threads: filteredProjects,
						isProjectLoaded: true,
						updateStatus: 'Projects loaded successfully'
					}));

					setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
					return filteredProjects;
				})(),
				'Error loading projects'
			);

			if (isFailure(loadResult)) {
				store.update((state) => ({
					...state,
					updateStatus: 'Failed to load projects',
					isProjectLoaded: false
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return [];
			}

			return loadResult.data;
		},

		addProject: async (projectData: Partial<Projects>): Promise<Projects | null> => {
			const addResult = await clientTryCatch(
				(async () => {
					const user = get(currentUser);
					if (!user) {
						throw new Error('User not authenticated');
					}

					// Ensure owner is set to current user if not specified
					const dataWithOwner: Partial<Projects> = {
						...projectData,
						owner: user.id // Always set owner to current user
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
				})(),
				'Error adding project'
			);

			if (isFailure(addResult)) {
				store.update((state) => ({ ...state, updateStatus: 'Failed to add project' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}

			return addResult.data;
		},

		deleteProject: async (projectId: string): Promise<boolean> => {
			const deleteResult = await clientTryCatch(
				(async () => {
					const user = get(currentUser);
					if (!user) {
						throw new Error('User not authenticated');
					}

					// Get the current project to check permissions
					const project = get(store).threads.find((p) => p.id === projectId);
					if (!project) {
						throw new Error('Project not found');
					}

					// Add debugging
					console.log('Deleting project:', {
						projectId,
						currentUserId: user.id,
						projectOwner: project.owner,
						isOwner: user.id === project.owner
					});

					// Verify user has permission to delete the project (owner only)
					if (user.id !== project.owner) {
						throw new Error(
							'Unauthorized to delete this project: only the owner can delete projects'
						);
					}

					// Delete the project
					await deleteProject(projectId);

					// Update the store by removing the deleted project
					store.update((state) => ({
						...state,
						threads: state.threads.filter((p) => p.id !== projectId),
						// If the deleted project was the current project, reset current project
						currentProjectId: state.currentProjectId === projectId ? null : state.currentProjectId,
						currentProject: state.currentProjectId === projectId ? null : state.currentProject,
						updateStatus: 'Project deleted successfully'
					}));

					setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
					return true;
				})(),
				'Failed to delete project'
			);

			if (isFailure(deleteResult)) {
				store.update((state) => ({
					...state,
					updateStatus: 'Failed to delete project: ' + deleteResult.error
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return false;
			}

			return deleteResult.data;
		},

		updateProject: async (id: string, changes: Partial<Projects>) => {
			const updateResult = await clientTryCatch(
				(async () => {
					const user = get(currentUser);
					if (!user) {
						throw new Error('User not authenticated');
					}

					// Get the current project to check permissions
					const project = get(store).threads.find((p) => p.id === id);
					if (!project) {
						throw new Error('Project not found');
					}

					// Verify user has permission to update the project
					if (
						project.owner !== user.id &&
						!(Array.isArray(project.collaborators) && project.collaborators.includes(user.id))
					) {
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
				})(),
				'Failed to update project'
			);

			if (isFailure(updateResult)) {
				store.update((state) => ({ ...state, updateStatus: 'Failed to update project' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw new Error(updateResult.error);
			}

			return updateResult.data;
		},

		setCurrentProject: async (id: string | null) => {
			const setResult = await clientTryCatch(
				(async () => {
					// Save to localStorage for persistence
					saveCurrentProjectToStorage(id);

					if (!id) {
						store.update((state) => ({
							...state,
							currentProjectId: null,
							currentProject: null,
							collaborators: []
						}));
						return;
					}

					const user = get(currentUser);
					if (!user) {
						throw new Error('User not authenticated');
					}

					const project = get(store).threads.find((p) => p.id === id);

					let currentProject = project;
					if (!currentProject) {
						const fetchResult = await fetchTryCatch<{ 
							success: boolean; 
							data: Projects; 
							error?: string 
						}>(`/api/projects/${id}`, {
							method: 'GET',
							credentials: 'include'
						});

						if (isFailure(fetchResult)) {
							saveCurrentProjectToStorage(null);
							throw new Error('Failed to fetch project');
						}

						const data = fetchResult.data;
						if (!data.success) {
							throw new Error(data.error || 'Failed to fetch project');
						}

						const fetchedProject = data.data;

						// Verify user has permission to access this project
						const isOwner = fetchedProject.owner === user.id;
						const isCollaborator =
							Array.isArray(fetchedProject.collaborators) &&
							fetchedProject.collaborators.includes(user.id);

						if (!isOwner && !isCollaborator) {
							throw new Error('Unauthorized to access this project');
						}

						currentProject = fetchedProject;

						// Add the fetched project to the store
						store.update((state) => ({
							...state,
							threads: [...state.threads.filter((p) => p.id !== id), fetchedProject]
						}));
					}

					store.update((state) => ({
						...state,
						currentProjectId: id,
						currentProject,
						updateStatus: ''
					}));

					// Load collaborators
					const collabResult = await clientTryCatch(
						storeObj.loadCollaborators(id),
						'Failed to load collaborators'
					);

					if (isFailure(collabResult)) {
						console.error('Failed to load collaborators:', collabResult.error);
						// Continue even if collaborator loading fails
					}

					// Load the threads for this project
					const threadsResult = await clientTryCatch(
						(async () => {
							console.log(`Loading threads for selected project ${id}`);
							const { loadThreads } = await import('$lib/clients/threadsClient');
							await loadThreads(id);
						})(),
						'Failed to load threads for project'
					);

					if (isFailure(threadsResult)) {
						console.error('Failed to load threads for project:', threadsResult.error);
					}
				})(),
				'Error setting current project'
			);

			if (isFailure(setResult)) {
				saveCurrentProjectToStorage(null); // Clear invalid project
				store.update((state) => ({
					...state,
					currentProjectId: null,
					currentProject: null,
					collaborators: [],
					updateStatus: setResult.error
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw new Error(setResult.error);
			}
		},

		initializeFromStorage: async () => {
			const savedProjectId = loadCurrentProjectFromStorage();
			if (savedProjectId) {
				const initResult = await clientTryCatch(
					storeObj.setCurrentProject(savedProjectId),
					'Failed to restore project from storage'
				);

				if (isFailure(initResult)) {
					console.log('Restoring project from localStorage on init:', savedProjectId);
					saveCurrentProjectToStorage(null);
				}
			}
		},

		loadCollaborators: async (projectId: string) => {
			const loadResult = await clientTryCatch(
				(async () => {
					if (!projectId) return [];

					const user = get(currentUser);
					if (!user) {
						throw new Error('User not authenticated');
					}

					store.update((state) => ({
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
						updateStatus:
							collaborators.length > 0
								? 'Collaborators loaded successfully'
								: 'No collaborators found'
					}));
					setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
					return collaborators;
				})(),
				'Error loading collaborators'
			);

			if (isFailure(loadResult)) {
				store.update((state) => ({
					...state,
					collaborators: [],
					updateStatus: 'Failed to load collaborators: ' + loadResult.error
				}));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				return [];
			}

			return loadResult.data;
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
			const addResult = await clientTryCatch(
				(async () => {
					const user = get(currentUser);
					if (!user) {
						throw new Error('User not authenticated');
					}

					// Get the current project to check permissions
					const project = get(store).threads.find((p) => p.id === projectId);
					if (!project) {
						throw new Error('Project not found');
					}

					// Only the owner should be able to add collaborators
					if (project.owner !== user.id) {
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
				})(),
				'Error adding collaborator'
			);

			if (isFailure(addResult)) {
				store.update((state) => ({ ...state, updateStatus: 'Failed to add collaborator' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw new Error(addResult.error);
			}

			return addResult.data;
		},

		removeCollaborator: async (projectId: string, userId: string) => {
			const removeResult = await clientTryCatch(
				(async () => {
					const user = get(currentUser);
					if (!user) {
						throw new Error('User not authenticated');
					}

					// Get the current project to check permissions
					const project = get(store).threads.find((p) => p.id === projectId);
					if (!project) {
						throw new Error('Project not found');
					}

					/*
					 * Only the owner should be able to remove collaborators
					 * Or users can remove themselves
					 */
					if (project.owner !== user.id && userId !== user.id) {
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
				})(),
				'Error removing collaborator'
			);

			if (isFailure(removeResult)) {
				store.update((state) => ({ ...state, updateStatus: 'Failed to remove collaborator' }));
				setTimeout(() => store.update((state) => ({ ...state, updateStatus: '' })), 3000);
				throw new Error(removeResult.error);
			}

			return removeResult.data;
		},

		getCurrentProject: derived(
			store,
			($store) =>
				$store.threads.find((p) => p.id === $store.currentProjectId) || $store.currentProject
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
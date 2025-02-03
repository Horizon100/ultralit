import { writable, get } from 'svelte/store';

import type {
	ProjectStoreState,
	ExpandedSections,
	ThreadGroup,
	MessageState,
	PromptState,
	UIState,
	AIModel,
	ChatMessage,
	InternalChatMessage,
	Scenario,
	ThreadStoreState,
	Projects,
	Task,
	Attachment,
	Guidance,
	RoleType,
	PromptType,
	NetworkData,
	AIAgent,
	Network,
	Threads,
	Messages
} from '$lib/types/types';
import { projectStore } from '$lib/stores/projectStore';
import {
	fetchProjects,
	resetProject,
	fetchThreadsForProject,
	updateProject,
	removeThreadFromProject,
	addThreadToProject
} from '$lib/clients/projectClient';
import { threadsStore } from '$lib/stores/threadsStore';
import { isThreadListVisible, showPromptCatalog } from '$lib/chat/threadHandlers';

// Main stores
export const projectVisibilityStore = writable(false);
export const projectStateStore = writable({
	projects: [] as Projects[],
	currentProject: null as Projects | null,
	currentProjectId: null as string | null,
	isEditingProjectName: false,
	newProjectName: '',
	editingProjectId: null as string | null,
	editedProjectName: '',
	isCreatingProject: false
});
export const projectState = writable({
	projects: [],
	currentProjectId: null as string | null,
	currentProject: null as Projects | null,
	filteredProjects: [] as Projects[],
	isEditingProjectName: false,
	editedProjectName: ''
});
// Helper function for type-safe store updates
export function updateProjectState(updates: Partial<(typeof projectStateStore)['_value']>) {
	projectStateStore.update((state) => ({ ...state, ...updates }));
}

// Functions
export async function submitProjectNameChange(projectId: string) {
	const state = get(projectStateStore);
	if (state.editedProjectName.trim()) {
		await projectStore.updateProject(projectId, { name: state.editedProjectName.trim() });
	}
	cancelEditing();
}

export function cancelEditing() {
	updateProjectState({
		editingProjectId: null,
		editedProjectName: ''
	});
}

export async function handleCreateNewProject(name: string) {
	if (!name.trim()) return;

	try {
		updateProjectState({ isCreatingProject: true });

		const newProject = await projectStore.addProject({
			name: name.trim(),
			description: ''
		});

		if (newProject) {
			updateProjectState({ newProjectName: '' });
			showPromptCatalog.set(false);
		}
	} catch (error) {
		console.error('Error in handleCreateNewProject:', error);
	} finally {
		updateProjectState({ isCreatingProject: false });
	}
}

export async function handleSelectProject(projectId: string) {
	try {
		await projectStore.setCurrentProject(projectId);
		const threads = await fetchThreadsForProject(projectId);
		threadsStore.update((state) => ({ ...state, threads }));
		projectVisibilityStore.set(false);
		isThreadListVisible.set(true);
	} catch (error) {
		console.error('Error handling project selection:', error);
	}
}

export async function handleDeleteProject(e: Event, projectId: string) {
	e.stopPropagation();
	// TODO: Add delete confirmation logic
	try {
		// Add your delete logic here
		console.log(`Deleting project ${projectId}`);
	} catch (error) {
		console.error(`Error deleting project ${projectId}:`, error);
	}
}

export function startEditingProjectName(projectId: string) {
	const storeValue = get(projectStore);
	const project = storeValue.threads.find((p) => p.id === projectId);
	if (project) {
		updateProjectState({
			editingProjectId: projectId,
			editedProjectName: project.name
		});
	}
}

// Subscribe to project visibility store
projectVisibilityStore.subscribe((value) => {
	// This creates a local reference that can be imported
	const isProjectListVisible = value;
	return isProjectListVisible;
});

import { writable, derived, get } from 'svelte/store';
import type { Projects, ProjectStoreState} from '$lib/types/types';
import { debounce } from 'lodash-es';
import { fetchProjects, createProject, updateProject, resetProject } from '$lib/clients/projectClient';

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
    collaborators: []
  });

  const { subscribe, update } = store;

  const debouncedUpdateProject = debounce(async (id: string, changes: Partial<Projects>) => {
    try {
      const updatedProject = await updateProject(id, changes);
      store.update(state => ({
        ...state,
        threads: state.threads.map(t => t.id === id ? { ...t, ...updatedProject } : t),
        updateStatus: 'Project updated successfully'
      }));
      setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
    } catch (error) {
      console.error('Failed to update project:', error);
      store.update(state => ({ ...state, updateStatus: 'Failed to update project' }));
      setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
    }
  }, 300);

  return {
    subscribe,
    update,
    loadProjects: async (): Promise<Projects[]> => {
      try {
        const projects = await fetchProjects();
        store.update(state => ({
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
        store.update(state => ({
          ...state,
          threads: updatedProjects,
          isProjectLoaded: true,
          updateStatus: 'Project added successfully'
        }));
        setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
        return newProject;
      } catch (error) {
        console.error('Error adding project:', error);
        store.update(state => ({ ...state, updateStatus: 'Failed to add project' }));
        setTimeout(() => store.update(state => ({ ...state, updateStatus: '' })), 3000);
        return null;
      }
    },

    updateProject: async (id: string, changes: Partial<Projects>) => {
      try {
        const updatedProject = await updateProject(id, changes);
        store.update(state => ({
          ...state,
          threads: state.threads.map(t => t.id === id ? { ...t, ...updatedProject } : t),
          updateStatus: 'Project updated successfully'
        }));
        return updatedProject;
      } catch (error) {
        console.error('Failed to update project:', error);
        store.update(state => ({ ...state, updateStatus: 'Failed to update project' }));
        throw error;
      }
    },

    setCurrentProject: (id: string | null) => {
      store.update(state => ({
        ...state,
        currentProjectId: id,
        currentProject: state.threads.find(p => p.id === id) || null
      }));
    },

    setSearchQuery: (query: string) => {
      store.update(state => ({
        ...state,
        searchQuery: query
      }));
    },

    reset: () => {
      store.update(state => ({
        ...state,
        currentProjectId: null,
        currentProject: null,
        messages: [],
        updateStatus: '',
        isProjectLoaded: false
      }));
    },

    // Derived stores
    getCurrentProject: derived(store, $store => 
      $store.threads.find(p => p.id === $store.currentProjectId) || null
    ),

    getSearchedProjects: derived(store, $store => {
      const query = $store.searchQuery.toLowerCase().trim();
      if (!query) return $store.threads;
      
      return $store.threads.filter(project => 
        project.name?.toLowerCase().includes(query) || 
        project.description?.toLowerCase().includes(query)
      );
    }),

    isSearchActive: derived(store, $store => 
      $store.searchQuery.trim().length > 0
    ),

    isProjectLoaded: derived(store, $store => $store.isProjectLoaded)
  };
}

export const projectStore = createProjectStore();

export function getProjectStore() {
  return get(projectStore);
}
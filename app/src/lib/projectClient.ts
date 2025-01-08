import type { Messages, Projects, Threads} from '$lib/types';
import { pb } from '$lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { marked } from 'marked';

marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false
});


function ensureAuthenticated(): void {
    if (!pb.authStore.isValid) {
        throw new Error('User is not authenticated');
    }
}

export async function fetchProjects(): Promise<Projects[]> {
    try {
        ensureAuthenticated();
        const projects = await pb.collection('projects').getFullList<Projects>({
            expand: 'last_message',
        });
        return projects;
    } catch (error) {
        console.error('Error fetching projects:', error);
        throw error;
    }
}

export async function fetchThreadsForProject(projectId: string): Promise<Threads[]> {
    try {
        ensureAuthenticated();
        const threads = await pb.collection('threads').getFullList<Threads>({
            filter: `project = "${projectId}"`,
            expand: 'last_message',
            sort: '-created'
        });
        return threads;
    } catch (error) {
        console.error('Error fetching threads for project:', error);
        throw error;
    }
}

export async function createProject(projectData: Partial<Projects>): Promise<Projects> {
    try {
        ensureAuthenticated();
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User ID not found');
        }

        const newProject: Partial<Projects> = {
            name: projectData.name || 'New Project',
            description: projectData.description || '',
            op: userId,
            threads: [],
            current_project: '',
            collaborators: [userId],
        };

        return await pb.collection('projects').create<Projects>(newProject);
    } catch (error) {
        console.error('Error creating project:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response details:', error.data);
        }
        throw error;
    }
}

export async function updateProject(id: string, changes: Partial<Projects>): Promise<Projects> {
    try {
        ensureAuthenticated();
        return await pb.collection('projects').update<Projects>(id, changes);
    } catch (error) {
        console.error('Error updating project:', error);
        throw error;
    }
}

export async function resetProject(projectId: string): Promise<void> {
    try {
        ensureAuthenticated();
        if (!projectId) {
            throw new Error('Project ID is required');
        }
        await pb.collection('projects').update(projectId, {
            selected: false
        });
    } catch (error) {
        console.error('Error resetting project:', error);
        throw error;
    }
}
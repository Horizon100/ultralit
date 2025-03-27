import type { Projects, Threads, User } from '$lib/types/types';
import { pb, ensureAuthenticated } from '$lib/pocketbase';
import { marked } from 'marked';


marked.setOptions({
	gfm: true,
	breaks: true,
	// headerIds: false,
	// mangle: false
});



export async function fetchProjects(): Promise<Projects[]> {
	try {
		ensureAuthenticated();
		const projects = await pb.collection('projects').getFullList<Projects>({
			expand: 'last_message'
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
		if (!projectId) {
			console.error('projectId is not defined.');
			return []; 
		}
		const resultList = await pb.collection('threads').getList<Threads>(1, 50, {
			filter: `project_id = "${projectId}"`,
			expand: 'last_message,tags,project_id',
			sort: '-created',
			$cancelKey: `project-threads-${projectId}`
		});

		if (!resultList?.items) {
			console.warn(`No threads found for project ${projectId}`);
			return [];
		}

		return resultList.items;
	} catch (error) {
		console.error('Error fetching project threads:', error);
		return [];
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
			created: new Date().toISOString(),
			updated: new Date().toISOString()
		};

		return await pb.collection('projects').create<Projects>(newProject);
	} catch (error) {
		console.error('Error creating project:', error);
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

export async function removeThreadFromProject(threadId: string, projectId: string): Promise<void> {
	try {
		ensureAuthenticated();
		await pb.collection('threads').update(threadId, {
			project_id: null
		});
		const project = await pb.collection('projects').getOne<Projects>(projectId);
		const updatedThreads = project.threads?.filter((id) => id !== threadId) || [];
		await pb.collection('projects').update(projectId, {
			threads: updatedThreads
		});
	} catch (error) {
		console.error('Error removing thread from project:', error);
		throw error;
	}
}

export async function addThreadToProject(threadId: string, projectId: string): Promise<void> {
	try {
		ensureAuthenticated();
		await pb.collection('threads').update(threadId, {
			project_id: projectId
		});
		const project = await pb.collection('projects').getOne<Projects>(projectId);
		const updatedThreads = [...(project.threads || []), threadId];
		await pb.collection('projects').update(projectId, {
			threads: updatedThreads
		});
	} catch (error) {
		console.error('Error adding thread to project:', error);
		throw error;
	}
}
export async function addCollaboratorToProject(projectId: string, userId: string): Promise<Projects> {
	try {
		ensureAuthenticated();
		const project = await pb.collection('projects').getOne<Projects>(projectId);
		const collaborators = project.collaborators || [];
		if (collaborators.includes(userId)) {
		console.log('User is already a collaborator on this project');
		return project;
		}
		const updatedCollaborators = [...collaborators, userId];
		return await pb.collection('projects').update<Projects>(projectId, {
		collaborators: updatedCollaborators
		});
	} catch (error) {
		console.error('Error adding collaborator to project:', error);
		throw error;
	}
}
export async function removeCollaboratorFromProject(projectId: string, userId: string): Promise<Projects> {
	try {
	  ensureAuthenticated();
	const project = await pb.collection('projects').getOne<Projects>(projectId);
	  if (project.op === userId) {
		throw new Error('Cannot remove the project owner from collaborators');
	  }
		const collaborators = project.collaborators || [];
	  const updatedCollaborators = collaborators.filter(id => id !== userId);
	  return await pb.collection('projects').update<Projects>(projectId, {
		collaborators: updatedCollaborators
	  });
	} catch (error) {
	  console.error('Error removing collaborator from project:', error);
	  throw error;
	}
  }
  export async function fetchProjectCollaborators(projectId: string): Promise<User[]> {
	try {
	  ensureAuthenticated();
  
	  console.log('Fetching project:', projectId);
	  const project = await pb.collection('projects').getOne<Projects>(projectId);
	  console.log('Project data:', project);
  
	  const collaboratorIds = project.collaborators || [];
	  console.log('Collaborator IDs:', collaboratorIds);
  
	  if (collaboratorIds.length === 0) {
		console.log('No collaborators found for this project.');
		return [];
	  }
  
	  const filter = collaboratorIds.map(id => `id="${id}"`).join(' || ');
	  console.log('Filter for users:', filter);
  
	  const userRecords = await pb.collection('users').getFullList<User>({
		filter: filter,
	  });
	  console.log('Users found:', userRecords);
  
	  return userRecords;
	} catch (error) {
	  console.error('Error fetching project collaborators:', error);
	  throw error;
	}
  }
  export async function isUserCollaborator(projectId: string, userId: string): Promise<boolean> {
	try {
	  ensureAuthenticated();
	  const project = await pb.collection('projects').getOne<Projects>(projectId);
	  const collaborators = project.collaborators || [];
	  return collaborators.includes(userId);
	} catch (error) {
	  console.error('Error checking if user is a collaborator:', error);
	  return false;
	}
  }
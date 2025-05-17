// src/routes/api/tasks/search/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    // Check if the user is authenticated
    const user = locals.user;
    if (!user) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const projectId = url.searchParams.get('project') || '';
    
    if (!query) {
      return json({ tasks: [], total: 0 });
    }
    
    // Build filter conditions for tasks
    let filter = `(title ~ "${query}" || taskDescription ~ "${query}") && (assignedTo = "${user.id}" || createdBy = "${user.id}")`;
    
    // Add project filter if provided
    if (projectId) {
      filter += ` && project_id = "${projectId}"`;
    }
    
    // Fetch tasks with the search filter
    const tasksData = await pb.collection('tasks').getList(1, limit, {
      filter,
      sort: '-updated',
      expand: 'createdBy', // Expand the user reference to get creator details
      skip: offset,
    });
    
    // Process tasks to include additional information
    const tasks = tasksData.items.map(task => {
      // Convert PocketBase record to a plain object
      const plainTask = { ...task };
      
      // Add creator information
      if (task.expand?.createdBy) {
        plainTask.creatorName = task.expand.createdBy.name || task.expand.createdBy.username;
        plainTask.creatorAvatar = task.expand.createdBy.avatar;
      }
      
      return plainTask;
    });
    
    return json({
      tasks,
      total: tasksData.totalItems,
      totalPages: tasksData.totalPages,
      page: tasksData.page
    });
  } catch (error) {
    console.error('Error searching tasks:', error);
    return json({ error: 'Failed to search tasks' }, { status: 500 });
  }
};
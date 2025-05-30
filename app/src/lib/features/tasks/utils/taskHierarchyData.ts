import type { KanbanTask } from '$lib/types/types';
import type { HierarchyData } from '$lib/types/types';

// Remove the references to static data that don't exist
export async function fetchTaskHierarchyData(
    type: 'status' | 'priority' | 'project' = 'status', 
    projectId?: string | null  
): Promise<HierarchyData> {
    try {
        const params = new URLSearchParams({ type });
        if (projectId) {
            params.append('project_id', projectId);
        }
        
        const response = await fetch(`/api/tasks/hierarchy?${params}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch hierarchy data: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching task hierarchy data:', error);
        // Return empty structure instead of referencing non-existent static data
        return {
            name: `No ${type} data available`,
            children: []
        };
    }
}
export function createTaskHierarchyFromData(
	tasks: KanbanTask[], 
	type: 'status' | 'priority' | 'project' = 'status'
): HierarchyData {
	switch (type) {
		case 'priority':
			return convertTasksToPriorityHierarchy(tasks);
		case 'project':
			return convertTasksToProjectHierarchy(tasks);
		default:
			return convertTasksToStatusHierarchy(tasks);
	}
}


// Task Priority Hierarchy Data


// Function to convert KanbanTask array to hierarchy data based on status
export function convertTasksToStatusHierarchy(tasks: KanbanTask[]): HierarchyData {
	const statusGroups: { [key: string]: KanbanTask[] } = {};
	
	// Group tasks by status
	tasks.forEach(task => {
		if (!statusGroups[task.status]) {
			statusGroups[task.status] = [];
		}
		statusGroups[task.status].push(task);
	});

	const children: HierarchyData[] = [];
	
	Object.entries(statusGroups).forEach(([status, statusTasks]) => {
		const priorityGroups: { [key: string]: KanbanTask[] } = {};
		
		// Group by priority within each status
		statusTasks.forEach(task => {
			if (!priorityGroups[task.priority]) {
				priorityGroups[task.priority] = [];
			}
			priorityGroups[task.priority].push(task);
		});

		const priorityChildren: HierarchyData[] = [];
		Object.entries(priorityGroups).forEach(([priority, priorityTasks]) => {
			priorityChildren.push({
				name: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`,
				value: priorityTasks.length
			});
		});

		children.push({
			name: status.charAt(0).toUpperCase() + status.slice(1),
			value: statusTasks.length,
			children: priorityChildren
		});
	});

	return {
		name: "Task Status Distribution",
		children
	};
}

// Function to convert KanbanTask array to hierarchy data based on priority
export function convertTasksToPriorityHierarchy(tasks: KanbanTask[]): HierarchyData {
	const priorityGroups: { [key: string]: KanbanTask[] } = {};
	
	// Group tasks by priority
	tasks.forEach(task => {
		if (!priorityGroups[task.priority]) {
			priorityGroups[task.priority] = [];
		}
		priorityGroups[task.priority].push(task);
	});

	const children: HierarchyData[] = [];
	
	Object.entries(priorityGroups).forEach(([priority, priorityTasks]) => {
		const statusGroups: { [key: string]: KanbanTask[] } = {};
		
		// Group by status within each priority
		priorityTasks.forEach(task => {
			if (!statusGroups[task.status]) {
				statusGroups[task.status] = [];
			}
			statusGroups[task.status].push(task);
		});

		const statusChildren: HierarchyData[] = [];
		Object.entries(statusGroups).forEach(([status, statusTasks]) => {
			statusChildren.push({
				name: status.charAt(0).toUpperCase() + status.slice(1),
				value: statusTasks.length
			});
		});

		children.push({
			name: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`,
			value: priorityTasks.length,
			children: statusChildren
		});
	});

	return {
		name: "Task Priority Distribution",
		children
	};
}

// Function to convert tasks to project hierarchy (if project_id is available)
export function convertTasksToProjectHierarchy(tasks: KanbanTask[]): HierarchyData {
	const projectGroups: { [key: string]: KanbanTask[] } = {};
	
	// Group tasks by project
	tasks.forEach(task => {
		const projectId = task.project_id || 'unassigned';
		if (!projectGroups[projectId]) {
			projectGroups[projectId] = [];
		}
		projectGroups[projectId].push(task);
	});

	const children: HierarchyData[] = [];
	
	Object.entries(projectGroups).forEach(([projectId, projectTasks]) => {
		const statusGroups: { [key: string]: KanbanTask[] } = {};
		
		// Group by status within each project
		projectTasks.forEach(task => {
			if (!statusGroups[task.status]) {
				statusGroups[task.status] = [];
			}
			statusGroups[task.status].push(task);
		});

		const statusChildren: HierarchyData[] = [];
		Object.entries(statusGroups).forEach(([status, statusTasks]) => {
			statusChildren.push({
				name: status.charAt(0).toUpperCase() + status.slice(1),
				value: statusTasks.length
			});
		});

		children.push({
			name: projectId === 'unassigned' ? 'Unassigned Tasks' : `Project ${projectId}`,
			value: projectTasks.length,
			children: statusChildren
		});
	});

	return {
		name: "Project Task Distribution",
		children
	};
}
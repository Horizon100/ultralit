// src/lib/clients/taskClient.ts
import { get } from 'svelte/store';
import { currentUser } from '$lib/pocketbase';
import type { KanbanTask, KanbanAttachment, Task, InternalChatMessage } from '$lib/types/types';

/**
 * Saves a task to the database
 * @param task Task object to save
 * @returns Promise with the saved task data
 */
export async function saveTask(task: KanbanTask): Promise<Task> {
    try {
        // Handle file attachments first if the task has any
        const attachmentPromises = task.attachments
            .filter(att => att.file)
            .map(async (att) => {
                const formData = new FormData();
                formData.append('file', att.file);
                formData.append('fileName', att.fileName);
                if (att.note) formData.append('note', att.note);
                formData.append('createdBy', get(currentUser)?.id);
                
                if (task.id && !task.id.startsWith('local_')) {
                    formData.append('attachedTasks', task.id);
                }
                
                if (task.project_id) {
                    formData.append('attachedProjects', task.project_id);
                }
                
                const response = await fetch('/api/attachments', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) throw new Error('Failed to upload attachment');
                
                const savedAttachment = await response.json();
                return {
                    id: savedAttachment.id,
                    fileName: att.fileName,
                    url: savedAttachment.url || '',
                    note: att.note
                };
            });
            
        const savedAttachments = await Promise.all(attachmentPromises);
        
        // Replace file attachments with saved ones
        const updatedAttachments = task.attachments.map(att => {
            if (att.file) {
                const savedAtt = savedAttachments.find(sa => sa.fileName === att.fileName);
                return savedAtt || att;
            }
            return att;
        });
        
        // Prepare attachment IDs as a comma-separated string
        const attachmentIds = updatedAttachments.map(att => att.id).join(',');
        
        const taskData = {
            title: task.title,
            taskDescription: task.taskDescription,
            project_id: task.project_id || '',
            createdBy: get(currentUser)?.id,
            status: task.status,
            priority: task.priority || 'medium',
            due_date: task.due_date ? task.due_date.toISOString() : null,
            taggedTasks: task.tags.join(','),
            taskTags: task.tags,
            allocatedAgents: task.allocatedAgents || [],
            attachments: attachmentIds,
            prompt: task.prompt || '',
            context: task.context || '',
            task_outcome: task.task_outcome || '',
            dependencies: task.dependencies || [],
            agentMessages: task.agentMessages || []
        };
        
        let url = '/api/tasks';
        let method = 'POST';
        
        // If task has an ID that's not auto-generated locally, it's an update
        if (task.id && !task.id.startsWith('local_')) {
            url = `/api/tasks/${task.id}`;
            method = 'PATCH';
        }
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        
        if (!response.ok) throw new Error('Failed to save task');
        
        const savedTask = await response.json();
        
        return {
            ...savedTask,
            id: savedTask.id,
            attachments: updatedAttachments,
            creationDate: new Date(savedTask.created),
            due_date: savedTask.due_date ? new Date(savedTask.due_date) : null,
            tags: savedTask.taggedTasks ? savedTask.taggedTasks.split(',') : []
        };
    } catch (err) {
        console.error('Error saving task:', err);
        throw err;
    }
}

/**
 * Creates a task from an AI message
 * @param message The message object to create a task from
 * @param promptMessage Optional original prompt message
 * @param projectId Optional project ID to associate the task with
 * @returns Promise with the created task
 */
export async function createTaskFromMessage(
    message: InternalChatMessage,
    promptMessage?: InternalChatMessage | null,
    projectId?: string
): Promise<Task> {
    try {
        // Extract title from first sentence, limiting to 50 characters
        let title = message.content.split('.')[0].trim();
        if (title.length > 50) {
            title = title.substring(0, 47) + '...';
        }
        
        // Create a task object
        const newTask: KanbanTask = {
            id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            title,
            taskDescription: message.content,
            creationDate: new Date(),
            due_date: null,
            tags: [],
            attachments: [],
            project_id: projectId || '',
            createdBy: get(currentUser)?.id,
            allocatedAgents: [],
            status: 'todo',
            priority: 'medium',
            prompt: promptMessage?.content || '',
            context: '',
            task_outcome: '',
            dependencies: [],
            agentMessages: [message.id]
        };
        
        return await saveTask(newTask);
    } catch (error) {
        console.error('Error creating task from message:', error);
        throw error;
    }
}

/**
 * Updates an existing task
 * @param taskId ID of the task to update
 * @param updateData Data to update on the task
 * @returns Promise with the updated task
 */
export async function updateTask(taskId: string, updateData: Partial<Task>): Promise<Task> {
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) throw new Error('Failed to update task');
        
        return await response.json();
    } catch (err) {
        console.error('Error updating task:', err);
        throw err;
    }
}

/**
 * Updates the tags associated with a task
 * @param taskId ID of the task to update
 * @param tagIds Array of tag IDs to associate with the task
 * @param taskDescription Optional updated task description
 * @returns Promise with the updated task
 */
export async function updateTaskTags(
    taskId: string, 
    tagIds: string[], 
    taskDescription?: string
): Promise<Task> {
    try {
        // Prepare the update data
        const updateData: any = {
            taggedTasks: tagIds.join(','),
            taskTags: tagIds
        };
        
        // If taskDescription is provided, update it as well
        if (taskDescription !== undefined) {
            updateData.taskDescription = taskDescription;
        }
        
        // Update the task
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Server error (${response.status}):`, errorText);
            throw new Error(`Failed to update task tags: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
    } catch (err) {
        console.error('Error updating task tags:', err);
        throw err;
    }
}

/**
 * Deletes a task
 * @param taskId ID of the task to delete
 * @returns Promise that resolves when the task is deleted
 */
export async function deleteTask(taskId: string): Promise<void> {
    try {
        // Check if task is local only
        if (taskId.startsWith('local_')) {
            return;
        }
        
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete task');
        
    } catch (err) {
        console.error('Error deleting task:', err);
        throw err;
    }
}

/**
 * Loads tasks for the current user or project
 * @param projectId Optional project ID to filter tasks
 * @returns Promise with the loaded tasks
 */
export async function loadTasks(projectId?: string): Promise<Task[]> {
    try {
        let url = '/api/tasks';
        if (projectId) {
            url = `/api/projects/${projectId}/tasks`;
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch tasks');
        
        const data = await response.json();
        return data.items;
    } catch (err) {
        console.error('Error loading tasks:', err);
        throw err;
    }
}

/**
 * Gets prompt content from a message thread
 * @param threadId ID of the thread
 * @param allMessages Array of all messages to search
 * @returns The content of the first user message in the thread or empty string
 */
export function getPromptFromThread(
    threadId: string,
    allMessages: InternalChatMessage[]
): string {
    if (!threadId) return '';
    
    // Find the first user message in the thread
    const firstUserMessage = allMessages.find(msg => 
        msg.thread === threadId && 
        msg.role === 'user'
    );
    
    return firstUserMessage ? firstUserMessage.content : '';
}
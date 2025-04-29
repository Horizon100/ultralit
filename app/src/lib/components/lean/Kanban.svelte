<script lang="ts">
    import { writable, get } from 'svelte/store';
    import { currentUser } from '$lib/pocketbase';
    import { projectStore } from '$lib/stores/projectStore';
    import type { KanbanTask, KanbanAttachment, Tag, User} from '$lib/types/types';
    import UserDisplay from '$lib/components/containers/UserDisplay.svelte';
	import { CalendarClock, Trash2 } from 'lucide-svelte';
    import { fade } from 'svelte/transition';
    // Get current project ID from project store if available
    let currentProjectId = null;
    projectStore.subscribe(state => {
        currentProjectId = state.currentProjectId;
    });
    let isDeleteConfirmOpen = false;
    let taskToDelete: string | null = null;
    function getRandomBrightColor(tagName: string): string {
        const hash = tagName.split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);
        const h = hash % 360;
        return `hsl(${h}, 70%, 60%)`;
    }

    interface Column {
        id: number;
        title: string;
        status: KanbanTask['status'] | 'backlog' | 'inprogress';
        tasks: KanbanTask[];
        isOpen: boolean;
    }

    // Map column status to PocketBase status
    const statusMapping = {
        'Backlog': 'backlog',
        'To Do': 'todo',
        'In Progress': 'inprogress',
        'Done': 'done'
    };

    // Reverse mapping for loading tasks from PocketBase
    const reverseStatusMapping = {
        'backlog': ['Backlog'],
        'todo': ['To Do'],
        'inprogress': ['In Progress'],
        'done': ['Done'],
        'hold': ['Backlog'],
        'postpone': ['Backlog'],
        'cancel': ['Done'],
        'review': ['In Progress'],
        'delegate': ['In Progress'],
        'archive': ['Done']
    };

    let columns = writable<Column[]>([
        { id: 1, title: 'Backlog', status: 'backlog', tasks: [], isOpen: true },
        { id: 2, title: 'To Do', status: 'todo', tasks: [], isOpen: true },
        { id: 3, title: 'In Progress', status: 'inprogress', tasks: [], isOpen: true },
        { id: 4, title: 'Done', status: 'done', tasks: [], isOpen: true }
    ]);

    let tags = writable<Tag[]>([]);
    let selectedTask: KanbanTask | null = null;
    let isModalOpen = false;
    let newTagName = '';
    let isEditingDescription = false;
    let isEditingTitle = false;
    let selectedDeadline: number | string | null = null;
    let isLoading = writable(true);
    let error = writable<string | null>(null);

    // Load data from PocketBase
    async function loadData() {
        isLoading.set(true);
        error.set(null);
        
        try {
            // Load tasks
            await loadTasks();
            
            // Load tags
            await loadTags();
            
            isLoading.set(false);
        } catch (err) {
            console.error('Error loading data:', err);
            error.set(err.message || 'Failed to load data');
            isLoading.set(false);
        }
    }

    async function loadTasks() {
    try {
        let url = '/api/tasks';
        if (currentProjectId) {
            url = `/api/projects/${currentProjectId}/tasks`;
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch tasks');
        
        const data = await response.json();
        
        // Reset all columns tasks
        columns.update(cols => {
            return cols.map(col => ({...col, tasks: []}));
        });
        
        // Distribute tasks to appropriate columns
        columns.update(cols => {
            data.items.forEach(task => {
                const taskObj: KanbanTask = {
                    id: task.id,
                    title: task.title,
                    taskDescription: task.taskDescription || '',
                    creationDate: new Date(task.created),
                    due_date: task.due_date ? new Date(task.due_date) : null,
                    tags: task.taskTags || (task.taggedTasks ? task.taggedTasks.split(',') : []),
                    attachments: [],
                    project_id: task.project_id,
                    createdBy: task.createdBy,
                    allocatedAgents: task.allocatedAgents || [],
                    status: task.status,
                    priority: task.priority || 'medium',
                    prompt: task.prompt || '',
                    context: task.context || '',
                    task_outcome: task.task_outcome || '',
                    dependencies: task.dependencies || [],
                    agentMessages: task.agentMessages || []
                };
                
                // Find the appropriate column based on status
                const targetColumns = reverseStatusMapping[task.status] || ['Backlog'];
                const targetColumn = cols.find(col => targetColumns.includes(col.title));
                
                if (targetColumn) {
                    targetColumn.tasks.push(taskObj);
                } else {
                    // If we can't find a matching column, default to Backlog
                    const backlog = cols.find(col => col.title === 'Backlog');
                    if (backlog) backlog.tasks.push(taskObj);
                }
            });
            return cols;
        });
            
            // Load attachments for each task
            data.items.forEach(async task => {
                if (task.attachments) {
                    try {
                        // Fetch attachments for this task
                        const response = await fetch(`/api/tasks/${task.id}/attachments`);
                        if (!response.ok) throw new Error('Failed to fetch attachments');
                        
                        const attachments = await response.json();
                        
                        if (attachments.items && attachments.items.length > 0) {
                            const mappedAttachments: KanbanAttachment[] = attachments.items.map(att => ({
                                id: att.id,
                                fileName: att.fileName,
                                url: att.url || '',
                                note: att.note
                            }));
                            
                            columns.update(cols => {
                                // Find and update the task with attachments
                                cols.forEach(col => {
                                    col.tasks.forEach(t => {
                                        if (t.id === task.id) {
                                            t.attachments = mappedAttachments;
                                        }
                                    });
                                });
                                return cols;
                            });
                        }
                    } catch (err) {
                        console.error(`Error loading attachments for task ${task.id}:`, err);
                    }
                }
            });
            
        } catch (err) {
            console.error('Error loading tasks:', err);
            throw err;
        }
    }

    async function loadTags() {
        try {
            let url = '/api/tags';
            if (currentProjectId) {
                url = `/api/projects/${currentProjectId}/tags`;
            }
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch tags');
            
            const data = await response.json();
            tags.set(data.items);
        } catch (err) {
            console.error('Error loading tags:', err);
            throw err;
        }
    }

    // Save a tag to PocketBase
    async function saveTag(tag: Tag) {
    try {
        const tagData = {
            name: tag.name,
            tagDescription: tag.tagDescription || '',
            color: tag.color,
            createdBy: get(currentUser)?.id,
            selected: tag.selected || false
        };
        
        // Update taggedProjects field if we have a current project
        if (currentProjectId) {
            tagData['taggedProjects'] = currentProjectId;
        }
        
        const response = await fetch('/api/tags', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tagData)
        });
        
        if (!response.ok) throw new Error('Failed to save tag');
        
        const savedTag = await response.json();
        tags.update(t => {
            // Remove the local version and add the saved version
            const filtered = t.filter(existingTag => existingTag.id !== tag.id);
            return [...filtered, savedTag];
        });
        
        return savedTag;
    } catch (err) {
        console.error('Error saving tag:', err);
        throw err;
    }
}
async function updateTaskTags(taskId: string, tagIds: string[], taskDescription?: string) {
    try {
        console.log(`Updating tags for task ${taskId} with:`, tagIds);
        
        // Prepare the update data
        const updateData: any = {
            taggedTasks: tagIds.join(','),
            taskTags: tagIds
        };
        
        // If taskDescription is provided, update it as well
        if (taskDescription !== undefined) {
            updateData.taskDescription = taskDescription;
        }
        
        console.log('Update data:', updateData);
        
        // Update the task directly
        const updateResponse = await fetch(`/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.error(`Server error (${updateResponse.status}):`, errorText);
            throw new Error(`Failed to update task tags: ${updateResponse.status} ${updateResponse.statusText}`);
        }
        
        return await updateResponse.json();
    } catch (err) {
        console.error('Error updating task tags:', err);
        throw err;
    }
}

    // Save a task to PocketBase
    async function saveTask(task: KanbanTask) {
    try {
        // First, handle file uploads for any new attachments
        const attachmentPromises = task.attachments
            .filter(att => att.file)
            .map(async (att) => {
                const formData = new FormData();
                formData.append('file', att.file);
                formData.append('fileName', att.fileName);
                if (att.note) formData.append('note', att.note);
                formData.append('createdBy', get(currentUser)?.id);
                
                // If we have a task ID (for updates), link the attachment to the task
                if (task.id && !task.id.startsWith('local_')) {
                    formData.append('attachedTasks', task.id);
                }
                
                // If we have a project ID, link the attachment to the project
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
        
        // Use the task's current status directly instead of trying to determine it from columns
        // This fixes the issue where status gets overridden during drag operations
        const taskStatus = task.status;
        
        // Prepare attachment IDs as a comma-separated string
        const attachmentIds = updatedAttachments.map(att => att.id).join(',');
        
        const taskData = {
            title: task.title,
            taskDescription: task.taskDescription,
            project_id: currentProjectId || '',
            createdBy: get(currentUser)?.id,
            status: taskStatus,
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
        
        // Update the task in the columns
        columns.update(cols => {
            return cols.map(col => ({
                ...col,
                tasks: col.tasks.map(t => 
                    t.id === task.id ? {
                        ...savedTask,
                        id: savedTask.id,
                        attachments: updatedAttachments,
                        creationDate: new Date(savedTask.created),
                        due_date: savedTask.due_date ? new Date(savedTask.due_date) : null,
                        tags: savedTask.taggedTasks ? savedTask.taggedTasks.split(',') : [],
                        status: savedTask.status // Make sure status is updated from the server response
                    } : t
                )
            }));
        });
        
        return savedTask;
    } catch (err) {
        console.error('Error saving task:', err);
        throw err;
    }
}

function openDeleteConfirm(taskId: string, event: MouseEvent) {
    event.stopPropagation(); 
    taskToDelete = taskId;
    isDeleteConfirmOpen = true;
}

function confirmDelete() {
    if (taskToDelete) {
        // If the task to delete is currently open in the modal, close it first
        if (selectedTask && selectedTask.id === taskToDelete) {
            isModalOpen = false;
            selectedTask = null;
        }
        
        // Then delete the task
        deleteTask(taskToDelete).then(() => {
            isDeleteConfirmOpen = false;
            taskToDelete = null;
        }).catch(err => {
            error.set(`Failed to delete task: ${err.message}`);
            isDeleteConfirmOpen = false;
            taskToDelete = null;
        });
    }
}

function cancelDelete() {
    isDeleteConfirmOpen = false;
    taskToDelete = null;
}

async function deleteTask(taskId: string) {
    try {
        // Check if task is local only
        if (taskId.startsWith('local_')) {
            columns.update(cols => {
                return cols.map(col => ({
                    ...col,
                    tasks: col.tasks.filter(t => t.id !== taskId)
                }));
            });
            return;
        }
        
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete task');
        
        columns.update(cols => {
            return cols.map(col => ({
                ...col,
                tasks: col.tasks.filter(t => t.id !== taskId)
            }));
        });
    } catch (err) {
        console.error('Error deleting task:', err);
        throw err;  
    }
}

    function deepCopy<T>(obj: T): T {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (obj instanceof Date) {
            return new Date(obj.getTime()) as any;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => deepCopy(item)) as any;
        }

        if (obj instanceof Object) {
            const copy = {} as T;
            Object.keys(obj).forEach(key => {
                copy[key as keyof T] = deepCopy(obj[key as keyof T]);
            });
            return copy;
        }

        throw new Error(`Unable to copy obj! Its type isn't supported.`);
    }

    function addTask(columnId: number, event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const input = event.target as HTMLTextAreaElement;
            const title = input.value.trim();
            if (title) {
                columns.update(cols => {
                    const column = cols.find(col => col.id === columnId);
                    if (column) {
                        const localId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                        const newTask: KanbanTask = {
                            id: localId,
                            title,
                            taskDescription: '',
                            creationDate: new Date(),
                            due_date: null,
                            tags: [],
                            attachments: [],
                            project_id: currentProjectId || undefined,
                            createdBy: get(currentUser)?.id,
                            allocatedAgents: [],
                            status: statusMapping[column.title] as KanbanTask['status'] || 'todo',
                            priority: 'medium'
                        };
                        column.tasks.push(newTask);
                        
                        // Save to PocketBase
                        saveTask(newTask).then(savedTask => {
                            columns.update(cols => {
                                return cols.map(col => ({
                                    ...col,
                                    tasks: col.tasks.map(t => 
                                        t.id === localId ? {
                                            ...savedTask,
                                            id: savedTask.id,
                                            creationDate: new Date(savedTask.created),
                                            due_date: savedTask.due_date ? new Date(savedTask.due_date) : null,
                                            tags: savedTask.taggedTasks ? savedTask.taggedTasks.split(',') : []
                                        } : t
                                    )
                                }));
                            });
                        }).catch(err => {
                            error.set(`Failed to save task: ${err.message}`);
                        });
                    }
                    return cols;
                });
                input.value = '';
            }
        }
    }

function moveTask(taskId: string, fromColumnId: number, toColumnId: number) {
    columns.update(cols => {
        const fromColumn = cols.find(col => col.id === fromColumnId);
        const toColumn = cols.find(col => col.id === toColumnId);
        
        if (fromColumn && toColumn) {
            const taskIndex = fromColumn.tasks.findIndex(task => task.id === taskId);
            
            if (taskIndex !== -1) {
                const task = deepCopy(fromColumn.tasks[taskIndex]);
                
                fromColumn.tasks.splice(taskIndex, 1);
                
                const newStatus = statusMapping[toColumn.title] as KanbanTask['status'] || 'todo';
                task.status = newStatus;
                
                if (!task.tags) {
                    task.tags = [];
                }
                
                toColumn.tasks.push(task);
                
                (async () => {
                    try {
                        const response = await fetch(`/api/tasks/${taskId}`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ 
                                status: newStatus,
                                // Explicitly include tags to make sure they're preserved
                                taggedTasks: task.tags.join(','),
                                taskTags: task.tags
                            })
                        });
                        
                        if (!response.ok) {
                            throw new Error('Failed to update task status');
                        }
                        
                        // Optional: Full task save if needed
                        // await saveTask(task);
                    } catch (err) {
                        error.set(`Failed to move task: ${err.message}`);
                        // Revert the move if saving fails
                        fromColumn.tasks.splice(taskIndex, 0, task);
                        const revertIndex = toColumn.tasks.findIndex(t => t.id === taskId);
                        if (revertIndex !== -1) {
                            toColumn.tasks.splice(revertIndex, 1);
                        }
                    }
                })();
            }
        }
        return cols;
    });
}

    function toggleColumn(columnId: number) {
        columns.update(cols => {
            const column = cols.find(col => col.id === columnId);
            if (column) {
                column.isOpen = !column.isOpen;
            }
            return cols;
        });
    }

    function handleDragStart(event: DragEvent, taskId: string, fromColumnId: number) {
        if (event.dataTransfer) {
            event.dataTransfer.setData('text/plain', JSON.stringify({ taskId, fromColumnId }));
            event.dataTransfer.effectAllowed = 'move';
        }
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }

    function handleDrop(event: DragEvent, toColumnId: number) {
        event.preventDefault();
        if (event.dataTransfer) {
            const data = JSON.parse(event.dataTransfer.getData('text/plain'));
            moveTask(data.taskId, data.fromColumnId, toColumnId);
        }
    }

    function openModal(task: KanbanTask, event: MouseEvent) {
        event.stopPropagation();
        selectedTask = deepCopy(task);
        isModalOpen = true;
        isEditingTitle = false;
        isEditingDescription = false;
        selectedDeadline = null;
    }

    function saveAndCloseModal() {
    if (selectedTask) {
        // Check if the task still exists in any column
        let taskExists = false;
        columns.update(cols => {
            for (const col of cols) {
                if (col.tasks.some(t => t.id === selectedTask.id)) {
                    taskExists = true;
                    break;
                }
            }
            return cols;
        });
        
        if (!taskExists) {
            // Task doesn't exist anymore, just close the modal
            selectedTask = null;
            isModalOpen = false;
            return;
        }
        
        // Save to PocketBase
        saveTask(selectedTask).then(() => {
            columns.update(cols => {
                return cols.map(col => ({
                    ...col,
                    tasks: col.tasks.map(task => 
                        task.id === selectedTask!.id ? {...selectedTask!} : task
                    )
                }));
            });
            selectedTask = null;
            isModalOpen = false;
        }).catch(err => {
            error.set(`Failed to save task: ${err.message}`);
        });
    }
}

    async function addTag() {
        if (newTagName.trim()) {
            const tagColor = getRandomBrightColor(newTagName.trim());
            const newTag: Tag = {
                id: `local_tag_${Date.now()}`,
                name: newTagName.trim(),
                tagDescription: '',
                color: tagColor,
                createdBy: get(currentUser)?.id,
                selected: false
            };
            
            tags.update(t => [...t, newTag]);
            newTagName = '';
            
            // Save tag to PocketBase
            try {
                await saveTag(newTag);
            } catch (err) {
                error.set(`Failed to save tag: ${err.message}`);
            }
        }
    }
    function addGlobalTask(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const input = event.target as HTMLTextAreaElement;
        const title = input.value.trim();
        
        if (title) {
            // Find the Backlog column (should be the first one with id=1)
            columns.update(cols => {
                const backlogColumn = cols.find(col => col.title === 'Backlog');
                
                if (backlogColumn) {
                    const localId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                    const newTask: KanbanTask = {
                        id: localId,
                        title,
                        taskDescription: '',
                        creationDate: new Date(),
                        due_date: null,
                        tags: [],
                        attachments: [],
                        project_id: currentProjectId || undefined,
                        createdBy: get(currentUser)?.id,
                        allocatedAgents: [],
                        status: 'todo', // Use the appropriate status for Backlog
                        priority: 'medium'
                    };
                    
                    backlogColumn.tasks.push(newTask);
                    
                    // Save to PocketBase
                    saveTask(newTask).then(savedTask => {
                        columns.update(cols => {
                            return cols.map(col => ({
                                ...col,
                                tasks: col.tasks.map(t => 
                                    t.id === localId ? {
                                        ...savedTask,
                                        id: savedTask.id,
                                        creationDate: new Date(savedTask.created),
                                        due_date: savedTask.due_date ? new Date(savedTask.due_date) : null,
                                        tags: savedTask.taggedTasks ? savedTask.taggedTasks.split(',') : []
                                    } : t
                                )
                            }));
                        });
                    }).catch(err => {
                        error.set(`Failed to save task: ${err.message}`);
                    });
                }
                
                return cols;
            });
            
            // Clear the input field
            input.value = '';
        }
    }
}
    function handleFileUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && selectedTask) {
            for (let i = 0; i < input.files.length; i++) {
                const file = input.files[i];
                const attachment: KanbanAttachment = {
                    id: `local_attachment_${Date.now()}_${i}`,
                    fileName: file.name,
                    url: URL.createObjectURL(file),
                    file: file
                };
                selectedTask.attachments = [...selectedTask.attachments, attachment];
            }
            selectedTask = { ...selectedTask }; // Trigger reactivity
        }
    }

    function setQuickDeadline(days: number) {
        if (selectedTask) {
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + days);
            selectedTask.due_date = deadline;
            selectedTask = { ...selectedTask };
            selectedDeadline = days;
        }
    }

    function setEndOfWeekDeadline() {
        if (selectedTask) {
            const deadline = new Date();
            const daysUntilEndOfWeek = 7 - deadline.getDay();
            deadline.setDate(deadline.getDate() + daysUntilEndOfWeek);
            selectedTask.due_date = deadline;
            selectedTask = { ...selectedTask };
            selectedDeadline = 'endOfWeek';
        }
    }

    function toggleTag(tagId: string) {
    if (selectedTask) {
        const tagIndex = selectedTask.tags.indexOf(tagId);
        if (tagIndex === -1) {
            selectedTask.tags = [...selectedTask.tags, tagId];
        } else {
            selectedTask.tags = selectedTask.tags.filter(id => id !== tagId);
        }
        selectedTask = { ...selectedTask };  // Trigger reactivity
        
        // If task is already saved to PocketBase, update the tags relation
        if (selectedTask.id && !selectedTask.id.startsWith('local_')) {
            console.log(`Toggling tag ${tagId} on task ${selectedTask.id}`);
            updateTaskTags(selectedTask.id, selectedTask.tags, selectedTask.taskDescription)
                .then(updatedTask => {
                    console.log('Tags updated successfully:', updatedTask);
                })
                .catch(err => {
                    console.error('Failed to update tags:', err);
                    error.set(`Failed to update task tags: ${err.message}`);
                });
        }
    }
}

    function toggleAgent(agentId: string) {
        if (selectedTask) {
            const agentIndex = selectedTask.allocatedAgents.indexOf(agentId);
            if (agentIndex === -1) {
                selectedTask.allocatedAgents = [...selectedTask.allocatedAgents, agentId];
            } else {
                selectedTask.allocatedAgents = selectedTask.allocatedAgents.filter(id => id !== agentId);
            }
            selectedTask = { ...selectedTask };  // Trigger reactivity
        }
    }

    // Load initial data when component mounts
    $: {
        if (currentProjectId) {
            loadData();
        } else {
            // If no project is selected, still try to load personal tasks
            loadData();
        }
    }

    $: taskTags = selectedTask ? $tags.filter(tag => selectedTask.tags.includes(tag.id)) : [];
</script>

{#if $isLoading}
<div class="spinner-container">
    <div class="spinner"></div>
</div>
{:else if $error}
    <div class="error-message">
        <p>Error: {$error}</p>
        <button on:click={loadData}>Retry</button>
    </div>
{:else}
<div class="kanban-container" transition:fade={{ duration: 150 }}
>

    <div class="global-input-container">
        <textarea 
            placeholder="Add a task and press Enter (will be added to Backlog)"
            on:keydown={(e) => addGlobalTask(e)}
            class="global-task-input"
        ></textarea>
    </div>

    <div class="kanban-board">
        {#each $columns as column}
            <div class="kanban-column" on:dragover={handleDragOver} on:drop={(e) => handleDrop(e, column.id)}>
                <button type="button" class="column-header" on:click={() => toggleColumn(column.id)}>
                    {column.title}
                </button>
                
                {#if column.isOpen}
                    <div class="task-list">
                        {#each column.tasks as task}
                            <div 
                                class="task-card" 
                                draggable="true" 
                                on:dragstart={(e) => handleDragStart(e, task.id, column.id)}
                                on:click={(e) => openModal(task, e)}
                            >
                                <h4>{task.title}</h4>

                                <p class="description">{task.taskDescription}</p>


                                {#if task.tags && task.tags.length > 0}
                                <div class="tag-list">
                                    {#each $tags.filter(tag => task.tags.includes(tag.id)) as tag}
                                        <span class="tag" style="background-color: {tag.color}">{tag.name}</span>
                                    {/each}
                                </div>
                                {/if}
                                {#if task.createdBy}
                                <p class="task-creator">

                                    <img 
                                        src={`/api/users/${task.createdBy}/avatar`} 
                                        alt="Avatar" 
                                        class="user-avatar"
                                        onerror="this.style.display='none'"
                                    />
                                    {#if task.due_date}
                                    <p class="deadline"> by {task.due_date.toLocaleDateString()}</p>
                                    {/if}
                                </p>
                                {/if}
                                {#if task.attachments && task.attachments.length > 0}
                                    <div class="attachment-indicator">
                                        📎 {task.attachments.length}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    </div>
</div>
{/if} 
{#if isModalOpen && selectedTask}
    <div class="modal-overlay" on:click={saveAndCloseModal}>
        <div class="modal-content" on:click|stopPropagation transition:fade={{ duration: 150 }}
        >
            {#if isEditingTitle}
                <textarea
                    type="text"
                    bind:value={selectedTask.title}
                    on:blur={() => isEditingTitle = false}
                    on:keydown={(e) => e.key === 'Enter' && (isEditingTitle = false)}
                    autoFocus
                    class="title-input"
                />
            {:else}
                <h1 on:click={() => isEditingTitle = true}>
                    {selectedTask.title}
                </h1>
            {/if}
            <div class="description-section">
                <p>Description:</p>
                {#if isEditingDescription}
                <textarea
                    bind:value={selectedTask.taskDescription}
                    on:blur={() => isEditingDescription = false}
                    autoFocus
                ></textarea>
            {:else}
                <div 
                    class="description-display"
                    on:click={() => isEditingDescription = true}
                >
                    {selectedTask.taskDescription || 'Click to add a description'}
                </div>
            {/if}
            </div>
            <div class="deadline-section">
                <p>Deadline:</p>
                <div class="deadline-controls">
                    <button 
                        on:click={() => setQuickDeadline(1)}
                        class:selected={selectedDeadline === 1}
                    >Tomorrow</button>
                    <button 
                        on:click={setEndOfWeekDeadline}
                        class:selected={selectedDeadline === 'endOfWeek'}
                    >End of Week</button>
                    <button 
                        on:click={() => setQuickDeadline(7)}
                        class:selected={selectedDeadline === 7}
                    >1 Week</button>
                    <button 
                        on:click={() => setQuickDeadline(14)}
                        class:selected={selectedDeadline === 14}
                    >2 Weeks</button>
                    <button 
                        on:click={() => setQuickDeadline(30)}
                        class:selected={selectedDeadline === 30}
                    >1 Month</button>
                </div>
            </div>
            <div class="tag-section">
                <p>Tags</p>
                <div class="tag-list">
                    {#each $tags as tag}
                        <button 
                            class="tag" 
                            class:selected={selectedTask.tags.includes(tag.id)}
                            on:click={() => toggleTag(tag.id)}
                            style="background-color: {tag.color}"
                            data-color={tag.color}

                        >
                            {tag.name}
                        </button>
                    {/each}
                </div>
                <div class="add-tag">
                    <input type="text" bind:value={newTagName} placeholder="New tag name">
                    <button on:click={addTag}>Add Tag</button>
                </div>
            </div>
            <div class="attachment-section">
                <p>Attachments</p>
                <input type="file" on:change={handleFileUpload} multiple>
                <div class="attachment-list">
                    {#each selectedTask.attachments as attachment}
                        <a href={attachment.url} target="_blank" rel="noopener noreferrer">{attachment.name}</a>
                    {/each}
                </div>
            </div>
            <p>Created: {selectedTask.creationDate.toLocaleDateString()}</p>
            <div class="button-group">
                <button class="done-button" on:click={saveAndCloseModal}>Done</button>
                <button class="delete-task-btn" on:click={(e) => openDeleteConfirm(selectedTask.id, e)}>
                    <Trash2 /> 
                    <span>Delete</span>
                </button>
            </div>

        </div>
    </div>
{/if}
{#if isDeleteConfirmOpen}
    <div class="confirm-delete-overlay">
        <div class="confirm-delete-modal">
            <h3>Delete Task</h3>
            <p>Are you sure you want to delete this task? This action cannot be undone.</p>
            
            <div class="confirm-buttons">
                <button class="cancel-btn" on:click={cancelDelete}>Cancel</button>
                <button class="confirm-btn" on:click={confirmDelete}>Delete</button>
            </div>
        </div>
    </div>
{/if}
<style lang="scss">
    $breakpoint-sm: 576px;
    $breakpoint-md: 1000px;
    $breakpoint-lg: 992px;
    $breakpoint-xl: 1200px;
      @use "src/styles/themes.scss" as *;
    * {
      /* font-family: 'Merriweather', serif; */
      /* font-family: 'Roboto', sans-serif; */
      /* font-family: 'Montserrat'; */
      /* color: var(--text-color); */
      font-family: var(--font-family);
    }
    p {
        font-size: 1.4rem;
        padding: 1rem 0;
        margin: 0;
        line-height: 1.5;
        color: var(--text-color);
        opacity: 0.8;
        font-weight: 800;
        text-align: left;
        letter-spacing: 0.3rem;
        transition: all 0.3s ease;

        &.description {
            color: var(--placeholder-color);
            letter-spacing: 0;
            font-weight: 100;
            font-size:1rem;
            line-height: 1.5;
            max-height: 3rem;
            overflow: hidden;
            text-align: left;
        }
    }
    .button-group {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 1rem;
        gap: 1rem;
    }
 
    .global-input-container {
        width: 100%;
        padding: 0;
        margin-bottom: 10px;
        // box-shadow: 0 1px 3px rgba(0,0,0,0.1);

        & textarea {
            text-align: center;
            line-height: 2;
 
            overflow-y: hidden;
        }
    }
    
    .global-task-input {
        width: calc(100% - 2rem);
        height: 3rem;
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 2rem;
        padding: 10px;
        font-size: 1.4rem;
    }
    
    .global-task-input:focus {
        outline: none;
        border-color: var(--tertiary-color);
        box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.4);
    }
    .kanban-board {
        display: flex;
        flex-direction: row;
        gap: 1.5rem;
        overflow-x: auto; 
        scrollbar-width: thin;
        scroll-behavior: smooth;
        scrollbar-color: var(--secondary-color) transparent;
        align-items: flex-start;
        height: 100vh;
        width: 100%;
        padding: 1rem;
        transition: all 0.3s ease;

    }

    .kanban-column {
        border-radius: 5px;
        flex: 0 0 auto;
        display: flex;        
        flex-direction: column;
        justify-content: center;
        width: calc(25% - 2rem);
        transition: all 0.3s ease;
        // border: 1px solid var(--secondary-color);
        // background: var(--primary-color);
        border-radius: 1rem;
        transition: all 0.3s ease;

        &:hover {
            border: 1px solid var(--secondary-color);
            background: var(--primary-color);
        }

    }


    .kanban-column button {
        cursor: pointer;
        border-top-left-radius: 2rem;
        background: transparent;
        display: flex;
        width: auto;
        text-align: left;
        border: none;
        padding: 1rem;
        color: var(--text-color);
        font-size: 1.2em;
        font-weight: bold;
        transition: all 0.3s ease;

        &:hover {
            color: var(--tertiary-color);
            letter-spacing: 0.2rem;
        }
    }

    textarea {
        width: 100%;
        padding: 0.5rem;
        align-items: center;
        justify-content: center;
        margin-bottom: 0.5rem;
        border-radius: 10px;
        border: 1px solid var(--line-color);
        background-color: var(--secondary-color);
        resize:none;
        color: var(--text-color);
        transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
        height: auto;
        font-size: 1.1em;

        &.selected {
            background-color: red;
        }
    }

    textarea:hover {
        /* border: 1px solid #7cb87e; */
        transform: scale(0.99);
    }

    .task-list {
        min-height: 100px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }
    .description-display {
        font-size: 1.5rem;
        padding: 1rem;
    }
    .task-card {
        background: var(--secondary-color);
        border-radius: 10px;
        padding: 0.5rem 1rem;
        margin-bottom: 0.5rem;
        cursor: move;
        transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
        position: relative;
        width: calc(100% - 4rem);
        word-break: break-all;
        transition: all 0.3s ease;
    }

    .task-card:hover {
        transform: scale(1.05) translateX(5px) rotate(3deg);    
        box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
        border: 1px solid var(--line-color);
        z-index: 1;
        & h4 {

        }
    }

    .task-card:active {
        transform: rotate(-3deg);
    }

    h1 {
        font-size: 1.8em;
        color: var(--tertiary-color);
        text-align: left;
        border-bottom: 1px solid var(--line-color);
    line-height: 2;
    margin: 0;
    }
    h4 {
        font-size: 1rem;
        margin: 0;
        margin-top: 0.5rem;
    }

    .tag-list {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 5px;
    }

    .tag {
        color: var(--text-color);
        // opacity: 0.5;
        border: none;
        padding: 0 0.5rem;

        border-radius: 10px;
        font-size: 1.1em;
        line-height: 2rem;

        transition: all 0.3s ease;
        cursor: pointer;
    }

    .tag:hover {
        opacity: 0.8;
    }

    .tag.selected {
        opacity: 1;
        font-weight: 800;
        font-size: 1.5rem;
        box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
    }

    .task-creator {
        display: flex;
        justify-content: flex-start;
        align-items: center;
        gap: 0.5rem;
        margin-top: 4px;
        font-size: 0.8rem;
        color: #666;
    }

    
    img.user-avatar {
        width: 2.5rem !important;
        height: 2.5rem!important;
        border-radius: 50%;
        margin-right: 4px;
    }
    
    .username {
        font-size: 0.8rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }


    .deadline {
        font-size: 1em;
        color: var(--text-color);

        display: flex;
        justify-content: flex-start;
        align-items: center;
        gap: 0.5rem;
        letter-spacing: 0.1rem;
    }

    .deadline.selected {
        color: var(--text-color);
        box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
    }    


    .attachment-indicator {
        position: absolute;
        bottom: 5px;
        right: 5px;
        font-size: 0.8em;
    }

    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .modal-content {
        backdrop-filter: blur(20px);
        color: var(--text-color);
        padding: 2rem;
        box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.4);

        border-radius: 40px;
        max-width: 500px;
        width: 100%;
        position: relative;
        border: 1px solid var(--line-color);
    }

    .deadline-section {
        margin-top: 10px;
        padding: 1rem;

    }

    .deadline-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 5px;
    }

    .deadline-controls input[type="date"] {
        flex-grow: 1;
        padding: 5px;
        border-radius: 5px;
        border: 1px solid #ddd;
        background-color: #3a3e3c;
        color: white;
    }

    .deadline-controls button {
        padding: 5px 10px;
        background: var(--secondary-color);
        color: var(--text-color);
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
        font-size: 1.2em;
        letter-spacing: 0.1rem;
        line-height: 2;

    }

    .deadline-controls button.selected {
        border: 2px solid var(--tertiary-color);
        background: var(--tertiary-color);
        color: var(--bg-color);
        box-shadow: 0px 1px 45px 1px rgba(255, 255, 255, 0.4);
        font-weight: 800;
    }


    .tag-section, .attachment-section {
        margin-top: 10px;
        padding: 1rem;

    }



    .add-tag {
        border-radius: 1rem;
        margin-top: 1rem;
        display: flex;
        gap: 10px;
    }

    .add-tag input[type="text"] {
        flex-grow: 1;
        padding: 5px;
        border-radius:2rem;
        padding-inline-start: 1rem;
    border: none;
        background-color: #3a3e3c;
        color: white;
        font-size: 1.2rem;

    }

    .add-tag button {
        padding:0.5rem;
        width: 200px;
        font-size: 1.2rem;
        background: var(--secondary-color);
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        &:hover {
            box-shadow: 0px 1px 45px 1px rgba(255, 255, 255, 0.4);
            background: var(--tertiary-color);
            color: var(--bg-color);
        }
    }
    
    input[type="file"] {
  display: flex;
  border-radius: 1rem;
  font-size: 1.4rem;
  gap: 0.5rem;

  
}
    .attachment-list {
        margin-top: 10px;
    }

    .attachment-list a {
        display: block;
        color: #4CAF50;
        text-decoration: none;
        margin-bottom: 5px;
    }

    .delete-task-btn {
        background: transparent;
        color: var(--placeholder-color);
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding: 0.5rem;
        border-radius: 2rem;
        border: none;
        gap: 0.5rem;
        transition: all 0.3s ease;
        & span {
                display: none;
                transition: all 0.3s ease;
            }
        &:hover {
            cursor: pointer;
            background: red;
            color: white;

            & span {
                display: flex;
            }
        }
    }
    .confirm-delete-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1100; /* Higher than the task modal */
    }
    
    .confirm-delete-modal {
        background-color: var(--secondary-color);
        border-radius: 8px;
        padding: 20px;
        max-width: 400px;
        width: 100%;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .confirm-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
    }
    
    .cancel-btn {
        background-color: var(--primary-color);
        color: var(--text-color);
        border: 1px solid var(--line-color);
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        cursor: pointer;
        font-size: 1rem;
    }
    
    .confirm-btn {
        background-color: red;
        color: white;
        border: 1px solid var(--line-color);
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        cursor: pointer;
        font-size: 1rem;
    }
    .done-button {
        bottom: 20px;
        right: 20px;
        background: var(--secondary-color);
        border: 1px solid var(--line-color);
        color: var(--text-color);
        padding: 10px 20px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 1.2em;
        letter-spacing: 0.5rem;
        width: 100%;
    }

    .done-button:hover {
        background: var(--tertiary-color);

    }

    @keyframes selectPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }

    .tag.selected {
        animation: selectPulse 0.3s ease-in-out;
        box-shadow: 0px 1px 40px 1px rgba(255, 255, 255, 0.4);

    }

    @media (max-width: 1000px) {
        .kanban-board {
            flex-direction: column;
            align-items: center;
            overflow-y: scroll;
            overflow-x: hidden;
            height: 80vh;
        }

        .kanban-column {
            width: 100%;
            max-width: none;
            display: flex;
            flex-direction: column;
            border: 1px solid var(--secondary-color);
            background: var(--primary-color);
        }

        .deadline-controls {
            flex-direction: column;
        }

        .deadline-controls input[type="date"],
        .deadline-controls button {
            width: 100%;
        }
    }
</style>
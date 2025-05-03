<script lang="ts">
    import { writable, get } from 'svelte/store';
    import { slide } from 'svelte/transition';
    import { currentUser } from '$lib/pocketbase';
    import { projectStore } from '$lib/stores/projectStore';
    import type { KanbanTask, KanbanAttachment, Tag, User} from '$lib/types/types';
    import UserDisplay from '$lib/components/containers/UserDisplay.svelte';
	import { CalendarClock, ChevronLeft, ChevronRight, FolderGit, GitFork, LayoutList, ListCollapse, Trash2 } from 'lucide-svelte';
    import { fade } from 'svelte/transition';
    import { t } from '$lib/stores/translationStore';

    let currentProjectId: string | null = null;
    projectStore.subscribe(state => {
        currentProjectId = state.currentProjectId;
    });
    let isDeleteConfirmOpen = false;
    let taskToDelete: string | null = null;
    let showSubtasks = false;
    let taskTransition = false;
    let hoveredButton: 'all' | 'parents' | 'subtasks' | null = null;


    enum TaskViewMode {
        All = 'all',
        OnlySubtasks = 'subtasks',
        OnlyParentTasks = 'parents'
    }
    let taskViewMode = TaskViewMode.All;
    let allTasksBackup: KanbanTask[] = [];


    interface Column {
        id: number;
        title: string;
        status: KanbanTask['status'] | 'backlog' | 'inprogress';
        tasks: KanbanTask[];
        isOpen: boolean;
    }
    const userNameCache = new Map<string, string>();

    const statusMapping = {
        'Backlog': 'backlog',
        'To Do': 'todo',
        'In Progress': 'inprogress',
        'Done': 'done'
    };

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

    function getRandomBrightColor(tagName: string): string {
        const hash = tagName.split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);
        const h = hash % 360;
        return `hsl(${h}, 70%, 60%)`;
    }
    async function getUserName(userId: string | undefined): Promise<string> {
        if (!userId) return "Unknown";
        
        // Check if we already have this username in cache
        if (userNameCache.has(userId)) {
            return userNameCache.get(userId) || "Unknown";
        }
        
        try {
            const response = await fetch(`/api/users/${userId}`);
            if (!response.ok) throw new Error('Failed to fetch user');
            
            const userData = await response.json();
            const userName = userData.name || userData.username || userData.email || "Unknown";
            
            // Cache the result for future use
            userNameCache.set(userId, userName);
            
            return userName;
        } catch (err) {
            console.error('Error fetching user data:', err);
            return "Unknown";
        }
    }
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
        
        // Store all tasks for filtering purposes
        allTasksBackup = [];
        
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
                    parent_task: task.parent_task || undefined,
                    allocatedAgents: task.allocatedAgents || [],
                    status: task.status,
                    priority: task.priority || 'medium',
                    prompt: task.prompt || '',
                    context: task.context || '',
                    task_outcome: task.task_outcome || '',
                    dependencies: task.dependencies || [],
                    agentMessages: task.agentMessages || []
                };
                
                // Add to our backup of all tasks
                allTasksBackup.push(taskObj);
                
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
        
        // Initial application of task view filtering
        if (taskViewMode !== TaskViewMode.All) {
            applyTaskViewFilter();
        }
        
        // Rest of your loadTasks function...
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
            parent_task: task.parent_task || '',
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
function applyTaskViewFilter() {
    columns.update(cols => {
        return cols.map(col => {
            // Start with all tasks
            const tasksForColumn = allTasksBackup.filter(task => {
                // Only include tasks that belong in this column
                const belongsInColumn = col.status === statusMapping[task.status] || 
                                       (reverseStatusMapping[task.status] && 
                                        reverseStatusMapping[task.status].includes(col.title));
                
                if (!belongsInColumn) return false;
                
                // Apply view mode filter
                switch (taskViewMode) {
                    case TaskViewMode.All:
                        return true;
                    case TaskViewMode.OnlySubtasks:
                        return !!task.parent_task; // Only show tasks with a parent
                    case TaskViewMode.OnlyParentTasks:
                        // Show tasks that have children (are parent tasks)
                        return allTasksBackup.some(t => t.parent_task === task.id);
                    default:
                        return true;
                }
            });
            
            return { ...col, tasks: tasksForColumn };
        });
    });
}
function toggleTaskView(mode: TaskViewMode) {
    taskViewMode = mode;
    applyTaskViewFilter();
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
        const taskToSave = { ...selectedTask };

        let taskExists = false;
        columns.update(cols => {
            for (const col of cols) {
                if (col.tasks.some(t => t.id === taskToSave.id)) {
                    taskExists = true;
                    break;
                }
            }
            return cols;
        });
        
        if (!taskExists) {
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
                        task.id === taskToSave.id ? {...taskToSave} : task
                    )
                }));
            });
            selectedTask = null;
            isModalOpen = false;
        }).catch(err => {
            error.set(`Failed to save task: ${err.message}`);
        });
    } else {
        isModalOpen = false;
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
 // Update these helper functions to check allTasksBackup instead of just visible tasks
function hasSubtasks(taskId: string): boolean {
  if (!taskId) return false;
  
  // Check in the complete tasks backup, not just currently visible tasks
  return allTasksBackup.some(task => task.parent_task === taskId);
}

function countSubtasks(taskId: string): number {
  if (!taskId) return 0;
  
  // Count in the complete tasks backup
  return allTasksBackup.filter(task => task.parent_task === taskId).length;
}

function getSubtasks(taskId: string): KanbanTask[] {
  if (!taskId) return [];
  
  // Get from the complete tasks backup
  return allTasksBackup.filter(task => task.parent_task === taskId);
}

// Reactive statement to maintain a map of parent task titles
$: parentTaskNames = (() => {
  const map = new Map<string, string>();
  allTasksBackup.forEach(task => {
    map.set(task.id, task.title);
  });
  return map;
})();

function getParentTaskTitle(parentId: string | undefined): string {
  if (!parentId) return "Unknown";
  return parentTaskNames.get(parentId) || "Unknown";
}

function navigateToParentTask(parentId: string, event: MouseEvent) {
    if (!parentId) return;
    
    event.stopPropagation();
    
    // Find the parent task
    let parentTask: KanbanTask | null = null;
    $columns.forEach(col => {
        col.tasks.forEach(task => {
            if (task.id === parentId) {
                parentTask = task;
            }
        });
    });
    
    if (parentTask) {
        // Add a visual transition effect
        taskTransition = true;
        
        // Update the task with a small delay for visual feedback
        setTimeout(() => {
            selectedTask = deepCopy(parentTask);
            isEditingTitle = false;
            isEditingDescription = false;
            showSubtasks = false;
            selectedDeadline = null;
            
            // Reset the transition flag after a moment
            setTimeout(() => {
                taskTransition = false;
            }, 300);
        }, 50);
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
    <div class="kanban-board">
        {#each $columns as column}
            <div class="kanban-column" on:dragover={handleDragOver} on:drop={(e) => handleDrop(e, column.id)}>
                <button type="button" class="column-header" on:click={() => toggleColumn(column.id)}>
                    {column.title}
                </button>
                
                {#if column.isOpen}
                    <div class="task-list" transition:fade={{ duration: 150 }}>
                        {#each column.tasks as task}
                            <div 
                                class="task-card" 
                                draggable="true" 
                                on:dragstart={(e) => handleDragStart(e, task.id, column.id)}
                                on:click={(e) => openModal(task, e)}
                            >
                            {#if hasSubtasks(task.id)}
                                <div class="task-badge subtasks">
                                    {countSubtasks(task.id)} subtasks
                                </div>
                            {/if}
                        
                            {#if task.parent_task}
                                <div class="task-badge ">
                                    {getParentTaskTitle(task.parent_task)}
                                </div>
                            {/if}
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

                                    <span>
                                        <img 
                                        src={`/api/users/${task.createdBy}/avatar`} 
                                        alt="Avatar" 
                                        class="user-avatar"
                                        onerror="this.style.display='none'"
                                    />
                                        <span class="username">
                                            {#await getUserName(task.createdBy) then username}
                                                {username}
                                            {/await}
                                        </span>
                                    </span>
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
    <div class="global-input-container">
        <div class="view-controls">
            <div class="tooltip-container">
                <span class="shared-tooltip" class:visible={hoveredButton === 'all'}>
                    Show all tasks
                </span>
                <span class="shared-tooltip" class:visible={hoveredButton === 'parents'}>
                    Show parent tasks only
                </span>
                <span class="shared-tooltip" class:visible={hoveredButton === 'subtasks'}>
                    Show subtasks only
                </span>
            </div>
            
            <button 
                class:active={taskViewMode === TaskViewMode.All} 
                on:click={() => toggleTaskView(TaskViewMode.All)}
                on:mouseenter={() => hoveredButton = 'all'}
                on:mouseleave={() => hoveredButton = null}
            >
                <ListCollapse/>
            </button>
            <button 
                class:active={taskViewMode === TaskViewMode.OnlyParentTasks} 
                on:click={() => toggleTaskView(TaskViewMode.OnlyParentTasks)}
                on:mouseenter={() => hoveredButton = 'parents'}
                on:mouseleave={() => hoveredButton = null}
            >
                <FolderGit/>
            </button>
            <button 
                class:active={taskViewMode === TaskViewMode.OnlySubtasks} 
                on:click={() => toggleTaskView(TaskViewMode.OnlySubtasks)}
                on:mouseenter={() => hoveredButton = 'subtasks'}
                on:mouseleave={() => hoveredButton = null}
            >
                <GitFork/>
            </button>
        </div>
        <textarea 
            placeholder="Add a task"
            on:keydown={(e) => addGlobalTask(e)}
            class="global-task-input"
        ></textarea>
    </div>

</div>
{/if} 
{#if isModalOpen && selectedTask}
    <div class="modal-overlay" on:click={saveAndCloseModal}>
        <div class="modal-content"     
            class:task-changing={taskTransition}
            on:click|stopPropagation 
            transition:fade={{ duration: 150 }}
        >
            {#if selectedTask && selectedTask.parent_task}
                <div class="parent-task-section">
                    <button 
                        class="tasknav-btn" 
                        on:click={(e) => navigateToParentTask(selectedTask.parent_task || '', e)}
                    >
                        <ChevronLeft size="16"/>
                    </button>
                    <p>{getParentTaskTitle(selectedTask.parent_task)}</p>
                </div>
            {/if}
            <div class="title-section">
                <p>Title:</p>
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
            </div>
            {#if hasSubtasks(selectedTask.id)}
            <div class="subtasks-section" on:click={() => showSubtasks = !showSubtasks}>
                <div class="section-header">
                    <p>Subtasks ({countSubtasks(selectedTask.id)})</p>
                    <!-- <button class="toggle-btn" on:click={() => showSubtasks = !showSubtasks}>
                        {showSubtasks ? 'Hide' : 'Show'}
                    </button> -->
                </div>
                
                {#if showSubtasks}
                    <div class="subtasks-list" transition:slide={{ duration: 150 }}>
                        {#each getSubtasks(selectedTask.id) as subtask}
                            <div class="subtask-item" on:click={(e) => openModal(subtask, e)}>
                                <div class="subtask-title">{subtask.title}</div>
                                <div class="subtask-status">{subtask.status}</div>
                                    <ChevronRight size="16"/>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
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
            <div class="submit-section">
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
        font-size: 1.1rem;
        // padding: 1rem 0;
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
            font-size:0.8rem;
            line-height: 1.25;
            max-height: 1rem;
            overflow: hidden;
            text-align: left;
            margin-bottom: 0.5rem;
            padding: 0 0.5rem;

        }
    }
    .button-group {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 1rem;
        width: 100%;
        gap: 1rem;
    }
 
    .global-input-container {
        width: 100%;
        padding: 0;
        margin: 0;
        margin-top: 1rem;
        gap: 1rem;
        // box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        display: flex;
        justify-content: flex-start;
        align-items: center;
        height: auto;
        width: 100%;
        transition: all 1s ease;
        & textarea {
            display: flex;
            justify-content: center;
            align-items: center;
            text-align: center;
            height: auto;
            padding: 0;
            margin: 0;
            line-height: 3rem;
            font-size: 1rem;
            width: 100%;
            overflow-y: hidden;
        }

    }
    

    .global-task-input {
        width: calc(100% - 4rem);
        height: 3rem !important;
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 2rem;
        font-size: 1.2rem;
        background: var(--secondary-color);
        textarea {
        }
    }
    
    .global-task-input:focus {
        outline: none;
        border-color: var(--tertiary-color);
        box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.4);
    }
    .kanban-board {
        display: flex;
        flex-direction: row;
        gap: 0.5rem;
        overflow-x: auto; 
        scrollbar-width: thin;
        scroll-behavior: smooth;
        scrollbar-color: var(--secondary-color) transparent;
        align-items: flex-start;
        height: 82vh;
        width: calc(100% - 3rem);
        padding: 1rem;
        transition: all 0.3s ease;

    }

    .kanban-column {
        border-radius: 5px;
        flex: 0 0 auto;
        display: flex;        
        flex-direction: column;
        justify-content: center;
        width: calc(25%);
        transition: all 0.3s ease;
        // border: 1px solid var(--secondary-color);
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

    .title-section {
        textarea.title-input {
            background: var(--primary-color);
            width: auto;
            height: 100px;
        }

        h1 {
            font-size: 1.2rem;
            padding: 0.5rem;
            border: 1px solid var(--line-color);
            border-radius: 1rem;
            color: var(--tertiary-color);
            text-align: left;
            line-height: 2;
            margin: 0;
        }
    }

    .submit-section {
        p {
            text-align: right;
            font-weight: 100;
            font-size: 0.8rem;
        }
    }

    .parent-task-section {
        flex-direction: row !important;
        // border-bottom: 1px solid var(--line-color);
        padding: 1rem;
        gap: 1rem;
        p {
            font-size: 1.3rem;
        }
    }
    .title-section,
    .deadline-section,
    .attachment-section,
    .tag-section,
    .submit-section,
    .subtasks-section,
    .parent-task-section,
    .description-section {
        display: flex;
        flex-direction: column;
        margin-bottom: 1rem;
        max-width: 450px;
        width: 100%;
        transition: all 0.2s ease;
        & textarea {
            background: var(--primary-color);
            height: 300px;
            width: auto;

        }
        & p {
            margin: 0;
            margin-bottom: 0.5rem;
            padding: 0;
            letter-spacing: 0.1rem;
        }
    }
    .description-display {
        overflow-y: auto;
        overflow-x: hidden;
        height: 80px;
        font-size: 1.1rem;
        border: 1px solid var(--line-color);
        border-radius: 1rem;
        padding: 1rem;

    }
    .task-card {
        background: var(--secondary-color);
        border-radius: 10px;
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


    h4 {
        font-size: 0.9rem;
        padding: 0 0.5rem;
        margin: 0;
        margin-top: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .tag-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 0 0.5rem;
        margin-bottom: 0.5rem;
    }

    .tag {
        color: var(--text-color);
        // opacity: 0.5;
        border: none;
        padding: 0.25rem;

        border-radius: 1rem;
        font-size: 0.75rem;

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
        justify-content: space-between;
        align-items: center;
        bottom: 0;
        right: 0;
        left: 0;
        // border-top: 1px solid var(--line-color);
        gap: 0.5rem;
        padding: 0.25rem 0.5rem;
        margin: 0;
        font-size: 0.8rem;
        span {
            display: flex;
            justify-content: center;
            align-items: center;
        }
        & .username {
            color: var(--placeholder-color);
            letter-spacing: 0.1rem;
        }
    }


    img.user-avatar {
        width: 1.5rem !important;
        height: 1.5rem!important;
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
    // color: var(--text-color);
    // padding: 0.25rem 0.5rem;
    // border-bottom-left-radius: 0.5rem;
    // border-top-right-radius: 0.5rem;
    font-size: 0.75rem;
    // display: inline-block;
    letter-spacing: 0.1rem;
    // position: absolute;
    // left: 0;
    // bottom: 0;
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
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-radius: 2rem;
        max-width: 600px;
        width: 100%;
        height: auto;
        position: relative;
        border: 1px solid var(--line-color);

    }



    .deadline-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
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
        font-size: 0.9rem;
        line-height: 2;

    }

    .deadline-controls button.selected {
        border: 2px solid var(--tertiary-color);
        background: var(--tertiary-color);
        color: var(--bg-color);
        box-shadow: 0px 1px 45px 1px rgba(255, 255, 255, 0.4);
        font-weight: 800;
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
    }

    .attachment-list a {
        display: block;
        color: #4CAF50;
        text-decoration: none;
        margin-bottom: 0.5rem;
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
        letter-spacing: 0.3rem;
        width: 100%;
    }

    .done-button:hover {
        background: var(--tertiary-color);

    }
    .task-badge {
        display: flex;
        width: auto;
    color: var(--placeholder-color);
    padding: 0.25rem 0.5rem;
    border-top-right-radius: 0.5rem;
    border-top-left-radius: 0.5rem;
    font-size: 0.75rem;
    letter-spacing: 0.1rem;
    cursor: pointer;

    &.subtasks {
        color: var(--placeholder-color);
        justify-content: flex-end;
    }
    &:hover {
        background: var(--tertiary-color);
        color: var(--text-color);
    }
}




.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100vw;
    max-width: 450px;
    &:hover {
            cursor: pointer;
            p {
                color: var(--tertiary-color);
            }
        }
}

.subtasks-list {
    width: 100%;
    max-width: 450px;
    display: flex;
    flex-direction: column;
}

.subtask-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    width: auto;
    background: var(--primary-color);
    border-radius: 4px;
    margin-bottom: 5px;
    transition: all 0.3s ease;
    &:hover {
        cursor: pointer;
        background: var(--secondary-color);

    }
}

.subtask-title {
    flex: 1;
    font-weight: 500;
}

.subtask-status {
    background: var(--color-primary-lighter);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.75rem;
    margin: 0 8px;
    background: var(--secondary-color);
}

.tasknav-btn {
    background-color: var(--bg-color);
    color: var(--text-color);
    border: none;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0.5rem;
    cursor: pointer;
}

.parent-task-section {
    margin-top: 15px;
    border-top: 1px solid var(--color-border);
    padding-top: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.navigate-parent-btn {
    background-color: var(--color-secondary);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
}

.task-changing {
    animation: flash 0.3s;
}

.tag.selected {
        animation: selectPulse 0.3s ease-in-out;
        box-shadow: 0px 1px 40px 1px rgba(255, 255, 255, 0.4);
    }
.view-controls {
    position: relative;
    display: flex;
    align-items: center;
    background-color: var(--color-bg-secondary);

}



.view-controls button {
    display: flex;
    flex-direction: row;
    padding: 1rem;

    background-color: transparent;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    margin-right: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--placeholder-color);

    &:hover {
        background: var(--secondary-color);
    }


}

.view-controls button.active {
    background-color: var(--color-primary);
    color: var(--tertiary-color);
    border-color: var(--color-primary);
}
.tooltip-container {
    position: absolute;
    top: -35px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    pointer-events: none;
}

.shared-tooltip {
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 10;
    position: absolute;
}

.shared-tooltip.visible {
    opacity: 1;
}

.shared-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
}

@keyframes flash {
    0% { background-color: var(--color-bg); }
    50% { background-color: var(--color-highlight); }
    100% { background-color: var(--color-bg); }
}
    @keyframes selectPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }


    @media (max-width: 1000px) {

        .modal-overlay {
            align-items: center;
        }
        .modal-content {
            margin-left: 1rem;
            margin-right: 1rem;
            max-width: 400px;
            width: 100%;
        }

        .view-controls {
            padding: 0;
            margin: 0;
        }
        .view-controls button {
            display: flex;
            flex-direction: row;
            padding: 0.5rem;
            background-color: transparent;
            border: 1px solid var(--color-border);
            border-radius: 4px;
            margin-right: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            color: var(--placeholder-color);
            &:hover {
                background: var(--secondary-color);
            }
        }

        .view-controls button.active {
            background-color: var(--color-primary);
            color: var(--tertiary-color);
            border-color: var(--color-primary);
        }

        .title-section,
        .deadline-section,
        .attachment-section,
        .tag-section,
        .submit-section,
        .subtasks-section,
        .parent-task-section,
        .description-section {
            display: flex;
            flex-direction: column;
            margin-bottom: 1rem;
            max-width: 450px;
            width: 100% !important;
            & textarea {
                background: var(--primary-color);
                height: 300px;
                width: auto;
                font-size: 0.9rem;

            }
            & p {
                margin: 0;
                margin-bottom: 0.5rem;
                padding: 0;
                font-size: 0.9rem;
            }
        }
    .description-display {
        overflow-y: auto;
        height: 80px;
        font-size: 0.9rem;
        border: 1px solid var(--line-color);
        border-radius: 1rem;
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
        font-size: 0.9rem;
        line-height: 2;

    }

    .deadline-controls button.selected {
        border: 2px solid var(--tertiary-color);
        background: var(--tertiary-color);
        color: var(--bg-color);
        box-shadow: 0px 1px 45px 1px rgba(255, 255, 255, 0.4);
        font-weight: 800;
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
        font-size: 0.9rem;

    }

    .add-tag button {
        padding:0.5rem;
        width: 200px;
        font-size: 0.9rem;
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
    font-size: 0.9rem;
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


        .kanban-board {
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            overflow-y: scroll;
            overflow-x: hidden;
            width: auto;
            margin-right: 2rem;
            height: 80vh;
            border-radius: 2rem;
            border: 1px solid var(--line-color);
            padding: 0;
            margin: 0;
        }
        .kanban-column {
            width: 100%;
            max-width: none;
            display: flex;
            flex-direction: column;
            border: 1px solid var(--secondary-color);
            background: var(--primary-color);
        }

        // .deadline-controls {
        //     flex-direction: column;
        // }

        // .deadline-controls input[type="date"],
        // .deadline-controls button {
        //     width: 100%;
        // }
    }
    @media (max-width: 450px) {
        .global-input-container {
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: auto;
            margin-left: 2rem;
            margin-right: 2rem;
        }
        .view-controls {
            justify-content: space-between;
            width: 100%;
        }
    }
</style>
<script lang="ts">
    import { writable, get } from 'svelte/store';
    import { slide, fly, fade } from 'svelte/transition';
      import { elasticOut, cubicIn, cubicOut, quintOut } from 'svelte/easing';
    import { currentUser, ensureAuthenticated } from '$lib/pocketbase';
    import { projectStore } from '$lib/stores/projectStore';
    import type { KanbanTask, KanbanAttachment, Column, Tag, User} from '$lib/types/types';
    import UserDisplay from '$lib/features/users/components/UserDisplay.svelte';
	import { ArrowRight, ArrowDown, EyeOff, Layers, Flag, CalendarClock, ChevronLeft, ChevronRight, Filter, ListFilter, ClipboardList, TagIcon, CirclePlay, FolderGit, GitFork, LayoutList, ListCollapse, PlayCircleIcon, Trash2, PlusCircle, Tags, Search } from 'lucide-svelte';
    import { t } from '$lib/stores/translationStore';
    import AssignButton from '$lib/components/buttons/AssignButton.svelte';
    import { 
        updateTaskStatus, 
        bulkUpdateTaskStatus, 
        updateTaskAssignment,
        updateTask,
        filterTasksByTags,
        applyTagFilterToColumns
    } from '$lib/clients/taskClient';
    import TagsDropdown from '$lib/components/buttons/TagsDropdown.svelte';
    import { threadsStore, showThreadList } from '$lib/stores/threadsStore';
    import { capitalizeFirst, processWordCrop, processWordMinimize } from '$lib/utils/textHandlers';
    import { assign } from 'lodash-es';
    let currentProjectId: string | null = null;
    projectStore.subscribe(state => {
        currentProjectId = state.currentProjectId;
    });
    let project = null;
    let isAuthenticated = false;
    let isAuthenticating = true;
    let isDeleteConfirmOpen = false;
    let taskToDelete: string | null = null;
    let showSubtasks = false;
    let taskTransition = false;
    let hoveredButton: 'all' | 'parents' | 'subtasks' | null = null;
    let showTagFilter = false;
    let selectedTagIds: string[] = [];
    let requireAllTags = false;
    let allColumnsOpen = true;
    let searchQuery = '';
    let hoveredButtonId: number | null = null;
    let priorityViewActive = false;
    let showAddTag = false;
    let addTagInput = false;

    enum TaskViewMode {
        All = 'all',
        OnlySubtasks = 'subtasks',
        OnlyParentTasks = 'parents',
        LowPriority = 'low',
        mediumPriority = 'medium',
        highPriority = 'high'

    }
    let taskViewMode = TaskViewMode.All;
    let allTasksBackup: KanbanTask[] = [];



    const userNameCache = new Map<string, string>();

    const statusMapping = {
        'Backlog': 'backlog',
        'To Do': 'todo',
        'In Progress': 'inprogress',
        'Review': 'review',
        'Done': 'done',
        'Hold': 'hold',
        'Postponed': 'postpone',
        'Delegate': 'delegate',
        'Cancelled': 'cancel',
        'Archived': 'archive',
    };

    const reverseStatusMapping = {
        'backlog': ['Backlog'],
        'todo': ['To Do'],
        'inprogress': ['In Progress'],
          'review': ['Review'],
        'done': ['Done'],
        'hold': ['Hold'],
        'postpone': ['Postponed'],
        'delegate': ['Delegate'],
        'cancel': ['Cancelled'],
        'archive': ['Archived']
    };

    let columns = writable<Column[]>([
        { id: 1, title: $t('tasks.backlog'), status: 'backlog', tasks: [], isOpen: true },
        { id: 2, title: $t('tasks.todo'), status: 'todo', tasks: [], isOpen: true },
        { id: 3, title: $t('tasks.inprogress'), status: 'inprogress', tasks: [], isOpen: true },
        { id: 4, title: $t('tasks.review'), status: 'review', tasks: [], isOpen: true },
        { id: 5, title: $t('tasks.done'), status: 'done', tasks: [], isOpen: true },
        { id: 6, title: $t('tasks.hold'), status: 'hold', tasks: [], isOpen: true },
        { id: 7, title: $t('tasks.postponed'), status: 'postpone', tasks: [], isOpen: true },
        { id: 8, title: $t('tasks.delegate'), status: 'delegate', tasks: [], isOpen: true },
        { id: 9, title: $t('tasks.cancelled'), status: 'cancel', tasks: [], isOpen: true },
        { id: 10, title: $t('tasks.archive'), status: 'archive', tasks: [], isOpen: true }

    ]);

    let tags = writable<Tag[]>([]);
    let selectedTask: KanbanTask | null = null;
    let isModalOpen = false;
    let newTagName = '';
    let isEditingDescription = false;
    let isEditingTitle = false;
    let selectedDeadline: number | string | null = null;
    let selectedStart: number | string | null = null;
    let isLoading = writable(true);
    let error = writable<string | null>(null);
    let isEditingStartDate = false;
    let isEditingDueDate = false;
    let editingYear: number | null = null;
    let editingMonth: number | null = null;
    let editingDay: number | null = null;
    let editingDateType: 'start' | 'due' | null = null;

    /*
     * projectStore.subscribe(state => {
     *     if (state.currentProjectId) {
     *         project = state.threads.find(p => p.id === state.currentProjectId);
     *     } else {
     *         project = null;
     *     }
     * });
     */
      projectStore.subscribe(state => {
        currentProjectId = state.currentProjectId;
    });

    function getRandomBrightColor(tagName: string): string {
        const hash = tagName.split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);
        const h = hash % 360;
        return `hsl(${h}, 70%, 60%)`;
    }
async function getUserName(userId: string | undefined): Promise<string> {
    if (!userId) return "Unassigned";
    
    // Check if we already have this username in cache
    if (userNameCache.has(userId)) {
        return userNameCache.get(userId) || "Unknown";
    }
    
    try {
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) {
            console.log(`User fetch failed for ID ${userId}: ${response.status}`);
            return "Unknown";
        }

        const data = await response.json();
        
        // Handle different response formats
        let userData;
        if (data.success && data.user) {
            userData = data.user;
        } else if (data.id) {
            userData = data;
        } else {
            console.log('Unexpected user data format:', data);
            return "Unknown";
        }
        
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
            error.set(err instanceof Error ? err.message : 'Failed to load data');
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
                    start_date: task.start_date ? new Date(task.start_date) : null,
                    tags: task.taskTags || (task.taggedTasks ? task.taggedTasks.split(',') : []),
                    attachments: [],
                    project_id: task.project_id,
                    createdBy: task.createdBy,
                    assignedTo: task.assignedTo,
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
        
        /*
         * Use the task's current status directly instead of trying to determine it from columns
         * This fixes the issue where status gets overridden during drag operations
         */
        const taskStatus = task.status;
        
        // Prepare attachment IDs as a comma-separated string
        const attachmentIds = updatedAttachments.map(att => att.id).join(',');
        
        const taskData = {
            title: task.title,
            taskDescription: task.taskDescription,
            project_id: currentProjectId || '',
            createdBy: get(currentUser)?.id,
            assignedTo: task.assignedTo || '',
            parent_task: task.parent_task || '',
            status: taskStatus,
            priority: task.priority || 'medium',
            due_date: task.due_date ? task.due_date.toISOString() : null,
            start_date: task.start_date ? task.start_date.toISOString() : null,
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
                        start_date: savedTask.start_date ? new Date(savedTask.start_date) : null,
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
            const tasksForColumn = allTasksBackup.filter(task => {
                const belongsInColumn = col.status === statusMapping[task.status] || 
                                       (reverseStatusMapping[task.status] && 
                                        reverseStatusMapping[task.status].includes(col.title));
                
                if (!belongsInColumn) return false;
                
                switch (taskViewMode) {
                    case TaskViewMode.All:
                        return true;
                    case TaskViewMode.OnlySubtasks:
                        return !!task.parent_task;
                    case TaskViewMode.OnlyParentTasks:
                        return allTasksBackup.some(t => t.parent_task === task.id);
                    case TaskViewMode.LowPriority:
                        return task.priority === 'low';
                    case TaskViewMode.mediumPriority:
                        return task.priority === 'medium';
                    case TaskViewMode.highPriority:
                        return task.priority === 'high';
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

function handleTagsChanged(event: CustomEvent) {
    selectedTagIds = event.detail.selectedTags;
    applyFilters();
}

function toggleRequireAllTags() {
    requireAllTags = !requireAllTags;
    applyFilters();
}
    
function applyFilters() {
    if (searchQuery.trim()) {
        searchTasks(searchQuery);
    } else {
        columns.update(cols => {
            // Start with all tasks
            let tasksToFilter = [...allTasksBackup];
            
            // First apply tag filtering
            if (selectedTagIds.length > 0) {
                tasksToFilter = filterTasksByTags(tasksToFilter, selectedTagIds, requireAllTags);
            }
            
            // Then distribute to columns based on status
            return cols.map(col => {
                // Filter tasks for this column
                const tasksForColumn = tasksToFilter.filter(task => {
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
}

function toggleTagFilter() {
    showTagFilter = !showTagFilter;
    if (!showTagFilter) {
        // Clear filters when hiding
        selectedTagIds = [];
        applyFilters();
    }
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
                            start_date: null,
                            tags: [],
                            attachments: [],
                            project_id: currentProjectId || undefined,
                            createdBy: get(currentUser)?.id,
                            allocatedAgents: [],
                            status: statusMapping[column.title] as KanbanTask['status'] || 'todo',
                            priority: 'medium'
                        };
                        column.tasks.push(newTask);
                        
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
                                            start_date: savedTask.start_date ? new Date(savedTask.start_date) : null,
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
                
                // First move the task in the UI for immediate feedback
                fromColumn.tasks.splice(taskIndex, 1);
                
                // Get the correct new status from statusMapping or use the column's status directly
                let newStatus;
                if (statusMapping[toColumn.title]) {
                    newStatus = statusMapping[toColumn.title];
                } else {
                    // Handle case where column title doesn't map directly to a status
                    newStatus = toColumn.status;
                }
                
                console.log(`Moving task from ${fromColumn.title} to ${toColumn.title} - new status: ${newStatus}`);
                
                // Ensure newStatus is a valid status value
                const validStatuses = ['backlog', 'todo', 'inprogress', 'focus', 'done', 
                                      'hold', 'postpone', 'cancel', 'review', 'delegate', 'archive'];
                                      
                if (!validStatuses.includes(newStatus)) {
                    console.error(`Invalid status: ${newStatus}, falling back to column status: ${toColumn.status}`);
                    newStatus = toColumn.status;
                }
                
                task.status = newStatus as KanbanTask['status'];
                
                if (!task.tags) {
                    task.tags = [];
                }
                
                toColumn.tasks.push(task);
                
                // Use simple updateTask instead of updateTaskStatus to avoid user assignment issues
                (async () => {
                    try {
                        // Simple status update without user assignment logic
                        await updateTask(taskId, { status: task.status });
                    } catch (err) {
                        console.error('Error updating task status:', err);
                        error.set(err instanceof Error ? err.message : 'Failed to move tasks');
                        
                        fromColumn.tasks.splice(taskIndex, 0, task);
                        const revertIndex = toColumn.tasks.findIndex(t => t.id === taskId);
                        if (revertIndex !== -1) {
                            toColumn.tasks.splice(revertIndex, 1);
                        }
                        
                        // Trigger UI update
                        columns.update(c => c);
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
    function toggleAllColumns() {
    // Update the state
    allColumnsOpen = !allColumnsOpen;
    
    columns.update(cols => {
      return cols.map(col => ({
        ...col,
        isOpen: allColumnsOpen
      }));
    });
  }
function handleDragStart(event: DragEvent, taskId: string, fromColumnId: number) {
    if (event.dataTransfer) {
        event.dataTransfer.setData('text/plain', JSON.stringify({ taskId, fromColumnId }));
        event.dataTransfer.effectAllowed = 'move';
        
        (event.target as HTMLElement).classList.add('dragging');
        
        setTimeout(() => {
            document.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.classList.add('drop-enabled');
            });
        }, 0);
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

function handleDragEnd(event: DragEvent) {
    (event.target as HTMLElement).classList.remove('dragging');
    
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('drop-enabled', 'drag-hover');
    });
    hoveredButtonId = null;
}

function handleButtonDragOver(event: DragEvent, columnId: number) {
    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
    }
    
    const button = event.currentTarget as HTMLElement;
    button.classList.add('drag-hover');
    hoveredButtonId = columnId;
}

function handleButtonDragLeave(event: DragEvent) {
    const button = event.currentTarget as HTMLElement;
    button.classList.remove('drag-hover');
    
    if (button.contains(event.relatedTarget as Node) === false) {
        hoveredButtonId = null;
    }
}

function handleButtonDrop(event: DragEvent, toColumnId: number) {
    event.preventDefault();
    event.stopPropagation();
    
    const button = event.currentTarget as HTMLElement;
    button.classList.remove('drag-hover');
    
    if (event.dataTransfer) {
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        
        if (data.fromColumnId !== toColumnId) {
            moveTask(data.taskId, data.fromColumnId, toColumnId);
        }
    }
    
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('drop-enabled', 'drag-hover');
    });
    hoveredButtonId = null;
}
    function openModal(task: KanbanTask, event: MouseEvent) {
        event.stopPropagation();
        selectedTask = deepCopy(task);
        isModalOpen = true;
        isEditingTitle = false;
        isEditingDescription = false;
        selectedDeadline = null;
        selectedStart = null;
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
        
        updateTask(taskToSave.id, taskToSave).then(() => {
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
function toggleAddTag() {
        showAddTag = !showAddTag;
        if (showAddTag) {
            // Focus the input when it becomes visible
            setTimeout(() => addTagInput?.focus(), 0);
        }
    }
    
    function handleInputBlur() {
        showAddTag = false;
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
            
            try {
                await saveTag(newTag);
                showAddTag = false;

            } catch (err) {
            error.set(err instanceof Error ? err.message : 'Failed to save tag');
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
                        start_date: null,
                        tags: [],
                        attachments: [],
                        project_id: currentProjectId || undefined,
                        createdBy: get(currentUser)?.id,
                        allocatedAgents: [],
                        status: 'backlog',
                        priority: 'medium'
                    };
                    
                    backlogColumn.tasks.push(newTask);
                    
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
                                        start_date: savedTask.start_date ? new Date(savedTask.start_date) : null,
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
    function setQuickStart(days: number) {
        if (selectedTask) {
            const start = new Date();
            start.setDate(start.getDate() + days);
            selectedTask.start_date = start;
            selectedTask = { ...selectedTask };
            selectedStart = days;
        }
    }

    function setEndOfWeekStart() {
        if (selectedTask) {
            const start = new Date();
            const daysUntilEndOfWeek = 7 - start.getDay();
            start.setDate(start.getDate() + daysUntilEndOfWeek);
            selectedTask.start_date = start;
            selectedTask = { ...selectedTask };
            selectedStart = 'endOfWeek';
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
        selectedTask = { ...selectedTask }; // Trigger reactivity
        
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
            selectedTask = { ...selectedTask }; // Trigger reactivity
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

async function getParentTaskTitle(parentId: string | undefined): Promise<string> {
    if (!parentId) return "Unknown";
    
    // Check local cache first
    if (parentTaskNames.has(parentId)) {
        return parentTaskNames.get(parentId) || "Unknown";
    }
    
    // If not in cache, fetch from API
    try {
        const response = await fetch(`/api/tasks/${parentId}`);
        if (!response.ok) throw new Error('Failed to fetch parent task');
        
        const parentTask = await response.json();
        const title = parentTask.title || "Unknown";
        
        // Update cache
        parentTaskNames.set(parentId, title);
        
        return title;
    } catch (err: unknown) {
        console.error('Error fetching parent task:', err);
        return "Unknown";
    }
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

async function handleTaskAssigned(detail) {
    const { taskId, userId } = detail;
    
    try {
        if (selectedTask && selectedTask.id === taskId) {
            selectedTask.assignedTo = userId;
            selectedTask = { ...selectedTask };
        }
        
        await updateTaskAssignment(taskId, userId);
        
        columns.update(cols => {
            return cols.map(col => ({
                ...col,
                tasks: col.tasks.map(task => 
                    task.id === taskId ? { ...task, assignedTo: userId } : task
                )
            }));
        });
    } catch (error) {
        console.error('Error handling task assignment:', error);
    }
}
async function handleTaskUnassigned(taskId) {
    try {
        if (selectedTask && selectedTask.id === taskId) {
            selectedTask.assignedTo = '';
            selectedTask = { ...selectedTask }; 
        }
        
        await updateTaskAssignment(taskId, '');
        
        // Update in columns
        columns.update(cols => {
            return cols.map(col => ({
                ...col,
                tasks: col.tasks.map(task => 
                    task.id === taskId ? { ...task, assignedTo: '' } : task
                )
            }));
        });
    } catch (error) {
        console.error('Error handling task unassignment:', error);
    }
}

function searchTasks(query: string) {
    if (!query.trim()) {
        // If search is empty, restore original tasks
        applyFilters();
        return;
    }
    
    // Normalize the search query (lowercase)
    const normalizedQuery = query.toLowerCase().trim();
    
    columns.update(cols => {
        return cols.map(col => {
            // Start with tasks that would be shown based on other active filters
            let filteredTasks = [...allTasksBackup];
            
            // Apply tag filters if active
            if (selectedTagIds.length > 0) {
                filteredTasks = filterTasksByTags(filteredTasks, selectedTagIds, requireAllTags);
            }
            
            // Apply task view mode filters
            switch (taskViewMode) {
                case TaskViewMode.OnlySubtasks:
                    filteredTasks = filteredTasks.filter(task => !!task.parent_task);
                    break;
                case TaskViewMode.OnlyParentTasks:
                    filteredTasks = filteredTasks.filter(task => 
                        allTasksBackup.some(t => t.parent_task === task.id)
                    );
                    break;
            }
            
            // Apply search query - search in title, description, and tags
            filteredTasks = filteredTasks.filter(task => {
                // Check if task belongs to this column
                const belongsInColumn = col.status === statusMapping[task.status] || 
                                      (reverseStatusMapping[task.status] && 
                                       reverseStatusMapping[task.status].includes(col.title));
                
                if (!belongsInColumn) return false;
                
                // Search in title
                if (task.title.toLowerCase().includes(normalizedQuery)) return true;
                
                // Search in description
                if (task.taskDescription?.toLowerCase().includes(normalizedQuery)) return true;
                
                // Search in tags
                const taskTags = $tags.filter(tag => task.tags.includes(tag.id));
                if (taskTags.some(tag => tag.name.toLowerCase().includes(normalizedQuery))) return true;
                
                // Search by priority
                if (task.priority.toLowerCase().includes(normalizedQuery)) return true;
                
                // Search by creator or assignee name (async, but works for pre-loaded names)
                if (userNameCache.has(task.createdBy) && 
                    userNameCache.get(task.createdBy)?.toLowerCase().includes(normalizedQuery)) return true;
                
                if (task.assignedTo && userNameCache.has(task.assignedTo) && 
                    userNameCache.get(task.assignedTo)?.toLowerCase().includes(normalizedQuery)) return true;
                
                return false;
            });
            
            return { ...col, tasks: filteredTasks };
        });
    });
}
async function togglePriority(task: KanbanTask, event: MouseEvent) {
    event.stopPropagation();
    
    const priorities = ['low', 'medium', 'high'];
    const currentIndex = priorities.indexOf(task.priority);
    const nextIndex = (currentIndex + 1) % priorities.length;
    const newPriority = priorities[nextIndex];
    
    columns.update(cols => {
        return cols.map(col => ({
            ...col,
            tasks: col.tasks.map(t => 
                t.id === task.id ? { ...t, priority: newPriority } : t
            )
        }));
    });
    allTasksBackup = allTasksBackup.map(t => 
    t.id === task.id ? { ...t, priority: newPriority } : t
    );
        if (selectedTask && selectedTask.id === task.id) {
        selectedTask = { ...selectedTask, priority: newPriority };
    }
    
    // Update in the backend
    try {
        await updateTask(task.id, { ...task, priority: newPriority });
    } catch (err) {
        console.error('Error updating task priority:', err);
        // Revert back if the update fails
        columns.update(cols => {
            return cols.map(col => ({
                ...col,
                tasks: col.tasks.map(t => 
                    t.id === task.id ? { ...t, priority: task.priority } : t
                )
            }));
        });
    }
}
function applyPriorityFilter() {
    columns.update(cols => {
        if (!cols) return cols;
        
        if (priorityViewActive) {
            return cols.map(col => ({
                ...col,
                tasks: col.tasks.filter(task => task.priority === 'high')
            }));
        } else {
            // Reset from backup
            return getColumnTasksFromBackup();
        }
    });
}
function getColumnTasksFromBackup() {
    return get(columns).map(col => ({
        ...col,
        tasks: allTasksBackup.filter(task => {
            const targetColumns = reverseStatusMapping[task.status] || ['Backlog'];
            return targetColumns.includes(col.title);
        })
    }));
}
function togglePriorityView(event: MouseEvent) {
    event.stopPropagation();
    
    // Ensure all columns are open when applying priority filters
    if (taskViewMode === TaskViewMode.All) {
        if (!allColumnsOpen) {
            toggleAllColumns();
        }
    }
    
    switch (taskViewMode) {
        case TaskViewMode.highPriority:
            toggleTaskView(TaskViewMode.mediumPriority);
            break;
        case TaskViewMode.mediumPriority:
            toggleTaskView(TaskViewMode.LowPriority);
            break;
        case TaskViewMode.LowPriority:
            toggleTaskView(TaskViewMode.All);
            break;
        default:
            toggleTaskView(TaskViewMode.highPriority);
    }
}

// Get all tags for a specific task, with selected tags first
function getOrderedTaskTags(task: KanbanTask, allTags: Tag[]): Tag[] {
    if (!task.tags || task.tags.length === 0) {
        // If no tags are selected, return all tags
        return allTags;
    }
    
    // Get tags that are selected for this task
    const selectedTags = allTags.filter(tag => task.tags.includes(tag.id));
    
    // Get tags that are not selected for this task
    const unselectedTags = allTags.filter(tag => !task.tags.includes(tag.id));
    
    // Return selected tags first, then unselected tags
    return [...selectedTags, ...unselectedTags];
}
/**
 * Handles date scrolling with threshold and sensitivity controls
 * @param event The wheel event
 * @param date The date to modify
 * @param part Which part of the date to modify ('day', 'month', 'year')
 * @param task The task object that will be updated
 * @param dateType Whether this is 'start_date' or 'due_date'
 */
function handleDateScroll(
    event: WheelEvent, 
    date: Date, 
    part: 'day' | 'month' | 'year', 
    task: KanbanTask, 
    dateType: 'start_date' | 'due_date'
): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Store scroll accumulation in a closure to track between events
    if (!task._scrollAccumulation) {
        task._scrollAccumulation = { day: 0, month: 0, year: 0 };
    }
    
    // Different sensitivity levels based on part
    let sensitivity = 1;
    switch (part) {
        case 'day':
            sensitivity = event.shiftKey ? 0.01 : 0.1;
            break;
        case 'month':
            sensitivity = event.shiftKey ? 0.01 : 0.1;
            break;
        case 'year':
            sensitivity = event.shiftKey ? 0.01 : 0.1;
            break;
    }
    
    // Calculate delta and add to accumulated value
    const delta = event.deltaY > 0 ? -1 : 1;
    task._scrollAccumulation[part] += (delta * sensitivity);
    
    // Check if we've crossed the threshold to actually change the date
    if (Math.abs(task._scrollAccumulation[part]) >= 1) {
        // Round to the nearest integer and get its sign
        const change = Math.sign(task._scrollAccumulation[part]);
        
        // Apply the change to the date
        const newDate = new Date(date);
        switch (part) {
            case 'day':
                newDate.setDate(newDate.getDate() + change);
                break;
            case 'month':
                newDate.setMonth(newDate.getMonth() + change);
                break;
            case 'year':
                newDate.setFullYear(newDate.getFullYear() + change);
                break;
        }
        
        // Reset the accumulation to the remainder after applying
        task._scrollAccumulation[part] %= 1;
        
        // Update the task with the new date
        if (dateType === 'start_date') {
            task.start_date = newDate;
        } else {
            task.due_date = newDate;
        }
        
        // Update task in the UI and backend
        columns.update(cols => {
            return cols.map(col => ({
                ...col,
                tasks: col.tasks.map(t => t.id === task.id ? { ...t, [dateType]: newDate } : t)
            }));
        });
        
        // Debounce the API update to avoid too many requests
        if (task._updateTimeout) {
            clearTimeout(task._updateTimeout);
        }
        
        task._updateTimeout = setTimeout(() => {
            updateTask(task.id, { ...task });
            delete task._updateTimeout;
        }, 500);
    }
}

// Function to start editing a date
function startDateEditing(dateType: 'start' | 'due') {
    editingDateType = dateType;
    
    // Set initial values based on current date
    const currentDate = dateType === 'start' 
        ? selectedTask?.start_date 
        : selectedTask?.due_date;
    
    if (currentDate) {
        editingYear = currentDate.getFullYear();
        editingMonth = currentDate.getMonth();
        editingDay = currentDate.getDate();
    } else {
        // Default to today if no date is set
        const today = new Date();
        editingYear = today.getFullYear();
        editingMonth = today.getMonth();
        editingDay = today.getDate();
    }
    
    // Set the editing flag
    if (dateType === 'start') {
        isEditingStartDate = true;
    } else {
        isEditingDueDate = true;
    }
}

// Function to save edited date
function saveEditedDate() {
    if (!selectedTask || !editingDateType || editingYear === null || editingMonth === null || editingDay === null) return;
    
    // Create new date
    const newDate = new Date(editingYear, editingMonth, editingDay);
    
    // Update the task
    if (editingDateType === 'start') {
        selectedTask.start_date = newDate;
        isEditingStartDate = false;
    } else {
        selectedTask.due_date = newDate;
        isEditingDueDate = false;
    }
    
    // Reset editing state
    editingDateType = null;
    editingYear = null;
    editingMonth = null;
    editingDay = null;
    
    // Force reactivity update
    selectedTask = { ...selectedTask };
}

// Function to cancel date editing
function cancelDateEditing() {
    isEditingStartDate = false;
    isEditingDueDate = false;
    editingDateType = null;
    editingYear = null;
    editingMonth = null;
    editingDay = null;
}
function updateBackup(taskId: string, newTags: string[]) {
    allTasksBackup = allTasksBackup.map(task => 
        task.id === taskId ? { ...task, tags: newTags } : task
    );
}
function handleTaskListScroll(e: WheelEvent) {
    if (e.shiftKey) {
        e.preventDefault();
        const taskList = e.currentTarget as HTMLElement;
        taskList.scrollLeft += e.deltaY;
    }
}
function handleTagClick(event: MouseEvent, task: KanbanTask, tag: Tag) {
    event.stopPropagation();
    
    const newTags = task.tags.includes(tag.id) 
        ? task.tags.filter(id => id !== tag.id)
        : [...task.tags, tag.id];
    
    // Update columns
    columns.update(cols => {
        return cols.map(col => ({
            ...col,
            tasks: col.tasks.map(t => 
                t.id === task.id ? { ...t, tags: newTags } : t
            )
        }));
    });
    
    // Update backup
    updateBackup(task.id, newTags);
    
    // Update backend
    updateTaskTags(task.id, newTags);
}
$: hasProjectContext = (selectedTask && selectedTask.project_id && selectedTask.project_id !== '') || 
                         (currentProjectId && currentProjectId !== '');

    $: {
        if (currentProjectId) {
            loadData();
        } else {
            loadData();
        }
    }

    $: taskTags = selectedTask ? $tags.filter(tag => selectedTask.tags.includes(tag.id)) : [];
    $: columnCounts = $columns.reduce((acc, column) => {
    acc[column.status] = column.tasks.length;
    return acc;
}, {});

$: totalTaskCount = allTasksBackup.length;

$: parentTaskCount = allTasksBackup.filter(task => 
    allTasksBackup.some(t => t.parent_task === task.id)
).length;

$: subtaskCount = allTasksBackup.filter(task => !!task.parent_task).length;

$: highPriorityCount = allTasksBackup.filter(task => task.priority === 'high').length;
$: mediumPriorityCount = allTasksBackup.filter(task => task.priority === 'medium').length;
$: lowPriorityCount = allTasksBackup.filter(task => task.priority === 'low').length;
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

<div class="global-input-container" 
>
    <div class="view-controls">
        <div class="tooltip-container">
            <span class="shared-tooltip" class:visible={hoveredButton === 'all'}>
                {$t('generic.show')} {$t('generic.all')} {$t('tasks.tasks')}
            </span>
            <span class="shared-tooltip" class:visible={hoveredButton === 'parents'}>
                {$t('generic.show')} {$t('tasks.parent')} {$t('tasks.tasks')} {$t('generic.only')}
            </span>
            <span class="shared-tooltip" class:visible={hoveredButton === 'subtasks'}>
                {$t('generic.show')} {$t('tasks.subtasks')} {$t('dates.days')}
            </span>
        </div>

<button 
    class="priority-toggle {taskViewMode === TaskViewMode.highPriority ? 'high' : 
                          taskViewMode === TaskViewMode.mediumPriority ? 'medium' : 
                          taskViewMode === TaskViewMode.LowPriority ? 'low' : ''}"
    on:click={(e) => togglePriorityView(e)}
    title="Toggle priority view"
>
    <Flag class={[TaskViewMode.highPriority, TaskViewMode.mediumPriority, TaskViewMode.LowPriority].includes(taskViewMode) ? 'active' : ''}/>
    {#if taskViewMode === TaskViewMode.highPriority}
        <span></span>
        <span class="count-badge">{highPriorityCount}</span>
    {:else if taskViewMode === TaskViewMode.mediumPriority}
        <span></span>
        <span class="count-badge">{mediumPriorityCount}</span>
    {:else if taskViewMode === TaskViewMode.LowPriority}
        <span></span>
        <span class="count-badge">{lowPriorityCount}</span>
    {/if}
</button>
           <button 
        class:active={taskViewMode === TaskViewMode.All} 
        on:click={() => toggleTaskView(TaskViewMode.All)}
        on:mouseenter={() => hoveredButton = 'all'}
        on:mouseleave={() => hoveredButton = null}
    >
        <ListCollapse/>
        <span class="count-badge">{totalTaskCount}</span>
    </button>
    <button 
        class:active={taskViewMode === TaskViewMode.OnlyParentTasks} 
        on:click={() => toggleTaskView(TaskViewMode.OnlyParentTasks)}
        on:mouseenter={() => hoveredButton = 'parents'}
        on:mouseleave={() => hoveredButton = null}
    >
        <FolderGit/>
        <span class="count-badge">{parentTaskCount}</span>
    </button>
    <button 
        class:active={taskViewMode === TaskViewMode.OnlySubtasks} 
        on:click={() => toggleTaskView(TaskViewMode.OnlySubtasks)}
        on:mouseenter={() => hoveredButton = 'subtasks'}
        on:mouseleave={() => hoveredButton = null}
    >
        <GitFork/>
        <span class="count-badge">{subtaskCount}</span>
    </button>
    <button 
        class="filter-toggle"
        class:active={showTagFilter} 
        on:click={toggleTagFilter}
        title="Tags"
    >
        <Filter/>
    </button>

    </div>
        {#if showTagFilter}
        <div class="tag-filter-container" in:slide={{ duration: 150 }}>
            <div class="tag-filter-options">
                <TagsDropdown 
                    bind:selectedTags={selectedTagIds}
                    currentProjectId={currentProjectId}
                    mode="task"
                    isFilterMode={true}
                    placeholder="Tags"
                    showSelectedCount={true}
                    on:tagsChanged={handleTagsChanged}
                />
                
                <div class="match-options">
                    <label class="toggle-label">
                        <input 
                            type="checkbox" 
                            bind:checked={requireAllTags}
                            on:change={toggleRequireAllTags}
                        />
                        <span>{$t('generic.match')}</span>
                    </label>
                </div>
            </div>
            
            <!-- Show active filters summary -->
            {#if selectedTagIds.length > 0}
                <div class="active-filters" transition:slide={{ duration: 150 }}>
                    <span class="filter-label">{$t('generic.filter')}</span>
                    <div class="filter-tags">
                        {#each $tags.filter(tag => selectedTagIds.includes(tag.id)) as tag}
                            <span class="filter-tag" style="background-color: {tag.color}">
                                {tag.name}
                            </span>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    {/if}

    <div class="global-task-input">
        <span>
            <Search/>
        </span>
        <input transition:fade={{ duration: 150 }}
            type="text" 
            bind:value={searchQuery}
            on:input={() => {
                searchTasks(searchQuery);
                if (searchQuery && !allColumnsOpen) {
                    toggleAllColumns();
                }
            }}
            placeholder={$t('nav.search')}
            class="search-input"
            />
            {#if searchQuery}
                <button class="clear-search" on:click={() => { 
                    searchQuery = ''; 
                    applyFilters(); 
                }}>
                    ✕
                </button>
            {/if}
    </div>
        <div class="global-task-input">
        <span>
            <PlusCircle/>
        </span>
        <textarea 
            placeholder={$t('tasks.add')} 
            on:keydown={(e) => addGlobalTask(e)}
            class="global-task-input"
        ></textarea>
    </div>
</div>
<div class="kanban-container" in:fly={{ y: -400, duration: 400 }} out:fade={{ duration: 300 }}
>
              {#if $showThreadList}

<div class="column-view-controls">
  <button 
    class="toggle-btn columns {allColumnsOpen ? 'active' : ''}"
    on:click={toggleAllColumns}
    aria-label={allColumnsOpen ? $t('generic.collapseAll') : $t('generic.expandAll')}
  >									

    <span class="toggle-icon">
      {#if allColumnsOpen}
        <EyeOff size={16} />
      {:else}
        <Layers size={16} />
      {/if}
    </span>
    <span class="toggle-label">
      {allColumnsOpen ? $t('button.tags') :$t('button.tags')}
    </span>
  </button>
  
{#each $columns as column}
    <button 
        class="toggle-btn toggle-{column.status} {column.isOpen ? 'active-'+column.status : ''}"
        on:click={() => toggleColumn(column.id)}
        on:dragover={(e) => handleButtonDragOver(e, column.id)}
        on:dragleave={handleButtonDragLeave}
        on:drop={(e) => handleButtonDrop(e, column.id)}
    >
        <span>{column.title}</span>
        {#if column.tasks.length > 0}
            <span class="count-badge">{column.tasks.length}</span>
        {/if}
    </button>
{/each}
</div>
{/if}
<div class="kanban-board" >
    {#each $columns as column}
    <div class="kanban-column column-{column.status} {column.isOpen ? 'expanded' : 'collapsed'}" 
         on:dragover={handleDragOver} 
        in:fly={{ x: -400, duration: 400 }} out:fly={{ x: -100,duration: 300 }}         
        on:drop={(e) => handleDrop(e, column.id)}

        >            
         <!-- <button type="button" class="column-header header-{column.status} {column.isOpen ? 'active-'+column.status : ''}" on:click={() => toggleColumn(column.id)}>
            </button> -->
            
            {#if column.isOpen}
                <div class="task-list"
                    in:slide={{ duration: 300, axis: 'x' }}
                    out:slide={{ duration: 300, easing: elasticOut, axis: 'x' }}

                >
                    <span class="column-title">
                        {column.title}
                    </span>

                    {#each column.tasks as task}
                        <div 
                            class="task-card status-{task.status}" 
                            draggable="true" 
                            on:dragstart={(e) => handleDragStart(e, task.id, column.id)}
                            on:dragend={handleDragEnd}
                            on:click={(e) => openModal(task, e)}
                        >
                            <h4>
                                {@html processWordMinimize(task.title)}
                            </h4>

                            {#if task.parent_task}
                                <div class="task-badge">
                                    {#await getParentTaskTitle(task.parent_task) then title}
                                        {title}
                                    {/await}
                                </div>
                            {/if}

                            <p class="description">{task.taskDescription}</p>

<!-- Replace the existing task-creator code block in your card view -->
{#if task.createdBy}
    <div class="task-creator">
        {#if hasSubtasks(task.id)}
            <div class="task-badge subtasks">
                <span class="task-icon">
                    <ClipboardList/>
                </span>
                {countSubtasks(task.id)} 
                <span>{$t('tasks.subtasks')}</span>
            </div>
        {/if}
    
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
        
        <span>
    {#if task.assignedTo}
        <img 
            src={`/api/users/${task.assignedTo}/avatar`} 
            alt="Avatar" 
            class="user-avatar"
            on:error={(e) => e.target.style.display = 'none'}
        />
        <span class="avatar-initials" style="display: none;">
            {#await getUserName(task.assignedTo) then username}
                {username?.charAt(0)?.toUpperCase() || 'U'}
            {/await}
        </span>
        <span class="username">
            {#await getUserName(task.assignedTo) then username}
                {username || $t('tasks.assigned')}
            {/await}
        </span>
    {:else}
        <span class="no-assignment">{$t('tasks.notAssigned')}</span>
    {/if}
</span>
        
        <!-- Priority flag with click to toggle -->
        <span 
            class="priority-flag {task.priority}"
            on:click={(e) => togglePriority(task, e)}
            title={$t('posts.reposted')} 
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
              <line x1="4" y1="22" x2="4" y2="15"></line>
            </svg>
            <span class="priority-name">
                {task.priority}
            </span>
        </span>
        

<div class="tag-list" on:click={(e) => e.stopPropagation()}>
    {#each $tags as tag}
        <span 
            class="tag-card {task.tags.includes(tag.id) ? 'selected' : 'unselected'}" 
            style="background-color: {task.tags.includes(tag.id) ? tag.color : 'rgba(128,128,128,0.2)'}"
            on:click={(e) => handleTagClick(e, task, tag)}
        >
            {tag.name}
        </span>
    {/each}
    <TagIcon size="16"/>
    {#if task.tags.length > 0}
        <span class="tag-count">{task.tags.length}</span>
    {/if}
</div>
    </div>
            <span class="timeline-container">
                <span class="timeline-wrapper">

            {#if task.start_date}
                {@const daysUntilStart = Math.ceil((task.start_date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
                {#if daysUntilStart < 0}
                    <span class="date-status overdue">{$t('tasks.postponed')} {Math.abs(daysUntilStart)} {$t('dates.days')}</span>
                {:else if daysUntilStart === 0}
                    <span class="date-status due-today">{$t('tasks.start')} {$t('dates.today')}</span>
                {:else if daysUntilStart <= 30}
                    <span class="date-status upcoming">Starts in {daysUntilStart} {daysUntilStart === 1 ? $t('dates.day') : $t('dates.days')}</span>
                {/if}
            {/if}

            {#if task.start_date}
                <div class="timeline">
                    <span 
                        class="date-part" 
                        on:wheel={(e) => handleDateScroll(e, task.start_date, $t('dates.day'), task, 'start_date')}
                        title="Scroll to change day (hold Shift for precision)"
                    >{task.start_date.getDate()}</span>
                    <span 
                        class="month-part"
                        on:wheel={(e) => handleDateScroll(e, task.start_date, $t('dates.month'), task, 'start_date')}
                        title="Scroll to change month (hold Shift for precision)"
                    >{task.start_date.toLocaleString('default', { month: 'short' })}</span>
                    <span 
                        class="year-part"
                        on:wheel={(e) => handleDateScroll(e, task.start_date, $t('dates.year'), task, 'start_date')}
                        title="Scroll to change year (hold Shift for precision)"
                    >{task.start_date.getFullYear()}</span>
                </div>
            {/if}
                <!-- <span class="timeline">
                    <ArrowDown/>

                </span> -->
                </span>
                    <span class="timeline-wrapper">




            <!-- Display date status (overdue, due today, upcoming) -->
            {#if task.due_date}
                {@const daysUntilDue = Math.ceil((task.due_date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
                {#if daysUntilDue < 0}
                    <span class="date-status overdue">{$t('tasks.hold')} {Math.abs(daysUntilDue)} {$t('dates.days')}</span>
                {:else if daysUntilDue === 0}
                    <span class="date-status due-today">{$t('tasks.due')} {$t('dates.today')}</span>
                {:else if daysUntilDue <= 30}
                    <span class="date-status upcoming">Review in {daysUntilDue} {daysUntilDue === 1 ?$t('dates.day'): $t('dates.days')}</span>
                {/if}
            {/if}
                {#if task.due_date}
                <div class="timeline">
                    <span 
                        class="date-part"
                        on:wheel={(e) => handleDateScroll(e, task.due_date, $t('dates.day'), task, 'due_date')}
                        title="Scroll to change day (hold Shift for precision)"
                    >{task.due_date.getDate()}</span>
                    <span 
                        class="month-part"
                        on:wheel={(e) => handleDateScroll(e, task.due_date, $t('dates.month'), task, 'due_date')}
                        title="Scroll to change month (hold Shift for precision)"
                    >{task.due_date.toLocaleString('default', { month: 'short' })}</span>
                    <span 
                        class="year-part"
                        on:wheel={(e) => handleDateScroll(e, task.due_date,$t('dates.year'), task, 'due_date')}
                        title="Scroll to change year (hold Shift for precision)"
                    >{task.due_date.getFullYear()}</span>
                </div>
            {/if}
            </span>
        </span>
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
        <div class="modal-content"     
            class:task-changing={taskTransition}
            on:click|stopPropagation 
             in:slide={{ duration: 300, axis: 'x' }}
             out:slide={{ duration: 300, easing: elasticOut, axis: 'x' }}
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
                                {@html processWordMinimize(selectedTask.title)}

                        </h1>
                    {/if}


            </div>
                        <div class="modal-header">
                <div class="assignment-section">
                    <AssignButton 
                        taskId={selectedTask.id} 
                        assignedTo={selectedTask.assignedTo || ''} 
                        projectId={selectedTask.project_id || currentProjectId}
                        on:assigned={(e) => handleTaskAssigned(e.detail)} 
                        on:unassigned={() => handleTaskUnassigned(selectedTask.id)}
                    />
                </div>
                <span 
                    class="priority-flag modal {selectedTask.priority}"
                    on:click={(e) => togglePriority(selectedTask, e)}
                    title="Click to change priority"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                    <line x1="4" y1="22" x2="4" y2="15"></line>
                    </svg>
                    <span class="priority-name">
                        {selectedTask.priority}
                    </span>
                </span>
            </div>
                            <div class="tag-section">
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
                        {#if showAddTag}
                            <input 
                                type="text" 
                                bind:value={newTagName} 
                                bind:this={addTagInput}
                                placeholder="Add tag"
                                on:blur={handleInputBlur}
                                on:keydown={(e) => e.key === 'Enter' && addTag()}
                            >
                        {/if}
                        <button on:click={showAddTag ? addTag : toggleAddTag}>
                            {#if showAddTag}
                            <ChevronLeft/>
                            {:else}
                                <Tags/> +

                            {/if}
                        </button>
                    </div>
            </div>
                <div class="description-section">
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
                         {capitalizeFirst(selectedTask.taskDescription || $t('tasks.addDescription'))}
                    </div>
                {/if}
                
                </div>
            <!-- Add Assignment Section after title - only if we have a valid project context -->


            
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
                                <div class="subtask-title">
                                    {processWordCrop(subtask.title)}
                                </div>
                                <div class="subtask-status">{subtask.status}</div>
                                    <ChevronRight size="16"/>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
            <div class="attachment-section">
                <p>{$t('generic.attachments')}:</p>
                <input type="file" on:change={handleFileUpload} multiple>
                <div class="attachment-list">
                    {#each selectedTask.attachments as attachment}
                        <a href={attachment.url} target="_blank" rel="noopener noreferrer">{attachment.name}</a>
                    {/each}
                </div>
            </div>

            <div class="start-section">
                <span class="timer">
                    <p>{$t('tasks.start')}:</p>
                    {selectedTask.start_date ? selectedTask.start_date.toLocaleDateString() : $t('tasks.selectStart')}
                </span>
                <div class="timer-controls">
                    <button class="play"
                        on:click={() => setQuickStart(0)}
                        class:selected={selectedStart === 0}
                    >
                        <span>
                            <CirclePlay size="20"/>
                            {$t('dates.now')}
                        </span>
                    </button>
                    <button 
                        on:click={() => setQuickStart(1)}
                        class:selected={selectedStart === 1}
                    >{$t('dates.today')}</button>
                    <button 
                        on:click={setEndOfWeekStart}
                        class:selected={selectedStart === 'endOfWeek'}
                    >{$t('dates.endWeek')}</button>
                    <button 
                        on:click={() => setQuickStart(7)}
                        class:selected={selectedStart === 7}
                    >1 {$t('dates.week')}</button>
                    <button 
                        on:click={() => setQuickStart(14)}
                        class:selected={selectedStart === 14}
                    >2 {$t('dates.weeks')}</button>
                    <button 
                        on:click={() => setQuickStart(30)}
                        class:selected={selectedStart === 30}
                    >1 {$t('dates.months')}</button>
                </div>
            </div>
            <div class="deadline-section">
                <span class="timer">
                    <p>{$t('tasks.deadline')}</p>
                    {selectedTask.due_date ? selectedTask.due_date.toLocaleDateString() : $t('tasks.selectEnd')}
                </span>
                <div class="timer-controls">
                    <button 
                        on:click={() => setQuickDeadline(0)}
                        class:selected={selectedDeadline === 0}
                    >{$t('dates.today')}</button>
                    <button 
                        on:click={() => setQuickDeadline(1)}
                        class:selected={selectedDeadline === 1}
                    >{$t('dates.tomorrow')}</button>
                    <button 
                        on:click={setEndOfWeekDeadline}
                        class:selected={selectedDeadline === 'endOfWeek'}
                    >{$t('dates.endWeek')}</button>
                    <button 
                        on:click={() => setQuickDeadline(7)}
                        class:selected={selectedDeadline === 7}
                    >1 {$t('dates.week')}</button>
                    <button 
                        on:click={() => setQuickDeadline(14)}
                        class:selected={selectedDeadline === 14}
                    >2 {$t('dates.weeks')}</button>
                    <button 
                        on:click={() => setQuickDeadline(30)}
                        class:selected={selectedDeadline === 30}
                    >1 {$t('dates.month')}</button>
                </div>
            </div>


            <div class="submit-section">

                <p>{$t('generic.created')}: {selectedTask.creationDate.toLocaleDateString()}</p>
                <div class="button-group">
                    <button class="done-button" on:click={saveAndCloseModal}>{$t('tasks.done')}</button>
                    <button class="delete-task-btn" on:click={(e) => openDeleteConfirm(selectedTask.id, e)}>
                        <Trash2 /> 
                        <span>{$t('generic.delete')}</span>
                    </button>
                </div>    
            </div>
        </div>
    </div>
{/if}


{#if isDeleteConfirmOpen}
    <div class="confirm-delete-overlay">
        <div class="confirm-delete-modal">
            <h3>{$t('generic.delete')} {$t('tasks.task')}</h3>
            <p>{$t('generic.deleteQuestion')} {$t('generic.deleteWarning')}</p>
            
            <div class="confirm-buttons">
                <button class="cancel-btn" on:click={cancelDelete}>{$t('generic.cancel')}</button>
                <button class="confirm-btn" on:click={confirmDelete}>{$t('generic.delete')}</button>
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

    :root {
        --color-backlog: var(--primary-color);
        --color-todo:  red;    
        --color-inprogress:orange;  
        --color-review: yellow;
        --color-done:  green;     
        --color-hold: #f3e5f5;        
        --color-postpone: #ede7f6;   
        --color-delegate: #1389bf;    
        --color-cancel: var(--primary-color);      
        --color-archive: var(--placeholder-color);    

        
        --column-expanded-width: 400px;
        }

    .kanban-container {
        display: flex;
        flex-direction: row;
        transition: all 0.2s ease;
        height: auto;
        margin-left: 0rem !important;
        overflow-x: auto;
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
        letter-spacing: 0.2rem;
        transition: all 0.3s ease;

        &.description {
            color: var(--placeholder-color);
            letter-spacing: 0;
            font-weight: 100;
            font-size:0.8rem;
            line-height: 1.25;
            // max-height: 1rem;
            max-height: 10rem;
            overflow: hidden;
            text-align: left;
            margin-bottom: 0.5rem;
            padding: 0 0.5rem;
            display: none;

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
        width: calc(100% - 300px);
        height: 2rem !important;
        padding: 0;
        margin: 0;
        margin-left: auto;
        margin-right: 1rem;
        gap: 0.5rem;
        // box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        display: flex;
        justify-content: flex-end;
        align-items: center;
        height: auto;
        transition: all 0.2s ease;
        & textarea {
            display: flex;
            justify-content: center;
            align-items: center;
            text-align: left;
            height: auto;
            margin: 0;
            font-size: 0.9rem;
            height: 2rem !important;
            overflow-y: hidden;
        }

    }
    
    .spinner-container {
        position: fixed;
    }



    .global-task-input {
        width: auto;
        height: 2rem !important;
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 2rem;
        font-size: 1.2rem;
        margin-left: 0.5rem;
        background: var(--secondary-color);
        border-color: 1px solid var(--line-color);
        transition: all 0.2s ease;
        & span {
            color: var(--placeholder-color);
            display: flex;
            justify-content: center;
            align-items: center;
                            transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

        }
        & input {
            display: none;
            height: 2rem !important;
            padding: 0 ;
            line-height:2.5;
            padding-inline-start: 0.5rem;
            transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
            outline: none;
            border: 1px solid var(--line-color);
        }
        & textarea {
            display: none;
            height: 2rem !important;
            padding: 0 ;
            line-height:2.5;
            padding-inline-start: 0.5rem;
            transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
            outline: none;
            border: 1px solid var(--line-color);
        }
        &:hover {
            padding: 0.5rem;
            background: transparent;
            border-color: 1px solid transparent;
            & span {
                display: none;
            }
            & textarea {
                display: flex;
                transition: all 0.2s ease;
                width: 350px;
                margin-top: 0;
                border-radius: 1rem;
                height: 2rem !important;
                background: var(--primary-color);
                resize: vertical;   
                overflow-y: auto;   
                overflow-x: hidden; 
                white-space: pre-wrap; 
                word-wrap: break-word;
                line-height: 1;
                z-index: 1;
                padding: 0;
                padding-inline-start: 1rem;
                padding-top: 0.5rem;
            }
            & input {
                display: flex;
                transition: all 0.2s ease;
                width: 350px;
                margin-top: 0;
                border-radius: 1rem;
                height: 2rem !important;
                background: var(--primary-color);
                overflow-y: auto;   
                overflow-x: hidden; 
                line-height: 1;
                z-index: 1;
                padding: 0;
                padding-inline-start: 1rem;
            }
        }
    }
    
    .global-task-input:focus {
        outline: none;
        width: 100%;
        border-color: var(--tertiary-color);
        box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.4);
    }
    .kanban-board {
        display: flex;
        flex-direction: row;
        justify-content: stretch;
        align-items: stretch;
        gap: 0.5rem;
        overflow-x: scroll; 
        overflow-y: scroll;
        scrollbar-width: thin;
        scroll-behavior: smooth;
        scrollbar-color: var(--secondary-color) transparent;
        align-items: flex-start;
        width: 90vw;
        height: 95%;
        margin-left: 2rem;
        // backdrop-filter: blur(20px);
        border-radius: 2rem;
        // border: 1px solid var(--line-color);
        transition: all 0.3s ease;

    }
:global(.minimized-symbol) {
    color: var(--placeholder-color) !important;
    font-weight: bold;
    font-size: 0.9em;
    opacity: 0.8;
    // or any other styles you want just for the symbols
}
:global(.styled-word) {
    color: var(--tertiary-color) !important;
    font-weight: bold;
    font-size: 0.9em;
    opacity: 0.8;
    // or any other styles you want just for the symbols
}
    .kanban-column {
        border-radius: 5px;
        flex: 0 0 auto;
        display: flex;        
        flex-direction: column;
        justify-content: flex-start;
        width: calc(25%);
        transition: all 0.3s ease;
        // border: 1px solid var(--secondary-color);
        border-radius: 2rem;
        transition: all 0.3s ease;
        height: 100vh;

        &:hover {
            // border: 1px solid var(--secondary-color);
            background: var(--primary-color);
        }

    }
    .column-title {
        padding: 0.5rem;
        line-height: 2;
        border-bottom: 1px solid var(--line-color) !important;
        font-size: 0.8rem;
        text-align: center;
        letter-spacing: 0.2rem;
        width: calc(100% - 2rem);

        margin-top: 0;
        margin-bottom: 0.25rem;

    }


        .column-backlog,
    .column-todo,
    .column-inprogress,
    .column-done,
    .column-review,
    .column-hold,
    .column-postpone,

    .column-delegate,
        .column-cancel,

     .column-archive {


        width: auto;
    }

.task-card.status-backlog {
  border: 1px solid  var(--color-backlog);
}
.task-card.status-todo {
//   border: 1px solid var(--color-todo);
    box-shadow: 1px 1px 1px 0px var(--color-todo);

}
.task-card.status-inprogress {
    box-shadow: 1px 1px 1px 0px var(--color-inprogress);
}
.task-card.status-review {
    box-shadow: 1px 1px 1px 0px var(--color-review);
}
.task-card.status-done {
    box-shadow: 1px 1px 1px 0px var(--color-done);
}
.task-card.status-hold {
    box-shadow: 1px 1px 1px 0px var(--color-hold);
}
.task-card.status-postpone {
    box-shadow: 1px 1px 1px 0px var(--color-postpone);
}
.task-card.status-delegate {
    box-shadow: 1px 1px 1px 0px var(--color-delegate);
}
.task-card.status-cancel {
    box-shadow: 1px 1px 1px 0px var(--color-cancel);
}
.task-card.status-archive {
    box-shadow: 1px 1px 1px 0px var(--color-archive);
}

.active-backlog {
  box-shadow: inset 0 -3px 0 var(--color-backlog);
}
.active-todo {
  box-shadow: inset 0 -3px 0 var(--color-todo);
}
.active-inprogress {
  box-shadow: inset 0 -3px 0 var(--color-inprogress);
}
.active-review {
  box-shadow: inset 0 -3px 0 var(--color-review);
}
.active-done {
  box-shadow: inset 0 -3px 0 var(--color-done);
}
.active-hold {
  box-shadow: inset 0 -3px 0 var(--color-hold);
}
.active-postpone {
  box-shadow: inset 0 -3px 0 var(--color-postpone);
}
.active-delegate {
  box-shadow: inset 0 -3px 0 var(--color-delegate);
}
.active-cancel {
  box-shadow: inset 0 -3px 0 var(--color-cancel);
}
.active-archive {
  box-shadow: inset 0 -3px 0 var(--color-archive);
}

.kanban-column.expanded[class*="column-"] {
  flex: 0 0 var(--column-expanded-width);
  
}
// .kanban-column.column-cancel:has(.column-header.active-cancel) {
//   flex: 0 0 400px;
// }
// .kanban-column.column-archived:has(.column-header.active-archived) {
//   flex: 0 0 400px;
// }

// .kanban-column.column-backlog {
//   background-color: var(--color-backlog);
// }
// .kanban-column.column-todo {
//   background-color: var(--color-todo);
// }
// .kanban-column.column-inprogress {
//   background-color: var(--color-inprogress);
// }
// .kanban-column.column-review {
//   background-color: var(--color-review);
// }
// .kanban-column.column-done {
//   background-color: var(--color-done);
// }
// .kanban-column.column-hold {
//   background-color: var(--color-hold);
// }
// .kanban-column.column-postpone {
//   background-color: var(--color-postpone);
// }
// .kanban-column.column-delegate {
//   background-color: var(--color-delegate);
// }
// .kanban-column.column-cancel {
//   background-color: var(--color-cancel);
// }
// .kanban-column.column-archive {
//   background-color: var(--color-archive);
// }



.kanban-column.collapsed.column-backlog,
.kanban-column.collapsed.column-todo,
.kanban-column.collapsed.column-inprogress,
.kanban-column.collapsed.column-review,
.kanban-column.collapsed.column-done,
.kanban-column.collapsed.column-hold,
.kanban-column.collapsed.column-postpone,
.kanban-column.collapsed.column-delegate,
.kanban-column.collapsed.column-cancel,
.kanban-column.collapsed.column-archive {
    display: none;
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
            letter-spacing: 0.1rem;
        }
    }

    textarea {
        width: 100%;
        // padding: 0.5rem;
        align-items: center;
        justify-content: center;
        border-radius: 1rem;
        border: 1px solid var(--line-color) !important;
        background-color: var(--secondary-color);
        resize:none !important;
        color: var(--text-color);
        transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
        // font-size: 1.1em;

        &.selected {
            background-color: var(--line-color);
        }
    }

    textarea:hover {
        /* border: 1px solid #7cb87e; */
        // transform: scale(0.99);
    }

    .task-list {
        min-height: 100px;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        height: 100%;
        overflow-y: scroll;
        overflow-x: hidden;
        padding: 0 0.5rem;
        border-radius: 2rem;
        // border: 1px solid var(--secondary-color);



    }

    .title-section {

        textarea.title-input {
            background: var(--primary-color);
            font-size: 1.2rem;
            // padding: 0.5rem;
            // border: 1px solid var(--line-color);
            border-radius: 1rem;
            color: var(--text-color);
            text-align: left;
            margin: 0;
            height: 2rem;
            line-height: 1.5;
            padding: 0.5rem;

        }

        h1 {
            font-size: 1.8rem;
            // border: 1px solid var(--line-color);
            border-radius: 1rem;
            color: var(--text-color);
            text-align: left;
            margin: 0;
            text-transform: capitalize;
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
    .tag-section {
    display: flex;
    flex-direction: row !important;
    justify-content: space-between;
    margin: 0 !important;
    & .tag-list {
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        width: auto !important;
        
        &:hover {
            position: relative;
            padding: 2rem;
            transform: none;
            width: auto !important;
            background: var(--bg-color);
            border-radius: 2rem;
        }
    }
}

.attachment-section {
    border-radius: 1rem;
    border: 1px solid var(--line-color);
    padding: 1rem;
    width: auto !important;
    display: flex;
}

    .title-section,
    .start-section,
    .deadline-section,
    .attachment-section,
    .tag-section,
    .submit-section,
    .subtasks-section,
    .parent-task-section,
    .description-section {
        display: flex;
        flex-direction: column;
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
        // border: 1px solid var(--line-color);
        border-radius: 1rem;
        line-height: 1.5;
        // padding: 1rem;

    }
    .task-card {
        background: var(--secondary-color);
        border-radius: 1rem;
        margin-bottom: 0.5rem;
        cursor: move;
        display: flex;
        flex-direction: column;
        transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
        position: relative;
        height: auto;
        width: 100%;
        word-break: break-all;
        transition: all 0.3s ease;
        cursor: pointer;

        & h4 {
            max-height: 5rem;
            overflow: hidden;
        }
    }
    .task-card:active {
    cursor: grabbing !important;
        background: transparent;

}
.toggle-btn.drag-hover {
    cursor: pointer !important;
}
.task-card.dragging {
    cursor: grab !important;
    opacity: 0.5;
}

.toggle-btn.toggle-backlog.drag-hover, 
.toggle-btn.toggle-todo.drag-hover, 
.toggle-btn.toggle-inprogress.drag-hover, 
.toggle-btn.toggle-review.drag-hover, 
.toggle-btn.toggle-done.drag-hover, 
.toggle-btn.toggle-hold.drag-hover, 
.toggle-btn.toggle-postpone.drag-hover, 
.toggle-btn.toggle-delegate.drag-hover, 
.toggle-btn.toggle-cancel.drag-hover {
    background: var(--tertiary-color);
}
.toggle-btn.toggle-archive.drag-hover {
    background-color: #dc3545;
    z-index: 2000;
}
    .task-card:hover {
        // transform: scale(1.05) translateX(0) rotate(0deg);    
        box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
        padding: 0.5rem 0;
        z-index: 1;
        & h4 {

        }
        &.description {
            overflow: visible !important;
            padding: 0.5rem;
        }

        p.description {
            display: flex;
            height: auto !important;
            max-height: 30px !important;


        }
    }

    .task-card:active {
        transform: rotate(-3deg);
    }


    h4 {
  font-size: 0.8rem;
  line-height: 1.5;
  padding: 0.25rem 0.5rem;
  text-align: l;
  margin: 0;
  text-transform: capitalize;
//   white-space: pre-wrap;
//   overflow-wrap: break-word;
//   word-wrap: break-word;
//   word-break: normal;      
//   hyphens: auto;            
//   -webkit-hyphens: auto;   
//   -ms-hyphens: auto;    
//   -webkit-line-break: normal;
//   line-break: normal;
//   text-wrap: balance;       
}

    .tag-list {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 0 0.5rem;
        transition: all 0.3s ease;
        color: var(--placeholder-color);
        opacity: 1;

        &:hover {
            padding: 0.5rem;
            border-radius: 1rem;
            position: relative;
            width: calc(100% - 1rem) !important;
            background-color: var(--primary-color);
            backdrop-filter: blur(10px);

            & .tag-card {
                display: flex;
            }
            & .tag-card.unselected {
                opacity: 0.4;
                border: 1px solid #ccc;
            }

        }
        & .tag {
            color: var(--text-color);
            // opacity: 0.5;
            border: none;
            padding: 0.25rem;
            opacity: 0.5;
            border-radius: 1rem;
            font-size: 0.75rem;
            
            transition: all 0.3s ease;
            cursor: pointer;
            &:hover {
                opacity: 0.8;
            }
            &.selected {
            opacity: 1;
            font-weight: 800;
            box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
            }
        }
        & .tag-card {
            color: var(--text-color);
            letter-spacing: 0 !important;
            // opacity: 0.5;
            border: none;
            padding: 0.25rem;
            display: none;
            opacity: 1;
            border-radius: 1rem;
            font-size: 0.75rem;
            transition: all 0.3s ease;
            cursor: pointer;
        }
    }

    span.no-assignment {
        display: none !important;
    }

    .task-creator {
        display: flex;
        overflow: hidden;
        justify-content: flex-end;
        align-items: center;
        bottom: 0;
        left: 0;
        // border-top: 1px solid var(--line-color);
        gap: 0.5rem;
        // padding: 0.25rem 0rem;
        margin: 0;
        margin-top: 0.5rem;
        width: 100%;
        font-size: 0.8rem;
        transition: all 0.3s ease;
        span {
            display: flex;
            justify-content: center;
            align-items: center;
            transition: all 0.2s ease;

            &:hover {
                padding: 0.25rem;
                & .username {
                    display: flex;
                }
            }
        }
        & .username {
            display: none;
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

    .timeline-container {
        transition: all 0.3s ease;
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        gap: 0.25rem;
        padding: 0.5rem !important;
        width: auto;
        & span {
            display: flex;
            flex-direction: row;
        }
        & .timeline {
            display: none;
        }
        
        & .timeline-wrapper {
            display: flex;
            margin-left: 1rem;
            flex-direction: column;
            justify-content: flex-end;
            border-radius: 1rem;
            width:auto;
            padding: 0;
            transition: all 0.2s ease;
            &:hover {
                background-color: var(--primary-color);
                padding: 0.5rem;
                flex-grow: 1;
                           span {
                width: 100% !important;
            }
                            & .date-part {
                font-size: 2rem !important;
            }

            & .timeline {
                position: relative;
                align-items: center;
                display: flex;
                justify-content: center;
                flex-direction: row;
                // width: 8rem;
                display: flex;

                font-size: 1rem;
                background-color: row;
            }

            }
        }
        span.date-status.upcoming,
        span.date-status.overdue,
        span.date-status.due-today {
            padding: 0 !important;
            margin: 0 !important;
            display: flex;
            font-size: 0.7rem !important;
            justify-content: flex-end;
            letter-spacing: 0;
            color: var(--line-color);

        }
        &:hover {
            flex-direction: row;
            width: calc(100% - 2rem);
            margin-left: 1rem;
            padding: 0;
 
            span.date-status.upcoming,
            span.date-status.overdue,
            span.date-status.due-today {
            padding: 0 !important;
            margin: 0 !important;
            display: flex;
            font-size: 0.9rem !important;
            letter-spacing: 0;
            }

        
        }
    }

    .timeline {
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
.timeline-container .date-part,
.timeline-container .month-part,
.timeline-container .year-part {
    cursor: ns-resize;
    // padding: 0.5rem;
    border-radius: 0.5rem;
    transition: all 0.2s ease;
        text-align: center;
        display: flex;
        justify-content: center;

}

.timeline-container .date-part:hover,
.timeline-container .month-part:hover,
.timeline-container .year-part:hover {
        background-color: var(--tertiary-color) ;
        // padding: 0.5rem;
}

.timeline-container .date-part {
    min-width: 24px;
    text-align: center;
}

.timeline-container .month-part {
    min-width: 36px;
    text-align: center;
}

.timeline-container .year-part {
    min-width: 40px;
    text-align: center;
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

    .modal-header {
        display: flex;
        flex-direction: row;
        width: 100%;
        align-items: center;
        justify-content: space-between;
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
        backdrop-filter: blur(60px);
        color: var(--text-color);
        padding: 2rem;
        box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.4);
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: stretch;
        border-radius: 1rem 0 0 1rem;
        border: 1px solid var(--line-color);
        border-right: none !important;
        max-width: 600px;
        width: 100%;
        right: 0;
        top: 3rem;
        bottom: 1rem;
        height: auto;
        gap: 1rem;
        position: absolute;

    }



    .timer-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        & button.play {
            display: flex;
            justify-content: center;
            align-items: center;
            height: auto;
            width: auto;
            padding: 0 0.5rem;
            transition: all 0.2s ease;
            cursor: pointer;
            span {
                gap: 0.25rem;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            &:hover {
                background: var(--primary-color);
                span {
                    color: var(--text-color);
                }
            }

        }
    }

    .timer-controls input[type="date"] {
        flex-grow: 1;
        padding: 5px;
        border-radius: 5px;
        border: 1px solid #ddd;
        background-color: #3a3e3c;
        color: white;
    }

    .timer-controls button {
        padding:0.5rem;
        background: var(--secondary-color);
        color: var(--text-color);
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
        font-size: 0.9rem;
        &:hover {
                background: var(--primary-color);
                span {
                    color: var(--text-color);
                }
            }

    }

    .timer-controls button.selected {
        border: 2px solid var(--tertiary-color);
        background: var(--tertiary-color);
        color: var(--bg-color);
        box-shadow: 0px 1px 45px 1px rgba(255, 255, 255, 0.4);
        font-weight: 800;
    }



    span.timer {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.5rem;
        color: var(--placeholder-color);
        & p {
            color: var(--text-color);
            margin: 0;
            padding: 0;
        }
    }

    .add-tag {
        border-radius: 1rem;
        display: flex;
        gap: 0.5rem;
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        width: auto;
        
        transition: all 0.2s ease;
    }

    .add-tag input[type="text"] {
        flex-grow: 1;
        padding:0.5rem;
        border-radius:2rem;
        padding-inline-start: 1rem;
         border: none;
        background-color: #3a3e3c;
        color: white;
        font-size: 1rem;
         transition: all 0.2s ease;


    }

    .add-tag button {
        padding:0.5rem;
        width: auto;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.2rem;
        background: var(--secondary-color);
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.2s ease;

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
        gap: 1rem;
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

    .priority-flag.modal {
        display: flex;
        justify-content: center;
        width: 6rem !important;
        margin: 0;
        padding: 0.25rem;
        border-radius: 1rem;
        top: 0;
        right: 0;
        gap: 0.5rem;
        cursor: pointer;
    & .priority-name {
        display: flex;
        flex-direction: flex-start;
        align-items: center;
        justify-content: center;
        text-transform: uppercase;
        letter-spacing: 0.2rem;
        font-size: 0.6rem;
    }
    &:hover {
        padding: 0.25rem;
            border-radius: 1rem;
            position: relative;
            justify-content: center;
            background-color: var(--primary-color);
            backdrop-filter: none;

        & .priority-name {
            display: flex;
        }
    }

    .priority-flag {
    display: inline-flex;
    align-items: center;
    user-select: none;
    gap: 0.5rem;
    border-radius: 0.5rem;
    font-size: 0.6rem;
    letter-spacing: 0.1rem;
                user-select: none;

    & .priority-name {
        display: none;

    }
        &:hover {
            padding: 1rem;
            border-radius: 1rem;
            position: absolute;
            width: 100% !important;
            justify-content: center;
            background-color: var(--primary-color);
            backdrop-filter: blur(10px);

        & .priority-name {
            display: flex;
            user-select: none;

        }
    }
}
  }
    .priority-flag.low,
  .priority-flag.medium,
  .priority-flag.high {
    & span {
        display: none;
    }
    &:hover {
        & span {
            display: flex;
            user-select: none;

        }
    }
}

  .priority-flag.high {
    color: #e53935;
    background-color: rgba(229, 57, 53, 0.1);

  }
  
  .priority-flag.medium {
    color: #fb8c00;
    background-color: rgba(251, 140, 0, 0.1);

  }
  
  .priority-flag.low {
    color: #43a047;
    background-color: rgba(67, 160, 71, 0.1);

  }
    .task-badge {
        display: flex;
        width: auto;
    color: var(--tertiary-color);
    padding: 0 0.5rem;
    margin: 0;

    font-size: 0.75rem;
        
    cursor: pointer;

    &.subtasks {
        width: 100%;
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
        gap: 0.5rem;
        color: var(--placeholder-color);
        transition: all 0.2s ease;
        & span {
            display: none;
            &.task-icon {
                display: flex;
            }
        }
        &:hover {
            border-radius: 2rem;
            padding: 0.5rem 1rem;
            position: absolute;
            width: calc(100% - 2rem) !important;
            margin-left: 2rem;
            background-color: var(--primary-color);
            backdrop-filter: blur(10px);
            opacity: 1;
            & span {
                display: flex;
                
                &.task-icon {
                    display: none;
                }
            
            }
        }
    }
    &:hover {
        // background: var(--tertiary-color);
        color: var(--text-color);
    }
}




.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    user-select: none;
    &:hover {
            cursor: pointer;
            p {
                color: var(--tertiary-color);
            }
        }
}

.subtasks-list {
    width: 100%;
    display: flex;
    flex-direction: column;
}

.subtask-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    width: 100% !important;
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
    width: auto;
    background-color: var(--color-bg-secondary);
    gap: 0.5rem;
}



.view-controls button {
    display: flex;
    flex-direction: row;

    background-color: transparent;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--placeholder-color);

    &:hover {
        background: var(--secondary-color);
    }


}

.view-controls button.active {
    background-color: var(--primary-color);
    color: var(--tertiary-color);
    // border-color: var(--color-primary);
}



.priority-toggle.high {
    color: #dc3545;
}

.priority-toggle.medium {
    color: #fd7e14;
}

.priority-toggle.low {
    color: #28a745;
}

.column-view-controls {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    font-size: 0.5rem !important;
    margin-right: 0.5rem;
    gap: 0.5rem;

}

.count-badge {
    background:var(--secondary-color);
    border-radius: 12px;
    padding: 0.25rem;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 0.7rem;
}
.toggle-btn {
  padding: 0.5rem;
  border-radius: 4px;
  background: transparent;
  border: none;
  font-weight: 500;
  font-size: 0.7rem;
  width: auto;
  cursor: pointer;
  transition: all 0.2s ease;
  &.columns {
    display: flex;
    flex-direction: row;
  transition: all 0.2s ease;

    & .toggle-icon {
        color: var(--text-color);
        opacity: 0.5;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 2rem;
    }
    opacity: 0.5;
    & .toggle-label {
        display: flex;
    }
    &.active {
        opacity: 1;
    }
  }
  span {
    margin: 0;
    text-align: left;
    width: 100%;
  }
  &:hover {
    width: auto;
    transform: translateX(1rem);
    letter-spacing: 0.1rem;
  }
}

.toggle-btn.active-backlog,
.toggle-btn.active-todo,
.toggle-btn.active-inprogress,
.toggle-btn.active-review,
.toggle-btn.active-done,
.toggle-btn.active-hold,
.toggle-btn.active-postpone,
.toggle-btn.active-delegate,
.toggle-btn.active-cancel,
.toggle-btn.active-archive {
//   transform: translateY(2px);
//   box-shadow: 0 0 0 1x white inset;
  border-radius: 0.5rem;
  font-weight: 800;
  font-size: 0.8rem;
  letter-spacing: 0.1rem;
  background: var(--primary-color);
  
}
.tooltip-container {
    position: absolute;
    bottom: -0.5rem;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    pointer-events: none;
}

.shared-tooltip {
    background: var(--primary-color);
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
    bottom: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    transform: rotate(180deg);
    border-style: solid;
    border-color: var(--primary-color) transparent transparent transparent;
}

 .assignment-section {
    display: flex;
    align-items: center;
  }
  
  .assignment-section p {
    min-width: 100px;
    font-weight: 500;
  }

  .filter-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: 0.375rem;
        border: 1px solid var(--line-color);
        background-color: var(--bg-color);
        color: var(--text-color);
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .filter-toggle.active {
        background-color: var(--bg-color);
        border: 1px solid var(--line-color);
        border-radius: 0;
        border-top-left-radius: 0.5rem;
        border-bottom-left-radius: 0.5rem;
        color: var(--primary-color);
        border-right: none;
    }
    
    .tag-filter-container {
        width: auto;
        background-color: var(--bg-color);
        border-radius: 0.5rem;
        margin-right: 0.5rem;
    }
    
    .tag-filter-options {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
    
    .match-options {
        display: flex;
        align-items: center;
        background-color: red;
        width: auto;
        display: none;
    }
    
    .toggle-label {
        display: flex;
        align-items: center;
        cursor: pointer;
        font-size: 0.875rem;
        color: var(--text-color);
    }
    
    .toggle-label input {
        margin-right: 0.5rem;
    }
    
    .active-filters {
        margin-top: 0.75rem;
        border-top: 1px dashed var(--line-color);
        display: none;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
    }
    
    .filter-label {
        font-size: 0.75rem;
        color: var(--placeholder-color);
    }
    
    .filter-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    
    .filter-tag {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        color: white;
        font-weight: 500;
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

            right: -1rem;
            max-width: 350px;
            bottom: 5rem;
            overflow-y: scroll;
            overflow-x: hidden;
        }

        // .view-controls {
        //     padding: 0;
        //     margin: 0;
        // }
        // .view-controls button {
        //     display: flex;
        //     flex-direction: row;
        //     padding: 0.5rem;
        //     background-color: transparent;
        //     border: 1px solid var(--color-border);
        //     border-radius: 4px;
        //     cursor: pointer;
        //     transition: all 0.2s ease;
        //     color: var(--placeholder-color);
        //     &:hover {
        //         background: var(--secondary-color);
        //     }
        // }

        // .view-controls button.active {
        //     background-color: var(--color-primary);
        //     color: var(--tertiary-color);
        //     border-color: var(--color-primary);
        // }

    .kanban-container {
        display: flex;
        flex-direction: row;
        transition: all 0.2s ease;
        height: auto;
    }

            .kanban-column {
        border-radius: 5px;
        flex: 0 0 auto;
        display: flex;        
        flex-direction: column;
        justify-content: center;
        width: 100%;
        transition: all 0.3s ease;
        // border: 1px solid var(--secondary-color);
        border-radius: 1rem;
        transition: all 0.3s ease;

        &:hover {
            // border: 1px solid var(--secondary-color);
            background: var(--secondary-color);
        }

    }

        .kanban-column.expanded.column-backlog { flex: 0 0 150px; }
.kanban-column.expanded.column-todo { flex: 0 0 150px; }
.kanban-column.expanded.column-inprogress { flex: 0 0 150px; }
.kanban-column.expanded.column-review { flex: 0 0 150px; }
.kanban-column.expanded.column-done { flex: 0 0 150px; }
.kanban-column.expanded.column-hold { flex: 0 0 150px; }
.kanban-column.expanded.column-postpone { flex: 0 0 150px; }
.kanban-column.expanded.column-delegate { flex: 0 0 150px; }
.kanban-column.expanded.column-cancel { flex: 0 0 150px; }
.kanban-column.expanded.column-archive { flex: 0 0 150px; }
.kanban-column.column-cancel:has(.column-header.active-cancel) {
  flex: 0 0 150px;
}




.kanban-column {
    height: 100px !important;
            overflow-x: scroll;

}

.column-title {
      position: absolute;
      font-size: 1rem;
      padding-inline-start: 0.5rem;
      display: none;

}
.toggle-btn {
    width: auto;
    &:hover {
        transform: none;
        padding: 0.5rem;
        width: auto;
        transform:rotateY(30deg);
        box-shadow: 0px 1px 100px 1px rgba(255, 255, 255, 0.2);
        letter-spacing: 0.2rem;
    }
}
        .task-list {
            height: auto;
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        justify-content: stretch;
        align-items: stretch;
        overflow-y: hidden;
        gap: 0.5rem;
        margin-top: 0.5rem !important;
        width: 100% !important;


    }

.task-card {
    background: var(--secondary-color);
    border-radius: 1rem;
    margin-bottom: 0.5rem;
    cursor: move;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
    position: relative;
    flex: 1 1 280px;
    min-width: 200px;
    max-width: 250px; 
    //width may break horizontal shift scroll
    word-break: break-word;    
    transition: all 0.3s ease;
    &:hover {
        & .description-display {
            display: none;
        }
        & p.description-display {
            display: none;
        }
    
    }
    
}
    .task-card:hover {
        transform: translateX(0) translateY(0);
        padding: 0;
        // transform: scale(1.05) translateX(0) rotate(2deg);    
        box-shadow: none;
        // box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
        // border: 1px solid var(--line-color);
        border: 1px solid transparent;
        z-index: 1;
        & h4 {

        }
        &.description {
            overflow: visible !important;
            padding: 1rem;
            max-height: auto !important;
        }

        p.description {
            display: none;
            height: 100% !important;

        }
    }
    .task-creator {
    }

    .task-card:active {
        transform: rotate(-3deg);
    }

    .title-section {
        h1 {
            font-size: 1.4rem;
            // border: 1px solid var(--line-color);
            border-radius: 1rem;
            color: var(--text-color);
            text-align: left;
            margin: 0;
            text-transform: capitalize;
        }
    }
        .title-section,
        .start-section,
        .deadline-section,
        .attachment-section,
        .tag-section,
        .submit-section,
        .subtasks-section,
        .parent-task-section,
        .description-section {
            display: flex;
            flex-direction: column;
            max-width: 450px;
            width: auto !important;
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
        // border: 1px solid var(--line-color);
        border-radius: 1rem;
        padding: 1rem;

    }
    .timer-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 5px;
    }

    .timer-controls input[type="date"] {
        flex-grow: 1;
        padding: 5px;
        border-radius: 5px;
        border: 1px solid #ddd;
        background-color: #3a3e3c;
        color: white;
    }

    .timer-controls button {
        padding: 5px 10px;
        background: var(--secondary-color);
        color: var(--text-color);
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
        font-size: 0.9rem;
        line-height: 2;

    }

    .timer-controls button.selected {
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
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        width: auto;
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

    .tag-section {
        flex-direction: column !important;
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
            width: 100%;
            margin-right: 2rem;
            height: 90vh;
            border-radius: 2rem;
            border: 1px solid var(--line-color);
            padding: 0;
            margin: 0;
        }
        .kanban-column {
            max-width: 100%;
            display: flex;
            flex-direction: column;
        }




    }

    @media (max-width: 768px) {


        .global-input-container {
                justify-content: flex-start;
                align-items: center;
                width: 100%;
                margin: 0;
            }
        .global-task-input:focus {
            outline: none;
            position: relative;
            width: auto;
            border-color: var(--tertiary-color);
            box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.4);
        }

            .kanban-container {
            display: flex;
            flex-direction: column;
            transition: all 0.2s ease;
            height: auto;
        }

        .view-controls {
            gap: 1rem;
        }
        .kanban-board {
            height: 87vh;
        }
        .task-card {
        background: var(--secondary-color);
        border-radius: 1rem;
        margin-bottom: 0.5rem;
        cursor: move;
        width: 250px;
        transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
        position: relative;
        width: auto;
        word-break: break-all;
        transition: all 0.3s ease;
    }

    .task-card:hover {
        transform: translateX(1rem);
        // transform: scale(1.05) translateX(0) rotate(2deg);    
        box-shadow: none;
        // box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
        // border: 1px solid var(--line-color);
        border: 1px solid transparent;
        z-index: 1;
        & h4 {

        }
        &.description {
            overflow: visible !important;
            padding: 1rem;
            max-height: auto !important;
        }

        p.description {
            display: none;
            height: 100% !important;

        }
    }

    .task-card:active {
        transform: rotate(-1deg);
    }
.column-view-controls {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    align-items: flex-start;
    height: auto;
    flex-wrap: wrap;
    width: auto !important;
    font-size: 0.5rem !important;
    bottom: 0;
    

}

    h4 {
        font-size: 0.9rem;
        padding: 0 0.5rem;
        margin: 0;
        margin-top: 0.25rem;
    }
    }
    @media (max-width: 450px) {
        
        .kanban-container {
            flex-direction: column;
        }
    .modal-content {
        backdrop-filter: blur(60px);
        color: var(--text-color);
        padding: 2rem;
        box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.4);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: stretch;
        border-radius: 1rem;
        border: 1px solid var(--line-color);
        border-right: 1px solid var(--line-color) !important;
        max-width: auto !important;
        width: auto;
        right: 0rem;
        left: 0rem;
        overflow: hidden;
        top: 7rem;
        bottom: 23rem;
        height: auto;
        gap: 1rem;
        position: absolute;

    }
.column-view-controls {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    align-items: flex-start;
    position: absolute;
    z-index: 2000;
    height: auto;
    width: auto !important;
    font-size: 0.5rem !important;
    bottom: 0;
    

}

        .global-input-container {
            position: fixed;
            bottom: 4rem;
        }

        .global-task-input {
            position: fixed;
            background: var(--primary-color);
            bottom: 1rem;
            right: 1rem;
            left: 4rem;
            width: auto;
            z-index: 1;
            & span {
                display: none;
            }

            & textarea {
                display: flex;
                background-color: var(--secondary-color);
            }

        }
        .global-task-input:focus {
            position: fixed;
            background: var(--primary-color);
            bottom: 1.2rem;
            right: 1rem;
            left: 6rem;
            width: auto;
            z-index: 1;
            box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.4);
        }
        .view-controls {
        }
        .tooltip-container {
            display: none;
        }
        .kanban-board {
            height: 80vh !important;
        }



    }
</style>
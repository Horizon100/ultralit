<script lang="ts">
   import { writable, get } from 'svelte/store';
    import { slide, fade } from 'svelte/transition';
    import { currentUser } from '$lib/pocketbase';
    import { projectStore } from '$lib/stores/projectStore';
    import type { KanbanTask, Task } from '$lib/types/types';
    import UserDisplay from '$lib/features/users/components/UserDisplay.svelte';
    import { CalendarClock, ChevronDown, ChevronRight, ChevronLeft, FolderGit, Info, X } from 'lucide-svelte';
    import { t } from '$lib/stores/translationStore';
    import { loadTasks, updateTask } from '$lib/clients/taskClient';

    // Project ID from store
    let currentProjectId: string | null = null;
    projectStore.subscribe(state => {
        currentProjectId = state.currentProjectId;
    });
    interface GridRow {
        tasks: KanbanTask[];
        isParentRow?: boolean;
        isChildRow?: boolean;
        parentId?: string;
    }
    const tasks = writable<KanbanTask[]>([]);
    // const expandedTasks = writable<Set<string>>(new Set());
    
    // function toggleTaskExpansion(taskId: string) {
    //     expandedTasks.update(expanded => {
    //         const newExpanded = new Set(expanded);
    //         if (newExpanded.has(taskId)) {
    //             newExpanded.delete(taskId);
    //         } else {
    //             newExpanded.add(taskId);
    //         }
    //         return newExpanded;
    //     });
        
    //     // Force a refresh of the grid
    //     tasks.update(currentTasks => [...currentTasks]);
    // }
    
    
    // Store for the visible date range
    const dateRange = writable({
        start: new Date(),
        end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from now
    });

    // UI state
    let isLoading = writable(true);
    let error = writable<string | null>(null);
    let selectedTask: KanbanTask | null = null;
    let showTaskInfo = false;
    let draggingTask: string | null = null;
    let draggingType: 'start' | 'end' | 'move' | null = null;
    let dragStartX = 0;
    let initialDateValue: Date | null = null;

    // Mapping to friendly status names
    const statusNames = {
        'backlog': 'Backlog',
        'todo': 'To Do',
        'focus': 'Focus',
        'inprogress': 'In Progress',
        'done': 'Done',
        'hold': 'On Hold',
        'postpone': 'Postponed',
        'cancel': 'Canceled',
        'review': 'Review',
        'delegate': 'Delegated',
        'archive': 'Archived'
    };

    // Status colors for visual distinction
    const statusColors = {
        'backlog': '#6c757d',
        'todo': '#007bff',
        'focus': '#6f42c1',
        'inprogress': '#17a2b8',
        'done': '#28a745',
        'hold': '#fd7e14',
        'postpone': '#6c757d',
        'cancel': '#dc3545',
        'review': '#20c997',
        'delegate': '#e83e8c',
        'archive': '#6c757d'
    };

    // Helper function to get cached usernames
    const userNameCache = new Map<string, string>();

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
    } catch (err: unknown) {
        console.error('Error fetching user data:', err);
        return "Unknown";
    }
}

    // Load tasks from API
    async function fetchTasks() {
        isLoading.set(true);
        error.set(null);
        
        try {
            const fetchedTasks = await loadTasks(currentProjectId || undefined);
            
            const processedTasks = fetchedTasks.map(task => {
                // Convert dates
                const due = task.due_date ? new Date(task.due_date) : null;
                const start = task.start_date ? new Date(task.start_date) : new Date(task.created);
                
                return {
                    id: task.id,
                    title: task.title,
                    taskDescription: task.taskDescription || '',
                    creationDate: new Date(task.created),
                    due_date: due,
                    start_date: start,
                    tags: task.taskTags || [],
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
                } as KanbanTask;
            });
            
            tasks.set(processedTasks);
            
            // Adjust date range based on tasks
            updateDateRange(processedTasks);
            
            isLoading.set(false);
        } catch (err) {
            console.error('Error loading tasks:', err);
            error.set(err.message || 'Failed to load tasks');
            isLoading.set(false);
        }
    }

    // Update task dates when dragged
    async function updateTaskDates(taskId: string, start?: Date, end?: Date) {
        try {
            const task = get(tasks).find(t => t.id === taskId);
            if (!task) return;
            
            const updateData: Partial<Task> = {};
            
            if (start) {
                updateData.start_date = start.toISOString();
            }
            
            if (end) {
                updateData.due_date = end.toISOString();
            }
            
            await updateTask(taskId, updateData);
            
            // Update local task data
            tasks.update(allTasks => {
                return allTasks.map(t => {
                    if (t.id === taskId) {
                        return {
                            ...t,
                            start_date: start || t.start_date,
                            due_date: end || t.due_date
                        };
                    }
                    return t;
                });
            });
        } catch (err) {
            console.error('Error updating task dates:', err);
            error.set(`Failed to update task: ${err.message}`);
        }
    }

    // Calculate the date range based on tasks
    function updateDateRange(taskList: KanbanTask[]) {
        if (!taskList.length) return;
        
        let minDate = new Date();
        let maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
        
        taskList.forEach(task => {
            if (task.start_date && task.start_date < minDate) {
                minDate = new Date(task.start_date);
            }
            
            if (task.due_date && task.due_date > maxDate) {
                maxDate = new Date(task.due_date);
            }
        });
        
        // Add buffer days
        minDate.setDate(minDate.getDate() - 7);
        maxDate.setDate(maxDate.getDate() + 7);
        
        dateRange.set({ start: minDate, end: maxDate });
    }

    // Helper to get days between two dates
    function getDaysBetween(start: Date, end: Date): number {
        const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
        return Math.round(Math.abs((end.getTime() - start.getTime()) / oneDay));
    }

    // Calculate horizontal position for a date
    function getPositionForDate(date: Date): number {
        const range = get(dateRange);
        const totalDays = getDaysBetween(range.start, range.end);
        
        // Fix for date positioning - ensure chronological order
        let daysSinceStart = 0;
        if (date >= range.start) {
            // Date is after start date
            daysSinceStart = getDaysBetween(range.start, date);
        } else {
            // Date is before start date (should be negative position)
            daysSinceStart = -getDaysBetween(date, range.start);
        }
        
        return (daysSinceStart / totalDays) * 100;
    }

    // Calculate width for a task bar
    function getTaskWidth(task: KanbanTask): number {
        if (!task.start_date || !task.due_date) return 5; // Default minimum width
        
        const start = task.start_date;
        const end = task.due_date;
        const range = get(dateRange);
        const totalDays = getDaysBetween(range.start, range.end);
        const taskDays = getDaysBetween(start, end) || 1; // Ensure at least 1 day
        
        return (taskDays / totalDays) * 100;
    }

    // Generate month labels for the chart
    function getMonthLabels(): { label: string, position: number }[] {
        const range = get(dateRange);
        const months: { label: string, position: number }[] = [];
        
        const currentDate = new Date(range.start);
        currentDate.setDate(1); // Start at beginning of month
        
        while (currentDate <= range.end) {
            const monthLabel = currentDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
            const position = getPositionForDate(currentDate);
            
            months.push({ label: monthLabel, position });
            
            // Move to next month
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        
        return months;
    }

    // Generate day markers for the chart
    function getDayMarkers(): { date: Date, position: number }[] {
        const range = get(dateRange);
        const days: { date: Date, position: number }[] = [];
        
        const currentDate = new Date(range.start);
        
        while (currentDate <= range.end) {
            const position = getPositionForDate(currentDate);
            days.push({ date: new Date(currentDate), position });
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return days;
    }

    // Handle various dragging operations on task bars
// Change this part in handleTaskDragStart function:
function handleTaskDragStart(event: MouseEvent, taskId: string, type: 'start' | 'end' | 'move') {
    event.preventDefault();
    event.stopPropagation(); // Stop event propagation to prevent conflicts
    
    draggingTask = taskId;
    draggingType = type;
    dragStartX = event.clientX;
    
    const task = get(tasks).find(t => t.id === taskId);
    if (task) {
        if (type === 'start') {
            initialDateValue = task.start_date ? new Date(task.start_date) : null;
        } else if (type === 'end') {
            initialDateValue = task.due_date ? new Date(task.due_date) : null;
        } else if (type === 'move') {
            // For move, we need to remember the start date
            initialDateValue = task.start_date ? new Date(task.start_date) : null;
        }
    }
    
    // Add global event listeners
    window.addEventListener('mousemove', handleTaskDragMove);
    window.addEventListener('mouseup', handleTaskDragEnd);
}

    function handleTaskDragMove(event: MouseEvent) {
        if (!draggingTask || !draggingType || !initialDateValue) return;
        
        const deltaX = event.clientX - dragStartX;
        const pixelsPerDay = document.querySelector('.gantt-timeline')?.clientWidth || 1000 / 
            getDaysBetween(get(dateRange).start, get(dateRange).end);
        
        const daysDelta = Math.round(deltaX / (pixelsPerDay / 30)); // Adjust sensitivity
        
        tasks.update(allTasks => {
            return allTasks.map(task => {
                if (task.id === draggingTask) {
                    const updatedTask = { ...task };
                    
                    if (draggingType === 'start' || draggingType === 'move') {
                        const newStartDate = new Date(initialDateValue || Date.now());

                        newStartDate.setDate(newStartDate.getDate() + daysDelta);
                        updatedTask.start_date = newStartDate;
                        
                        // If moving the whole task, adjust end date too
                        if (draggingType === 'move' && task.due_date) {
                            const duration = task.due_date.getTime() - (task.start_date?.getTime() || 0);
                            updatedTask.due_date = new Date(newStartDate.getTime() + duration);
                        }
                    } else if (draggingType === 'end' && task.due_date) {
                        const newEndDate = new Date(initialDateValue || Date.now());

                        newEndDate.setDate(newEndDate.getDate() + daysDelta);
                        
                        // Ensure end date isn't before start date
                        if (task.start_date && newEndDate > task.start_date) {
                            updatedTask.due_date = newEndDate;
                        }
                    }
                    
                    return updatedTask;
                }
                return task;
            });
        });
    }

    async function handleTaskDragEnd() {
    try {
        if (draggingTask && draggingType) {
            const task = get(tasks).find(t => t.id === draggingTask);
            if (task) {
                if (draggingType === 'start') {
                    await updateTaskDates(draggingTask, task.start_date || undefined);
                } else if (draggingType === 'end') {
                    await updateTaskDates(draggingTask, undefined, task.due_date || undefined);
                } else if (draggingType === 'move') {
                    await updateTaskDates(draggingTask, undefined, task.due_date || undefined);
                }
            }
        }
    } catch (err: unknown) {
        console.error('Error updating task dates during drag end:', err);
    } finally {
        draggingTask = null;
        draggingType = null;
        initialDateValue = null;
        
        // Remove global event listeners
        window.removeEventListener('mousemove', handleTaskDragMove);
        window.removeEventListener('mouseup', handleTaskDragEnd);
    }
}



    function panLeft() {
        dateRange.update(range => {
            const duration = range.end.getTime() - range.start.getTime();
            const panAmount = duration * 0.1;
            
            return {
                start: new Date(range.start.getTime() - panAmount),
                end: new Date(range.end.getTime() - panAmount)
            };
        });
    }

    function panRight() {
        dateRange.update(range => {
            const duration = range.end.getTime() - range.start.getTime();
            const panAmount = duration * 0.1;
            
            return {
                start: new Date(range.start.getTime() + panAmount),
                end: new Date(range.end.getTime() + panAmount)
            };
        });
    }

    function getTaskDependencies(taskId: string): KanbanTask[] {
        const allTasks = get(tasks);
        return allTasks.filter(task => task.parent_task === taskId);
    }

    function taskHasDependencies(taskId: string): boolean {
        return getTaskDependencies(taskId).length > 0;
    }
    
    function hasValidDates(task: KanbanTask): boolean {
        return !!task.start_date && !!task.due_date;
    }

    function generateGridRows(): GridRow[] {
        const allTasks = get(tasks);
        const rows: GridRow[] = [];
        
        const parentTasks = allTasks.filter(task => 
            !task.parent_task && getTaskDependencies(task.id).length > 0
        );
        
        parentTasks.forEach(parentTask => {
            rows.push({
                tasks: [parentTask],
                isParentRow: true
            });
            
            const childTasks = getTaskDependencies(parentTask.id);
            
            childTasks.forEach(childTask => {
                rows.push({
                    tasks: [childTask],
                    isChildRow: true,
                    parentId: parentTask.id
                });
            });
        });
        
        return rows;
    }

    function handleTaskClick(task: KanbanTask) {
        selectedTask = task;
        showTaskInfo = true;
    }

    function closeTaskInfo() {
        showTaskInfo = false;
        setTimeout(() => {
            selectedTask = null;
        }, 300); 
    }

    $: {
        if (currentProjectId) {
            fetchTasks();
        } else {
            fetchTasks(); 
        }
    }
</script>

<div class="gantt-container">
    {#if $isLoading}
        <div class="spinner-container">
            <div class="spinner"></div>
        </div>
    {:else if $error}
        <div class="error-message">
            <p>Error: {$error}</p>
            <button on:click={fetchTasks}>Retry</button>
        </div>
    {:else}
        <div class="gantt-controls">
            <div class="pan-controls">
                <button on:click={panLeft}>⟵</button>
                <button on:click={panRight}>⟶</button>
            </div>
        </div>
        
        <div class="gantt-chart">
            <div class="gantt-header">
                <div class="gantt-timeline">
                    <div class="timeline-months">
                        {#each getMonthLabels() as month}
                            <div class="month-label" style="left: {month.position}%">
                                {month.label}
                            </div>
                        {/each}
                    </div>
                    <div class="timeline-days">
                        {#each getDayMarkers() as day}
                            <div 
                                class="day-marker" 
                                style="left: {day.position}%"
                                class:today={day.date.toDateString() === new Date().toDateString()}
                                class:weekend={day.date.getDay() === 0 || day.date.getDay() === 5}
                            >
                                <div class="day-label">
                                    {day.date.getDate()}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
            
            <div class="gantt-body">
                <div class="gantt-chart-grid">
                    {#each getDayMarkers() as day}
                        <div 
                            class="grid-line" 
                            style="left: {day.position}%"
                            class:today={day.date.toDateString() === new Date().toDateString()}
                            class:weekend={day.date.getDay() === 0 || day.date.getDay() === 6}
                        ></div>
                    {/each}
                    
                    {#each generateGridRows() as row, rowIndex}
                        <div class="task-row" class:child-row={row.isChildRow} class:parent-row={row.isParentRow}>
                            {#each row.tasks as task}
                                {@const startPos = task.start_date ? getPositionForDate(task.start_date) : 0}
                                {@const width = task.start_date && task.due_date ? getTaskWidth(task) : 10}
                                
                                <div 
                                    class="task-bar"
                                    class:child-task-bar={row.isChildRow}
                                    class:parent-task-bar={row.isParentRow}
                                    style="
                                        left: {startPos}%; 
                                        width: {width}%;
                                        background-color: {statusColors[task.status] || '#007bff'};
                                    "
                                    on:click={() => {
                                            handleTaskClick(task);
                                        // if (taskHasDependencies(task.id)) {
                                        //     toggleTaskExpansion(task.id);
                                        // }
                                    }}
                                    draggable="false" 
                                    on:mousedown={(e) => {
                                        if (e.target && e.target instanceof Element && !e.target.closest('button')) {
                                            handleTaskDragStart(e, task.id, 'move');
                                        }
                                    }}
                                >
                                    <div 
                                        class="task-resizer start"
                                        on:mousedown={(e) => {
                                            e.stopPropagation();
                                            handleTaskDragStart(e, task.id, 'start');
                                        }}
                                    ></div>
                                    
                                    <div class="task-title">
                                        {task.title}
                                        
                                        <!-- {#if taskHasDependencies(task.id)}
                                            <button 
                                                class="toggle-button-inline" 
                                                on:click|stopPropagation={(e) => {
                                                    e.stopPropagation();
                                                    toggleTaskExpansion(task.id);
                                                }}
                                            >
                                                {#if $expandedTasks.has(task.id)}
                                                    <ChevronDown size="12" />
                                                {:else}
                                                    <ChevronRight size="12" />
                                                {/if}
                                            </button>
                                        {/if} -->
                                        
                                        <button 
                                            class="info-button" 
                                            on:click|stopPropagation={(e) => {
                                                e.stopPropagation();
                                                handleTaskClick(task);
                                            }}
                                        >
                                            <Info size="12" />
                                        </button>
                                    </div>
                                    
                                    <div 
                                        class="task-resizer end"
                                        on:mousedown={(e) => {
                                            e.stopPropagation();
                                            handleTaskDragStart(e, task.id, 'end');
                                        }}
                                    ></div>
                                </div>
                            {/each}
                            
                            <!-- {#if row.isParentRow && taskHasDependencies(row.tasks[0].id) && $expandedTasks.has(row.tasks[0].id)}
                                {#each getTaskDependencies(row.tasks[0].id) as childTask}
                                    {#if childTask.start_date && row.tasks[0].start_date && row.tasks[0].due_date}
                                        {@const childStartPos = getPositionForDate(childTask.start_date)}
                                        {@const taskEndPos = getPositionForDate(row.tasks[0].due_date)}
                                        
                                        <div class="dependency-arrow" style="
                                            left: {taskEndPos}%;
                                            width: {childStartPos - taskEndPos}%;
                                        "></div>
                                    {/if}
                                {/each}
                            {/if} -->
                        </div>
                    {/each}
                </div>
            </div>
        </div>
        
        {#if showTaskInfo && selectedTask}
            <div 
                class="task-info-modal"
                transition:fade={{ duration: 150 }}
                on:click={closeTaskInfo}
            >
                <div 
                    class="task-info-content"
                    on:click|stopPropagation
                    transition:slide={{ duration: 200 }}
                >
                    <div class="task-info-header">
                        <h3>{selectedTask.title}</h3>
                        <button class="close-btn" on:click={closeTaskInfo}>
                            <X size={18} />
                        </button>
                    </div>
                    
                    <div class="task-info-body">
                        <div class="info-section">
                            <h4>Status</h4>
                            <span>
                                <div class="status-badge" style="background-color: {statusColors[selectedTask.status]}">
                                    {statusNames[selectedTask.status] || selectedTask.status}
                                </div>
                            </span>
                        </div>
                        
                        <div class="info-section">
                            <h4>Timeline</h4>
                            <div class="timeline-info">
                                <div>
                                    <strong>Start:</strong> {selectedTask.start_date ? selectedTask.start_date.toLocaleDateString() : 'Not set'}
                                </div>
                                <div>
                                    <strong>Due:</strong> {selectedTask.due_date ? selectedTask.due_date.toLocaleDateString() : 'Not set'}
                                </div>
                                {#if selectedTask.start_date && selectedTask.due_date}
                                    <div>
                                        <strong>Duration:</strong> {getDaysBetween(selectedTask.start_date, selectedTask.due_date)} days
                                    </div>
                                {/if}
                            </div>
                        </div>
                        
                        {#if selectedTask.taskDescription}
                            <div class="info-section">
                                <h4>Description</h4>
                                <p>{selectedTask.taskDescription}</p>
                            </div>
                        {/if}
                        
                        {#if selectedTask.parent_task}
                            <div class="info-section">
                                <h4>Parent Task</h4>
                                <div class="parent-task">
                                    {#each $tasks as task}
                                        {#if task.id === selectedTask.parent_task}
                                            <div class="linked-task" on:click={() => handleTaskClick(task)}>
                                                {task.title}
                                            </div>
                                        {/if}
                                    {/each}
                                </div>
                            </div>
                        {/if}
                        
                        {#if taskHasDependencies(selectedTask.id)}
                            <div class="info-section">
                                <h4>Child Tasks</h4>
                                <div class="child-tasks">
                                    {#each getTaskDependencies(selectedTask.id) as childTask}
                                        <div class="linked-task" on:click={() => handleTaskClick(childTask)}>
                                            {childTask.title}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                        
                        {#if selectedTask.createdBy}
                            <div class="info-section">
                                <h4>Created By</h4>
                                <div class="creator-info">
                                    <img 
                                        src={`/api/users/${selectedTask.createdBy}/avatar`} 
                                        alt="Avatar" 
                                        class="user-avatar"
                                        onerror="this.style.display='none'"
                                    />
                                    <span class="username">
                                        {#await getUserName(selectedTask.createdBy) then username}
                                            {username}
                                        {/await}
                                    </span>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        {/if}
    {/if}
</div>

<style lang="scss">
      @use "src/styles/themes.scss" as *;
    * {

      font-family: var(--font-family);
    }    .gantt-container {
        height: auto;
        width: 100%;
        display: flex;
        backdrop-filter: blur(10px);
        flex-direction: column;
        justify-content: flex-start;
        border-radius: 2rem;
        position: relative;
    }
    
    .spinner-container {
        position: fixed;
        height: 100vh;
    }

    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .error-message {
        padding: 20px;
        text-align: center;
    }
    
    .gantt-controls {
        display: flex;
        justify-content: flex-end;
        padding: 10px;
        border-bottom: 1px solid #dee2e6;
    }
    
    .zoom-controls, .pan-controls {
        display: flex;
        gap: 5px;
    }
    
    .gantt-controls button {
        border: 1px solid #dee2e6;
        border-radius: 4px;
        padding: 5px 10px;
        cursor: pointer;
    }
    
    .gantt-controls button:hover {
        background-color: #e9ecef;
    }
    
    .gantt-chart {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    
    .gantt-header {
        display: flex;
        border-bottom: 1px solid #dee2e6;
    }
    
    .gantt-timeline {
        flex: 1;
        position: relative;
        height: 60px;
        overflow: hidden;
    }
    
    .timeline-months {
        position: relative;

        height: 30px;
        border-bottom: 1px solid var(--line-color);
    }
    
    .month-label {
        position: absolute;
        transform: translateX(-50%);
        font-size: 12px;
        font-weight: bold;
        padding: 5px;
    }

    .timeline-days {
        position: relative;
        height: 30px;
    }
    
    .day-marker {
        position: absolute;
        height: 100%;
        width: 1px;
        background-color: var(--secondary-color);
        transform: translateX(-50%);
    }
    
    .day-marker.weekend {
        background-color: var(--text-color);
    }
    
    .day-marker.today {
        background-color: var(--tertiary-color);
        width: 2px;
    }
    
    .day-label {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        bottom: 3px;
        transform: translateX(-50%);
        font-size: 10px;
        color: var(--text-color);
    }
    
    .gantt-body {
        flex: 1;
        display: flex;
        overflow: auto;
    }
    
    .gantt-chart-grid {
        flex: 1;
        position: relative;
        overflow: auto;
    }
    
    .grid-line {
        position: absolute;
        height: 100%;
        width: 1px;
        transform: translateX(-50%);
    }
    
    .grid-line.weekend {
        width: 100%;
        opacity: 0.5;
        z-index: 0;
    }
    
    .grid-line.today {
        background-color: var(--tertiary-color);
        width: 2px;
        z-index: 1;
    }
    
    .task-row {
        position: relative;
        height: 40px;
        border-bottom: 1px solid var(--line-color);
    }
    
    .child-row {
        height: 35px;
        background-color: rgba(0, 0, 0, 0.02);
    }
    
    .task-bar {
        
        position: absolute;
        height: 24px;
        top: 8px;
        border-radius: 4px;
        color: var(--text-color);
        font-size: 12px;
        display: flex;
        align-items: center;
        padding: 0 8px;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        z-index: 2;
    }
    
    .child-task-bar {
        height: 20px;
        border-left: 1px solid var(--tertiary-color);
        top: 7px;
        opacity: 0.9;
    }
    
    .parent-task-bar {
        font-weight: bold;
    }
    
    .task-title {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    .task-resizer {
        position: absolute;
        width: 8px;
        height: 100%;
        cursor: col-resize;
        top: 0;
        z-index: 3;
    }
    
    .task-resizer.start {
        left: 0;
    }
    
    .task-resizer.end {
        right: 0;
    }
    
    .dependency-arrow {
        position: absolute;
        height: 2px;
        top: 20px;
        background-color: rgba(0, 0, 0, 0.2);
    }
    
    .dependency-arrow::after {
        content: "";
        position: absolute;
        right: 0;
        top: -4px;
        border-left: 8px solid rgba(0, 0, 0, 0.2);
        border-top: 5px solid transparent;
        border-bottom: 5px solid transparent;
    }
    
    .task-info-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .task-info-content {
        border-radius: 8px;
        width: 80%;
        max-width: 600px;
        max-height: 80vh;
        overflow: auto;
        backdrop-filter: blur(20px);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }
    
    .task-info-header {
        padding: 15px 20px;
        border-bottom: 1px solid #dee2e6;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .task-info-header h3 {
        margin: 0;
        font-size: 18px;
    }
    
    .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        opacity: 0.6;
    }
    
    .close-btn:hover {
        opacity: 1;
    }
    
    .task-info-body {
        padding: 20px;
    }
    
    .info-section {
        margin-bottom: 20px;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--line-color);

        & p {
            padding-inline-start: 1rem;
        }
        & h4 {
            margin: 0 0 10px 0;
            font-size: 16px;
            color: var(--text-color);
        }
        & span {
            padding-inline-start: 1rem;
        }
    }
    
    
    .status-badge {
        display: inline-block;
        padding: 5px 10px;
        border-radius: 4px;
        color: var(--tertiary-color);
        font-size: 14px;
    }
    
    .timeline-info {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        padding-inline-start: 1rem;
    }
    
    .user-avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        margin-right: 10px;
    }
    
    .creator-info {
        display: flex;
        align-items: center;
        padding-inline-start: 1rem;

    }
    
    .linked-task {
        padding: 5px;
        border-radius: 4px;
        margin-bottom: 5px;
        padding-inline-start: 1rem;
        cursor: pointer;
        background: var(--primary-color);
    }
    
    .linked-task:hover {
        background-color: #e9ecef;
    }
    
    .toggle-button-inline {
        background: none;
        border: none;
        padding: 2px;
        margin-left: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.2);
    }
    
    .toggle-button-inline:hover {
        background-color: rgba(255, 255, 255, 0.3);
    }
    
    .info-button {
        background: none;
        border: none;
        padding: 2px;
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.2);
    }
    
    .info-button:hover {
        background-color: rgba(255, 255, 255, 0.3);
    }
    .missing-dates-indicator {
        color: #dc3545;
        margin-left: 4px;
    }
    
    /* Add styles for parent tasks with expanded children */
    .parent-row.expanded {
        border-bottom: 1px dashed #adb5bd;
    }
    
    /* Hover effects */
    .task-bar:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        filter: brightness(1.05);
    }
    
    /* Dragging styles */
    .task-bar.dragging {
        opacity: 0.8;
        z-index: 10;
    }
    
    /* Improve resizer handles visibility */
    .task-resizer:hover::before {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background-color: rgba(255, 255, 255, 0.7);
    }
    
    .task-resizer.start:hover::before {
        left: 3px;
    }
    
    .task-resizer.end:hover::before {
        right: 3px;
    }
    
    /* Media query for smaller screens */
    @media (max-width: 768px) {
        .gantt-controls {
            flex-direction: column;
            gap: 10px;
        }
        
        .task-info-content {
            width: 95%;
        }
        
        .timeline-info {
            grid-template-columns: 1fr;
        }
    }
</style>
<script lang="ts">
    import { writable } from 'svelte/store';

    function getRandomBrightColor(tagName: string): string {
        const hash = tagName.split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);
        const h = hash % 360;
        return `hsl(${h}, 70%, 60%)`;
    }

    interface Tag {
        id: number;
        name: string;
        color: string;
    }

    interface Attachment {
        id: number;
        name: string;
        url: string;
    }

    interface Task {
        id: number;
        title: string;
        description: string;
        creationDate: Date;
        deadline: Date | null;
        tags: number[];
        attachments: Attachment[];
    }

    interface Column {
        id: number;
        title: string;
        tasks: Task[];
        isOpen: boolean;
    }

    let columns = writable<Column[]>([
        { id: 1, title: 'Backlog', tasks: [], isOpen: true },
        { id: 2, title: 'To Do', tasks: [], isOpen: true },
        { id: 3, title: 'In Progress', tasks: [], isOpen: true },
        { id: 4, title: 'Done', tasks: [], isOpen: true }
    ]);

    let tags = writable<Tag[]>([]);
    let nextTaskId = 1;
    let nextTagId = 1;
    let nextAttachmentId = 1;
    let selectedTask: Task | null = null;
    let isModalOpen = false;
    let newTagName = '';
    let isEditingDescription = false;
    let isEditingTitle = false;
    let selectedDeadline: number | null = null;







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
                        column.tasks.push({
                            id: nextTaskId++,
                            title,
                            description: '',
                            creationDate: new Date(),
                            deadline: null,
                            tags: [],
                            attachments: []
                        });
                    }
                    return cols;
                });
                input.value = '';
            }
        }
    }

    function moveTask(taskId: number, fromColumnId: number, toColumnId: number) {
        columns.update(cols => {
            const fromColumn = cols.find(col => col.id === fromColumnId);
            const toColumn = cols.find(col => col.id === toColumnId);
            if (fromColumn && toColumn) {
                const taskIndex = fromColumn.tasks.findIndex(task => task.id === taskId);
                if (taskIndex !== -1) {
                    const [task] = fromColumn.tasks.splice(taskIndex, 1);
                    toColumn.tasks.push(task);
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

    function handleDragStart(event: DragEvent, taskId: number, fromColumnId: number) {
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

    function openModal(task: Task, event: MouseEvent) {
        event.stopPropagation();
        selectedTask = deepCopy(task);
        isModalOpen = true;
        isEditingTitle = false;
        isEditingDescription = false;
        selectedDeadline = null;  // Reset selected deadline
    }
    function saveAndCloseModal() {
        if (selectedTask) {
            columns.update(cols => {
                return cols.map(col => ({
                    ...col,
                    tasks: col.tasks.map(task => 
                        task.id === selectedTask!.id ? {...selectedTask!} : task
                    )
                }));
            });
        }
        selectedTask = null;
        isModalOpen = false;
    }
    function addTag() {
        if (newTagName.trim()) {
            tags.update(t => {
                const newTag = {
                    id: nextTagId++,
                    name: newTagName.trim(),
                    color: getRandomBrightColor(newTagName.trim())
                };
                return [...t, newTag];
            });
            newTagName = '';
        }
    }


    function handleFileUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && selectedTask) {
            for (let i = 0; i < input.files.length; i++) {
                const file = input.files[i];
                const attachment: Attachment = {
                    id: nextAttachmentId++,
                    name: file.name,
                    url: URL.createObjectURL(file)
                };
                selectedTask.attachments = [...selectedTask.attachments, attachment];
            }
        }
    }

    function setQuickDeadline(days: number) {
        if (selectedTask) {
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + days);
            selectedTask.deadline = deadline;
            selectedTask = { ...selectedTask };
            selectedDeadline = days;
        }
    }

    function setEndOfWeekDeadline() {
        if (selectedTask) {
            const deadline = new Date();
            const daysUntilEndOfWeek = 7 - deadline.getDay();
            deadline.setDate(deadline.getDate() + daysUntilEndOfWeek);
            selectedTask.deadline = deadline;
            selectedTask = { ...selectedTask };
            selectedDeadline = 'endOfWeek';
        }
    }

    function toggleTag(tagId: number) {
    if (selectedTask) {
        const tagIndex = selectedTask.tags.indexOf(tagId);
        if (tagIndex === -1) {
            selectedTask.tags = [...selectedTask.tags, tagId];
        } else {
            selectedTask.tags = selectedTask.tags.filter(id => id !== tagId);
        }
        selectedTask = { ...selectedTask };  // Trigger reactivity
    }
}

    

    $: taskTags = selectedTask ? $tags.filter(tag => selectedTask.tags.includes(tag.id)) : [];
</script>

<div class="kanban-board">
    {#each $columns as column}
        <div class="kanban-column" on:dragover={handleDragOver} on:drop={(e) => handleDrop(e, column.id)}>
            <button type="button" on:click={() => toggleColumn(column.id)}>{column.title}</button>
            <textarea 
                placeholder="Add a task and press Enter"
                on:keydown={(e) => addTask(column.id, e)}
            ></textarea>
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

                            {#if task.deadline}
                                <p class="deadline">⌛ {task.deadline.toLocaleDateString()}</p>
                            {/if}
                            {#if task.tags.length > 0}
                            <div class="tag-list">
                                {#each $tags.filter(tag => task.tags.includes(tag.id)) as tag}
                                    <span class="tag" style="background-color: {tag.color}">{tag.name}</span>
                                {/each}
                            </div>
                            {/if}
                            {#if task.attachments.length > 0}
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

{#if isModalOpen && selectedTask}
    <div class="modal-overlay" on:click={saveAndCloseModal}>
        <div class="modal-content" on:click|stopPropagation>
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
                        bind:value={selectedTask.description}
                        on:blur={() => isEditingDescription = false}
                        autoFocus
                    ></textarea>
                {:else}
                    <div 
                        class="description-display"
                        on:click={() => isEditingDescription = true}
                    >
                        {selectedTask.description || 'Click to add a description'}
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
            <button class="done-button" on:click={saveAndCloseModal}>Done</button>
            <p>Created: {selectedTask.creationDate.toLocaleDateString()}</p>

        </div>
    </div>
{/if}

<style>

    p {
        font-size: 14px;
    }
    .kanban-board {
        display: flex;
        flex-direction: row;
        gap: 10px;
        padding: 10px;
        overflow-x: auto;
        justify-content: flex-start; 
        align-items: flex-start;
        height: 100%;

    }

    .kanban-column {
        background-color: none;
        border-radius: 5px;
        flex: 0 0 auto;
        display: flex;        
        flex-direction: column;
        max-width: 300px;
        min-width: 200px;
        padding: 10px;
        transition: all 0.3s ease;
    }

    .kanban-column button {
        cursor: pointer;
        width: 100%;
        text-align: left;
        padding: 10px;
        background: none;
        border: none;
        font-size: 1.2em;
        font-weight: bold;
    }

    textarea {
        width: 90%;
        align-items: center;
        justify-content: center;
        margin-bottom: 10px;
        padding: 5px;
        border-radius: 10px;
        border: 1px solid #ddd;
        background-color: #3a3e3c;
        resize:none;
        color: white;
        transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

    }

    textarea:hover {
        /* border: 1px solid #7cb87e; */
        transform: scale(1.05);
    }

    .task-list {
        min-height: 100px;
    }

    .task-card {
        background-color: #1c1c1c;
        border-radius: 10px;
        padding: 5px;
        margin-bottom: 10px;;
        cursor: move;
        transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
        position: relative;
    }

    .task-card:hover {
        transform: scale(1.05) translateX(5px) rotate(5deg);        
    }

    .task-card:active {
        transform: rotate(-5deg);
    }


    .tag-list {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 5px;
    }

    .tag {
        color: white;
        padding: 2px 5px;
        border-radius: 10px;
        font-size: 0.8em;
        border: 2px solid transparent;
        transition: all 0.3s ease;
        cursor: pointer;
    }

    .tag:hover {
        opacity: 0.8;
    }

    .tag.selected {
        border-color: white;
        box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
    }




    .deadline {
        font-size: 0.8em;
        color: #888;
        margin-top: 5px;
    }

    .deadline.selected {
        border-color: white;
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
        background-color: #333333;
        color: white;
        padding: 20px;
        border-radius: 40px;
        max-width: 500px;
        width: 100%;
        position: relative;
        border: 1px solid white;
    }

    .deadline-section {
        margin-top: 10px;
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
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 0.8em;
    }

    .deadline-controls button.selected {
        border: 2px solid white;
        box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
    }


    .tag-section, .attachment-section {
        margin-top: 10px;
    }

    .add-tag {
        border-radius: 20px;
        margin-top: 10px;
        display: flex;
        gap: 10px;
    }

    .add-tag input[type="text"] {
        flex-grow: 1;
        padding: 5px;
        border-radius: 5px;
        border: 1px solid #ddd;
        background-color: #3a3e3c;
        color: white;
    }

    .add-tag button {
        padding: 5px 10px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
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

    .done-button {
        position: absolute;
        bottom: 20px;
        right: 20px;
        background-color: #4CAF50;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 20px;
        cursor: pointer;
        font-size: 1em;
    }

    .done-button:hover {
        background-color: #45a049;
    }

    @keyframes selectPulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }

    .tag.selected {
        animation: selectPulse 0.3s ease-in-out;
    }

    @media (max-width: 970px) {
        .kanban-board {
            flex-direction: column;
            align-items: center;
        }

        .kanban-column {
            width: 100%;
            max-width: none;
            display: flex;
            flex-direction: column;
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
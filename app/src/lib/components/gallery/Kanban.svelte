<script lang="ts">
    import { writable } from 'svelte/store';
    import { workshopStore } from '$lib/stores/workshopStore';
    import { updateWorkshop, deleteWorkshop } from '$lib/workshopClient';
    import type { Workshops } from '$lib/types';

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

    interface Column {
        id: number;
        title: string;
        workshops: Workshops[];
        isOpen: boolean;
    }

    let columns = writable<Column[]>([
        { id: 1, title: 'Backlog', workshops: [], isOpen: true },
        { id: 2, title: 'To Do', workshops: [], isOpen: true },
        { id: 3, title: 'In Progress', workshops: [], isOpen: true },
        { id: 4, title: 'Done', workshops: [], isOpen: true }
    ]);

    let tags = writable<Tag[]>([]);
    let nextTagId = 1;
    let selectedWorkshop: Workshops | null = null;
    let isModalOpen = false;
    let newTagName = '';
    let isEditingDescription = false;
    let isEditingTitle = false;

    function deepCopy<T>(obj: T): T {
        // ... (keep the deepCopy function as is)
    }

    function addWorkshop(columnId: number, event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const input = event.target as HTMLTextAreaElement;
            const name = input.value.trim();
            if (name) {
                columns.update(cols => {
                    const column = cols.find(col => col.id === columnId);
                    if (column) {
                        const newWorkshop: Workshops = {
                            id: Date.now().toString(),
                            name,
                            description: '',
                            workspace: '', // Set this to the current workspace id
                            workflow: '',
                            prompt: '',
                            replies: [],
                            created: new Date().toISOString(),
                            updated: new Date().toISOString()
                        };
                        column.workshops.push(newWorkshop);
                        workshopStore.addWorkshop(newWorkshop);
                    }
                    return cols;
                });
                input.value = '';
            }
        }
    }

    function moveWorkshop(workshopId: string, fromColumnId: number, toColumnId: number) {
        columns.update(cols => {
            const fromColumn = cols.find(col => col.id === fromColumnId);
            const toColumn = cols.find(col => col.id === toColumnId);
            if (fromColumn && toColumn) {
                const workshopIndex = fromColumn.workshops.findIndex(w => w.id === workshopId);
                if (workshopIndex !== -1) {
                    const [workshop] = fromColumn.workshops.splice(workshopIndex, 1);
                    toColumn.workshops.push(workshop);
                    // Update the workshop's status based on the new column
                    updateWorkshop(workshop.id, { status: toColumn.title });
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

    function handleDragStart(event: DragEvent, workshopId: string, fromColumnId: number) {
        if (event.dataTransfer) {
            event.dataTransfer.setData('text/plain', JSON.stringify({ workshopId, fromColumnId }));
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
            moveWorkshop(data.workshopId, data.fromColumnId, toColumnId);
        }
    }

    function openModal(workshop: Workshops, event: MouseEvent) {
        event.stopPropagation();
        selectedWorkshop = deepCopy(workshop);
        isModalOpen = true;
        isEditingTitle = false;
        isEditingDescription = false;
    }

    async function saveAndCloseModal() {
        if (selectedWorkshop) {
            columns.update(cols => {
                return cols.map(col => ({
                    ...col,
                    workshops: col.workshops.map(w => 
                        w.id === selectedWorkshop!.id ? {...selectedWorkshop!} : w
                    )
                }));
            });
            await updateWorkshop(selectedWorkshop.id, selectedWorkshop);
            workshopStore.updateWorkshop(selectedWorkshop);
        }
        selectedWorkshop = null;
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

    function toggleTag(tagId: number) {
        if (selectedWorkshop) {
            const tagIndex = selectedWorkshop.tags ? selectedWorkshop.tags.indexOf(tagId) : -1;
            if (tagIndex === -1) {
                selectedWorkshop.tags = [...(selectedWorkshop.tags || []), tagId];
            } else {
                selectedWorkshop.tags = selectedWorkshop.tags!.filter(id => id !== tagId);
            }
            selectedWorkshop = { ...selectedWorkshop };  // Trigger reactivity
        }
    }

    $: workshopTags = selectedWorkshop && selectedWorkshop.tags ? $tags.filter(tag => selectedWorkshop!.tags!.includes(tag.id)) : [];
</script>

<div class="kanban-board">
    {#each $columns as column}
        <div class="kanban-column" on:dragover={handleDragOver} on:drop={(e) => handleDrop(e, column.id)}>
            <button type="button" on:click={() => toggleColumn(column.id)}>{column.title}</button>
            <textarea 
                placeholder="Add a workshop and press Enter"
                on:keydown={(e) => addWorkshop(column.id, e)}
            ></textarea>
            {#if column.isOpen}
                <div class="workshop-list">
                    {#each column.workshops as workshop}
                        <div 
                            class="workshop-card" 
                            draggable="true" 
                            on:dragstart={(e) => handleDragStart(e, workshop.id, column.id)}
                            on:click={(e) => openModal(workshop, e)}
                        >
                            <h4>{workshop.name}</h4>
                            <p>{workshop.description}</p>
                            {#if workshop.tags && workshop.tags.length > 0}
                            <div class="tag-list">
                                {#each $tags.filter(tag => workshop.tags!.includes(tag.id)) as tag}
                                    <span class="tag" style="background-color: {tag.color}">{tag.name}</span>
                                {/each}
                            </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/each}
</div>

{#if isModalOpen && selectedWorkshop}
    <div class="modal-overlay" on:click={saveAndCloseModal}>
        <div class="modal-content" on:click|stopPropagation>
            {#if isEditingTitle}
                <textarea
                    bind:value={selectedWorkshop.name}
                    on:blur={() => isEditingTitle = false}
                    on:keydown={(e) => e.key === 'Enter' && (isEditingTitle = false)}
                    autoFocus
                    class="title-input"
                />
            {:else}
                <h1 on:click={() => isEditingTitle = true}>
                    {selectedWorkshop.name}
                </h1>
            {/if}
            <div class="description-section">
                <p>Description:</p>
                {#if isEditingDescription}
                    <textarea
                        bind:value={selectedWorkshop.description}
                        on:blur={() => isEditingDescription = false}
                        autoFocus
                    ></textarea>
                {:else}
                    <div 
                        class="description-display"
                        on:click={() => isEditingDescription = true}
                    >
                        {selectedWorkshop.description || 'Click to add a description'}
                    </div>
                {/if}
            </div>
            <div class="tag-section">
                <p>Tags</p>
                <div class="tag-list">
                    {#each $tags as tag}
                        <button 
                            class="tag" 
                            class:selected={selectedWorkshop.tags && selectedWorkshop.tags.includes(tag.id)}
                            on:click={() => toggleTag(tag.id)}
                            style="background-color: {tag.color}"
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
            <button class="done-button" on:click={saveAndCloseModal}>Done</button>
            <p>Created: {new Date(selectedWorkshop.created).toLocaleDateString()}</p>
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
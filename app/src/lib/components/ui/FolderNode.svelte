<script lang="ts">
    import { slide } from 'svelte/transition';
    import { ChevronRight, ChevronDown, MoreVertical } from 'lucide-svelte';
    import type { Folders, Notes } from '$lib/types/types';
    import { notesStore } from '$lib/stores/notesStore';

    export let folder: Folders;
    export let openFolders: Set<string>;
    export let currentNote: Notes | null;
    export let dragOverFolder: Folders | null;
    export let draggedItem: { item: Folders | Notes; isFolder: boolean } | null;
    
    // Events to bubble up to the parent component
    export let onDragStart;
    export let onDragOver;
    export let onDrop;
    export let onOpenNote;
    export let onToggleFolder;
    export let onShowContextMenu;

    $: childFolders = notesStore.getChildFolders(folder.id);
    $: notes = notesStore.notes[folder.id] || [];

</script>

<div class="folder" 
     draggable="true"
     on:dragstart={(e) => onDragStart(e, folder, true)}
     on:dragover={(e) => onDragOver(e, folder)}
     on:drop={(e) => onDrop(e, folder)}
     class:drag-over={dragOverFolder === folder}>
    
    <div class="folder-title">
        <span on:click={() => onToggleFolder(folder)}>
            {#if openFolders.has(folder.id)}
                <ChevronDown size={16} />
            {:else}
                <ChevronRight size={16} />
            {/if}
            {folder.title}
        </span>
        <button class="context-menu-button" on:click|stopPropagation={(e) => onShowContextMenu(e, folder, true)}>
            <MoreVertical size={16} />
        </button>
    </div>

    <!-- Render child folders and notes if folder is open -->
    {#if openFolders.has(folder.id)}
        <div class="folder-contents" transition:slide>
            {#each notes as note (note.id)}
                <div 
                    draggable="true"
                    on:dragstart={(e) => onDragStart(e, note, false)}
                    on:click={() => onOpenNote(note)}
                    on:contextmenu|preventDefault={(e) => onShowContextMenu(e, note, false)}
                    class:selected={currentNote && currentNote.id === note.id}
                >
                    {note.title}
                </div>
            {/each}
            
            <!-- Recursively render child folders -->
            {#each childFolders as childFolder (childFolder.id)}
                <FolderNode 
                    folder={childFolder}
                    openFolders={openFolders}
                    currentNote={currentNote}
                    dragOverFolder={dragOverFolder}
                    draggedItem={draggedItem}
                    on:dragstart={onDragStart}
                    on:dragover={onDragOver}
                    on:drop={onDrop}
                    on:openNote={onOpenNote}
                    on:toggleFolder={onToggleFolder}
                    on:showContextMenu={onShowContextMenu}
                />
            {/each}
        </div>
    {/if}
</div>

<style>
    /* Add relevant styles for folder nesting */
    .folder-contents {
        padding-left: 20px; /* Indent child folders */
    }
</style>
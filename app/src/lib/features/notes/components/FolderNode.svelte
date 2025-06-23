<script lang="ts">
	import { slide } from 'svelte/transition';
	import type { Folders, Notes } from '$lib/types/types';
	import { notesStore } from '$lib/stores/notesStore';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	export let folder: Folders;
	export let openFolders: Set<string>;
	export let currentNote: Notes | null;
	export let dragOverFolder: Folders | null;
	export let draggedItem: { item: Folders | Notes; isFolder: boolean } | null;

	// Events to bubble up to the parent component
	export let onDragStart: (e: DragEvent, item: Folders | Notes, isFolder: boolean) => void;
	export let onDragOver: (e: DragEvent, folder: Folders) => void;
	export let onDrop: (e: DragEvent, folder: Folders) => void;
	export let onOpenNote: (note: Notes) => void;
	export let onToggleFolder: (folder: Folders) => void;
	export let onShowContextMenu: (e: Event, item: Folders | Notes, isFolder: boolean) => void;

	// Subscribe to the store to access the data
	$: storeData = $notesStore;
	$: childFolders = storeData.folders.filter((f) => f.parentId === folder.id);
	$: notes = storeData.notes[folder.id] || [];
</script>

<div
	class="folder"
	draggable="true"
	on:dragstart={(e) => onDragStart(e, folder, true)}
	on:dragover={(e) => onDragOver(e, folder)}
	on:drop={(e) => onDrop(e, folder)}
	class:drag-over={dragOverFolder === folder}
>
	<div class="folder-title">
		<span on:click={() => onToggleFolder(folder)}>
			{#if openFolders.has(folder.id)}
				{@html getIcon('ChevronDown', { size: 16 })}
			{:else}
				{@html getIcon('ChevronRight', { size: 16 })}
			{/if}
			{folder.title}
		</span>
		<button
			class="context-menu-button"
			on:click|stopPropagation={(e) => onShowContextMenu(e, folder, true)}
		>
			{@html getIcon('MoreVertical', { size: 16 })}
		</button>
	</div>

	<!-- Render child folders and notes if folder is open -->
	{#if openFolders.has(folder.id)}
		<div class="folder-contents" transition:slide>
			{#each notes as note (note.id)}
				<div
					class="note-item"
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
				<svelte:self
					folder={childFolder}
					{openFolders}
					{currentNote}
					{dragOverFolder}
					{draggedItem}
					{onDragStart}
					{onDragOver}
					{onDrop}
					{onOpenNote}
					{onToggleFolder}
					{onShowContextMenu}
				/>
			{/each}
		</div>
	{/if}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;

	* {
		font-family: var(--font-family);
	}

	.folder {
		user-select: none;
	}

	.folder-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 8px;
		cursor: pointer;
	}

	.folder-title:hover {
		background-color: var(--color-surface-hover, #f5f5f5);
	}

	.drag-over {
		background-color: var(--color-primary-light, #e3f2fd);
	}

	.context-menu-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px;
		opacity: 0.7;
	}

	.context-menu-button:hover {
		opacity: 1;
		background-color: var(--color-surface-hover, #f0f0f0);
	}

	.folder-contents {
		padding-left: 20px;
	}

	.note-item {
		padding: 4px 8px;
		cursor: pointer;
		border-radius: 4px;
	}

	.note-item:hover {
		background-color: var(--color-surface-hover, #f5f5f5);
	}

	.note-item.selected {
		background-color: var(--color-primary-light, #e3f2fd);
		font-weight: 500;
	}
</style>

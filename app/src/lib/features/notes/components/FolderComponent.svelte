<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import type { Folders, Notes, FolderEventDetail } from '$lib/types/types';
	import { slide } from 'svelte/transition';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	export let folder: Folders;
	export let folders: Folders[];
	export let openFolders: Set<string>;
	export let currentNote: Notes | null;
	export let dragOverFolder: Folders | null;
	export let notes: Notes[];

	const dispatch = createEventDispatcher<{
		folderEvent: FolderEventDetail;
	}>();

	$: childFolders = folders.filter((f) => f.parentId === folder.id);

	function dispatchFolderEvent<T extends FolderEventDetail['type']>(
		type: T,
		detail: Extract<FolderEventDetail, { type: T }>['detail']
	) {
		dispatch('folderEvent', { type, detail } as FolderEventDetail);
	}

	function toggleFolder() {
		dispatchFolderEvent('toggleFolder', folder);
	}

	function handleDragStart(event: DragEvent) {
		dispatchFolderEvent('handleDragStart', { event, item: folder, isFolder: true });
	}

	function handleDragOver(event: DragEvent) {
		dispatchFolderEvent('handleDragOver', { event, folder });
	}

	function handleDrop(event: DragEvent) {
		dispatchFolderEvent('handleDrop', { event, folder });
	}

	function showContextMenu(event: MouseEvent) {
		dispatchFolderEvent('showContextMenu', { event, item: folder, isFolder: true });
	}

	function openNote(note: Notes) {
		dispatchFolderEvent('openNote', note);
	}
</script>

<div
	class="folder"
	draggable="true"
	on:dragstart={handleDragStart}
	on:dragover={handleDragOver}
	on:drop={handleDrop}
	class:drag-over={dragOverFolder === folder}
>
	<div class="folder-title">
		<span on:click={toggleFolder}>
			{#if openFolders.has(folder.id)}
				<Icon name="ChevronDown" size={16} />
			{:else}
				<Icon name="ChevronRight" size={16} />
			{/if}
			{folder.title}
		</span>
		<button class="context-menu-button" on:click|stopPropagation={showContextMenu}>
			<Icon name="MoreVertical" size={16} />
		</button>
	</div>
	{#if openFolders.has(folder.id)}
		<div class="folder-content" transition:slide>
			{#each notes as note (note.id)}
				<div
					class="note"
					draggable="true"
					on:dragstart={(e) =>
						dispatchFolderEvent('handleDragStart', { event: e, item: note, isFolder: false })}
					on:click={() => openNote(note)}
					on:contextmenu|preventDefault={(e) =>
						dispatchFolderEvent('showContextMenu', { event: e, item: note, isFolder: false })}
					class:selected={currentNote && currentNote.id === note.id}
					class:drag-over={dragOverFolder === folder}
				>
					{note.title}
				</div>
			{/each}
			{#each childFolders as childFolder (childFolder.id)}
				<svelte:self
					folder={childFolder}
					{folders}
					{openFolders}
					{currentNote}
					{dragOverFolder}
					notes={notes.filter((n) => n.folder === childFolder.id)}
					on:folderEvent
				/>
			{/each}
		</div>
	{/if}
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.folder {
		margin-left: 20px;
	}

	.folder-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: pointer;
		padding: 5px;
	}

	.folder-title:hover {
		background-color: rgba(255, 255, 255, 0.1);
	}

	.folder-content {
		margin-left: 20px;
	}

	.note {
		padding: 5px;
		cursor: pointer;
	}

	.note:hover {
		background-color: rgba(255, 255, 255, 0.1);
	}

	.note.selected {
		background-color: #4a4a4a;
	}

	.drag-over {
		border: 2px dashed #4a4a4a;
		background-color: #2a2a2a;
	}

	.context-menu-button {
		background: none;
		border: none;
		cursor: pointer;
		color: #888;
		padding: 2px;
	}

	.context-menu-button:hover {
		color: var(--text-color);
	}
</style>

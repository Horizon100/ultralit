<!-- <script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { ensureAuthenticated } from '$lib/pocketbase';
	import type { Folders, Notes } from '$lib/types/types';
	import { notesStore, currentFolderNotes } from '$lib/stores/notesStore';
	import {
		Folder,
		Search,
		Bookmark,
		FolderPlus,
		ListFilter,
		ChevronRight,
		ChevronDown,
		Plus,
		MoreVertical
	} from 'lucide-svelte';

	let draggedItem: { item: Folders | Notes; isFolder: boolean } | null = null;
	let dragOverFolder: Folders | null = null;
	let activeSection: 'folders' | 'search' | 'bookmarks' = 'folders';
	let searchTerm = '';
	let openFolders: Set<string> = new Set();
	let contextMenuFolder: Folders | null = null;
	let contextMenuNote: Notes | null = null;
	let contextMenuPosition: { x: number; y: number } | null = null;

	$: folders = $notesStore.folders;
	$: currentFolder = $notesStore.currentFolder;
	$: currentNote = $notesStore.currentNote;
	$: notes = $currentFolderNotes;
	$: unassignedNotes = $notesStore.notes[''] || [];

	$: filteredFolders = searchTerm
		? folders.filter((folder) => folder.title.toLowerCase().includes(searchTerm.toLowerCase()))
		: folders;

	$: filteredNotes = searchTerm
		? Object.values($notesStore.notes)
				.flat()
				.filter((note) => note.title.toLowerCase().includes(searchTerm.toLowerCase()))
		: [];

	$: rootFolders = folders.filter((folder) => !folder.parentId);

	function addFolder() {
		const newFolderName = prompt('Enter new folder name:');
		if (newFolderName) {
			notesStore.addFolder({ title: newFolderName, order: folders.length, parentId: null });
		}
	}

	function toggleFolder(folder: Folders) {
		if (openFolders.has(folder.id)) {
			openFolders.delete(folder.id);
		} else {
			openFolders.add(folder.id);
			notesStore.loadNotes(folder.id);
		}
		openFolders = openFolders;
	}

	function setCurrentFolder(folder: Folders) {
		notesStore.setCurrentFolder(folder);
		notesStore.loadNotes(folder.id);
	}

	function createNewNote(event: MouseEvent, folderId?: string) {
		notesStore.addNote({
			title: 'Untitled',
			content: '',
			folder: folderId || ''
		});
		if (folderId) {
			openFolders.add(folderId);
			openFolders = openFolders;
		}
	}

	function openNote(note: Notes) {
		console.log('Opening note:', note);
		notesStore.setCurrentNote(note);
		notesStore.addOpenTab(note);
	}

	function handleDragStart(event: DragEvent, item: Folders | Notes, isFolder: boolean) {
		draggedItem = { item, isFolder };
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(event: DragEvent, folder: Folders) {
		event.preventDefault();
		dragOverFolder = folder;
	}

	async function handleDrop(event: DragEvent, targetFolder: Folders) {
		event.preventDefault();
		if (draggedItem) {
			if (draggedItem.isFolder) {
				const draggedFolder = draggedItem.item as Folders;
				if (draggedFolder.id !== targetFolder.id && !isDescendant(targetFolder, draggedFolder)) {
					await notesStore.updateFolder(draggedFolder.id, { parentId: targetFolder.id });
				}
			} else {
				const draggedNote = draggedItem.item as Notes;
				if (draggedNote.folder !== targetFolder.id) {
					await notesStore.updateNote(draggedNote.id, { folder: targetFolder.id });
					// Refresh the notes for both the source and target folders
					await notesStore.loadNotes(draggedNote.folder);
					await notesStore.loadNotes(targetFolder.id);
				}
			}
		}
		dragOverFolder = null;
		draggedItem = null;
	}

	function isDescendant(potentialParent: Folders, folder: Folders): boolean {
		let current = folder;
		while (current.parentId) {
			if (current.parentId === potentialParent.id) {
				return true;
			}
			current = folders.find((f) => f.id === current.parentId) as Folders;
		}
		return false;
	}

	function showContextMenu(event: MouseEvent, item: Folders | Notes, isFolder: boolean) {
		event.preventDefault();
		if (isFolder) {
			contextMenuFolder = item as Folders;
			contextMenuNote = null;
		} else {
			contextMenuNote = item as Notes;
			contextMenuFolder = null;
		}
		contextMenuPosition = { x: event.clientX, y: event.clientY };
	}

	function hideContextMenu() {
		contextMenuFolder = null;
		contextMenuNote = null;
		contextMenuPosition = null;
	}

	function handleFolderContextMenuAction(action: 'add' | 'rename' | 'delete') {
		if (!contextMenuFolder) return;

		switch (action) {
			case 'add':
				createNewNote(new MouseEvent('click'), contextMenuFolder.id);
				break;
			case 'rename':
				const newName = prompt('Enter new folder name:', contextMenuFolder.title);
				if (newName) {
					notesStore.updateFolder(contextMenuFolder.id, { title: newName });
				}
				break;
			case 'delete':
				if (confirm('Are you sure you want to delete this folder and all its notes?')) {
					notesStore.deleteFolder(contextMenuFolder.id);
				}
				break;
		}

		hideContextMenu();
	}

	function handleNoteContextMenuAction(action: 'rename' | 'delete') {
		if (!contextMenuNote) return;

		switch (action) {
			case 'rename':
				const newTitle = prompt('Enter new note title:', contextMenuNote.title);
				if (newTitle) {
					notesStore.updateNote(contextMenuNote.id, { title: newTitle });
				}
				break;
			case 'delete':
				if (confirm('Are you sure you want to delete this note?')) {
					notesStore.deleteNote(contextMenuNote.id, contextMenuNote.folder);
				}
				break;
		}

		hideContextMenu();
	}

	onMount(async () => {
		await ensureAuthenticated();
		await notesStore.initializeFolders();
		await notesStore.loadAllNotes();
	});
</script>

<div class="container" on:click={hideContextMenu}>
	<div class="side-column">
		<span>🏠</span>
	</div>

	<div class="explorer">
		<div class="explorer-header">
			<span class:active={activeSection === 'folders'} on:click={() => (activeSection = 'folders')}>
				<Folder size={24} class="nav-icon" />
			</span>
			<span class:active={activeSection === 'search'} on:click={() => (activeSection = 'search')}>
				<Search size={24} class="nav-icon" />
			</span>
			<span
				class:active={activeSection === 'bookmarks'}
				on:click={() => (activeSection = 'bookmarks')}
			>
				<Bookmark size={24} class="nav-icon" />
			</span>
		</div>

		{#if activeSection === 'folders'}
			<div class="explorer-nav" transition:slide>
				<span on:click={addFolder}>
					<FolderPlus size={24} class="nav-icon" />
				</span>
				<span on:click={(e) => createNewNote(e)}>
					<Plus size={24} class="nav-icon" />
				</span>
				<span>
					<ListFilter size={24} class="nav-icon" />
				</span>
			</div>

			<div class="explorer-content">
				{#each rootFolders as folder (folder.id)}
					<div
						class="folder"
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, folder, true)}
						on:dragover={(e) => handleDragOver(e, folder)}
						on:drop={(e) => handleDrop(e, folder)}
						class:drag-over={dragOverFolder === folder}
					>
						<div class="folder-title">
							<span on:click={() => toggleFolder(folder)}>
								{#if openFolders.has(folder.id)}
									<ChevronDown size={16} />
								{:else}
									<ChevronRight size={16} />
								{/if}
								{folder.title}
							</span>
							<button
								class="context-menu-button"
								on:click|stopPropagation={(e) => showContextMenu(e, folder, true)}
							>
								<MoreVertical size={16} />
							</button>
						</div>
						{#if openFolders.has(folder.id)}
							<div class="folder-notes" transition:slide>
								{#each $notesStore.notes[folder.id] || [] as note (note.id)}
									<div
										draggable="true"
										on:dragstart={(e) => handleDragStart(e, note, false)}
										on:click={() => openNote(note)}
										on:contextmenu|preventDefault={(e) => showContextMenu(e, note, false)}
										class:selected={currentNote && currentNote.id === note.id}
										class:drag-over={dragOverFolder === folder}
									>
										{note.title}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
				{#if unassignedNotes.length > 0}
					<div class="unassigned-notes">
						<h3>Unassigned Notes</h3>
						{#each unassignedNotes as note (note.id)}
							<div
								draggable="true"
								on:dragstart={(e) => handleDragStart(e, note, false)}
								on:click={() => openNote(note)}
								on:contextmenu|preventDefault={(e) => showContextMenu(e, note, false)}
								class:selected={currentNote && currentNote.id === note.id}
							>
								{note.title}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		{#if activeSection === 'search'}
			<div class="search-container" transition:slide>
				<input type="text" bind:value={searchTerm} placeholder="Search folders and notes..." />
				{#if searchTerm}
					<div class="search-results">
						<h3>Folders</h3>
						{#each filteredFolders as folder}
							<div on:click={() => setCurrentFolder(folder)}>{folder.title}</div>
						{/each}
						<h3>Notes</h3>
						{#each filteredNotes as note}
							<div on:click={() => openNote(note)}>{note.title}</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<div class="explorer-footer">
			<span>⚙️</span>
		</div>
	</div>

	<div class="editor">
		<slot></slot>
	</div>
</div>

{#if (contextMenuFolder || contextMenuNote) && contextMenuPosition}
	<div class="context-menu" style="top: {contextMenuPosition.y}px; left: {contextMenuPosition.x}px">
		{#if contextMenuFolder}
			<button on:click={() => handleFolderContextMenuAction('add')}>Add Note</button>
			<button on:click={() => handleFolderContextMenuAction('rename')}>Rename Folder</button>
			<button on:click={() => handleFolderContextMenuAction('delete')}>Delete Folder</button>
		{:else if contextMenuNote}
			<button on:click={() => handleNoteContextMenuAction('rename')}>Rename Note</button>
			<button on:click={() => handleNoteContextMenuAction('delete')}>Delete Note</button>
		{/if}
	</div>
{/if}

<style>
	.container {
		display: flex;
		flex-direction: row;
		position: absolute;
		width: 98%;
		right: 1%;
		height: 90vh;
		text-align: center;
		justify-content: right;
		align-items: right;
		/* padding: 1em; */
		/* height: 94vh; */
		/* width: 59%; */
		/* margin-left: 50%; */
		/* margin-top: 25%; */
		/* max-width: 240px; */
		/* margin: 0 auto; */
		color: #ffd700;
		border-radius: 50px;
		transition: all ease 0.3s;
		background: #000000;
		animation: pulsate 1.5s infinite alternate;
	}

	.side-column {
		width: 60px;
		background-color: #151515;
		display: flex;
		justify-content: center;
		align-items: top;
		border-right: 1px solid #2a2a2a;
		border-top: 1px solid #181818;
		user-select: none;
		padding: 10px;
		border-radius: 50px;
	}

	.explorer {
		width: 400px;
		/* height: 99%; */
		display: flex;
		flex-direction: column;
		/* justify-content: space-between; */
		border-right: 1px solid #181818;
		background-color: #151515;
		border-radius: 50px;

		padding: 10px;
	}

	.explorer-header,
	.explorer-footer {
		padding: 10px 20px;
		/* background-color: #1e1e1e; */
		color: white;
		display: flex;
		justify-content: space-between;
		user-select: none;
		border-top: 1px solid #181818;
		border-bottom: 1px solid #181818;
	}

	.explorer-nav {
		padding: 10px 20px;
		background-color: #1e1e1e;
		color: white;
		display: flex;
		justify-content: space-between;
		user-select: none;
		/* border-top: 1px solid #181818; */
		border-bottom: 1px solid #181818;
		border-radius: 20px;
	}

	.explorer-content {
		flex-grow: 1;
		overflow-y: auto;
		padding: 10px 10px;

		color: white;
	}

	.explorer-header span,
	.explorer-nav span,
	.explorer-footer span {
		transition: background-color 0.3s ease;
		padding: 5px;
		border-radius: 4px;
	}

	.explorer-header span:hover,
	.explorer-nav span:hover,
	.explorer-footer span:hover {
		background-color: rgba(255, 255, 255, 0.1);
	}

	.explorer-header span.active {
		background-color: rgba(255, 255, 255, 0.2);
	}

	.folder {
		padding: 10px;
		/* margin-top: 20px; */
	}

	.folder-title {
		font-weight: bold;
		cursor: pointer;
		transition: background-color ease-in 0.3s;
	}

	.folder-title:hover {
		background-color: rgb(0, 0, 0);
	}

	.folder-notes {
		/* margin-left: 50px; */
		padding: 0 50px;
		margin-top: 10px;
		border-left: 1px solid rgb(172, 172, 172);
	}

	.folder-notes div {
		margin-top: 10px; /* Increased gap between notes */
	}

	.editor {
		flex-grow: 1;
		width: 100%;
		text-align: left;

		/* background-color: #1e1e1e; */
	}

	.tab-row {
		background-color: #353f3f;
		display: flex;
		user-select: none;
		align-items: center;
	}

	.tab {
		display: flex;
		align-items: center;
		justify-content: space-between;
		transition: background-color 0.3s ease;
		padding: 10px;
		border: none;
	}

	.tab.active {
		background-color: #1e1e1e;
		color: white;
		border-top-left-radius: 10px;
		border-top-right-radius: 10px;
	}

	.close-tab,
	.new-tab {
		background: none;
		border: none;
		cursor: pointer;
		color: #888;
		padding: 5px;
		margin-left: 5px;
	}

	.close-tab:hover,
	.new-tab:hover {
		color: white;
	}

	.title {
		height: 50px;
		width: 80%;
		margin-left: 10%;
		margin-top: 2rem;
		color: white;
	}

	textarea {
		/* height: 94%; */
		width: 80%;
		/* margin-left: 10%; */
		margin-top: 2rem;
		color: white;
		background-color: transparent;
		border: none;
		outline: none;
	}

	textarea:focus {
		outline: none;
	}

	.folder.drag-over {
		border: 2px dashed #4a4a4a;
		background-color: #2a2a2a;
	}

	.folder-notes div.drag-over {
		background-color: #2a2a2a;
	}

	.folder-title {
		display: flex;
		align-items: center;
	}

	.folder-title :global(svg) {
		margin-right: 5px;
		transition: transform 0.3s ease;
	}

	.no-document {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #888;
	}

	.no-document h1 {
		margin-bottom: 20px;
	}

	.no-document button {
		display: flex;
		align-items: center;
		background-color: #4a4a4a;
		color: white;
		border: none;
		padding: 10px 15px;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.3s ease;
	}

	.no-document button:hover {
		background-color: #5a5a5a;
	}

	.no-document button :global(svg) {
		margin-right: 5px;
	}

	#editor {
		height: 100%;
		color: white;
		padding: 20px;
	}

	#editor:focus::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 2px;
		background-color: #4a4a4a;
		animation: pulse 2s infinite;
	}

	.search-container {
		/* padding: 10px; */
		/* background-color: red; */
		display: flex;
		justify-content: center;
		height: 50px;
	}

	.search-container input {
		width: 100%;
		padding: 5px;
		margin-bottom: 10px;
	}

	.search-results h3 {
		margin-top: 10px;
		margin-bottom: 5px;
	}

	.search-results div {
		cursor: pointer;
		padding: 5px;
	}

	.search-results div:hover {
		background-color: rgba(255, 255, 255, 0.1);
	}

	.folder-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.context-menu-button {
		background: none;
		border: none;
		cursor: pointer;
		color: #888;
		padding: 2px;
	}

	.context-menu-button:hover {
		color: white;
	}

	.context-menu {
		position: fixed;
		background-color: #2a2a2a;
		border: 1px solid #4a4a4a;
		border-radius: 4px;
		padding: 5px 0;
		z-index: 1000;
	}

	.context-menu button {
		display: block;
		width: 100%;
		padding: 5px 10px;
		text-align: left;
		background: none;
		border: none;
		color: white;
		cursor: pointer;
	}

	.context-menu button:hover {
		background-color: #4a4a4a;
	}

	.folder-notes div,
	.unassigned-notes div {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 5px;
		cursor: pointer;
	}

	.folder-notes div:hover,
	.unassigned-notes div:hover {
		background-color: rgba(255, 255, 255, 0.1);
	}

	.folder-notes div.selected,
	.unassigned-notes div.selected {
		background-color: #4a4a4a;
	}

	.unassigned-notes {
		margin-top: 20px;
		padding: 10px;
	}

	.unassigned-notes h3 {
		font-size: 14px;
		color: #888;
		margin-bottom: 10px;
	}

	.unassigned-notes div {
		margin-top: 5px;
		cursor: pointer;
	}

	.folder-content {
		padding-left: 20px;
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

	@keyframes pulse {
		0% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
		100% {
			opacity: 0.5;
		}
	}

	.test-slide {
		animation-duration: 3s;
		animation-name: slideIn;
	}

	@keyframes slideIn {
		from {
			margin-left: 0%;
			width: 50%;
		}
		to {
			margin-left: 100%;
			width: 100%;
		}
	}
</style> -->
<slot></slot>

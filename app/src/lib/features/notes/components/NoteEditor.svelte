<script lang="ts">
	import { onMount } from 'svelte';
	import { currentUser } from '$lib/pocketbase';
	import { elasticOut, elasticIn } from 'svelte/easing';
	import { fly, slide, fade } from 'svelte/transition';
	import type { Notes, Attachment, Folders, AIModel, ProviderType } from '$lib/types/types';
	import { notesStore } from '$lib/stores/notesStore';
	import { fetchAIResponse } from '$lib/clients/aiClient';
	import { X, FileIcon } from 'lucide-svelte';
	import Headmaster from '$lib/assets/illustrations/headmaster.jpeg';
	import {
		handleImageUpload,
		onFileSelected,
		handleImageResize,
		handleImageAlign
	} from '$lib/utils/imageHandlers';
	import { notesClient } from '$lib/clients/notesClient';
	import { page } from '$app/stores';
	import { ensureAuthenticated } from '$lib/pocketbase';
	import { currentFolderNotes } from '$lib/stores/notesStore';
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
	import {
		sidenavStore,
		showSidenav,
		showInput,
		showRightSidenav,
		showFilters,
		showOverlay,
		showSettings,
		showEditor,
		showExplorer
	} from '$lib/stores/sidenavStore';

	let draggedItem: { item: Folders | Notes; isFolder: boolean } | null = null;
	let dragOverFolder: Folders | null = null;
	let activeSection: 'folders' | 'search' | 'bookmarks' = 'folders';
	let searchTerm = '';
	let openFolders: Set<string> = new Set();
	let contextMenuFolder: Folders | null = null;
	let contextMenuNote: Notes | null = null;
	// let contextMenuPosition: { x: number; y: number } | null = null;

	let contextMenuVisible = false;
	let contextMenuPosition = { x: 0, y: 0 };
	let selectedText = '';
	let fileInput: HTMLInputElement;
	let dragCounter = 0;
	let isDragging = false;
	let attachmentsVisible = false;
	let showFade = false;
	let showH2 = false;

	$: currentNote = $notesStore.currentNote;
	$: openTabs = $notesStore.openTabs;
	$: user = $currentUser;
	$: folders = $notesStore.folders;
	$: currentFolder = $notesStore.currentFolder;
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

	function closeTab(note: Notes) {
		notesStore.removeOpenTab(note);
		if (currentNote && currentNote.id === note.id) {
			notesStore.setCurrentNote(null);
		}
	}

	function handleNoteContentChange(event: Event) {
		const target = event.target as HTMLDivElement;
		if (currentNote) {
			notesStore.updateNote(currentNote.id, { content: target.innerHTML });
		}
		applyMarkdownStyling(target);
	}

	function handleNoteTitleChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (currentNote) {
			notesStore.updateNote(currentNote.id, { title: target.value });
		}
	}

	function applyMarkdownStyling(element: HTMLDivElement) {
		// ... (keep existing markdown styling logic)
	}

	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();
		const selection = window.getSelection();
		if (selection) {
			selectedText = selection.toString().trim();
		}
		contextMenuVisible = true;
		contextMenuPosition = { x: event.clientX, y: event.clientY };
	}

	function hideContextMenu() {
		contextMenuVisible = false;
	}

	function updateNoteContent() {
		const noteContent = document.querySelector('.note-content') as HTMLDivElement;
		if (noteContent && currentNote) {
			notesStore.updateNote(currentNote.id, { content: noteContent.innerHTML });
		}
	}

	async function handleContextMenuOption(option: string) {
		hideContextMenu();
		let prompt = '';
		switch (option) {
			case 'joke':
				prompt = 'Tell me a short joke';
				break;
			case 'fact':
				prompt = 'Tell me an interesting fact';
				break;
			case 'summarize':
				prompt = `Summarize the following text: "${selectedText}"`;
				break;
			case 'criticize':
				prompt = `Provide a critical analysis of the following text: "${selectedText}"`;
				break;
			case 'uploadImage':
				handleImageUpload(fileInput);
				return;
			case 'alignLeft':
			case 'alignCenter':
			case 'alignRight':
				handleImageAlign(
					option.replace('align', '').toLowerCase() as 'left' | 'center' | 'right',
					updateNoteContent
				);
				return;
		}

		if (prompt) {
			try {
				const currentAIModel: AIModel = getCurrentAIModel();
				const response = await fetchAIResponse(
					[
						{
							role: 'user',
							content: prompt,
							provider: currentAIModel.provider,
							model: currentAIModel.id
						}
					],
					currentAIModel,
					'user123'
				);
				if (option === 'summarize' || option === 'criticize') {
					wrapSelectedTextWithAIAnalysis(response, option);
				} else {
					insertTextAtCursorWithAnimation(response);
				}
			} catch (error) {
				console.error('Error fetching AI response:', error);
				insertTextAtCursorWithAnimation('Error: Unable to fetch AI response');
			}
		}
	}

	function handleDragEnter(event: DragEvent) {
		event.preventDefault();
		dragCounter++;
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		dragCounter--;
		if (dragCounter === 0) {
			isDragging = false;
		}
	}

	function insertTextAtCursorWithAnimation(text: string, isAnalysis = false) {
		const selection = window.getSelection();
		if (selection && selection.rangeCount > 0 && currentNote) {
			const range = selection.getRangeAt(0);
			const span = document.createElement('span');
			span.className = isAnalysis ? 'ai-analyzed-text' : 'ai-generated-text';
			if (isAnalysis) {
				span.setAttribute('data-analysis', text);
				span.textContent = selectedText;
			}
			range.insertNode(span);

			if (!isAnalysis) {
				let index = 0;
				const typingInterval = setInterval(() => {
					if (index < text.length) {
						span.textContent += text[index];
						index++;
						// Ensure the cursor stays at the end of the typed text
						const newRange = document.createRange();
						newRange.setStartAfter(span);
						newRange.collapse(true);
						selection.removeAllRanges();
						selection.addRange(newRange);
					} else {
						clearInterval(typingInterval);
						updateNoteContent();
					}
				}, 30);
			} else {
				updateNoteContent();
			}
		}
	}

	function insertNodeAtCursor(node: Node) {
		const selection = window.getSelection();
		if (selection && selection.rangeCount > 0) {
			const range = selection.getRangeAt(0);
			range.insertNode(node);
			range.setStartAfter(node);
			range.setEndAfter(node);
			selection.removeAllRanges();
			selection.addRange(range);
			updateNoteContent();
		}
	}
	async function uploadAttachment(file: File) {
		if (currentNote) {
			try {
				console.log('Uploading file:', file.name, 'to note:', currentNote.id);
				const uploadedFile = await notesClient.uploadAttachment(currentNote.id, file);
				console.log('Uploaded attachment:', uploadedFile);

				// Fetch the updated note
				const updatedNote = await notesClient.getNote(currentNote.id);

				// Update the current note in the store
				notesStore.updateNote(currentNote.id, updatedNote);
			} catch (error) {
				console.error('Error uploading attachment:', error);
				if (error instanceof Error) {
					console.error('Error message:', error.message);
					console.error('Error stack:', error.stack);
				}
			}
		}
	}

	function toggleAttachments() {
		attachmentsVisible = !attachmentsVisible;
	}

	function wrapSelectedTextWithAIAnalysis(analysis: string, type: string) {
		const selection = window.getSelection();
		if (selection && selection.rangeCount > 0 && currentNote) {
			const range = selection.getRangeAt(0);
			const span = document.createElement('span');
			span.className = `ai-analyzed-text ${type}`;
			span.setAttribute('data-analysis', analysis);
			span.textContent = selectedText;
			range.deleteContents();
			range.insertNode(span);
			const noteContent = document.querySelector('.note-content') as HTMLDivElement;
			if (noteContent) {
				notesStore.updateNote(currentNote.id, { content: noteContent.innerHTML });
			}
		}
	}

	function showTooltip(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (target.classList.contains('ai-analyzed-text')) {
			const tooltip = document.createElement('div');
			tooltip.className = 'ai-tooltip';
			tooltip.textContent = target.getAttribute('data-analysis') || '';
			document.body.appendChild(tooltip);

			const rect = target.getBoundingClientRect();
			tooltip.style.left = `${rect.left}px`;
			tooltip.style.top = `${rect.bottom + 5}px`;

			target.addEventListener(
				'mouseleave',
				() => {
					document.body.removeChild(tooltip);
				},
				{ once: true }
			);
		}
	}

	$: if (currentNote && !currentNote.attachments) {
		loadAttachments(currentNote.id);
	}

	async function loadAttachments(noteId: string) {
		try {
			const attachments = await notesClient.getAttachments(noteId);
			if (currentNote) {
				notesStore.updateNote(noteId, { attachments });
			}
		} catch (error) {
			console.error('Error loading attachments:', error);
		}
	}

	function getCurrentAIModel(): AIModel {
		return {
			id: 'default-model',
			name: 'Default Model',
			api_key: 'your-api-key',
			base_url: 'https://api.openai.com',
			api_type: 'gpt-3.5-turbo',
			api_version: '1.0',
			description: 'Default AI model',
			user: ['default-user'],
			created: new Date().toISOString(),
			updated: new Date().toISOString(),
			provider: 'openai',
			collectionId: 'ai_models',
			collectionName: 'ai_models'
		};
	}
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
	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		dragCounter = 0;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				if (file.size > 5 * 1024 * 1024) {
					alert(`File ${file.name} is too large. Maximum size is 5MB.`);
					continue;
				}

				if (file.type.startsWith('image/')) {
					const reader = new FileReader();
					reader.onload = (e) => {
						const img = document.createElement('img');
						img.src = e.target?.result as string;
						img.style.maxWidth = '100%';
						img.style.height = 'auto';
						insertNodeAtCursor(img);
					};
					reader.readAsDataURL(file);
				} else {
					await uploadAttachment(file);
				}
			}
		}
	}

	/*
	 * async function handleDrop(event: DragEvent, targetFolder: Folders) {
	 * 	event.preventDefault();
	 * 	if (draggedItem) {
	 * 		if (draggedItem.isFolder) {
	 * 			const draggedFolder = draggedItem.item as Folders;
	 * 			if (draggedFolder.id !== targetFolder.id && !isDescendant(targetFolder, draggedFolder)) {
	 * 				await notesStore.updateFolder(draggedFolder.id, { parentId: targetFolder.id });
	 * 			}
	 * 		} else {
	 * 			const draggedNote = draggedItem.item as Notes;
	 * 			if (draggedNote.folder !== targetFolder.id) {
	 * 				await notesStore.updateNote(draggedNote.id, { folder: targetFolder.id });
	 * 				// Refresh the notes for both the source and target folders
	 * 				await notesStore.loadNotes(draggedNote.folder);
	 * 				await notesStore.loadNotes(targetFolder.id);
	 * 			}
	 * 		}
	 * 	}
	 * 	dragOverFolder = null;
	 * 	draggedItem = null;
	 * }
	 */

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

	/*
	 * function hideContextMenu() {
	 * 	contextMenuFolder = null;
	 * 	contextMenuNote = null;
	 * 	contextMenuPosition = null;
	 * }
	 */

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

	onMount(() => {
		user = $currentUser;
		setTimeout(() => (showFade = true), 50);
		setTimeout(() => (showH2 = true), 50);
	});
</script>
<div class="container" on:click={hideContextMenu}>
	{#if $showExplorer}
		<div class="explorer">
			<div class="explorer-header">
				<span
					class:active={activeSection === 'folders'}
					on:click={() => (activeSection = 'folders')}
				>
					<Folder size={16} class="nav-icon" />
				</span>
				<span class:active={activeSection === 'search'} on:click={() => (activeSection = 'search')}>
					<Search size={16} class="nav-icon" />
				</span>
				<span
					class:active={activeSection === 'bookmarks'}
					on:click={() => (activeSection = 'bookmarks')}
				>
					<Bookmark size={16} class="nav-icon" />
				</span>
			</div>

			{#if activeSection === 'folders'}
				<div class="explorer-nav" transition:slide>
					<span on:click={addFolder}>
						<FolderPlus size={16} class="nav-icon" />
					</span>
					<span on:click={(e) => createNewNote(e)}>
						<Plus size={16} class="nav-icon" />
					</span>
					<span>
						<ListFilter size={16} class="nav-icon" />
					</span>
				</div>

				<div class="explorer-content">
					{#each rootFolders as folder (folder.id)}
						<div
							class="folder"
							draggable="true"
							on:dragstart={(e) => handleDragStart(e, folder, true)}
							on:dragover={(e) => handleDragOver(e, folder)}
							on:drop={(e) => handleDrop(e)}
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
	{/if}
</div>

{#if showH2}
	<div class="content" in:fly={{ x: 200, duration: 400 }} out:fade={{ duration: 300 }}>
		<div class="tab-row">
			<button class="new-tab" on:click={createNewNote}>
				<Plus size={16} />
			</button>
			{#each openTabs as tab (tab.id)}
				<div
					class="tab"
					class:active={currentNote && currentNote.id === tab.id}
					transition:fly={{ x: 100, duration: 200 }}
				>
					<span on:click={() => notesStore.setCurrentNote(tab)}>{tab.title}</span>
					<button class="close-tab" on:click={() => closeTab(tab)}>
						<X size={16} />
					</button>
				</div>
			{/each}
		</div>

		<input
			type="file"
			accept="image/*"
			style="display: none"
			on:change={(e) => onFileSelected(e, updateNoteContent)}
			bind:this={fileInput}
		/>

		{#if currentNote}
			<input
				type="text"
				bind:value={currentNote.title}
				on:input={handleNoteTitleChange}
				placeholder="Note title"
				class="note-title"
			/>
			<div
				contenteditable="true"
				on:input={handleNoteContentChange}
				on:contextmenu={handleContextMenu}
				on:click={showTooltip}
				on:dragenter={handleDragEnter}
				on:dragleave={handleDragLeave}
				on:dragover={(event) => currentFolder && handleDragOver(event, currentFolder)}
				on:drop={(event) => currentFolder && handleDrop(event)}
				class="note-content"
				class:dragging={isDragging}
				bind:innerHTML={currentNote.content}
			></div>
			<input
				type="file"
				accept="image/*"
				style="display: none"
				on:change={(e) => onFileSelected(e, updateNoteContent)}
				bind:this={fileInput}
			/>
			<div class="attachments-toggle" on:click={toggleAttachments}>
				Attachments ({currentNote.attachments?.length || 0})
			</div>
			{#if attachmentsVisible}
				<div class="attachments-container" transition:slide>
					{#each currentNote.attachments || [] as attachment}
						<div class="attachment">
							<FileIcon />
							<span>{attachment.fileName}</span>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- <div class="no-document">
			<h1>No documents</h1>
			<button on:click={createNewNote}>
				<Plus size={16} />
				Create new note
			</button>
		</div> -->
		{/if}

		{#if contextMenuVisible}
			<div
				class="context-menu"
				style="top: {contextMenuPosition.y}px; left: {contextMenuPosition.x}px;"
				on:mouseleave={hideContextMenu}
			>
				<button on:click={() => handleContextMenuOption('joke')}>Tell a joke</button>
				<button on:click={() => handleContextMenuOption('fact')}>Tell an interesting fact</button>
				{#if selectedText}
					<button on:click={() => handleContextMenuOption('summarize')}
						>Summarize selected text</button
					>
					<button on:click={() => handleContextMenuOption('criticize')}
						>Criticize selected text</button
					>
				{/if}
				<button on:click={() => handleContextMenuOption('uploadImage')}>Upload Image</button>
				<button on:click={() => handleContextMenuOption('alignLeft')}>Align Left</button>
				<button on:click={() => handleContextMenuOption('alignCenter')}>Align Center</button>
				<button on:click={() => handleContextMenuOption('alignRight')}>Align Right</button>
			</div>
		{/if}

		{#if attachmentsVisible && currentNote?.attachments}
			<div class="attachments-container" transition:slide>
				{#each currentNote.attachments as attachment (attachment.id)}
					<div class="attachment">
						<FileIcon />
						<span>{attachment.fileName}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
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

{#if showFade}
	<div in:fade={{ duration: 500 }} out:fade={{ duration: 300 }}>
		<img src={Headmaster} alt="Notes illustration" class="illustration" />
	</div>
{/if}


<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
		transition: all 0.3s ease;
	}

	.container {
		display: flex;
		flex-direction: row;
		position: relative;
		width: auto;
		height: 90vh;
		text-align: center;
		justify-content: center;
		align-items: right;
		/* padding: 1em; */
		/* height: 94vh; */
		/* width: 59%; */
		/* margin-left: 50%; */
		/* margin-top: 25%; */
		/* max-width: 240px; */
		/* margin: 0 auto; */
		border-radius: 50px;
		transition: all ease 0.3s;

		animation: pulsate 1.5s infinite alternate;
	}

	.explorer {
		width: 200px;
		/* height: 99%; */
		display: flex;
		flex-direction: column;
		position: relative;
		/* justify-content: space-between; */
		background-color: var(--primary-color);
	}
	.content {
		display: flex;
		flex-direction: column;
		position: relative;
		width: calc(100% - 200px);
		height: 90vh;
		// background: var(--bg-gradient-r);
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
		background: var(--bg-gradient);
		display: flex;
		user-select: none;
		align-items: center;
		width: 100vw;
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
		background-color: var(--primary-color) !important;
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
		position: absolute;

		width: 400px;
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
	.tab-row {
		background-color: #151515;
		display: flex;
		user-select: none;
		align-items: center;
		padding-top: 10px;
		gap: 4px;
		width: auto;
	}

	.tab {
		display: flex;
		align-items: center;
		justify-content: space-between;
		transition: background-color 0.3s ease;
		padding: 5px 20px;
		border: none;
		color: gray;
		border-top-right-radius: 10px;
		border-top-left-radius: 10px;
	}

	.tab.active {
		background-color: #1e1e1e;
		color: white;
	}

	.new-tab {
		background: none;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		color: #888;
		padding: 5px 20px;
		margin: 5px;
		background-color: #1e1e1e;
	}

	.close-tab {
		background: none;
		border: none;
		cursor: pointer;
		color: #888;
		padding: 10px;
		margin-left: 5px;
		background-color: transparent;
	}

	.close-tab:hover,
	.new-tab:hover {
		color: white;
	}

	.note-title {
		display: flex;
		flex-direction: row;
		width: 77vw;
		padding-top: 1rem;
		padding-bottom: 1rem;
		margin-left: 1rem;
		font-size: 30px;
		font-weight: bold;
		background-color: transparent;
		color: white;
		border: none;
		border-bottom: 1px solid #4a4a4a;
		background-color: var(--primary-color) !important;

		outline: none;
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
		background-color: var(--primary-color);
		color: white;
		border: none;
		padding: 10px 15px;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.3s ease;
	}

	.no-document button:hover {
		background-color: var(--tertiary-color);
	}

	.no-document button :global(svg) {
		margin-right: 5px;
	}

	.illustration {
		position: absolute;
		width: 95%;
		height: auto;
		left: 5%;
		top: 50%;
		transform: translateY(-50%);
		opacity: 0.015;
		z-index: 1;
		pointer-events: none;
	}

	.editor-toolbar {
		display: flex;
		background-color: var(--secondary-color);
		padding: 5px;
	}

	.editor-toolbar button {
		background: none;
		border: none;
		color: white;
		padding: 5px 10px;
		margin: 0 2px;
		cursor: pointer;
		border-radius: 3px;
	}

	.editor-toolbar button:hover {
		background-color: #3a3a3a;
	}

	.note-content h1,
	.note-content h2,
	.note-content h3,
	.note-content h4,
	.note-content h5,
	.note-content h6 {
		margin-top: 20px;
		margin-bottom: 10px;
	}

	.note-content {
		height: calc(100% - 120px);
		width: 78vw;

		color: white;
		border: none;
		text-align: left;
		margin-left: 1rem;
		outline: none;
		overflow: auto;
		font-family: 'Courier New', Courier, monospace;
		scroll-behavior: smooth;
		scrollbar-color: var(--primary-color) transparent;
		white-space: nowrap;
		-webkit-overflow-scrolling: touch;
		background-color: var(--primary-color);
	}

	.note-content h1,
	.note-content h2,
	.note-content h3 {
		margin-top: 20px;
		margin-bottom: 10px;
		font-family: Arial, sans-serif;
	}

	.note-content ul,
	.note-content ol {
		padding-left: 20px;
	}

	.note-content a {
		color: #4a9eff;
		text-decoration: underline;
	}

	.note-content blockquote {
		border-left: 3px solid #4a4a4a;
		margin: 10px 0;
		padding-left: 10px;
		color: #aaa;
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
		background-color: #3a3a3a;
	}

	.ai-generated-text {
		background-color: rgba(100, 149, 237, 0.1);
		color: #6495ed;
		padding: 2px 4px;
		border-radius: 3px;
		font-weight: 500;
		transition:
			background-color 0.3s ease,
			color 0.3s ease;
	}

	.ai-generated-text::after {
		content: '|';
		animation: blink 0.7s infinite;
		font-weight: normal;
		background-color: rgba(100, 149, 237, 0.2);
		color: #4169e1;
	}

	.ai-generated-text:hover {
		background-color: rgba(100, 149, 237, 0.2);
		color: #4169e1;
	}

	.ai-analyzed-text {
		border-bottom: 2px dashed #6495ed;
		cursor: pointer;
	}

	.ai-analyzed-text.summarize {
		background-color: rgba(100, 149, 237, 0.1);
	}

	.ai-analyzed-text.criticize {
		background-color: rgba(255, 99, 71, 0.1);
	}

	.ai-tooltip {
		position: absolute;
		background-color: #333;
		color: white;
		padding: 5px 10px;
		border-radius: 4px;
		font-size: 14px;
		max-width: 300px;
		z-index: 1000;
	}

	.note-content.dragging {
		border: 2px dashed #4a9eff;
	}

	.attachments-toggle {
		background-color: #2a2a2a;
		color: white;
		padding: 10px;
		cursor: pointer;
		text-align: center;
	}

	.attachments-container {
		background-color: #1e1e1e;
		padding: 10px;
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.attachment {
		display: flex;
		flex-direction: column;
		align-items: center;
		color: white;
		font-size: 12px;
	}

	@keyframes blink {
		0% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
		100% {
			opacity: 1;
		}
	}
</style>

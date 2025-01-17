<script lang="ts">
      import { onMount } from 'svelte';
  import { currentUser } from '$lib/pocketbase';
  import { elasticOut, elasticIn } from 'svelte/easing';
    import { fly, slide, fade } from 'svelte/transition';
    import type { Notes, Attachment, AIModel } from '$lib/types/types';
    import { notesStore } from '$lib/stores/notesStore';
    import { fetchAIResponse } from '$lib/clients/aiClient';
    import { X, Plus, FileIcon } from 'lucide-svelte';
    import Headmaster from '$lib/assets/illustrations/headmaster2.png';
    import { handleImageUpload, onFileSelected, handleImageResize, handleImageAlign } from '$lib/utils/imageHandlers';
    import { notesClient } from '$lib/clients/notesClient';
    import { page } from '$app/stores';

    $: currentNote = $notesStore.currentNote;
    $: openTabs = $notesStore.openTabs;
    $: user = $currentUser;

    let contextMenuVisible = false;
    let contextMenuPosition = { x: 0, y: 0 };
    let selectedText = "";
    let fileInput: HTMLInputElement;
    let dragCounter = 0;
    let isDragging = false;
    let attachmentsVisible = false;
    let showFade = false;
    let showH2 = false;

    function createNewNote(event: MouseEvent) {
        notesStore.addNote({
            title: 'Untitled',
            content: '',
            folder: ''
        });
    }

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
            handleImageAlign(option.replace('align', '').toLowerCase() as 'left' | 'center' | 'right', updateNoteContent);
            return;
    }

    if (prompt) {
        try {
            // Assuming you have a default AIModel object or a way to get the current AIModel
            const currentAIModel: AIModel = getCurrentAIModel(); // You need to implement this function
            const response = await fetchAIResponse([{ role: 'user', content: prompt }], currentAIModel, 'user123');
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

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
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

            target.addEventListener('mouseleave', () => {
                document.body.removeChild(tooltip);
            }, { once: true });
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
    // This is just a placeholder. You should implement the logic to get the current AIModel.
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
        updated: new Date().toISOString()
    };
}

onMount(() => {
        user = $currentUser;
        setTimeout(() => showFade = true, 50);
        setTimeout(() => showH2 = true, 50);
    });

</script>

    {#if showFade}

    <div in:fade="{{ duration: 500 }}" out:fade="{{ duration: 300 }}">


        <img src={Headmaster} alt="Notes illustration" class="illustration" />
    </div>
    {/if}
    {#if showH2}

    <div in:fly="{{ x: 200, duration: 400 }}" out:fade="{{ duration: 300 }}">


        <div class="tab-row">
            <button class="new-tab" on:click={createNewNote}>
                <Plus size={24} />
            </button>
            {#each openTabs as tab (tab.id)}
                <div class="tab" class:active={currentNote && currentNote.id === tab.id} transition:fly={{ x: 100, duration: 200 }}>
                    <span on:click={() => notesStore.setCurrentNote(tab)}>{tab.title}</span>
                    <button class="close-tab" on:click={() => closeTab(tab)}>
                        <X size={24} />
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
                on:dragover={handleDragOver}
                on:drop={handleDrop}
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
                            <span>{attachment.name}</span>
                        </div>
                    {/each}
                </div>
            {/if}
        {:else}
            <div class="no-document">
                <h1>No documents</h1>
                <button on:click={createNewNote}>
                    <Plus size={16} />
                    Create new note
                </button>
            </div>
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
                    <button on:click={() => handleContextMenuOption('summarize')}>Summarize selected text</button>
                    <button on:click={() => handleContextMenuOption('criticize')}>Criticize selected text</button>
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

<style>
    .tab-row {
        background-color: #151515;
        display: flex;
        user-select: none;
        align-items: center;
        padding-top: 10px;
        gap: 4px;
        border-radius: 50px;


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

    .close-tab:hover, .new-tab:hover {
        color: white;
    }

    .note-title {
        display: flex;
        flex-direction: row;
        width: 96%;
        padding: 30px;
        font-size: 40px;
        font-weight: bold;
        background-color: transparent;
        color: white;
        border: none;
        border-bottom: 1px solid #4a4a4a;
        background-color: #1e1e1e;


        outline: none;
    }

    .note-content {
        height: calc(100% - 120px);
        width: 100%;
        padding: 30px;
        color: white;
        background-color: #1e1e1e;
        border: none;
        outline: none;
        overflow-y: auto;
        position: relative;
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
        background-color: #2a2a2a;
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





    .note-content h1, .note-content h2, .note-content h3,
    .note-content h4, .note-content h5, .note-content h6 {
        margin-top: 20px;
        margin-bottom: 10px;
    }
    .note-content {
        height: calc(100% - 120px);
        width: 94%;
        color: white;
        background-color: #1e1e1e;
        border: none;
        outline: none;
        overflow-y: auto;
        font-family: 'Courier New', Courier, monospace;
    }

    .note-content h1, .note-content h2, .note-content h3 {
        margin-top: 20px;
        margin-bottom: 10px;
        font-family: Arial, sans-serif;
    }

    .note-content ul, .note-content ol {
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
        color: #6495ED;
        padding: 2px 4px;
        border-radius: 3px;
        font-weight: 500;
        transition: background-color 0.3s ease, color 0.3s ease;
    }



    .ai-generated-text::after {
        content: '|';
        animation: blink 0.7s infinite;
        font-weight: normal;
        background-color: rgba(100, 149, 237, 0.2);
        color: #4169E1; 

    }

    .ai-generated-text:hover {
        background-color: rgba(100, 149, 237, 0.2);
        color: #4169E1;
    }

    .ai-analyzed-text {
        border-bottom: 2px dashed #6495ED;
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
        0% { opacity: 1; }
        50% { opacity: 0; }
        100% { opacity: 1; }
    }

</style>
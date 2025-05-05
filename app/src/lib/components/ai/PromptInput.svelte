<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { promptInputStore } from '$lib/stores/promptInputStore';
	import { createPrompt, deletePrompt, updatePrompt } from '$lib/clients/promptInputClient';
	import { slide } from 'svelte/transition';
	import type { PromptInput as PromptInputType, InternalChatMessage } from '$lib/types/types';
	import Calendar from '../ui/Calendar.svelte';
	import { Calculator, CalendarCheck, ChevronLeft, GitCompare, Pen, RefreshCcw, SplitSquareVertical, Trash2, X } from 'lucide-svelte';
	
	let prompts: PromptInputType[] = [];
	let isLoading = true;
	let error = '';
	let showInputForm = false;
	let editingPromptId: string | null = null;
	let promptText = '';
	let isSubmitting = false;
	let selectedSystemPrompt: string | null = null;
	let dualComparisonMode = false;
	let selectedSystemPrompts: string[] = [];
	// View toggle for system/user prompts
	let viewMode: 'user' | 'system' = 'user';
	let showingDualResponses = false;
	let dualResponsesMessages: InternalChatMessage[] = [];
	let dualResponseSystemPrompts: string[] = [];
	let dualResponsesThreadId: string | null = null;
	const dispatch = createEventDispatcher();

	// System prompt constants
	const SYSTEM_PROMPTS = {
		Normal: "Respond naturally and conversationally with balanced detail.",
		Concise: "Provide brief responses focused on key information only.",
		Critical: "Analyze critically, identify flaws, and suggest improvements.",
		Interview: "Ask probing questions to gather more information."
	};
	
	const unsubscribe = promptInputStore.subscribe(value => {
		prompts = value;
		if (prompts.length > 0) {
			isLoading = false;
		}
	});
	function toggleDualMode() {
		dualComparisonMode = !dualComparisonMode;
		selectedSystemPrompts = [];
		error = '';
		
		if (dualComparisonMode) {
			const promptList = Object.values(SYSTEM_PROMPTS);
			selectedSystemPrompts = [promptList[0], promptList[1]];
		}
	}
	function toggleDualPrompt(promptText: string) {
		if (selectedSystemPrompts.includes(promptText)) {
			selectedSystemPrompts = selectedSystemPrompts.filter(p => p !== promptText);
		} else {
			if (selectedSystemPrompts.length >= 2) {
			selectedSystemPrompts = [selectedSystemPrompts[1], promptText];
			} else {
			selectedSystemPrompts = [...selectedSystemPrompts, promptText];
			}
		}
		
		console.log('Selected system prompts for dual comparison:', selectedSystemPrompts);
	}
	function applyDualPrompts() {
		if (selectedSystemPrompts.length !== 2) {
			error = 'Please select exactly two system prompts for comparison';
			return;
		}
		
		dispatch('select', { 
			prompts: selectedSystemPrompts,
			isDual: true
		});
		
		dualComparisonMode = false;
		selectedSystemPrompts = [];
	}
	function applySystemPrompt(promptText: string) {
		if (dualComparisonMode) {
			toggleDualPrompt(promptText);
			return;
		}
		
		selectedSystemPrompt = promptText;
		console.log('Applied system prompt:', promptText);
		
		dispatch('select', { 
			prompt: promptText,
			isDual: false
		});
	}
	
	async function handleSubmit() {
		if (!promptText.trim()) {
			error = 'Prompt cannot be empty';
			return;
		}
		
		isSubmitting = true;
		error = '';
		
		try {
			if (editingPromptId) {
				// Update existing prompt
				const updatedPrompt = await updatePrompt(editingPromptId, promptText);
				promptInputStore.updatePrompt(editingPromptId, updatedPrompt);
				editingPromptId = null;
			} else {
				// Create new prompt
				const newPrompt = await createPrompt(promptText);
				promptInputStore.addPrompt(newPrompt);
			}
			
			promptText = '';
			showInputForm = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save prompt';
		} finally {
			isSubmitting = false;
		}
	}
	
	function handleEdit(prompt: PromptInputType) {
		editingPromptId = prompt.id;
		promptText = prompt.prompt;
		showInputForm = true;
		error = '';
	}
	
	async function handleDelete(id: string) {
		if (confirm('Are you sure you want to delete this prompt?')) {
			try {
				// Add debug information
				console.log(`Deleting prompt with ID: ${id}`);
				
				const success = await deletePrompt(id);
				
				if (success) {
					promptInputStore.removePrompt(id);
					console.log(`Successfully deleted prompt with ID: ${id}`);
				} else {
					throw new Error('Server returned unsuccessful status');
				}
			} catch (err) {
				error = err instanceof Error ? err.message : 'Failed to delete prompt';
				console.error(`Error in handleDelete: ${error}`);
			}
		}
	}
	
	function clearError() {
		error = '';
	}
	
	function toggleView() {
		viewMode = viewMode === 'user' ? 'system' : 'user';
		// Close input form when switching views
		showInputForm = false;
		editingPromptId = null;
		promptText = '';
	}
	

	
	onMount(async () => {
		try {
			await promptInputStore.loadPrompts();
			isLoading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load prompts';
			isLoading = false;
		}
		
		return () => {
			unsubscribe();
		};
	});
</script>

<div class="prompt-container">
	<div class="header-row">


		<div class="title-toggle-group">
			<!-- <h2>{viewMode === 'user' ? (editingPromptId ? 'Edit Prompt' : 'Your Prompts') : 'System Prompts'}</h2> -->
			<div class="toggle-switch">
				<button class={`toggle-button ${viewMode === 'system' ? 'active' : ''}`} on:click={() => viewMode = 'system'}>
					System Prompts
					<!-- {#if viewMode === 'system'}
					<button 
						class={`toggle-button dual ${dualComparisonMode ? 'active' : ''}`} 
						on:click={toggleDualMode}
						title={dualComparisonMode ? "Exit comparison mode" : "Compare two system prompts"}
					>
					{#if dualComparisonMode}
						<ChevronLeft size={20} />
					{:else}
						<GitCompare size={20} />
					{/if}						
					
					</button>
					{#if dualComparisonMode && selectedSystemPrompts.length > 0}
						<div class="dual-mode-actions">
						<button 
							class="apply-dual-button" 
							on:click={applyDualPrompts}
							disabled={selectedSystemPrompts.length !== 2}
						>
							 {selectedSystemPrompts.length}/2 Selected Prompts
						</button>
						</div>
					{/if}
					{/if} -->
				</button>
				<button class={`toggle-button ${viewMode === 'user' ? 'active' : ''}`} on:click={() => viewMode = 'user'}>
					Your Prompts
				</button>
			</div>
		</div>
		
		{#if viewMode === 'user'}
			<button class="add-button" on:click={() => {
				if (showInputForm && editingPromptId) {
					// Cancel editing
					editingPromptId = null;
					promptText = '';
				}
				showInputForm = !showInputForm;
			}}>
				{showInputForm ? 'X' : 'Add New Prompt'}
			</button>
		{/if}
	</div>

	{#if viewMode === 'user'}
		{#if showInputForm}
			<div class="input-form" transition:slide={{ duration: 300 }}>
				<textarea
					bind:value={promptText}
					placeholder="Enter your prompt here..."
					rows="4"
					class="prompt-textarea"
					disabled={isSubmitting}
				></textarea>
				
				{#if error}
					<div class="error-message">{error}</div>
				{/if}
				
				<div class="button-group">
					<button 
						class="cancel-button" 
						on:click={() => {
							showInputForm = false;
							promptText = '';
							error = '';
						}} 
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button 
						class="submit-button" 
						on:click={handleSubmit} 
						disabled={isSubmitting || !promptText.trim()}
					>
						{#if isSubmitting}
							{editingPromptId ? 'Updating...' : 'Adding...'}
						{:else}
							{editingPromptId ? 'Update Prompt' : 'Add Prompt'}
						{/if}
					</button>
				</div>
			</div>
		{/if}
		
		{#if isLoading}
			<div class="spinner-container">
				<div class="spinner"></div>
			</div>
		{:else if prompts.length === 0}
			<div class="empty-state">You haven't created any prompts yet.</div>
		{:else}
			<div class="prompt-list">
				{#each prompts as prompt (prompt.id)}
					<div class="prompt-item" transition:slide={{ duration: 300 }}>
						<div class="prompt-content">
							<p class="prompt-text">{prompt.prompt}</p>
							
							<!-- <div class="prompt-meta">
								<span class="prompt-date">
									<CalendarCheck size={16} class="icon" />
									{new Date(prompt.created).toLocaleDateString()} 
								</span>
								{#if prompt.updated !== prompt.created}
									<span class="prompt-date">
										<RefreshCcw size={16} class="icon" />
										{new Date(prompt.updated).toLocaleDateString()}
									</span>
								{/if}
							</div> -->
						</div>
						<button class="edit-button" on:click={() => handleEdit(prompt)}>
							<Pen size="16"/>
						</button>
						<button class="delete-button" on:click={() => handleDelete(prompt.id)}>
							<Trash2 size="16"/>
						</button>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<!-- System Prompts View -->
		<div class="prompt-list system-prompts">
			{#each Object.entries(SYSTEM_PROMPTS) as [name, text]}
			  <div class="prompt-item system-prompt-item" class:selected={dualComparisonMode ? selectedSystemPrompts.includes(text) : selectedSystemPrompt === text}>
				<div class="prompt-content">
				  <h3 class="system-prompt-name">{name}</h3>
				  <p class="prompt-text">{text}</p>
				</div>
				<div class="button-container">
				  <button 
					class={`select-button ${selectedSystemPrompts.includes(text) ? 'selected' : ''}`} 
					on:click={() => toggleDualPrompt(text)}
					disabled={!selectedSystemPrompts.includes(text) && selectedSystemPrompts.length >= 2}
				  >
					{selectedSystemPrompts.includes(text) ? 'Selected pair' : 'Select pair'}
				  </button>
				  <button class="apply-button" on:click={() => applySystemPrompt(text)}>
					Apply
				  </button>
				</div>
			  </div>
			{/each}
		  </div>
	{/if}

</div>

<style lang="scss">
		@use "src/styles/themes.scss" as *;

		* {
			font-family: var(--font-family);
		}
	.prompt-container {
		width: calc(100% - 2rem);
		max-width: 1200px;
		margin-right: 1rem;
		margin-left: 1rem;
	}


	
	.header-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
	}
	
	.title-toggle-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.toggle-switch {
		display: flex;
		border-top-left-radius: 1rem;
		border-top-right-radius: 1rem;
		overflow: hidden;
	}
	
	.toggle-button {
		padding: 1rem 0.75rem;
		background: none;
		display: flex;
		flex-direction: row;
		align-items: center;
		cursor: pointer;
		background: var(--secondary-color);
		color: var(--placeholder-color);
		flex: 1;
		gap: 1rem;
		border: 1px solid transparent;
		min-width: 200px;
		font-size: 1rem;
		transition: background-color 0.2s;
		&.dual {
			background-color: var(--tertiary-color);
			border-radius: 50%;
			padding: 0.25rem;
			display: flex;
			justify-content: center;
			align-items: center;
			flex: 0;
			min-width: auto;
			font-size: 0.8rem;
			margin: 0;
			height: 100%;
		}
	}
	.toggle-button .dual {
		&.active {
			background-color: var(--line-color);
			padding: 0.25rem;
			height: auto;
			width: auto;
			border-radius: 50%;
		}
	}
	
	.toggle-button.active {
		background-color: var(--primary-color);
		color: var(--text-color);
		justify-content: center;
		align-items: center;
	}
	
	.system-prompts {
		display: grid;
		gap: 1rem;
	}
	
	.system-prompt-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;

		border-radius: 8px;
	}
	
	.system-prompt-name {
		font-weight: 600;
		margin-bottom: 0.5rem;
	}
	.select-button,
	.apply-button {
		background-color: var(--bg-color);
		color: white;
		border: none;
		border-radius: 4px;
		padding: 0.5rem 1rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	
	.apply-button:hover {
		background-color: var(--tertiary-color);
	}
	.select-button.selected {
	background-color: var(--tertiary-color);
	color: var(--primary-color);
	font-weight: 800;
	border-color: var(--primary-color);
	}

	.select-button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
	}

	
	h2 {
		font-size: 1.8rem;
		color: var(--text-color);
		margin: 0;
	}
	
	.add-button {
		padding: 0.5rem 1rem;
		background: var(--primary-color);
		color: var(--text-color);
		border: none;
		border-radius: var(--radius-m);
		cursor: pointer;
		font-weight: bold;
		transition: all 0.3s ease;
		
		&:hover {
			background: var(--secondary-color);
		}
	}
	
	.input-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		// padding: 1rem;
		width: calc(100%);
		margin-top: 1rem;
		background: var(--primary-color);
		border: 1px solid var(--primary-color);
		border-top-left-radius: 2rem;
		border-top-right-radius: 2rem;

		& textarea {
			background: var(--bg-color);
		}
	}
	
	.prompt-textarea {
		width: auto;

		border-radius: var(--radius-m);
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-color);
		font-family: var(--font-family);
		font-size: 1.5rem;

		resize: none;
		height: auto;


		
		&:focus {
			outline: none;
			border: 1px solid transparent;

			border-color: var(--secondary-color);
			box-shadow: 0 0 0 2px rgba(var(--secondary-color-rgb), 0.2);
		}
	}
	
	.button-group {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	
	.submit-button {
		padding: 0.5rem 1rem;
		background: var(--primary-color);
		color: var(--text-color);
		border: none;
		border-radius: var(--radius-m);
		cursor: pointer;
		font-weight: bold;
		transition: all 0.3s ease;
		
		&:hover:not(:disabled) {
			background: var(--secondary-color);
		}
		
		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}
	
	.cancel-button {
		padding: 0.5rem 1rem;
		background: transparent;
		color: var(--text-color);
		border: 1px solid var(--primary-color);
		border-radius: var(--radius-m);
		cursor: pointer;
		transition: all 0.3s ease;
		
		&:hover:not(:disabled) {
			background: rgba(var(--primary-color-rgb), 0.1);
		}
		
		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}
	
	.loading, .error-message, .empty-state {
		padding: 1rem;
		border-radius: var(--radius-m);
		text-align: center;
		margin: 1rem 0;
	}
	
	.loading {
		background: var(--bg-gradient);
		color: var(--text-color);
	}
	
	.error-message {
		background: rgba(231, 76, 60, 0.1);
		color: #e74c3c;
		margin: 0.5rem 0;
	}
	
	.empty-state {
		background: var(--bg-gradient);
		color: var(--text-color);
		font-style: italic;
	}
	
	.prompt-list {
		list-style-type: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		overflow-x: hidden;
		box-shadow: 0px 1px 20px 1px rgba(255, 255, 255, 0.2);


		height: 400px;
		width: 100%;
		gap: 0;
		backdrop-filter: blur(20px);
	}
	
	.prompt-item {
		padding: 1rem;
		// background: var(--bg-gradient);
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		background: transparent;
		border-radius: 0;
		&:hover {
			background: var(--primary-color);
			transform: none;

			& .prompt-meta {
				display: flex;
			}
		}
	}
	
	.prompt-content {
		flex: 1;
	}
	
	.prompt-text {
		margin: 0 0 0.5rem 0;
		color: var(--text-color);
		line-height: 1.5;
		white-space: pre-wrap;
	}
	
	.prompt-meta {
		font-size: 0.8rem;
		color: var(--text-color);
		opacity: 0.7;
		display: none;
		justify-content: flex-end;
		gap: 1rem;
	}
	
	.dual-mode-button {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 6px 12px;
	border-radius: 4px;
	border: 1px solid var(--border-color, #ddd);
	background-color: transparent;
	cursor: pointer;
	transition: all 0.2s ease;
	}

	.dual-mode-button.active {
	background-color: var(--primary-color, #3b82f6);
	color: white;
	border-color: var(--primary-color, #3b82f6);
	}

	



	.dual-mode-actions {
	display: flex;
	justify-content: center;
	}

	.apply-dual-button {
	padding: 8px 16px;
	border-radius: 6px;
	background-color: var(--primary-color, #3b82f6);
	color: white;
	border: none;
	cursor: pointer;
	font-weight: 500;
	}

	.apply-dual-button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
	}
	
	@media (max-width: 768px) {
		.header-row {
			flex-direction: column;
			align-items: stretch;
			gap: 0.5rem;
		}
		
		.button-group {
			flex-direction: column;
		}
		
		.prompt-item {
			flex-direction: column;
		}
		
		.delete-button {
			margin-left: 0;
			margin-top: 0.5rem;
			align-self: flex-end;
		}
		
		.prompt-meta {
			flex-direction: column;
			gap: 0.25rem;
		}
	}
</style>
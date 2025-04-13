<script lang="ts">
	import { onMount } from 'svelte';
	import { promptInputStore } from '$lib/stores/promptInputStore';
	import { createPrompt, deletePrompt, fetchUserPrompts } from '$lib/clients/promptInputClient';
	import { slide } from 'svelte/transition';
	import type { PromptInput as PromptInputType } from '$lib/types/types';
	
	let prompts: PromptInputType[] = [];
	let isLoading = true;
	let error = '';
	let showInputForm = false;
	let promptText = '';
	let isSubmitting = false;
	
	// Initialize store if needed
	if (!promptInputStore) {
		function createPromptInputStore() {
			const { subscribe, update, set } = writable<PromptInputType[]>([]);
			
			return {
				subscribe,
				setPrompts: (prompts: PromptInputType[]) => set(prompts),
				addPrompt: (prompt: PromptInputType) => update(prompts => [...prompts, prompt]),
				removePrompt: (id: string) => update(prompts => prompts.filter(p => p.id !== id)),
				updatePrompt: (id: string, updatedPrompt: Partial<PromptInputType>) => update(prompts => 
					prompts.map(p => p.id === id ? { ...p, ...updatedPrompt } : p)
				),
				loadPrompts: async () => {
					try {
						const userPrompts = await fetchUserPrompts();
						set(userPrompts);
						return userPrompts;
					} catch (error) {
						console.error('Failed to load prompts:', error);
						return [];
					}
				}
			};
		}
	}
	
	// Subscribe to the store
	const unsubscribe = promptInputStore.subscribe(value => {
		prompts = value;
		if (prompts.length > 0) {
			isLoading = false;
		}
	});
	
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
	
	async function handleSubmit() {
		if (!promptText.trim()) {
			error = 'Prompt cannot be empty';
			return;
		}
		
		isSubmitting = true;
		error = '';
		
		try {
			const newPrompt = await createPrompt(promptText);
			promptInputStore.addPrompt(newPrompt);
			promptText = '';
			showInputForm = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create prompt';
		} finally {
			isSubmitting = false;
		}
	}
	
	async function handleDelete(id: string) {
		if (confirm('Are you sure you want to delete this prompt?')) {
			try {
				const success = await deletePrompt(id);
				if (success) {
					promptInputStore.removePrompt(id);
				}
			} catch (err) {
				error = err instanceof Error ? err.message : 'Failed to delete prompt';
			}
		}
	}
</script>

<div class="prompt-container">
	<div class="header-row">
		<h2>Your Prompts</h2>
		{#if !showInputForm}
			<button class="add-button" on:click={() => showInputForm = true}>
				Add New Prompt
			</button>
		{/if}
	</div>
	
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
					{isSubmitting ? 'Adding...' : 'Add Prompt'}
				</button>
			</div>
		</div>
	{/if}
	
	{#if isLoading}
		<div class="loading">Loading prompts...</div>
	{:else if prompts.length === 0}
		<div class="empty-state">You haven't created any prompts yet.</div>
	{:else}
		<ul class="prompt-list">
			{#each prompts as prompt (prompt.id)}
				<li class="prompt-item" transition:slide={{ duration: 300 }}>
					<div class="prompt-content">
						<p class="prompt-text">{prompt.prompt}</p>
						<div class="prompt-meta">
							<span class="prompt-date">
								Created: {new Date(prompt.created).toLocaleDateString()} 
							</span>
							{#if prompt.updated !== prompt.created}
								<span class="prompt-date">
									Updated: {new Date(prompt.updated).toLocaleDateString()}
								</span>
							{/if}
						</div>
					</div>
					<button class="delete-button" on:click={() => handleDelete(prompt.id)}>
						Delete
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style lang="scss">
	.prompt-container {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem;
	}
	
	.header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0;
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
		margin-bottom: 1.5rem;
		padding: 1rem;
		border-radius: var(--radius-m);
		background: var(--bg-gradient);
		border: 1px solid var(--primary-color);
	}
	
	.prompt-textarea {
		width: calc(100% - 2rem);

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
		height: 400px;
		width: 100%;
		gap: 0;
	}
	
	.prompt-item {
		padding: 1rem;
		// background: var(--bg-gradient);
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		border: 1px solid var(--primary-color);
		border-radius: 0;
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
		display: flex;
		gap: 1rem;
	}
	
	.delete-button {
		background: transparent;
		color: #e74c3c;
		border: 1px solid #e74c3c;
		border-radius: var(--radius-m);
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		font-size: 0.8rem;
		margin-left: 1rem;
		transition: all 0.3s ease;
		align-self: flex-start;
		
		&:hover {
			background: #e74c3c;
			color: white;
		}
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
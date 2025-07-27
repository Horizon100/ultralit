<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { onMount, createEventDispatcher } from 'svelte';
	import { promptInputStore } from '$lib/stores/promptInputStore';
	import { createPrompt, deletePrompt, updatePrompt } from '$lib/clients/promptInputClient';
	import { slide } from 'svelte/transition';
	import type {
		PromptInput as PromptInputType,
		PromptType,
		InternalChatMessage
	} from '$lib/types/types';
	import Calendar from '$lib/components/data/Calendar.svelte';
	import { t } from '$lib/stores/translationStore';
	import { currentUser, updateUser, getUserById, signOut } from '$lib/pocketbase';
	import { clientTryCatch, isFailure } from '$lib/utils/errorUtils';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	let prompts: PromptInputType[] = [];
	let isLoading = true;
	let error = '';
	let showInputForm = false;
	let editingPromptId: string | null = null;
	let promptText = '';
	let activePromptId: string | null = null;
	let activeSysPrompt: string | null = null;
	let isSubmitting = false;
	let selectedSystemPrompt: string | null = null;
	let dualComparisonMode = false;
	let selectedSystemPrompts: string[] = [];
	let viewMode: 'user' | 'system' = 'user';
	let showingDualResponses = false;
	let dualResponsesMessages: InternalChatMessage[] = [];
	let dualResponseSystemPrompts: string[] = [];
	let dualResponsesThreadId: string | null = null;
	const dispatch = createEventDispatcher();

	const unsubscribe = promptInputStore.subscribe((value) => {
		prompts = value;
		if (prompts.length > 0) {
			isLoading = false;
		}
	});

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

	async function setPromptPreference(promptId: string): Promise<void> {
		const result = await clientTryCatch(
			(async () => {
				if ($currentUser?.id) {
					await updateUser($currentUser.id, {
						prompt_preference: [promptId]
					});

					// Update local state
					activePromptId = promptId;

					const updatedUser = await getUserById($currentUser.id, true);
					if (updatedUser) {
						currentUser.set(updatedUser);
					}

					console.log('Prompt preferences updated successfully:', [promptId]);
				} else {
					throw new Error('User not authenticated');
				}
			})(),
			`Setting prompt preference to ${promptId}`
		);

		if (isFailure(result)) {
			console.error('Error updating prompt preference:', result.error);
		}
	}

	onMount(async () => {
		try {
			// Load prompts
			await promptInputStore.loadPrompts();

			// Get fresh user data (bypass cache)
			if ($currentUser?.id) {
				const userData = await getUserById($currentUser.id, true);
				console.log('Loaded user data for preferences:', userData);

				if (userData) {
					// Set active prompt from user data
					if (userData.prompt_preference) {
						// If it's an array, use the first element
						if (Array.isArray(userData.prompt_preference)) {
							activePromptId =
								userData.prompt_preference.length > 0 ? userData.prompt_preference[0] : null;
						} else {
							// Otherwise use it directly
							activePromptId = userData.prompt_preference;
						}
						console.log('Active prompt ID set to:', activePromptId);
					}

					// Set active system prompt from user data
					if (userData.sysprompt_preference) {
						activeSysPrompt = userData.sysprompt_preference;
						console.log('Active system prompt set to:', activeSysPrompt);
					}
				}
			}

			isLoading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load prompts';
			isLoading = false;
		}
	});

	// // Add this reactive statement to track when currentUser changes
	// $: if ($currentUser && !preferencesLoaded) {
	//   console.log('Current user changed, checking preferences');
	//   if ($currentUser.prompt_preference) {
	//     if (Array.isArray($currentUser.prompt_preference)) {
	//       activePromptId = $currentUser.prompt_preference.length > 0
	//         ? $currentUser.prompt_preference[0]
	//         : null;
	//     } else {
	//       activePromptId = $currentUser.prompt_preference;
	//     }
	//     console.log('Updated active prompt ID from reactive statement:', activePromptId);
	//   }

	/*
	 *   if ($currentUser.sysprompt_preference) {
	 *     activeSysPrompt = $currentUser.sysprompt_preference;
	 *     console.log('Updated active system prompt from reactive statement:', activeSysPrompt);
	 *   }
	 */

	/*
	 *   preferencesLoaded = true;
	 * }
	 */
</script>

<div class="prompt-container">
	<div class="header-row">
		<h3>
			{showInputForm ? 'Add New Prompt' : 'Your Prompts'}
		</h3>
		<button
			class="add-button"
			on:click={() => {
				showInputForm = true;
				editingPromptId = null;
				promptText = '';
				error = '';
			}}
		>
			{showInputForm ? '' : '+'} 
		</button>
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
					{#if isSubmitting}
						{editingPromptId ? $t('status.updating') + '...' : $t('status.adding') + '...'}

					{:else}

						{editingPromptId ? $t('status.update') + ' ' + $t('chat.prompt') : $t('status.add') + ' ' + $t('chat.prompt')}

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
					</div>
					<div class="button-container">
						{#if activePromptId === prompt.id}
							<span class="active-prompt-badge">
								<Icon name="Check" size={16} />
								Active
							</span>
						{:else}
							<button class="apply-button" on:click={() => setPromptPreference(prompt.id)}>
								Switch
							</button>
						{/if}
						<button class="edit-button" on:click={() => handleEdit(prompt)}>
							<Icon name="Pen" size={16} />
						</button>
						<button class="delete-button" on:click={() => handleDelete(prompt.id)}>
							<Icon name="Trash2" size={16} />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
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
		padding: 1rem;
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
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
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

	.loading,
	.error-message,
	.empty-state {
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
		justify-content: space-between;
		height: 400px;
		width: 100%;
		gap: 0;
		backdrop-filter: blur(20px);
				scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: auto;
		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 1rem;
		}
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
		font-size: 0.8rem;
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
			flex-direction: row;
			align-items: stretch;
			gap: 0.5rem;
		}
			.button-container {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

		.button-group {
			flex-direction: column;
		}

		.prompt-item {
			flex-direction: column;
		}

		// .delete-button {
		// 	margin-left: 0;
		// 	margin-top: 0.5rem;
		// 	align-self: flex-end;
		// }

		.prompt-meta {
			flex-direction: column;
			gap: 0.25rem;
		}
		
	}
</style>

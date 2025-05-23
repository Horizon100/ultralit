<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { promptInputStore } from '$lib/stores/promptInputStore';
	import { createPrompt, deletePrompt, updatePrompt } from '$lib/clients/promptInputClient';
	import { slide } from 'svelte/transition';
	import type { PromptInput as PromptInputType, PromptType, InternalChatMessage } from '$lib/types/types';
	import Calendar from '$lib/components/data/Calendar.svelte';
	import { Calculator, CalendarCheck, ChevronLeft, Check, GitCompare, Pen, RefreshCcw, SplitSquareVertical, Trash2, X } from 'lucide-svelte';
	import { currentUser, pocketbaseUrl, updateUser, getUserById, signOut } from '$lib/pocketbase';
	import { SYSTEM_PROMPTS, availablePrompts } from '$lib/features/ai/utils/prompts';
import { promptStore, syspromptStore, setSystemPrompt, initPromptStores } from '$lib/stores/promptStore';

	let prompts: PromptInputType[] = [];
	let isLoading = true;
	let error = '';
	let showInputForm = false;
	let editingPromptId: string | null = null;
	let promptText = '';
let selectedPromptType: PromptType = 'NORMAL';
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


	const unsubscribe = promptInputStore.subscribe(value => {
		prompts = value;
		if (prompts.length > 0) {
			isLoading = false;
		}
	});

	const unsubscribeSysPrompt = syspromptStore.subscribe(value => {
  console.log('syspromptStore updated:', value);
  if (value.promptType && !value.selectedPromptId) {
    // Built-in system prompt
    activeSysPrompt = value.promptType;
  }
});

const unsubscribePrompt = promptStore.subscribe(value => {
  console.log('promptStore updated:', value);
  if (value.selectedPromptId) {
    activePromptId = value.selectedPromptId;
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
// In your component
async function setSysPromptPreference(promptType: string): Promise<void> {
  console.log('=== STARTING setSysPromptPreference ===');
  console.log('Input promptType:', promptType);
  console.log('Current $currentUser:', $currentUser);
  
  try {
    if ($currentUser?.id) {
      console.log('Calling updateUser with:', {
        userId: $currentUser.id,
        data: { sysprompt_preference: promptType }
      });
      
      const result = await updateUser($currentUser.id, {
        sysprompt_preference: promptType
      });
      console.log('updateUser result:', result);
      
      // Check what's actually in the database now
      const freshUser = await getUserById($currentUser.id, true);
      console.log('Fresh user data from DB:', freshUser);
      console.log('Fresh sysprompt_preference:', freshUser?.sysprompt_preference);
      
      if (freshUser) {
        currentUser.set(freshUser);
        console.log('Updated currentUser store, new value:', $currentUser);
      }
    }
  } catch (error) {
    console.error('Error in setSysPromptPreference:', error);
  }
  console.log('=== END setSysPromptPreference ===');
}

function applySystemPrompt(promptText: string, promptName?: string) {
  console.log('applySystemPrompt called with:', { promptText, promptName });
  
  if (dualComparisonMode) {
    toggleDualPrompt(promptText);
    return;
  }
  
  selectedSystemPrompt = promptText;
  
  const promptType = promptName || 
    Object.entries(SYSTEM_PROMPTS).find(([key, value]) => value === promptText)?.[0] || 'NORMAL';
  
  console.log('Calculated promptType:', promptType);
  console.log('SYSTEM_PROMPTS entries:', Object.entries(SYSTEM_PROMPTS));
  
  setSysPromptPreference(promptType);
  
  dispatch('select', { 
    prompt: promptText,
    type: promptType,
    isDual: false
  });
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


	
onMount(async () => {
  try {
    await promptInputStore.loadPrompts();
    
    if ($currentUser?.id) {
      const userData = await getUserById($currentUser.id, true);
      console.log('Loaded user data for preferences:', userData);
      
      if (userData) {
        await initPromptStores(userData);
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
	<div class="prompt-wrapper">

	<div class="header-row">
		<h3>
			System Prompts
		</h3>
				
	</div>


		<!-- System Prompts View -->
		<div class="prompt-list system-prompts">
			{#each Object.entries(SYSTEM_PROMPTS) as [name, text]}
			  <div class="prompt-item system-prompt-item" 
			  on:click={() => applySystemPrompt(text, name)}
				   class:selected={dualComparisonMode ? selectedSystemPrompts.includes(text) : selectedSystemPrompt === text}
				   class:active={activeSysPrompt === name}>
				<div class="prompt-content">
				  <h3 class="system-prompt-name">{name}</h3>
				  <p class="prompt-text">{text}</p>
				</div>
				<div class="button-container">
				  {#if dualComparisonMode}
					<button 
					  class={`select-button ${selectedSystemPrompts.includes(text) ? 'selected' : ''}`} 
					  on:click={() => toggleDualPrompt(text)}
					  disabled={!selectedSystemPrompts.includes(text) && selectedSystemPrompts.length >= 2}
					>
					  {selectedSystemPrompts.includes(text) ? 'Selected pair' : 'Select pair'}
					</button>
				  {:else if activeSysPrompt === name}
					<span class="active-prompt-badge">
					  <Check size={20} />
					  Active
					</span>
				  {:else}
					<!-- <button class="apply-button" on:click={() => applySystemPrompt(text, name)}>
					  Use
					</button> -->
				  {/if}
				</div>
			  </div>
			{/each}
		  </div>
	</div>

</div>

<style lang="scss">
		@use "src/styles/themes.scss" as *;

		* {
			font-family: var(--font-family);
		}
	.prompt-container {
		display: flex;
		justify-content: flex-end;
		// background-color: red;
		right: 0;
		top: auto;
		bottom: auto;
		height: auto;
		    border-radius: 1rem;

		width: 100%;
				// box-shadow: 0px 1px 20px 1px rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(20px);
	}

	.prompt-wrapper {
		display: flex;
		flex-direction: column;
		padding: 1rem;
		width: 100%;
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

	span.active-prompt-badge {
		color: var(--tertiary-color);
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		margin: 0;
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
		cursor: pointer;
		opacity: 0.8;

		&:hover {
			background: var(--secondary-color);
			opacity:1;
		}

	}

	.system-prompt-name {
		font-weight: 600;
		font-size: 1rem;
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
		width: 100%;
		gap: 0;
				padding: 1rem;

	}
	
	.prompt-item {
		// background: var(--bg-gradient);
		padding: 0.5rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		background: transparent;
		border-radius: 0;
					border-radius: 1rem;

		&.system-prompt-item.active {
			background: var(--primary-color);
			color: var(--tertiary-color);
		}
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
	
	p.prompt-text {
		margin: 0.5rem;
		// line-height: 1.5;
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

	@media (max-width: 1000px) {
		.prompt-wrapper {
			max-width: auto;
			width: calc(100% - 5rem);
			display: flex;
			flex-direction: column;
			padding: 0;
			margin-top: 1rem;
		}
	}
	.prompt-list {
		list-style-type: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		overflow-x: hidden;
		width: 100%;
		gap: 0;
		padding: 0;

	}
	
	.system-prompts {
		display: flex;
		flex-wrap: wrap;
		width: auto;
		gap: 0.5rem;
	}
	
	.system-prompt-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: pointer;
		opacity: 0.8;
		width: auto;

		&:hover {
			background: var(--secondary-color);
			opacity:1;

		}
	}
	
	.system-prompt-name {
		font-weight: 600;
		font-size: 1rem;
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

		@media (max-width: 450px) {
				.prompt-container {
		display: flex;
		justify-content: flex-end;
		position: fixed;
		right: 0;
		top: auto;
		bottom: 7rem;
		width: 100%;
		max-width: 400px;
				// box-shadow: 0px 1px 20px 1px rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(20px);
	}

	.prompt-wrapper {
		max-width: 400px;
		display: flex;
		flex-direction: column;
		padding: 1rem;
	}

	h3 {
		text-align: center;
	}

		.prompt-item {
		// background: var(--bg-gradient);
		padding: 0.5rem;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		background: transparent;
		border-radius: 0;
		h3 {
			text-align: left;
		}
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
	
	p.prompt-text {
		line-height: 1.5;
		white-space: pre-wrap;

	}

		}
</style>
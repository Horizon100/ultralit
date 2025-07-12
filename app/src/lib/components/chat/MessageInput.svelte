<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import { onMount } from 'svelte';
	import { slide, fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import {
		isTextareaFocused,
		handleTextareaFocus,
		handleTextareaBlur,
		adjustFontSize
	} from '$lib/stores/textareaFocusStore';
	import { showThreadList, threadsStore } from '$lib/stores/threadsStore';
	import { expandedSections } from '$lib/stores/uiStore';
	import { currentUser } from '$lib/pocketbase';
	import { t } from '$lib/stores/translationStore';
	import ThreadCollaborators from '$lib/features/threads/components/ThreadCollaborators.svelte';
	import SysPromptSelector from '$lib/features/ai/components/prompts/SysPromptSelector.svelte';
	import PromptCatalog from '$lib/features/ai/components/prompts/PromptInput.svelte';
	import ModelSelector from '$lib/features/ai/components/models/ModelSelector.svelte';
	import MsgBookmarks from '$lib/features/ai/components/chat/MsgBookmarks.svelte';
	import { availablePrompts } from '$lib/features/ai/utils/prompts';
	import type { AIModel } from '$lib/types/types';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	// Props
	export let userInput = '';
	export let isLoading = false;
	export let isAiActive = true;
	export let currentThreadId: string | null = null;
	export let aiModel: AIModel;
	export let selectedModelLabel = '';
	export let selectedPromptLabel = '';
	export let selectedIcon: IconName | null = null;
	export let currentPlaceholder = '';
	export let placeholderText = '';
	export let showTextModal = false;
	export let textTooLong = false;
	export let createHovered = false;
	export let isPlaceholder = false;
	export let currentManualPlaceholder = $t('chat.manualPlaceholder');

	// Constants
	const MAX_VISIBLE_CHARS = 200;

	// DOM references
	let textareaElement: HTMLTextAreaElement | null = null;
	let localIsFocused = false;

	// Event dispatcher
	const dispatch = createEventDispatcher();

	// Debug function to test if component is working
	function testClick() {
		console.log('MessageInput component is working!');
		dispatch('test', { message: 'Component is responsive' });
	}

	// Event handlers
	function onTextareaFocus(event: FocusEvent) {
		console.log('Textarea focused');
		localIsFocused = true;
		handleTextareaFocus();
		dispatch('textareaFocus');
	}
	function handleClickOutside(event: MouseEvent) {
		if (textareaElement && !textareaElement.contains(event.target as Node)) {
			localIsFocused = false;
			handleTextareaBlur();
		}
	}
	function onTextareaBlur(event: FocusEvent) {
		console.log('Textarea blurred');
		localIsFocused = false;
		handleTextareaBlur();
		textTooLong = userInput.length > MAX_VISIBLE_CHARS;
		dispatch('textareaBlur');
	}
	$: showButtons = localIsFocused || $isTextareaFocused;

	let inputTimeout: ReturnType<typeof setTimeout>;

	function handleInput(event: Event) {
		const target = event.currentTarget as HTMLTextAreaElement;
		userInput = target.value;

		// Debounce expensive operations
		clearTimeout(inputTimeout);
		inputTimeout = setTimeout(() => {
			adjustFontSize(target);
			textTooLong = target.value.length > MAX_VISIBLE_CHARS;
		}, 100);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (!isLoading) {
				handleSendMessage();
			}
		}
	}

	function handleSendMessage() {
		console.log('Sending message:', userInput);
		dispatch('sendMessage', { message: userInput });
	}

	function toggleSection(section: string) {
		// console.log('Toggling section:', section);
		dispatch('toggleSection', { section });
	}

	function toggleAiActive() {
		isAiActive = !isAiActive;
		console.log('Toggling AI active:', isAiActive);
		dispatch('toggleAiActive');
	}

	function handleModelSelection(event: CustomEvent) {
		console.log('🔄 MessageInput handleModelSelection - event.detail:', event.detail);

		// Add safety check before dispatching
		if (!event.detail) {
			console.error('❌ No event detail in MessageInput handleModelSelection');
			return;
		}

		// Pass through the exact same structure
		console.log('✅ MessageInput dispatching model selection');
		dispatch('modelSelection', event.detail); // Pass through unchanged
	}

	function handleSysPromptSelect(event: CustomEvent) {
		console.log('Sys prompt selected:', event.detail);
		dispatch('sysPromptSelect', { prompt: event.detail });
	}

	function handlePromptSelect(event: CustomEvent) {
		console.log('Prompt selected:', event.detail);
		dispatch('promptSelect', { prompt: event.detail });
	}

	function handleCollaboratorSelect(event: CustomEvent) {
		console.log('Collaborator selected:', event.detail);
		dispatch('collaboratorSelect', { collaborator: event.detail });
	}

	function handleLoadThread(event: CustomEvent) {
		console.log('Loading thread:', event.detail);
		dispatch('loadThread', { threadId: event.detail.threadId });
	}

	function clearUserInput() {
		userInput = '';
		console.log('Input cleared');
		dispatch('inputCleared');
	}

	function openTextModal() {
		showTextModal = true;
		console.log('Text modal opened');
		dispatch('textModalOpen');
	}
	let cachedShowButtons = false;
	let cachedProjectId = '';

	$: {
		// Only update if actually changed
		const newShowButtons = localIsFocused || $isTextareaFocused;
		if (newShowButtons !== cachedShowButtons) {
			cachedShowButtons = newShowButtons;
		}

		const newProjectId = $threadsStore.currentThread?.project_id || '';
		if (newProjectId !== cachedProjectId) {
			cachedProjectId = newProjectId;
		}
	}

	$: placeholderText = (currentManualPlaceholder as string) || '';

	// Export textarea element for parent access
	export { textareaElement };

	// Debug reactive statement
	// $: console.log('MessageInput props:', { isPlaceholder, currentThreadId, isAiActive });
	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div
	class="input-container"
	class:input-container-start={isPlaceholder}
	class:drawer-visible={$showThreadList}
	transition:slide={{ duration: 100, easing: cubicOut }}
>
	<!-- AI Active Mode or Placeholder Input -->
	{#if (isAiActive && !isPlaceholder) || isPlaceholder}
		<div class="ai-selector">
			<!-- Collaborators Section -->
			{#if $expandedSections.collaborators && currentThreadId && !isPlaceholder}
				<div class="section-content" in:slide={{ duration: 200 }} out:slide={{ duration: 200 }}>
					<ThreadCollaborators
						threadId={currentThreadId}
						projectId={$threadsStore.currentThread?.project_id || ''}
						on:select={handleCollaboratorSelect}
					/>
				</div>
			{/if}

			<!-- System Prompts Section -->
			{#if $expandedSections.sysprompts}
				<div
					class="section-content-sysprompts"
					in:slide={{ duration: 200 }}
					out:slide={{ duration: 200 }}
				>
					<SysPromptSelector on:select={handleSysPromptSelect} />
				</div>
			{/if}

			<!-- Prompts Section -->
			{#if $expandedSections.prompts}
				<div class="section-content" in:slide={{ duration: 200 }} out:slide={{ duration: 200 }}>
					<PromptCatalog on:select={handlePromptSelect} />
				</div>
			{/if}

			<!-- Models Section -->
			{#if $expandedSections.models}
				<div class="section-content" in:slide={{ duration: 200 }} out:slide={{ duration: 200 }}>
					<ModelSelector provider={aiModel?.provider} on:select={handleModelSelection} />
				</div>
			{/if}

			<!-- Bookmarks Section -->
			{#if $expandedSections.bookmarks}
				<div
					class="section-content-bookmark"
					in:slide={{ duration: 200 }}
					out:slide={{ duration: 200 }}
				>
					<MsgBookmarks on:loadThread={handleLoadThread} />
				</div>
			{/if}
		</div>

		<!-- Input Area -->
		<div class="combo-input" in:fly={{ x: 200, duration: 300 }} out:fade={{ duration: 200 }}>
			{#if userInput.length > MAX_VISIBLE_CHARS && !$isTextareaFocused}
				<div class="text-preview-container">
					<button class="text-preview-btn" on:click={openTextModal}>
						View/Edit Text ({userInput.length} chars)
					</button>
					<button class="text-trash-btn" on:click={clearUserInput}>
						<Icon name="TrashIcon" size={16} />
					</button>
				</div>
			{:else}
				<!-- Textarea -->
				<textarea
					bind:this={textareaElement}
					bind:value={userInput}
					class:quote-placeholder={$isTextareaFocused}
					on:input={handleInput}
					on:keydown={handleKeydown}
					on:focus={onTextareaFocus}
					on:blur={onTextareaBlur}
					placeholder={$isTextareaFocused ? currentPlaceholder : placeholderText}
					disabled={isLoading}
					rows="1"
				/>
			{/if}

			<!-- Button Row -->
			{#if showButtons}
				<div class="btn-row" transition:slide>
					<div class="submission" class:visible={$isTextareaFocused}>
						<!-- AI Toggle Button (only for existing threads) -->
						{#if currentThreadId && !isPlaceholder}
							<button
								class="btn model"
								type="button"
								on:mouseenter={() => (createHovered = true)}
								on:mouseleave={() => (createHovered = false)}
								on:click={toggleAiActive}
							>
								{#if isAiActive}
									<Icon name="PlugZap" size={20} />
									{#if createHovered}
										<span class="tooltip" in:fade>
											{$t('tooltip.pauseAi')}
										</span>
									{/if}
								{:else}
									<Icon name="ZapOff" size={20} />
									{#if createHovered}
										<span class="tooltip" in:fade>
											{$t('tooltip.playAi')}
										</span>
									{/if}
								{/if}
							</button>

							<!-- Collaborators Button -->
							<button
								class="btn model"
								type="button"
								transition:slide
								on:click={() => toggleSection('collaborators')}
							>
								<span class="icon">
									{#if $expandedSections.collaborators}
										<Icon name="Users" size={30} />
									{:else}
										<Icon name="Users" size={20} />
									{/if}
								</span>
							</button>
						{/if}

						<!-- Bookmarks Button -->
						<button
							class="btn model"
							type="button"
							transition:slide
							on:click={() => toggleSection('bookmarks')}
						>
							<span class="icon">
								{#if $expandedSections.bookmarks}
									<Icon name="BookmarkCheckIcon" size={30} />
								{:else}
									<Icon name="Bookmark" size={20} />
								{/if}
							</span>
						</button>

						<!-- Prompts Button -->
						<button
							class="btn model"
							type="button"
							transition:slide
							on:click={() => toggleSection('prompts')}
						>
							<span class="icon">
								{#if $expandedSections.prompts}
									<Icon name="Braces" size={30} />
								{:else}
									<Icon name="Braces" size={20} />
								{/if}
							</span>
							{#if selectedPromptLabel && selectedIcon}
								<svelte:component this={selectedIcon} color="var(--text-color)" />
							{/if}
						</button>

						<!-- System Prompts Button -->
						<button
							class="btn model"
							type="button"
							transition:slide
							on:click={() => toggleSection('sysprompts')}
						>
							<span class="icon">
								{#if $expandedSections.sysprompts}
									<Icon name="Command" size={24} />
								{:else}
									<Icon name="Command" size={20} />
								{/if}
							</span>

							<div class="label-container">
								{#if $currentUser?.sysprompt_preference}
									{#if $currentUser.sysprompt_preference === 'NORMAL'}
										<span class="prompt-label">Normal</span>
									{:else if $currentUser.sysprompt_preference === 'CONCISE'}
										<span class="prompt-label">Concise</span>
									{:else if $currentUser.sysprompt_preference === 'CRITICAL'}
										<span class="prompt-label">Critical</span>
									{:else if $currentUser.sysprompt_preference === 'INTERVIEW'}
										<span class="prompt-label">Interview</span>
									{:else}
										<span class="prompt-label">{$currentUser.sysprompt_preference}</span>
									{/if}
								{/if}
							</div>
						</button>

						<!-- Model Selection Button -->
						<button
							class="btn model"
							type="button"
							transition:slide
							on:click={() => toggleSection('models')}
						>
							<span class="icon">
								<Icon name="Brain" />
								{#if selectedModelLabel}
									<p class="selector-lable">{selectedModelLabel}</p>
								{/if}
							</span>
						</button>

						<!-- Send Button -->
						<button
							class="btn send-btn"
							type="button"
							class:visible={$isTextareaFocused}
							transition:slide
							on:click={handleSendMessage}
							disabled={isLoading}
						>
							<Icon name="Send" />
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Human-only Mode Input (when AI is disabled) -->
	{#if !isAiActive && !isPlaceholder}
		<div class="combo-input-human" in:fly={{ x: 200, duration: 300 }} out:fade={{ duration: 200 }}>
			<textarea
				bind:this={textareaElement}
				bind:value={userInput}
				class:quote-placeholder={$isTextareaFocused}
				on:input={handleInput}
				on:keydown={handleKeydown}
				on:focus={onTextareaFocus}
				on:blur={onTextareaBlur}
				placeholder={placeholderText}
				disabled={isLoading}
				rows="1"
			/>

			<div class="btn-row" transition:slide>
				<div class="submission" class:visible={$isTextareaFocused}>
					{#if $isTextareaFocused}
						{#if currentThreadId}
							<!-- AI Toggle Button -->
							<button
								class="toggle-btn response"
								type="button"
								on:mouseenter={() => (createHovered = true)}
								on:mouseleave={() => (createHovered = false)}
								on:click={toggleAiActive}
							>
								{#if isAiActive}
									<Icon name="PlugZap" size={20} />
									{#if createHovered}
										<span class="tooltip" in:fade>
											{$t('tooltip.pauseAi')}
										</span>
									{/if}
								{:else}
									<Icon name="ZapOff" size={20} />
									{#if createHovered}
										<span class="tooltip" in:fade>
											{$t('tooltip.playAi')}
										</span>
									{/if}
								{/if}
							</button>
						{/if}

						<!-- Attachment Button -->
						<button class="btn" type="button" transition:slide>
							<Icon name="Paperclip" />
						</button>

						<!-- Send Button -->
						<button
							class="btn send-btn"
							type="button"
							class:visible={$isTextareaFocused}
							transition:slide
							on:click={handleSendMessage}
							disabled={isLoading}
						>
							<Icon name="Send" />
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	:root {
		--h3-min-size: 0.875rem;
		--h3-max-size: 1.125rem;
		--breakpoint-sm: #{$breakpoint-sm};
		--breakpoint-md: #{$breakpoint-md};
		--breakpoint-lg: #{$breakpoint-lg};
		--breakpoint-xl: #{$breakpoint-xl};
	}

	span {
		display: flex;
		justify-content: left;
		align-items: center;
		color: var(--text-color);

		&.btn {
			display: flex;
			width: auto;
			border-radius: 50%;
			padding: 0.5rem;
			width: 2rem;
			height: 2rem;
			transition: all 0.3s ease;
			border: none;
			z-index: 9999;
			&:hover {
				cursor: pointer;
				transform: scale(1.3);
				background: var(--bg-gradient-left);
			}
		}

		&.start {
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			height: auto !important;
			width: auto;
			margin-bottom: 0 !important;
			max-width: 800px;
			gap: 0.5rem;
			margin: 0;

			position: relative;
			transition: all 0.3s ease;
			& p {
				font-size: 1.5rem;
			}
			&:hover {
				animation: shake 2.8s ease;
			}
			& h3 {
				font-size: 2rem;
				display: flex;
				width: auto;
				max-width: 800px;
				justify-content: center !important;
				align-items: center !important;
				padding: 0 !important;
			}

			& img.logo {
				width: 3rem;
				height: 3rem;

				margin-top: auto;
				display: flex;
				justify-content: center;
				align-items: center;
			}
		}

		&.icon {
			transition: all 0.2s ease-in-out;
			gap: 0.5rem;
			height: 36px;

			& &.active {
				color: var(--bg-color) !important;
			}
		}
		&.counter {
			color: var(--placeholder-color);
			font-size: 16px;
			max-width: 100px;
			margin: 0 !important;
			display: flex;
			flex-direction: row;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		&.role {
			display: flex;
			justify-content: center;
			align-items: center;
		}
		&.model {
			display: flex;
			box-shadow: rgba(128, 128, 128, 0.8);
			justify-content: center;
			align-items: center;
			gap: 0.5rem;
			border-radius: 1rem;
		}
	}

	.btn {
		display: flex;
		justify-content: center;
		align-items: center;
		// box-shadow: 2px -4px 20px 1px rgba(255, 255, 255, 0.1);
		transition: all 0.3s ease;
		border: none;
		width: auto;
		&.model {
			border-radius: 1rem;
			width: 2rem !important;
			background: var(--bg-color) !important;
			p.selector-lable {
				display: none;
			}
			& .prompt-label {
				display: none;
			}
			&:hover {
				width: 10rem !important;
				transform: translateX(-1rem);
				p.selector-lable {
					display: flex;
				}
				& .prompt-label {
					display: flex;
				}
			}
		}

		&.send-btn {
			border-radius: 1rem;
			width: 3rem !important;
			height: 3rem !important;
			background: var(--bg-color) !important;
			&:hover {
				transform: scale(1.1);
			}
		}
	}
	.casual-input {
		background: var(--bg-color);
		width: 100%;
		display: flex;
		position: relative;
		bottom: auto;
		top: 0;
		height: 200px;
	}
	.drawer-visible .input-container {
		bottom: 3rem;
		position: absolute;
	}

	.input-container {
		display: flex;
		flex-direction: column;
		max-width: 1200px;
		width: 100%;
		position: absolute;
		flex-grow: 0;
		left: auto;
		margin-top: 0;
		height: auto;
		bottom: 3rem;
		margin-bottom: 0;
		border: 1px solid var(--line-color);
		transition: all 0.2s ease;
		// backdrop-filter: blur(10px);
		border-radius: 2rem;
		align-items: center;
		// backdrop-filter: blur(4px);
		justify-content: center;
		// background: var(--bg-gradient);
		z-index: 7700;
		pointer-events: auto;

		&::placeholder {
			color: var(--placeholder-color);
		}

		:global(svg) {
			color: var(--primary-color);
			stroke: var(--primary-color);
			fill: var(--tertiary-color);
		}
		&.combo-input {
			backdrop-filter: blur(1px);
		}

		& textarea {
			font-size: 1.5rem;
			// border: 1px solid var(--secondary-color);
			border: none;
			box-shadow: none;
			position: relative;
			border-radius: 1rem;
			backdrop-filter: blur(14px);
			// border-top-left-radius: var(--radius-m);
			// border-bottom-left-radius: var(--radius-m);
			// background-color: transparent;
			// margin-left: 7rem;
			// transition: 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);
			// box-shadow: 0px 1px 20px 1px rgba(255, 255, 255, 0.2);
			color: var(--text-color);
			// background: transparent;
			display: flex;
			// max-height: 400px;
			// backdrop-filter: blur(40 px);
			// & :focus {
			//   border-top: 1px solid red;
			// color: white;
			// animation: pulse 10.5s infinite alternate;
			// box-shadow: none;

			// display: flex;
			// // background: var(--bg-gradient-left) !important;
			//     // box-shadow: -0 -1px 50px 4px rgba(255, 255, 255, 0.78);
			//     border-top: 1px solid var(--secondary-color) !important;

			// background: black !important;
			// padding: 2rem;
			// margin-left: 2rem;
			// margin-right: 0;
			// height: auto;
			// box-shadow: none !important;

			// }
		}
	}
	.btn {
		display: flex;
		justify-content: center;
		align-items: center;
		// box-shadow: 2px -4px 20px 1px rgba(255, 255, 255, 0.1);
		transition: all 0.3s ease;
		border: none;
		width: auto;
		&.model {
			width: auto;
			width: auto !important;
			p.selector-lable {
				display: none;
			}
			&:hover {
				width: 10rem !important;
				transform: translateX(-75%);
				p.selector-lable {
					display: flex;
				}
			}
		}

		&.send-btn {
			background-color: var(--tertiary-color);
			width: 2rem;
			height: 2rem;
			border-radius: 50%;
			&:hover {
				cursor: pointer;
				transform: scale(1.3);
				background: var(--bg-gradient-left);
			}
		}
	}
	.input-container-start {
		display: flex;
		flex-direction: column;
		position: absolute;

		width: 100%;
		margin-top: 0;
		height: auto;
		right: auto;
		left: auto;
		bottom: 1rem;
		margin-bottom: 0;
		overflow-y: none;
		// backdrop-filter: blur(4px);
		justify-content: flex-end;
		align-items: center;
		// background: var(--bg-gradient);
		z-index: 1;
		transition: all 0.1s ease;

		& .combo-input {
			background: var(--primary-color);
			display: flex;
			justify-content: center;
			align-items: center;
			border: 1px solid var(--secondary-color);
			border-radius: 2rem;
			width: 100%;

			height: auto;
		}

		&::placeholder {
			color: var(--placeholder-color);
		}

		:global(svg) {
			color: var(--primary-color);
			stroke: var(--primary-color);
			fill: var(--tertiary-color);
		}

		& textarea {
			border: none;
			box-shadow: none;
			background: var(--bg-color);
			margin-top: 1rem !important;
			// backdrop-filter: blur(14px);
			// margin-left: 7rem;
			// padding-left: 1rem;
			// box-shadow: 0px 1px 20px 1px rgba(255, 255, 255, 0.2);
			color: var(--text-color);
			// background: transparent;
			display: flex;
			// backdrop-filter: blur(40px);
			font-size: 1.5rem;
			width: calc(100% - 2rem);
			border-radius: 2rem;
			background: transparent;
			// max-height: 400px;
			// margin-left: 2rem !important;
			// margin-right: 2rem !important;
			transition: all 0.5s ease;

			& :focus {
				color: white;
				// animation: pulse 10.5s infinite alternate;
				box-shadow: none;
				overflow-y: auto !important;
				transition: all 0.3s ease;

				display: flex;
				// background: var(--bg-gradient-left) !important;
				// box-shadow: -0 -1px 50px 4px rgba(255, 255, 255, 0.78);
				// border-top: 4px solid var(--secondary-color) !important;

				box-shadow: none !important;
			}
		}
	}

	.combo-input {
		// width: 100vw;;
		border-radius: var(--radius-m);
		margin-bottom: 0;
		height: auto;
		width: 100%;
		margin-left: 0;
		bottom: auto;
		left: 0;
		display: flex;
		position: relative;
		align-items: flex-end;
		// background: var(--bg-color);
		flex-direction: row;
		// background: var(--bg-gradient);
		// backdrop-filter: blur(40px);
		transition: all 0.3s ease;
		max-height: 400px;
		overflow: hidden; //

		& textarea {
			// max-height: 50vh;
			padding: 1rem;
			height: auto !important;
			width: 100%;
			margin: 1rem;
			margin-top: 0;
			margin-bottom: 0;
			font-size: 1rem !important;
			height: 100vh;
			// background: var(--bg-gradient-left);
			&:focus {
				// box-shadow: 0 20px -60px 0 var(--secondary-color, 0.11);
				// border-bottom: 1px solid var(--placeholder-color);
				// border-top-left-radius: 0;
				height: 100% !important;
				// background: var(--primary-color);
				// box-shadow: -100px -1px 100px 4px rgba(255, 255, 255, 0.2);
				// margin: 2.5rem;
				margin-top: 1.5rem;
				margin-bottom: 0;
				overflow-y: scroll !important;

				// background: var(--primary-color);
			}
		}
	}
	.combo-input-human {
		// width: 100vw;;
		border-radius: var(--radius-m);
		margin-bottom: 0;
		height: auto;
		width: 100%;
		max-width: 1200px;
		margin-left: 0;
		bottom: auto;
		left: 0;
		display: flex;
		position: relative;
		background: transparent;
		flex-direction: column;
		// background: var(--bg-gradient);
		// backdrop-filter: blur(40px);
		transition: all 0.3s ease;
		& .btn-row {
			display: flex;
			flex-direction: row !important;
			justify-content: flex-end;
			margin-top: 0.5rem;
			width: calc(100% - 8rem) !important;
		}
		& span.btn {
			padding: auto;
		}
		& .submission {
			flex-direction: row;
		}

		& textarea {
			// max-height: 50vh;
			height: 100px !important;
			border-radius: 4rem;
			margin: 1rem;
			margin-top: 0.5rem;
			margin-bottom: 0;
			padding-left: 2rem;
			font-style: normal;
			z-index: 1000;
			// background: var(--bg-color);

			&:focus {
				// box-shadow: 0 20px -60px 0 var(--secondary-color, 0.11);
				// border-bottom: 1px solid var(--placeholder-color);
				// border-top-left-radius: 0;
				min-height: 400px !important;
				// background: var(--primary-color);
				// box-shadow: -100px -1px 100px 4px rgba(255, 255, 255, 0.2);
				box-shadow: 0px 1px 210px 1px rgba(255, 255, 255, 0.2);
				margin: 2.5rem;
				margin-top: 0.5rem;
				margin-bottom: 0;
				// background: var(--primary-color);
			}
		}
	}

	textarea::placeholder {
		color: var(--placeholder-color);
		transition: all 0.3s ease;
		width: 100%;
		height: 100%;
		padding-top: 1rem !important;
		display: flex;
		text-align: center;
		user-select: none !important;

		font-size: 1.5rem;
		letter-spacing: 0.2rem;
	}

	textarea.quote-placeholder::placeholder {
		font-style: italic;
		color: var(--placeholder-color);
		opacity: 0.8;
		padding: 1rem;
		font-size: 0.8rem;
		display: flex;
		flex: 1;
		justify-content: center;
		align-items: flex-start;
		height: auto;
		user-select: none !important;
		// transform: translateY(50%);
	}

	textarea {
		display: flex;
		flex-direction: column;
		/* font-family: 'Merriweather', serif; */
		width: auto;
		min-height: 80px;
		/* min-height: 60px; Set a minimum height */
		/* max-height: 1200px; Set a maximum height */
		// padding: 1rem;
		text-justify: center;
		justify-content: center;
		resize: none;
		letter-spacing: 1.4px;
		background: transparent;
		border: 1px solid rgba(53, 63, 63, 0.5);
		// border-radius: 20px;
		/* background-color: #2e3838; */
		// background-color: #020101;
		color: #818380;
		line-height: 1.4;
		height: auto;
		// max-height: 50vh;
		text-justify: center;
		box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
		overflow: scroll;
		scrollbar-width: none;
		scrollbar-color: #21201d transparent;
		vertical-align: middle; /* Align text vertically */
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		margin-left: 1rem;
		margin-top: 1rem;
		&:focus {
			/* margin-right: 5rem; */
			outline: none;
			// border: 2px solid #000000;
			transform: translateY(0) rotate(0deg);
			/* height: 400px; */
			display: flex;
			/* min-height: 200px; */
		}
	}
	.btn-row {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 100%;
		gap: 2rem;
		width: 3rem !important;
		margin-right: 1rem;
		margin-bottom: 0.5rem;
		z-index: 8000;
		// background: var(--bg-gradient-r);
	}
	.submission {
		display: flex;
		flex-direction: column;
		gap: 1rem !important;
		margin: 0;
		padding: 0;
		width: 3rem !important;
		height: 100%;
		justify-content: center;
		align-self: flex-end;
		// padding: 0.5rem;
		transition: all 0.3s ease;
	}

	.visible.submission {
		// backdrop-filter: blur(4px);
		z-index: 7000;
	}
	@media (max-width: 1000px) {
		.input-container {
			left: 0rem !important;
			right: 0;
			margin-bottom: 0;
			bottom: 6rem !important;
			background: transparent;
			border-radius: 0;
			border: 1px solid transparent;
			border-top: 1px solid var(--line-color);
			flex-grow: 0;
			width: auto;
			position: absolute;
			align-items: center;
			justify-content: flex-end;
			overflow: none;
		}

		.chat-placeholder {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: flex-start;
			border-radius: var(--radius-m);
			// background: var(--primary-color);
			transition: all 0.3s ease;
			margin-left: 0;
			margin-right: 0;

			margin-top: 0;
			height: calc(100vh - 2rem);
			user-select: none;
			scrollbar-width: thin;
			scrollbar-color: var(--secondary-color) transparent;
			scroll-behavior: smooth;
			width: 100%;
		}

		span.header-btns {
			display: flex;
			flex-direction: row !important;
			right: 0;
			bottom: 0;
			margin-right: 0.5rem;
			margin-top: 0;
			width: auto !important;
		}

		.toggle-btn {
			width: auto;
			padding: 0.5rem !important;
			height: auto;
		}

		// .logo-container {
		//   display: flex;
		// }
		.chat-container {
			margin-left: 0;
			margin-right: 0;
			right: 0;
			width: 100%;
		}
		.chat-content {
			margin-right: 0;
		}

		// .chat-header {
		//   margin-top: 1rem;
		//   padding: 1rem;
		//   width: 90%;
		// }

		.drawer-visible {
			&.chat-container {
				margin-left: 0;
				left: 0;
			}
		}

		.input-container-start {
			display: flex;
			flex-direction: column;

			width: calc(100%);
			max-width: 1200px;
			margin-top: 0;
			height: auto;
			right: 0;
			bottom: 0 !important;
			margin-bottom: 0;
			overflow-y: none;
			// backdrop-filter: blur(4px);
			justify-content: flex-start;
			align-items: flex-end;
			// background: var(--bg-gradient);
			z-index: 1;

			& .combo-input {
				background: transparent;
				// background: var(--primary-color);
				position: absolute;
				display: flex;
				justify-content: center;
				align-items: center;
				border: 1px solid var(--secondary-color);
				border-radius: 2rem;
				bottom: 0;
				width: calc(100% - 2rem);
				height: auto;
				padding-inline-start: 2rem;
				backdrop-filter: blur(10px);

				& textarea {
					padding-inline-start: 3.5rem;
					max-height: 200px;
					font-size: 1rem !important;
					padding: 2rem;

					&::placeholder {
						color: var(--placeholder-color);
						font-size: 0.65rem !important;
					}
					&:focus {
						padding-inline-start: 4rem;
						height: auto !important;
						padding: 0;
					}
				}
			}
			.section-content-sysprompts {
				// width: calc(50% - 1rem);
				// margin-left: calc(50% - 1rem);
				width: 100% !important;
				max-width: 1200px;
				height: auto;
				display: flex;
				margin-right: 0;
				position: relative;
				bottom: 4rem;
				right: 0;
				justify-content: flex-end;
			}

			:global(svg) {
				color: var(--primary-color);
				stroke: var(--primary-color);
				fill: var(--tertiary-color);
			}

			& textarea {
				border: none;
				box-shadow: none;
				transition: all 0.3s ease;
				background: var(--bg-color);
				margin-top: 0 !important;
				padding: 0;
				margin: 0;
				// backdrop-filter: blur(14px);
				// margin-left: 7rem;
				// padding-left: 1rem;
				// box-shadow: 0px 1px 20px 1px rgba(255, 255, 255, 0.2);
				color: var(--text-color);
				// background: transparent;
				display: flex;
				// backdrop-filter: blur(40px);
				font-size: 1.5rem;
				width: 100%;
				border-radius: 0;
				background: transparent;
				// max-height: 400px;
				// margin-left: 2rem !important;
				// margin-right: 2rem !important;

				// & :focus {
				// color: white;
				// animation: none;
				// box-shadow: none;
				// overflow-y: auto !important;
				// transition: all 0.3s ease;
				// display: flex;
				// // background: var(--bg-gradient-left) !important;
				//     // box-shadow: -0 -1px 50px 4px rgba(255, 255, 255, 0.78);
				//     // border-top: 4px solid var(--secondary-color) !important;

				// box-shadow: none !important;

				// }
			}
		}
		button {
			display: flex;
			user-select: none;
			.toggle-btn {
				&.header {
					background-color: red !important;
					width: 500px;
				}
			}
			&.play {
				background: transparent;
				display: flex;
				justify-content: center;
				align-items: center;
				width: 3rem;
				height: 3rem;
			}
			&.btn-back {
				background-color: var(--placeholder-color);
				position: relative;
				display: flex;
				overflow-x: none;
				// height: 50%;
				// top: 3rem;
				justify-content: center;
				align-items: center;
				border: none;
				color: var(--text-color);
				cursor: pointer;
				border-radius: var(--radius-l);
				transition: all 0.3s ease;
				// &:hover {
				//   background-color: var(--tertiary-color);
				//   transform: translateX(2px);
				// }
				// &:active {
				// }
			}

			&.btn-ai {
				border-radius: var(--radius-m);
				width: auto;
				height: auto;
				border: none;
				display: flex;
				justify-content: center;
				align-items: center;
				transition: all 0.3s ease;
				justify-content: center !important;
				background-color: transparent;
				z-index: 2000;
				&:hover {
					background: var(--secondary-color);
					// box-shadow: -0 2px 20px 1px rgba(255, 255, 255, 0.1);
					transform: translateY(-10px);
				}
			}
			&.drawer-header {
				justify-content: space-between;
				width: 100%;
				height: 100%;
				gap: 0.5rem;
				&:hover {
					background-color: var(--secondary-color);
				}
			}
			&.add {
				background-color: transparent;
				font-size: var(--font-size-s);
				font-weight: bold;
				cursor: pointer;
				transition: all ease 0.3s;
				display: flex;
				justify-content: center;
				align-items: center;
				position: relative;
				user-select: none;
				transition: all 0.2s ease;
				width: fit-content !important;

				// gap: var(--spacing-sm);

				& span.icon {
					color: var(--placeholder-color);
					gap: 0.5rem;

					&:hover {
						color: var(--tertiary-color);
					}

					&.active {
						color: var(--tertiary-color);
					}
				}

				&:hover {
					color: var(--tertiary-color);
				}
			}
		}

		.toolbar-button {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0;
			height: 3rem;
			width: 3rem;
			padding: 0;
			border-radius: 4rem;

			border: 1px solid var(--border-color, #e2e8f0);
			cursor: pointer;
			&:hover {
				background-color: var(--secondary-color);
			}

			&.active {
				background-color: var(--tertiary-color);
			}
		}

		.card {
			margin-left: 0;
			width: 100%;
		}

		.btn-row {
			display: flex;
			flex-direction: column;
			width: 100%;
			margin-top: 0;
			padding-top: 0;
			padding-bottom: 0;
			justify-content: flex-end;
			align-items: flex-end;
			gap: 0;
			padding-top: 0.5rem;
			padding-bottom: 0.5rem;
			height: auto;
			// z-index: 8000;
			// background: var(--bg-gradient-r);
		}
		.submission {
			display: flex;
			flex-direction: column;
			gap: 1rem;
			width: auto;
			height: auto;
			justify-content: flex-end;
			align-self: flex-end;
			// padding: 0.5rem;
			transition: all 0.3s ease;
		}

		.btn-col-left {
			display: flex;
			flex-direction: column;
			gap: 10px;
			position: fixed;
			left: 0;
			top: 0;
			height: 90%;
			width: auto;
			align-items: left;
			justify-content: flex-end;
			z-index: 10;
			border-radius: 1rem;
			padding: 0.5rem;
			transition: all 0.3s ease-in;
		}

		.selector-lable {
			display: none;
		}
	}

	@media (max-width: 450px) {
		.input-container {
			margin-bottom: 0;
			margin-left: 0;
			bottom: 4rem !important;
			height: auto;
			// width: 100%;
			backdrop-filter: blur(10px);
			border-top: 1px solid var(--line-color);
			border-top-left-radius: 1rem;
			border-top-right-radius: 1rem;
			flex-grow: 0;
			max-height: 200px;

			& .combo-input textarea {
				padding: 0 !important;
				margin-left: 2.5rem;
				height: 2rem !important;
				border: none;

				&:focus {
					margin-left: 0;
					padding-inline-start: 2rem !important;
					font-size: 0.7rem !important;
					background: transparent !important;
				}
			}
		}
		textarea::placeholder {
			color: var(--placeholder-color);
			transition: all 0.3s ease;
			width: 100%;
			padding: 0.5rem;
			height: 3rem !important;
			user-select: none;
			line-height: 1.5;
			margin-top: auto;
			display: flex;
			text-align: left;
			font-size: 0.7rem;
			letter-spacing: 0rem;
		}

		textarea.quote-placeholder::placeholder {
			font-style: italic;
			color: var(--placeholder-color);
			opacity: 0.8;
			height: auto;
			user-select: none;
		}

		textarea {
			font-size: 0.8rem !important;
		}
		.input-container-start {
			bottom: 0rem;
			width: 100%;
			height: auto;

			& .combo-input {
				background: var(--primary-color);
				display: flex;
				justify-content: center;
				align-items: center;
				border: 0;
				border-top-left-radius: 2rem;
				border-top-right-radius: 2rem;
				border-bottom-left-radius: 0;
				border-bottom-right-radius: 0;
				border-top: 1px solid var(--line-color);
				width: calc(100% - 2rem) !important;
				background: var(--primary-color);
				height: auto;
				user-select: none;

				& textarea {
					// max-height: 50vh;
					height: auto;
					width: 100%;
					margin: 1rem;
					margin-top: 0;
					margin-bottom: 0;
					z-index: 1000;
					// background: var(--bg-gradient-left);
					&:focus {
						// box-shadow: 0 20px -60px 0 var(--secondary-color, 0.11);
						// border-bottom: 1px solid var(--placeholder-color);
						// border-top-left-radius: 0;
						height: 100px !important;
						min-height: auto !important;
						// background: var(--primary-color);
						// box-shadow: -100px -1px 100px 4px rgba(255, 255, 255, 0.2);
						// margin: 2.5rem;
						margin-top: 0.5rem;
						margin-bottom: 0;
						// background: var(--primary-color);
					}
				}
			}

			&::placeholder {
				color: var(--placeholder-color);
			}

			:global(svg) {
				color: var(--primary-color);
				stroke: var(--primary-color);
				fill: var(--tertiary-color);
			}

			& textarea {
				border: none;
				box-shadow: none;
				transition: all 0.3s ease;
				background: var(--bg-color);
				margin-top: 1rem !important;
				// backdrop-filter: blur(14px);
				// margin-left: 7rem;
				// padding-left: 1rem;
				// box-shadow: 0px 1px 20px 1px rgba(255, 255, 255, 0.2);
				color: var(--text-color);
				// background: transparent;
				display: flex;
				// backdrop-filter: blur(40px);
				font-size: 1rem;
				width: calc(100% - 2rem);
				border-radius: 0;
				background: transparent;
				// max-height: 400px;
				// margin-left: 2rem !important;
				// margin-right: 2rem !important;

				&:focus {
					color: white;
					animation: none;
					box-shadow: none;
					overflow-y: auto !important;
					transition: all 0.3s ease;
					display: flex;
					font-size: 1rem;
					// background: var(--bg-gradient-left) !important;
					// box-shadow: -0 -1px 50px 4px rgba(255, 255, 255, 0.78);
					// border-top: 4px solid var(--secondary-color) !important;

					box-shadow: none !important;
				}
			}
		}

		.input-container {
			flex-direction: column;
		}

		.combo-input {
			width: 100% !important;
			padding: 0;
			max-height: 200px;
		}
		.btn-row {
			flex-direction: row;
			gap: 0.1rem;
		}

		.submission {
			flex-direction: row;
			gap: 0.1rem;
		}
		.submission {
			gap: 0.5rem;
			margin-right: 0;
			margin-left: 2rem;
			margin-bottom: 0;
			width: 100%;
		}

		.drawer-container {
			margin-right: 0;
			margin-left: 0;
			right: 0;
			left: 0;
			width: 100%;
		}
	}
</style>

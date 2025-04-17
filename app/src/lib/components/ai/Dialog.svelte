<script lang="ts">
	import { onMount, createEventDispatcher, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { currentLanguage } from '$lib/stores/languageStore';
	import AIChat from '$lib/components/ai/AIChat.svelte';
	import { quintOut } from 'svelte/easing';
	import {  currentUser } from '$lib/pocketbase';

	import { networkStore } from '$lib/stores/networkStore';
	import { threadsStore } from '$lib/stores/threadsStore';
	import type {
		Node,
		NodeConfig,
		AIModel,
		NetworkData,
		Task,
		PromptType,
		Attachment,
		Threads,
		Messages
	} from '$lib/types/types';
	import {
		ArrowRight,
		Paperclip,
		CheckCircle,
		Bot,
		Clock,
		MessageSquare,
		Tag,
		User
	} from 'lucide-svelte';
	import { createAgentWithSummary, ensureAuthenticated, updateAIAgent } from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	import ModelSelector from './ModelSelector.svelte';
	import PromptSelector from './PromptSelector.svelte';
	import { fly, fade, blur } from 'svelte/transition';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import greekImage from '$lib/assets/illustrations/greek.png';
	import { navigating } from '$app/stores';
	import { isNavigating } from '$lib/stores/navigationStore';
	import {
		fetchThreads,
		fetchMessagesForThread,
		addMessageToThread,
		updateThread,
		updateMessage,
		createThread
	} from '$lib/clients/threadsClient';
	import { t } from '$lib/stores/translationStore';
	import StatsContainer from '$lib/components/common/cards/StatsContainer.svelte';

	export let x: number;
	export let y: number;
	export let aiModel: AIModel;
	export let userId: string = crypto.randomUUID();
	export let availableModels: AIModel[] = [];

	let showFade = false;

	let pageReady = false;

	$: if ($currentLanguage) {
		updatePageContent();
	}

	async function updatePageContent() {
		pageReady = false;
		await tick();
		pageReady = true;
	}

	onMount(() => {
		setTimeout(() => (showFade = true), 200);

		updatePageContent();
	});

	let seedPrompt = '';
	let showChat = false;
	let showIntro = false;
	let config: NodeConfig = {
		maxTokens: 100,
		temperature: 0.7
	};
	let summary: string = '';
	let tasks: Task[] = [];

	let isTextareaFocused = false;
	let placeholderText = '';

	function getRandomQuote() {
		const quotes = $t('extras.quotes');
		return quotes[Math.floor(Math.random() * quotes.length)];
	}

	function getPlaceholder() {
		return $t('landing.textplaceholder');
	}

	$: placeholderText = isTextareaFocused ? getPlaceholder() : getRandomQuote();

	let textareaElement: HTMLTextAreaElement | null = null;
	let isAuthenticated = false;

	let attachment: Attachment | null = null;
	let fileInput: HTMLInputElement;
	let selectedPromptType: PromptType = 'TUTOR';

	let isLoading = false;

	let threads: Threads[];
	let currentThreadId: string | null;
	let messages: Messages[];
	let showThreadList = false;
	let updateStatus: string;
	let showConfirmation = false;
	let newThreadName = '';
	let newThreadId: string | null = null;

	let showArrowOverlay = false;

	$: ({ threads, currentThreadId, messages, updateStatus } = $threadsStore);

	const dispatch = createEventDispatcher<{
		create: { node: Node; networkData: NetworkData | null };
		cancel: void;
	}>();

	function handleOverlayClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			showArrowOverlay = false;
		}
	}

	function toggleArrow() {
		showArrowOverlay = !showArrowOverlay;
	}

	function handleTextareaFocus() {
		isTextareaFocused = true;
		showArrowOverlay = false;
	}

	function handleTextareaBlur() {
		isTextareaFocused = false;
		showArrowOverlay = true;
	}

	function adjustFontSize(element: HTMLTextAreaElement) {
		if (!element) return;

		const maxFontSize = 3;
		const minFontSize = 1;
		const maxLength = 600; // Adjust this value to determine when to start shrinking the font

		const contentLength = element.value.length;

		if (contentLength <= maxLength) {
			element.style.fontSize = `${maxFontSize}rem`;
		} else {
			const fontSize = Math.max(minFontSize, maxFontSize - (contentLength - maxLength) / 2);
			element.style.fontSize = `${fontSize}rem`;
		}
	}

	function groupThreadsByDate(thread: Threads): string {
		const now = new Date();
		const threadDate = new Date(thread.updated);
		const diffDays = Math.floor((now.getTime() - threadDate.getTime()) / (1000 * 3600 * 24));

		if (diffDays === 0) return $t('threads.today');
		if (diffDays === 1) return $t('threads.yesterday');
		if (diffDays < 7) return $t('threads.lastweek');
		if (diffDays < 30) return $t('threads.thismonth');
		return $t('threads.older');
	}

	const groupOrder = [
		$t('threads.today'),
		$t('threads.yesterday'),
		$t('threads.lastweek'),
		$t('threads.thismonth'),
		$t('threads.older')
	];

	$: groupedThreads = threads.reduce(
		(acc, thread) => {
			const group = groupThreadsByDate(thread);
			if (!acc[group]) acc[group] = [];
			acc[group].push(thread);
			return acc;
		},
		{} as Record<string, Threads[]>
	);

	$: orderedGroupedThreads = groupOrder
		.filter((group) => groupedThreads[group] && groupedThreads[group].length > 0)
		.map((group) => ({ group, threads: groupedThreads[group] }));

	onMount(() => {
		const unsubscribe = navigating.subscribe((navigationData) => {
			if (navigationData) {
				isNavigating.set(true);
			} else {
				// Add a small delay before hiding the spinner to ensure content is ready
				setTimeout(() => {
					isNavigating.set(false);
				}, 300);
			}
		});

		return () => {
			unsubscribe();
		};
	});

	async function handleThreadSelection(threadId: string) {
		try {
			// Just set the current thread and load its messages
			await threadsStore.setCurrentThread(threadId);
			await threadsStore.loadMessages(threadId);

			// Navigate to the ask page with the existing thread
			const params = new URLSearchParams();
			params.append('threadId', threadId);
			if (aiModel && aiModel.id) {
				params.append('modelId', aiModel.id);
			}
			params.append('promptType', selectedPromptType);

			goto(`/ask?${params.toString()}`);
		} catch (error) {
			console.error(`Error selecting thread ${threadId}:`, error);
		}
	}

	async function handleLoadThread(threadId: string) {
		try {
			await threadsStore.loadMessages(threadId);
			// Don't automatically redirect, instead update the UI to show the loaded thread
			currentThreadId = threadId;
			// You might want to update other UI elements here
		} catch (error) {
			console.error(`Error loading messages for thread ${threadId}:`, error);
		}
	}

	onMount(async () => {
		isAuthenticated = await ensureAuthenticated();
		if (!isAuthenticated) {
			console.error('User is not logged in. Please log in to create a network.');
		}

		if (textareaElement) {
			const adjustTextareaHeight = () => {
				if (textareaElement) {
					textareaElement.style.height = 'auto';
					textareaElement.style.height = `${Math.min(textareaElement.scrollHeight, 1000)}px`;
				}
			};

			textareaElement.addEventListener('input', adjustTextareaHeight);
			adjustTextareaHeight();

			if (!showChat) {
				textareaElement.focus();
			}

			const loadedThreads = await threadsStore.loadThreads();
			threads = loadedThreads;
		}

		await threadsStore.loadThreads();
		if (threads.length === 0) {
			await handleCreateNewThread();
			await handleSeedPromptSubmit();

			// goto('/ask');
		}
		if (currentThreadId) {
			await handleLoadThread(currentThreadId);
			// goto('/ask');
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSeedPromptSubmit();
			goto('/ask');
		}
	}

	async function handleCreateNewThread() {
		try {
			const newThread = await threadsStore.addThread({
				op: userId,
				name: `Thread ${threads?.length ? threads.length + 1 : 1}`
			});
			if (newThread && newThread.id) {
				threads = [...(threads || []), newThread];
				await handleLoadThread(newThread.id);
			} else {
				console.error('Failed to create new thread: Thread object is undefined or missing id');
			}
		} catch (error) {
			console.error('Error creating new thread:', error);
		}
	}

	function handleUpload() {
		fileInput.click();
	}

	interface Attachment {
		id: string;
		fileName: string;
		note?: string;
		created: string;
		updated: string;
		url: string;
		file?: File;
	}

	// Fix the getMessagesByDate access
	$: groupedMessages = threadsStore.getMessagesByDate;

	// Fix attachment creation
	function handleFileSelected(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			const file = target.files[0];
			attachment = {
				id: crypto.randomUUID(),
				fileName: file.name,
				note: '',
				created: new Date().toISOString(),
				updated: new Date().toISOString(),
				url: URL.createObjectURL(file),
				file: file
			};
		}
	}
	function deleteAttachment() {
		attachment = null;
	}

	function handlePromptSelection(event: CustomEvent<PromptType>) {
		selectedPromptType = event.detail;
		console.log('Selected prompt:', event.detail);
	}

	async function handleSeedPromptSubmit() {
		console.log('handleSeedPromptSubmit called');
		if (seedPrompt.trim() || attachment) {
			isLoading = true;
			try {
				// Create new thread
				const newThread = await threadsStore.addThread({
					op: pb.authStore.model?.id,
					name: `Thread ${threads?.length ? threads.length + 1 : 1}`
				});

				if (newThread && newThread.id) {
					// Add the seed prompt message first
					if (seedPrompt.trim()) {
						const messageData = {
							thread: newThread.id,
							text: seedPrompt.trim(),
							type: 'human',
							user: pb.authStore.model?.id
						};

						try {
							// Add message using the existing addMessageToThread function
							const createdMessage = await addMessageToThread(messageData);

							// Only after message is saved, update the thread list and set current thread
							threads = [...(threads || []), newThread];
							await threadsStore.setCurrentThread(newThread.id);
							newThreadName = newThread.name;
							newThreadId = newThread.id;

							showConfirmation = true;
							handleConfirmation();

							// Navigate to AIChat with the thread ID and trigger message
							const params = new URLSearchParams({
								threadId: newThread.id,
								messageId: createdMessage.id,
								autoTrigger: 'true'
							});

							goto(`/ask?${params.toString()}`);
						} catch (messageError) {
							console.error('Error creating message:', messageError);
							// If message creation fails, delete the thread to maintain consistency
							await pb.collection('threads').delete(newThread.id);
							throw messageError;
						}
					}
				} else {
					throw new Error('Failed to create new thread: Thread object is undefined or missing id');
				}
			} catch (error) {
				console.error('Error in handleSeedPromptSubmit:', error);
				if (error instanceof ClientResponseError) {
					console.error('Response data:', error.data);
					console.error('Status code:', error.status);
				}
				// Add user-friendly error handling here
			} finally {
				isLoading = false;
			}
		}
	}

	async function verifyUser() {
		if (!userId) {
			throw new Error('No user ID available');
		}

		try {
			const userRecord = await pb.collection('users').getOne(userId);
			return userRecord;
		} catch (error) {
			console.error('Error verifying user:', error);
			throw new Error('User verification failed');
		}
	}

	function handleConfirmation() {
		if (newThreadId) {
			const params = new URLSearchParams();
			params.append('threadId', newThreadId);
			if (aiModel && aiModel.id) {
				params.append('modelId', aiModel.id);
			}
			params.append('promptType', selectedPromptType);
			goto(`/ask?${params.toString()}`);
		}
		showConfirmation = false;
	}
	function resetSeedPrompt() {
		seedPrompt = '';
		showChat = false;
		showIntro = true;
		getRandomQuote;
	}

	async function handleFinalize() {
		// ... (keep the existing handleFinalize function)
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleSummaryGeneration(event: CustomEvent<string>) {
		summary = event.detail;
		console.log('Summary received:', summary);
	}

	function handleTasksGeneration(event: CustomEvent<Task[]>) {
		tasks = event.detail;
		console.log('Tasks received:', tasks);
	}

	function handleModelSelection(event: CustomEvent<AIModel>) {
		aiModel = event.detail;
		console.log('Selected model:', event.detail);
	}

	let threadCount = 0;
	let messageCount = 0;
	let threadMessageCounts: Record<string, number> = {};

	$: {
		if (threads && messages) {
			threadMessageCounts = threads.reduce(
				(acc, thread) => {
					const count = messages.filter((message) => message.thread === thread.id).length;
					acc[thread.id] = count;
					return acc;
				},
				{} as Record<string, number>
			);
		}
	}

	let tagCount = 0;
	let timerCount: number = 0;
	let lastActive: Date | null = null;

	function formatTimerCount(seconds: number): string {
		const hours = Math.floor(seconds / 60);
		const remainingMinutes = seconds % 60;
		return `${hours}h ${remainingMinutes}m`;
	}

	async function fetchCount(collection: string, filter: string): Promise<number> {
		if (!pb.authStore.isValid) {
			console.error('User is not authenticated');
			return 0;
		}

		try {
			const resultList = await pb.collection(collection).getList(1, 1, {
				sort: '-created',
				filter: filter
			});
			return resultList.totalItems;
		} catch (error) {
			console.error(`Error fetching ${collection} count:`, error);
			return 0;
		}
	}

	// Assuming `messages` is an array of message objects, where each message has a `thread` property

	export function fetchThreadMessageCounts(threadId: string): number {
		return messages.filter((message) => message.thread === threadId).length;
	}

	export async function fetchThreadCount(): Promise<number> {
		return fetchCount('threads', `op = "${$currentUser?.id}"`);
	}

	export async function fetchMessageCount(): Promise<number> {
		return fetchCount('messages', `user = "${$currentUser?.id}"`);
	}

	export async function fetchTagCount(): Promise<number> {
		return fetchCount('tags', `user = "${$currentUser?.id}"`);
	}

	export async function fetchTimerCount(): Promise<number> {
		if (!pb.authStore.isValid || !$currentUser) {
			console.error('User is not authenticated');
			return 0;
		}

		try {
			const user = await pb.collection('users').getOne($currentUser.id);

			if (!user.timer_sessions || !Array.isArray(user.timer_sessions)) {
				return 0;
			}

			const totalSeconds = user.timer_sessions.reduce((total, session) => {
				return total + (session.duration || 0);
			}, 0);

			return totalSeconds;
		} catch (error) {
			console.error('Error fetching timer sessions:', error);
			return 0;
		}
	}

	export async function fetchLastActiveTime(): Promise<Date | null> {
		if (!pb.authStore.isValid || !$currentUser) {
			console.error('User is not authenticated');
			return null;
		}

		try {
			const lastMessageResult = await pb.collection('messages').getList(1, 1, {
				filter: `user = "${$currentUser.id}"`,
				sort: '-created'
			});
			if (lastMessageResult.items.length > 0) {
				return new Date(lastMessageResult.items[0].created);
			}
			return null;
		} catch (error) {
			console.error('Error fetching last active time:', error);
			return null;
		}
	}

	function calculatePercentage(count: number, target: number): number {
		return Math.min(Math.round((count / target) * 100), 100);
	}

	// onMount(async () => {

	/*
	 *   if (!pb.authStore.isValid) {
	 *     console.error('User is not authenticated');
	 *     return;
	 *   }
	 */

	/*
	 *   try {
	 *     // Fetch all stats concurrently
	 *     const [ threads, messages, tags, users, lastActiveTime] = await Promise.all([
	 *       fetchThreadCount(),
	 *       fetchMessageCount(),
	 *       fetchTagCount(),
	 *       fetchTimerCount(),
	 *       fetchLastActiveTime(),
	 */

	//     ]);

	/*
	 *     threadCount = threads;
	 *     messageCount = messages;
	 *     tagCount = tags;
	 *     timerCount = await fetchTimerCount();
	 */

	//     lastActive = lastActiveTime;

	/*
	 *     console.log('Stats fetched successfully');
	 *   } catch (error) {
	 *     console.error('Error fetching stats:', error);
	 *   }
	 * });
	 */

	function formatDate(date: string): string {
		if (date === 'Today' || date === 'Yesterday') return date;
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	$: {
		if ($t) {
			placeholderText = isTextareaFocused ? getPlaceholder() : getRandomQuote();
		}
	}
</script>

{#if pageReady}
	<div class="seed-container" transition:fade={{ duration: 300 }}>
		<div
			class="modal"
			in:fly={{ x: -50, duration: 300, delay: 300 }}
			out:fly={{ x: 50, duration: 300 }}
		>
			{#if !showChat}
				{#if !showConfirmation}
					<div class="seed-prompt-input" transition:blur={{ duration: 300 }}>
						<div class="text-container" on:click={handleOverlayClick}>
							<textarea
								bind:this={textareaElement}
								bind:value={seedPrompt}
								placeholder={placeholderText}
								on:keydown={handleKeydown}
								on:focus={handleTextareaFocus}
								on:blur={handleTextareaBlur}
								on:input={(e) => adjustFontSize(e.target)}
							></textarea>
						</div>
						<div class="button-row">
							{#if attachment}
								<button class="attachment-icon" on:dblclick={deleteAttachment}>
									<Paperclip size="20" color="white" />
									<span class="file-name">{attachment.name}</span>
								</button>
							{/if}
							<ModelSelector selectedModel={aiModel} on:select={handleModelSelection} />
							<PromptSelector on:select={handlePromptSelection} />
							<button on:click={handleUpload}>
								<Paperclip />
							</button>
							<button on:click={handleSeedPromptSubmit}>
								<ArrowRight />
							</button>
						</div>
						<div class="thread-columns">
							<!-- <StatsContainer
              {threadCount}
              {messageCount}
              {tagCount}
              {timerCount}
              {lastActive}
            /> -->
							<div class="thread-list">
								<!-- <button class="add-button" on:click={handleCreateNewThread}>
                  {$t('threads.newThread')}
                </button> -->
								{#each orderedGroupedThreads as { group, threads }}
									<div class="thread-group">
										<h3>{group}</h3>
										{#each threads as thread}
											<button on:click={() => handleThreadSelection(thread.id)}>
												<span class="thread-name">{thread.name}</span>
												<span class="message-count">
													✉ {fetchThreadMessageCounts(thread.id)}
												</span>
											</button>
										{/each}
									</div>
								{/each}
							</div>
						</div>
					</div>
				{:else if showConfirmation}
					<div class="confirmation" transition:fly={{ y: -20, duration: 300 }}>
						<div class="spinner">
							<Bot size={40} class="bot-icon" />
						</div>
						<p>"{newThreadName}" thread created</p>
						<button on:click={handleConfirmation}>Continue to Chat</button>
					</div>
				{/if}
			{:else}
				<AIChat
					{seedPrompt}
					{aiModel}
					{userId}
					attachment={attachment?.file}
					promptType={selectedPromptType}
					on:summary={handleSummaryGeneration}
					on:tasks={handleTasksGeneration}
				/>
			{/if}
		</div>
	</div>
{/if}

{#if $isNavigating}
	<LoadingSpinner />
{/if}

{#if showArrowOverlay && !isTextareaFocused}
	<div class="arrow-overlay" transition:fly={{ y: 200, duration: 300, easing: quintOut }}>
		<div class="arrow"></div>
	</div>
{/if}

<input type="file" bind:this={fileInput} style="display: none;" on:change={handleFileSelected} />

<input type="file" bind:this={fileInput} style="display: none;" on:change={handleFileSelected} />

<style lang="scss">
	@use 'src/styles/themes.scss' as *;

	* {
		font-family: var(--font-family);
		color: var(--text-color);
	}
	.modal {
		display: flex;
		flex-direction: column;
		/* border-radius: 40px; */
		/* padding: 10px; */
		height: 100%;
		width: 100%;
		/* margin-top: 100px; */
		position: relative;
		/* min-width: 400px; */
		/* background-color:#010e0e; */
		/* width: 50%; */
		/* left: 2rem; */
		/* transform: translate(-50%, 0%); */
		/* border-radius: 80px; */
		/* background-color: red; */
		transition: all 1.2s ease-in-out;
		/* z-index: 1000; */
	}

	.thread-columns {
		display: flex;
		flex-direction: row;
		height: 40vh;
	}

	.thread-name {
		/* font-family: 'Montserrat'; */
	}
	/* Create the pseudo-element for the light reflection */
	/* Hover trigger */

	/* Keyframes for the swipe animation */
	@keyframes swipe {
		0% {
			transform: translateX(-100%) translateY(-100%) rotate(45deg);
		}
		100% {
			transform: translateX(100%) translateY(100%) rotate(45deg);
		}
	}

	.progress-bar {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		border-radius: 50px;
		border-left: 20px solid rgb(0, 0, 0);
		border-bottom: 10px solid black;
		border-top: 4px solid black;
		border-right: 4px solid black;
		backdrop-filter: blur(15px);
		transition: all 0.3s ease;
		padding: 1rem;
	}

	.progress-bar:hover {
		backdrop-filter: blur(15px);
		transform: translateX(-30px);
	}

	// .stats-container {
	//   background-color:  var(--secondary-color);;
	// }

	.stats-container h2 {
		display: flex;
		justify-content: right;
		color: white;
	}
	.stat-item {
		display: flex;
		align-items: center;
		position: relative;
		padding: 1rem;
		margin-bottom: 8px;
		justify-content: space-between;
		color: #cccccc;
		font-size: 20px;
		overflow: hidden;
		transition: all 0.5s ease;
		border-radius: 0.5rem;

		background: linear-gradient(
			to right,
			rgba(0, 128, 0, 0.2) var(--progress),
			rgba(128, 128, 128, 0.1) var(--progress)
		);
	}

	.stat-item:hover {
		background: radial-gradient(
			circle at center,
			rgba(255, 255, 255, 0.2) 20%,
			rgba(247, 247, 247, 0.2) 96%
		);
	}

	.stat-item::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(
			to right,
			rgba(1, 149, 137, 0.5) var(--progress),
			transparent var(--progress)
		);

		z-index: -1;
	}

	.stat-item :global(svg) {
		margin-right: 8px;
	}

	.target-item {
		display: flex;
		align-items: center;
		margin-bottom: 8px;
		color: #cccccc;
		font-size: 20px;
	}

	.seed-prompt-input {
		display: flex;
		flex-direction: column;
		justify-content: center;
		/* align-items: center; */
		/* margin-top: 25%; */

		gap: 10px;
		/* height: auto; */
		/* align-content: center; */
		/* justify-content: center; */
		/* padding: 10px; */

		/* gap: 10px; */
		/* align-items: bottom; */
		/* width: 94%; */
		/* margin: 0 auto; */
	}

	@media (max-width: 940px) {
		.seed-prompt-input {
			flex-direction: column;
			/* width: 90%; */
		}

		.button-row {
			justify-content: center;
			/* align-items: center; */

			/* position: relative; */
			/* bottom: 3rem; */
			/* right: 1rem; */
			/* padding: 10px; */

			/* background-color: red; */
		}
	}

	/* flex-grow: 1;
      overflow-y: auto;
      padding: 10px;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      scrollbar-width: thin;
      scrollbar-color: #000000 transparent;
      margin-bottom: 10px;
      padding-top: 40px;
      padding-bottom: 40px;
 */

	@media (max-width: 600px) {
		.landing-footer {
			flex-direction: column;
			display: flex;
			flex-direction: column;
			width: 98%;
			margin-left: 1%;
		}
	}

	.text-container {
		display: flex;
		width: 100%;
	}

	textarea {
		display: flex;
		position: relative;
		width: 100%;
		padding: 2rem;
		top: 0;
		/* min-height: 60px; Set a minimum height */
		/* max-height: 1200px; Set a maximum height */
		text-justify: center;
		justify-content: center;
		align-items: center;
		resize: none;
		font-size: 2rem;
		letter-spacing: 1.4px;
		border: none;
		border-radius: 20px;
		margin: 1rem;
		/* background-color: #2e3838; */
		background-color: var(--secondary-color);
		color: var(--placeholder-color);
		line-height: 1.4;
		/* height: auto; */
		text-justify: center;
		box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
		overflow: scroll;
		scrollbar-width: none;
		scrollbar-color: #21201d transparent;
		vertical-align: middle; /* Align text vertically */
		transition: 0.6s cubic-bezier(0.075, 1.82, 0.165, 1);
		opacity: 0.8;
		box-shadow:
			8px 8px 16px rgba(0, 0, 0, 0.3),
			-8px -8px 16px rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
	}

	textarea:focus {
		outline: none;
		// border: 1px solid var(---color);
		color: var(--text-color);
		font-size: 3rem;
		padding: 3rem;
		line-height: 1.4;
		margin: 10px;
		flex-direction: column;
		background-color: var(--bg-color);
		height: 30vh;
		z-index: 3000;
		/* width: 100%; */
	}

	textarea::placeholder {
		font-size: 1.6rem;
	}
	.button-row {
		display: flex;
		flex-direction: row;
		justify-content: flex-end;
		align-items: center;

		/* position: relative; */
		/* bottom: 3rem; */
		/* right: 1rem; */
		gap: 20px;
		/* padding: 10px; */
		width: 92vw;
		/* background-color: red; */
	}

	h1 {
		padding: 20px;
		border-radius: 50px;
		justify-content: center;
		align-items: center;
		font-size: 70px;
		color: white;
		letter-spacing: 4px;
		font-style: italic;
	}

	button {
		width: 60px;
		height: 60px;
		/* padding: 12px; */
		justify-content: center;
		align-items: center;
		/* margin-bottom: 20px; */
		background-color: var(--bg-color);
		color: var(--secondary-color);
		font-size: 18px;
		border: none;
		/* border: 2px solid #506262; */
		border-radius: 80px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	button:hover {
		background: var(--tertiary-color);
		color: var(--bg-color);
	}

	p {
		margin: 0 0 20px 0;
		font-size: 24px;
		padding: 20px;
		font-style: italic;
		position: relative;
		backdrop-filter: blur(15px);
		transition: all 0.2s ease-in-out;
	}

	p::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border-radius: inherit;
		z-index: -1;
		filter: blur(30px);
		opacity: 0.6;
	}

	p:hover {
		box-shadow: 0 80px 16px rgba(0, 0, 0, 0.3);
	}

	.intro {
		display: flex;
		width: auto;
		align-items: center;
		justify-content: center;
		text-align: center;
		margin-top: 0;
	}

	.seed-container {
		display: flex;
		width: 100%;
		/* max-width: 900px; */
		flex-direction: column;
		align-items: right;
		justify-content: center;
		gap: 20px;
		/* border: 7px solid black; */
		align-items: bottom;
		/* background-color: red; */
	}

	.attachment-icon {
		position: relative;
		border: none;
		height: 30px;
		width: 30px;
		margin-right: 10px;
	}

	.attachment-icon::after {
		content: '\2715';
		position: absolute;
		top: -5px;
		right: -5px;
		background-color: red;
		color: white;
		border-radius: 50%;
		width: 15px;
		height: 15px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
	}

	.illustration {
		position: absolute;
		width: 90%;
		height: auto;
		left: 5%;
		top: 50%;
		(-50%);
		opacity: 0.025;
		z-index: 1;
		pointer-events: none;
	}

	.thread-list {
		display: flex;
		flex-direction: column;
		flex-wrap: nowrap;
		justify-content: flex-start;
		align-content: flex-start;
		max-height: calc(100vh - 100px);
		gap: 20px;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 10px;
		width: 360px;
		border-radius: 20px;
		scroll-behavior: smooth;
		transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		background: var(--bg-gradient-right);
		backdrop-filter: blur(10px);
		border-radius: 20px;
		padding: 16px;
		display: flex;

		/* Neomorphic shadow */
		box-shadow:
			8px 8px 16px rgba(0, 0, 0, 0.3),
			-8px -8px 16px rgba(255, 255, 255, 0.1);
	}

	.thread-group button {
		width: 100%;
	}

	.thread-group {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		background-color: transparent;
	}

	.thread-group h3 {
		display: flex;
		flex-direction: row;
		font-size: 24px;
		color: #818380;
		margin-bottom: 5px;
		position: relative;
		margin-bottom: 40px;
		justify-content: right;
	}

	.thread-list button {
		display: flex;
		/* width: 50%; */
		/* height: 60px; */
		padding: 20px;
		margin-top: -3px;
		margin-right: 2rem;
		text-align: left;
		border: 10px solid rgb(0, 0, 0);
		border-left: 40px solid rgb(24, 24, 24);
		border-bottom: 18px solid rgb(82, 82, 82);
		border-bottom-left-radius: 0px;
		/* border-left: 1px solid #4b4b4b; */
		/* border-top: 1px solid #4b4b4b; */
		/* background-color: red; */
		/* border-end-start-radius: 50px; */
		border-radius: 10px;
		/* border-top-left-radius: 50px; */
		cursor: pointer;
		// background-color: rgb(71, 59, 59);
		position: relative;
		color: #fff;
		transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		font-size: 20px;
		justify-content: space-between;
		align-items: center;
		border-bottom-right-radius: 19px;
		border-left: 40px solid rgb(169, 189, 209);
		border-top: 4px solid rgb(129, 160, 190);
		border-right: 1px solid black;
		border-bottom: 20px solid rgb(80, 80, 80);
		// background: radial-gradient(circle at center, rgba(255,255,255,0.2) 20%, rgba(247, 247, 247, 0.2) 96%);
		user-select: none;
	}

	.thread-list button:hover {
		background-color: var(--primary-color);
		transform: scale(1.1) translateX(30px) rotate(3deg);

		letter-spacing: 4px;
		width: calc(100% - 40px);
		z-index: 10;
		border-bottom-right-radius: 19px;
		border-left: 40px solid rgb(169, 189, 209);
		border-top: 4px solid rgb(129, 160, 190);
		border-right: 1px solid black;
		border-bottom: 20px solid rgb(80, 80, 80);
	}

	.thread-list button.selected {
		/* background-color: #2980b9; */
		font-weight: 200;
	}

	.landing-footer {
		display: flex;
		position: relative;
		width: 98%;
		margin-left: 1%;
	}

	.thread-list .add-button {
		/* background-color: rgb(62, 75, 92); */
		width: 100%;
		font-style: italic;
		font-weight: bolder;
		border-radius: 30px;
		transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		justify-content: center;
		color: var(--tertiary-color);

		/* margin-bottom: 2rem; */
	}

	.thread-list .add-button:hover {
		background-color: #2c3e50;
		transform: scale(0.9) translateY(20px) rotate(5deg);
		width: 100%;

		background: radial-gradient(
			circle at center,
			rgba(255, 255, 255, 0.2) 0%,
			rgba(44, 193, 216, 0.2) 50%
		);
		justify-content: center;
		/* margin-bottom: 2rem; */
	}

	.confirmation {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background-color: rgba(255, 255, 255, 0.9);
		border-radius: 10px;
		padding: 20px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		z-index: 1000;
	}

	.confirmation p {
		margin: 10px 0 0 0;
		font-size: 16px;
		color: #333;
	}

	.confirmation p {
		font-size: 18px;
		margin-bottom: 30px;
	}

	.confirmation button {
		width: auto;
		height: auto;
		padding: 10px 20px;
		font-size: 16px;
		background-color: #2c3e50;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	.confirmation button:hover {
		background-color: #34495e;
	}

	.spinner {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 80px;
		height: 80px;
		border: 4px dashed #363f3f;
		border-radius: 50%;
		position: relative;
		animation: nonlinearSpin 4.2s infinite;
		animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
	}

	.bot-icon {
		width: 100%;
		height: 100%;
		color: #363f3f;
	}

	@keyframes nonlinearSpin {
		0% {
			transform: rotate(0deg);
		}
		25% {
			transform: rotate(1080deg);
		}
		50% {
			transform: rotate(0deg);
		}
		75% {
			transform: rotate(1080deg);
		}
		100% {
			transform: rotate(2160deg);
		}
	}

	.arrow-overlay {
		position: absolute;
		top: -200px;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		pointer-events: none;
		z-index: 1001;
	}

	.arrow {
		width: 0;
		height: 0;
		border-left: 50px solid transparent;
		border-right: 50px solid transparent;
		border-top: 70px solid #6fdfc4;
		margin-top: 40px;
		top: 80px;
		position: absolute;
		display: flex;

		left: 100px;
		animation: bounce 1s infinite;
		filter: drop-shadow(0 0 10px rgba(111, 223, 196, 0.7));
	}

	.message-count {
		width: auto;
		display: flex;
		flex-direction: row;
		height: 20px;
		justify-content: space-between;
		align-items: center;
	}

	.thread-list button:hover .message-count {
		font-size: 16px;
	}
	@keyframes bounce {
		0%,
		100% {
			(0);
		}
		50% {
			(-30px);
		}
	}
</style>

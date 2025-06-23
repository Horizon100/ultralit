<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade, slide } from 'svelte/transition';
	import { Bot, MessagesSquare, RefreshCcw, Send, ChevronDown, ChevronUp } from 'lucide-svelte';
	import Reactions from '$lib/features/ai/components/chat/Reactions.svelte';
	import type { InternalChatMessage, RoleType } from '$lib/types/types';
	import { createEventDispatcher } from 'svelte';
	import { showThreadList, threadsStore } from '$lib/stores/threadsStore';
	import { threadListVisibility } from '$lib/clients/threadsClient';
	import { prepareReplyContext } from '$lib/features/ai/utils/handleReplyMessage';
	import { currentUser, getUserById, getPublicUsersBatch } from '$lib/pocketbase';
	import { saveTask, getPromptFromThread } from '$lib/clients/taskClient';
	import type { KanbanTask } from '$lib/types/types';
	import { fetchAIResponse, generateTaskFromMessage } from '$lib/clients/aiClient';
	import { addNotification, updateNotification } from '$lib/stores/taskNotificationStore';
	import { projectStore } from '$lib/stores/projectStore';
	import { t } from '$lib/stores/translationStore';
	import { getProviderFromModel, getProviderIcon } from '$lib/features/ai/utils/providers';
	import {
		getPromptLabel,
		getPromptDescription,
		getPromptLabelFromContent
	} from '$lib/features/ai/utils/prompts';
	import { isFailure, clientTryCatch } from '$lib/utils/errorUtils';
	export let message: InternalChatMessage;
	export let allMessages: InternalChatMessage[] = [];
	export let userId: string;
	export let name: string;
	export let depth: number = 0;
	// export let getUserProfile;
	export let getAvatarUrl: (user: any) => string;
	export let processMessageContentWithReplyable;
	export let latestMessageId: string | null;
	export let toggleReplies: (messageId: string) => void;
	export let hiddenReplies: Set<string>;
	export let aiModel: any;
	export let promptType: string | null = null;
	export let sendMessage: (
		text: string,
		parent_msg?: string,
		contextMessages?: any[]
	) => Promise<void> = async () => {};
	export let isDualResponse = false;
	export let dualResponsePair = false;
	export let isPrimaryDualResponse = false;
	export let onSelectResponse: ((messageId: string) => void) | null = null;
	export let onScrollToMessage: ((direction: 'next' | 'prev') => void) | null = null;
	export let currentMessageIndex = 0;
	export let totalMessages = 0;
	export let onGetVisibleMessages: (() => Element[]) | null = null;
	export let onGetCurrentIndex: (() => number) | null = null;

	let currentProjectId: string | null;
	let isUserScrolling = false;
	let lastScrollTop = 0;
	let userScrollY = 0;
	let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
	let showScrollButtons = false;
	let processedContent = '';
	let isProcessingContent = true;
	let showReplyInput = false;
	let replyText = '';
	let isSubmitting = false;
	let showTaskTooltip = false;
	let taskTooltipText = '';
	let wheelDelta = 0;
	let wheelTimeout: ReturnType<typeof setTimeout> | null = null;
	let createHovered = false;
	let providerHovered = false;

	const dispatch = createEventDispatcher();
	const WHEEL_THRESHOLD = 100;
	const MAX_DEPTH = 5;

	$: currentProjectId = $projectStore.currentProjectId;
	$: isClickable = $showThreadList && childReplies.length > 0;
	$: childReplies = allMessages.filter((msg) => msg.parent_msg === message.id);
	$: repliesHidden = hiddenReplies.has(message.id) || $showThreadList;
	$: provider = getProviderFromModel(message.model || '');
	$: providerIconSrc = getProviderIcon(provider);
	$: promptLabel = getPromptLabelFromContent(message.prompt_type);
	$: promptDescription = getPromptDescription(message.prompt_type);

	function handleToggleReplies(messageId: string) {
		if (hiddenReplies.has(messageId)) {
			hiddenReplies.delete(messageId);
		} else {
			hiddenReplies.add(messageId);
		}
		hiddenReplies = new Set(hiddenReplies);
	}

	function getRandomThinkingPhrase(): string {
		const thinkingPhrases = $t('extras.thinking') as string[];

		if (!Array.isArray(thinkingPhrases) || !thinkingPhrases.length) {
			return 'Thinking...';
		}

		return thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
	}
	// Add this helper function
	function findScrollableParent(element: Element | null): HTMLElement | null {
		if (!element) return null;

		let parent = element.parentElement;
		while (parent) {
			// Check if this parent is scrollable
			const style = window.getComputedStyle(parent);
			const overflowY = style.getPropertyValue('overflow-y');

			if (['auto', 'scroll'].includes(overflowY) && parent.scrollHeight > parent.clientHeight) {
				return parent;
			}

			parent = parent.parentElement;
		}

		return document.documentElement;
	}

	function handleReply() {
		showReplyInput = !showReplyInput;

		if (showReplyInput) {
			setTimeout(() => {
				const textarea = document.getElementById(`reply-textarea-${message.id}`);
				if (textarea) textarea.focus();
			}, 10);
		}
	}

	async function submitReply() {
		if (!replyText.trim() || isSubmitting) return;

		const result = await clientTryCatch((async () => {
			isSubmitting = true;

			const { messagesToSend, contextMessage } = prepareReplyContext(
				replyText,
				message.id,
				allMessages,
				aiModel,
				promptType
			);

			await sendMessage(replyText, message.id, messagesToSend);

			// Clear the input and hide it
			replyText = '';
			showReplyInput = false;

			// Make sure any nested replies container is visible after sending
			if (hiddenReplies.has(message.id)) {
				hiddenReplies.delete(message.id);
				hiddenReplies = new Set(hiddenReplies);
			}

			return true; // Success indicator
		})(), `Submitting reply to message ${message.id}`);

		if (isFailure(result)) {
			console.error('Error sending reply:', result.error);
			dispatch('notification', {
				message: 'Failed to send reply. Please try again.',
				type: 'error'
			});
		}

		// Always reset submitting state
		isSubmitting = false;
	}

	function cancelReply() {
		replyText = '';
		showReplyInput = false;
	}

	//

	async function generateTask(taskDetails: {
		messageId: string;
		content: string;
		model: string;
		promptType: string;
		threadId?: string;
	}) {
		console.log('generateTask called with details:', taskDetails);
		try {
			const notificationId = addNotification('Generating parent task...', 'loading');
			const modelObject =
				typeof aiModel === 'string'
					? { api_type: aiModel, provider: 'anthropic', name: aiModel }
					: aiModel;

			const { title, description } = await generateTaskFromMessage({
				content: taskDetails.content,
				messageId: taskDetails.messageId,
				model: modelObject,
				userId: userId,
				threadId: taskDetails.threadId || message.thread,
				isParentTask: true
			});
			updateNotification(notificationId, {
				message: 'Creating task...'
			});
			const cleanTitle = title
				.replace(/^\*\*Title:\*\*\s*/i, '')
				.replace(/^Title:\s*/i, '')
				.replace(/\*\*/g, '')
				.replace(/^#+\s*/, '')
				.trim();

			console.log('Generated parent task title:', cleanTitle);
			console.log('Generated parent task description:', description);

			const threadId = taskDetails.threadId || message.thread || '';

			const newParentTask: KanbanTask = {
				id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
				title: cleanTitle,
				taskDescription: description,
				creationDate: new Date(),
				start_date: null,
				due_date: null,
				tags: [],
				attachments: [],
				project_id: currentProjectId || '',
				createdBy: $currentUser?.id || '',
				parent_task: undefined,
				allocatedAgents: [],
				status: 'backlog' as const,
				priority: 'medium' as const,
				prompt: getPromptFromThread(threadId, allMessages),
				context: '',
				task_outcome: '',
				dependencies: [],
				agentMessages: [taskDetails.messageId]
			};

			const projectId = currentProjectId || '';
			console.log('Saving parent task with projectId:', projectId);
			const savedParentTask = await saveTask(newParentTask);
			console.log('Parent task saved successfully:', savedParentTask);

			const parentId = savedParentTask.id;
			console.log('Using parent task ID for child tasks:', parentId);
			updateNotification(notificationId, {
				message: 'Generating subtasks...'
			});
			const childTasks = await generateChildTasks({
				content: taskDetails.content,
				messageId: taskDetails.messageId,
				model: modelObject,
				userId: userId,
				parentTaskId: parentId,
				projectId: currentProjectId || ''
			});

			console.log(`Generated and saved ${childTasks.length} child tasks`);
			updateNotification(notificationId, {
				message: `Task "${cleanTitle}" created with ${childTasks.length} subtasks`,
				type: 'success',
				link: {
					url: '/lean',
					text: 'Open Tasks'
				}
			});
			dispatch('notification', {
				message: `Task created with ${childTasks.length} subtasks`,
				type: 'success'
			});

			/*
			 * taskTooltipText = `Task created with ${childTasks.length} subtasks`;
			 * showTaskTooltip = true;
			 * setTimeout(() => {
			 *   showTaskTooltip = false;
			 * }, 2000);
			 */

			return {
				parentTask: savedParentTask,
				childTasks: childTasks
			};
		} catch (error: unknown) {
			console.error('Error generating task:', error);
			console.log('Error details:', {
				name: (error as any)?.name,
				message: (error as any)?.message,
				stack: (error as any)?.stack,
				fullError: error
			});
			addNotification(
				'Failed to create task: ' + (error instanceof Error ? error.message : 'Unknown error'),
				'error'
			);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			dispatch('notification', {
				message: 'Failed to create task: ' + errorMessage,
				type: 'error'
			});

			// Show error tooltip
			taskTooltipText = 'Failed to create task';
			showTaskTooltip = true;
			setTimeout(() => {
				showTaskTooltip = false;
			}, 2000);
		}
	}

	async function generateChildTasks({
		content,
		messageId,
		model,
		userId,
		parentTaskId,
		projectId
	}: {
		content: string;
		messageId: string;
		model: any;
		userId: string;
		parentTaskId: string;
		projectId: string;
	}) {
		console.log('generateChildTasks called with parentTaskId:', parentTaskId);
		const subtasksNotificationId = addNotification('Analyzing message for subtasks...', 'loading');

		try {
			const systemPrompt = {
				role: 'system' as RoleType,
				content: `Extract 4-8 specific subtasks from the content below. Each subtask should be:
      - A clear, actionable item
      - Independent enough to track separately
      - Specific to one part of the overall task
      - Written in imperative form (e.g., "Design user interface" not "Designing user interface")
      - 3-8 words in length
      Format your response as a JSON array of strings containing ONLY the subtask titles. 
      Example: ["Create project plan", "Design user interface", "Implement backend API", "Test functionality"]`,
				provider: model.provider,
				model: model.api_type
			};

			const userPrompt = {
				role: 'user' as RoleType,
				content: `Generate subtasks based on this content: ${content}`,
				provider: model.provider,
				model: model.api_type
			};
			updateNotification(subtasksNotificationId, {
				message: 'Generating subtask titles...'
			});
			const subtasksResponse = await fetchAIResponse([systemPrompt, userPrompt], model, userId);

			let subtaskTitles = [];
			try {
				subtaskTitles = JSON.parse(subtasksResponse);
			} catch (e) {
				const jsonMatch = subtasksResponse.match(/\[.*\]/s);
				if (jsonMatch) {
					try {
						subtaskTitles = JSON.parse(jsonMatch[0]);
					} catch (e2) {
						console.error('Failed to parse subtasks JSON:', e2);
						subtaskTitles = subtasksResponse
							.split('\n')
							.map((line) => line.trim())
							.filter(
								(line) =>
									line.length > 0 &&
									!line.includes('"role":') &&
									!line.includes('{') &&
									!line.includes('}')
							)
							.map((line) => line.replace(/^["'\d\-[\]\s•]+|\s*["',]+$/g, '').trim())
							.filter((line) => line.length > 0);
					}
				} else {
					subtaskTitles = subtasksResponse
						.split('\n')
						.map((line) => line.trim())
						.filter((line) => line.length > 0);
				}
			}

			if (!Array.isArray(subtaskTitles) || subtaskTitles.length === 0) {
				console.error('Failed to generate valid subtasks array:', subtasksResponse);
				updateNotification(subtasksNotificationId, {
					message: 'Failed to generate subtasks',
					type: 'error'
				});
				return [];
			}

			console.log('Generated subtask titles:', subtaskTitles);
			console.log('Creating child tasks with parent_task ID:', parentTaskId);
			updateNotification(subtasksNotificationId, {
				message: `Saving ${subtaskTitles.length} subtasks...`
			});
			const savedChildTasks = [];

			for (const title of subtaskTitles) {
				const cleanTitle = title
					.replace(/^\d+\.\s*/, '')
					.replace(/^\*+\s*/, '')
					.replace(/^-\s*/, '')
					.trim();

				const childTask: KanbanTask = {
					id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
					title: cleanTitle,
					taskDescription: '',
					creationDate: new Date(),
					start_date: null,
					due_date: null,
					tags: [],
					attachments: [],
					project_id: projectId,
					createdBy: $currentUser?.id || '',
					parent_task: parentTaskId,
					allocatedAgents: [],
					status: 'backlog' as const,
					priority: 'medium' as const,
					prompt: '',
					context: '',
					task_outcome: '',
					dependencies: [],
					agentMessages: []
				};

				console.log('Saving child task with parent_task:', childTask.parent_task);

				try {
					const savedChildTask = await saveTask(childTask);
					console.log('Child task saved with ID:', savedChildTask.id);
					console.log('Child task parent_task field:', savedChildTask.parent_task);
					savedChildTasks.push(savedChildTask);
				} catch (err) {
					console.error('Error saving child task:', err);
					console.error('Failed task object:', childTask);
				}
			}
			updateNotification(subtasksNotificationId, {
				message: `Created ${savedChildTasks.length} subtasks`,
				type: 'success'
			});
			return savedChildTasks;
		} catch (error) {
			console.error('Error generating child tasks:', error);
			updateNotification(subtasksNotificationId, {
				message:
					'Failed to generate subtasks: ' +
					(error instanceof Error ? error.message : 'Unknown error'),
				type: 'error'
			});
			return [];
		}
	}

	async function handleSelectResponse(event: CustomEvent) {
		const { messageId, content, systemPrompt } = event.detail;
		console.log('Handling response selection:', event.detail);

		try {
			const userMessage = isDualResponse
				? allMessages.find(
						(msg) =>
							msg.role === 'user' &&
							(msg.id === message.parent_msg || msg.thread === message.thread)
					)
				: null;

			const userMessageContent = userMessage ? userMessage.content : 'User message';

			// Use the existing sendMessage function which already knows how to properly save messages
			await sendMessage(userMessageContent, undefined, [
				{
					role: 'system',
					content: systemPrompt || '',
					model: typeof aiModel === 'string' ? aiModel : aiModel.api_type
				},
				{
					role: 'user',
					content: userMessageContent,
					model: typeof aiModel === 'string' ? aiModel : aiModel.api_type
				}
			]);

			// Show success notification
			dispatch('notification', {
				message: 'Response selected and saved',
				type: 'success'
			});

			// Notify the parent that a selection was made so it can clean up dual response state
			dispatch('dualResponseProcessed', {
				selectedMessageId: messageId
			});
		} catch (error) {
			console.error('Error handling response selection:', error);
			dispatch('notification', {
				message:
					'Failed to save selected response: ' +
					(error instanceof Error ? error.message : 'Unknown error'),
				type: 'error'
			});
		}
	}
	function cleanHtmlContent(htmlContent: string): string {
		let cleaned = htmlContent.replace(/<\/?[^>]+(>|$)/g, '');
		cleaned = cleaned.replace(/\s+/g, ' ');
		cleaned = cleaned.trim();
		return cleaned;
	}
	function handleMessageClick(event: MouseEvent) {
		if (
			event.target instanceof HTMLElement &&
			(event.target.tagName === 'BUTTON' ||
				event.target.closest('button') ||
				event.target.tagName === 'A' ||
				event.target.tagName === 'INPUT' ||
				event.target.tagName === 'TEXTAREA' ||
				event.target.closest('.message-footer') ||
				event.target.closest('.reply-input-container'))
		) {
			return;
		}

		if ($showThreadList) {
			threadListVisibility.set(false);

			const messageElement = event.currentTarget as HTMLElement;
			const messageId = messageElement.dataset.messageId;

			setTimeout(() => {
				const targetMessage = document.querySelector(`[data-message-id="${messageId}"]`);

				if (targetMessage) {
					targetMessage.scrollIntoView({
						behavior: 'smooth',
						block: 'start'
					});

					targetMessage.classList.add('scroll-highlight');
					setTimeout(() => {
						targetMessage.classList.remove('scroll-highlight');
					}, 1500);
				}
			}, 100);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			submitReply();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelReply();
		}
	}
	function getVisibleMessages() {
		const scrollContainer = findScrollableParent(
			document.querySelector(`[data-message-id="${message.id}"]`)
		);
		if (!scrollContainer) return [];

		// Get only depth-0 messages (top-level messages)
		const messageElements = Array.from(
			scrollContainer.querySelectorAll('[data-message-id]')
		).filter((el) => {
			const rect = el.getBoundingClientRect();
			// Check if element has depth-0 class and is visible
			return rect.height > 0 && el.classList.contains('depth-0');
		});

		return messageElements;
	}
	// Function to find current message index
	function findCurrentMessageIndex() {
		const visibleMessages = getVisibleMessages();
		const scrollContainer = findScrollableParent(
			document.querySelector(`[data-message-id="${message.id}"]`)
		);

		if (!scrollContainer || visibleMessages.length === 0) return 0;

		const containerRect = scrollContainer.getBoundingClientRect();
		const containerCenter = containerRect.top + containerRect.height / 2;

		let closestIndex = 0;
		let closestDistance = Infinity;

		visibleMessages.forEach((msgEl, index) => {
			const rect = msgEl.getBoundingClientRect();
			const messageCenter = rect.top + rect.height / 2;
			const distance = Math.abs(messageCenter - containerCenter);

			if (distance < closestDistance) {
				closestDistance = distance;
				closestIndex = index;
			}
		});

		return closestIndex;
	}

	// Function to scroll to specific message
	function scrollToMessage(direction: 'next' | 'prev') {
		const visibleMessages = getVisibleMessages();

		if (visibleMessages.length === 0) return;

		const newIndex =
			direction === 'next'
				? Math.min(currentMessageIndex + 1, visibleMessages.length - 1)
				: Math.max(currentMessageIndex - 1, 0);

		const targetMessage = visibleMessages[newIndex];

		if (targetMessage) {
			targetMessage.scrollIntoView({
				behavior: 'smooth',
				block: 'start'
			});

			currentMessageIndex = newIndex;

			// Add highlight effect
			targetMessage.classList.add('scroll-highlight');
			setTimeout(() => {
				targetMessage.classList.remove('scroll-highlight');
			}, 1500);
		}
	}
	function setupScrollHandler() {
		const scrollContainer = findScrollableParent(
			document.querySelector(`[data-message-id="${message.id}"]`)
		);

		if (scrollContainer) {
			const handleScroll = () => {
				const { scrollTop } = scrollContainer;

				// Update current message index
				currentMessageIndex = findCurrentMessageIndex();

				// Show buttons only when message is not clickable
				showScrollButtons = !isClickable;

				// Track user scrolling state
				if (scrollTop > lastScrollTop) {
					isUserScrolling = true;
				} else if (scrollTop < lastScrollTop) {
					isUserScrolling = true;
				}

				lastScrollTop = scrollTop;

				// Clear scrolling state after a delay
				if (scrollTimeout) clearTimeout(scrollTimeout);
				scrollTimeout = setTimeout(() => {
					isUserScrolling = false;
				}, 150);
			};

			// Handle wheel events for depth-0 messages
			const handleWheel = (event: WheelEvent) => {
				// Only work with Shift key pressed
				if (!event.shiftKey || depth !== 0 || isClickable) return;

				event.preventDefault();

				// Accumulate wheel delta
				wheelDelta += event.deltaY;

				// Clear previous timeout
				if (wheelTimeout) clearTimeout(wheelTimeout);

				// Check if threshold is reached
				if (Math.abs(wheelDelta) >= WHEEL_THRESHOLD) {
					if (wheelDelta > 0) {
						// Scroll down - next message
						scrollToMessage('next');
					} else {
						// Scroll up - previous message
						scrollToMessage('prev');
					}
					wheelDelta = 0; // Reset delta
				}

				// Reset delta after timeout if no further scrolling
				wheelTimeout = setTimeout(() => {
					wheelDelta = 0;
				}, 100);
			};

			// Initial check
			handleScroll();

			// Add event listeners
			scrollContainer.addEventListener('scroll', handleScroll);

			// Add wheel listener only for depth-0 messages
			if (depth === 0) {
				document.addEventListener('wheel', handleWheel, { passive: false });
			}

			// Clean up on destroy
			return () => {
				scrollContainer.removeEventListener('scroll', handleScroll);
				if (depth === 0) {
					document.removeEventListener('wheel', handleWheel);
				}
			};
		}
	}

	$: if (depth === 0) {
		onScrollToMessage = scrollToMessage;
		onGetVisibleMessages = getVisibleMessages;
		onGetCurrentIndex = () => currentMessageIndex;
	}

	function isPromise<T>(value: any): value is Promise<T> {
		return value && typeof value === 'object' && typeof value.then === 'function';
	}

	$: if (message?.content) {
		console.log(
			'Processing message:',
			message.id,
			'Content:',
			message.content,
			'Type:',
			typeof message.content
		);
		isProcessingContent = true;

		if (isPromise(message.content)) {
			message.content
				.then((resolvedContent: unknown) => {
					console.log('Promise resolved to:', resolvedContent);

					const contentString = String(resolvedContent || '');

					if (processMessageContentWithReplyable) {
						return processMessageContentWithReplyable(contentString, message.id);
					} else {
						return contentString;
					}
				})
				.then((content: string) => {
					console.log('Final processed content:', content);
					processedContent = content;
					isProcessingContent = false;
				})
				.catch((error: any) => {
					console.error('Error processing message content:', error);
					processedContent = 'Error loading message content';
					isProcessingContent = false;
				});
		} else {
			const contentToProcess = String(message.content || '');

			if (processMessageContentWithReplyable) {
				processMessageContentWithReplyable(contentToProcess, message.id)
					.then((content: string) => {
						processedContent = content;
						isProcessingContent = false;
					})
					.catch((error: any) => {
						console.error('Error processing message content:', error);
						processedContent = contentToProcess;
						isProcessingContent = false;
					});
			} else {
				processedContent = contentToProcess;
				isProcessingContent = false;
			}
		}
	}

	// Keep the function export reactive statement:
	$: if (depth === 0) {
		onScrollToMessage = scrollToMessage;
		onGetVisibleMessages = getVisibleMessages;
		onGetCurrentIndex = () => currentMessageIndex;
	}
	// Also add this debug logging to see what's in the message content:
	$: {
		console.log('Message object:', message);
		console.log('Message content:', message?.content);
		console.log('Content type:', typeof message?.content);
	}
	/*
	 *     onMount(() => {
	 *   return setupScrollHandler();
	 * });
	 */

	onMount(() => {
		// Only set up scroll handler for depth-0 messages
		if (depth === 0) {
			// Wait a bit for the DOM to be ready
			const timeoutId = setTimeout(() => {
				const cleanup = setupScrollHandler();

				// Store cleanup function to call on destroy
				return cleanup;
			}, 100);

			// Return cleanup function
			return () => {
				clearTimeout(timeoutId);
			};
		}
	});
</script>

<div
	class="message {message.role} depth-{depth}"
	class:latest-message={message.id === latestMessageId}
	class:highlighted={message.isHighlighted}
	class:clickable={$showThreadList && childReplies.length > 0}
	class:dual-response={isDualResponse}
	class:dual-response-alt={isDualResponse && dualResponsePair}
	data-message-id={message.id}
	data-thread-id={message.thread || ''}
	in:fly={{ y: 20, duration: 300 }}
	out:fade={{ duration: 200 }}
	on:click={handleMessageClick}
>
	<div class="message-header">
		{#if message.role === 'user'}
			<div class="user-header">
				<div class="avatar-container">
					{#if message.user}
						{#await getUserById(message.user) then userProfile}
							{#if userProfile && getAvatarUrl(userProfile)}
								<img src={getAvatarUrl(userProfile)} alt="User avatar" class="user-avatar" />
							{:else}
								<div class="default-avatar">
									{(userProfile?.name ||
										userProfile?.username ||
										userProfile?.email ||
										'?')[0]?.toUpperCase()}
								</div>
							{/if}
						{/await}
					{:else}
						<!-- Fallback to currentUser if no message.user -->
						{#if getAvatarUrl($currentUser)}
							<img src={getAvatarUrl($currentUser)} alt="User avatar" class="user-avatar" />
						{:else}
							<div class="default-avatar">
								{($currentUser?.name ||
									$currentUser?.username ||
									$currentUser?.email ||
									'?')[0]?.toUpperCase()}
							</div>
						{/if}
					{/if}
				</div>
				<span class="role">
					{#if message.type === 'human' && message.user}
						{#await getUserById(message.user) then userProfile}
							{userProfile ? userProfile.name : name}
						{/await}
					{:else}
						{name}
					{/if}
				</span>
			</div>
		{:else if message.role === 'assistant'}
			<div class="user-header ai">
				<div
					class="avatar-container"
					on:mouseenter={() => (providerHovered = true)}
					on:mouseleave={() => (providerHovered = false)}
				>
					<img src={providerIconSrc} alt="{provider} icon" class="provider-icon" />
				</div>
				{#if providerHovered}
					<span class="tooltip tooltip-delayed" in:fade>
						{provider}
					</span>
				{/if}
				<span class="model">{message.model} </span>
			</div>
			<span
				class="prompt-type"
				on:mouseenter={() => (createHovered = true)}
				on:mouseleave={() => (createHovered = false)}
			>
				{promptLabel}
				{#if createHovered}
					<span class="tooltip tooltip-delayed" in:fade>
						{message.prompt_type}
					</span>
				{/if}
			</span>
		{/if}
		<!-- <div class="navigation-buttons">
			{#if depth === 0 && showScrollButtons && !isClickable}
				<button
					class="nav-btn scroll-prev-btn"
					on:click={() => scrollToMessage('prev')}
					disabled={currentMessageIndex === 0}
				>
					<ChevronUp />
				</button>
				<span class="message-indicator">
					{currentMessageIndex + 1} / {getVisibleMessages().length}
				</span>
				<button
					class="nav-btn scroll-next-btn"
					on:click={() => scrollToMessage('next')}
					disabled={currentMessageIndex >= getVisibleMessages().length - 1}
				>
					<ChevronDown />
				</button>
			{/if}
		</div> -->
	</div>

	<p class:typing={message.isTyping}>
		{#if isProcessingContent}
			<!-- <span class="processing">Processing...</span> -->
		{:else}
			{@html processedContent}
		{/if}
	</p>

	{#if showReplyInput}
		<div class="reply-input-container" transition:slide={{ duration: 200 }}>
			<textarea
				id="reply-textarea-{message.id}"
				bind:value={replyText}
				placeholder="Type your reply..."
				on:keydown={handleKeydown}
				disabled={isSubmitting}
				rows="2"
			></textarea>
			<div class="reply-actions">
				<button class="cancel-btn" on:click={cancelReply} title="Cancel" disabled={isSubmitting}>
					<span class="x-icon">×</span>
				</button>
				<button
					class="send-btn"
					on:click={submitReply}
					disabled={!replyText.trim() || isSubmitting}
					title="Send reply (Ctrl+Enter)"
				>
					{#if isSubmitting}
						<RefreshCcw size={16} class="loading-icon" />
					{:else}
						<Send size={16} />
					{/if}
				</button>
			</div>
		</div>
	{/if}

	{#if childReplies.length > 0}
		<div class="replies-section" in:fly={{ y: -200, duration: 300 }} out:fade={{ duration: 200 }}>
			<button
				class="toggle-replies-btn {repliesHidden ? '' : 'selected'}"
				on:click|stopPropagation={() => handleToggleReplies(message.id)}
			>
				<span class="replies-indicator">
					<!-- <MessagesSquare size={16} /> -->
					{childReplies.length}
					<span class="toggle-icon">
						{#if repliesHidden}
							<ChevronDown size={12} />
						{:else}
							<ChevronUp size={12} />
						{/if}
					</span>
				</span>
			</button>

			{#if !repliesHidden}
				<div
					class="replies-container replies-to-{message.id}"
					in:fly={{ y: -200, duration: 300 }}
					out:fly={{ y: -200, duration: 200 }}
				>
					{#each childReplies as reply (reply.id)}
						{#if depth < MAX_DEPTH}
							<svelte:self
								message={reply}
								{allMessages}
								{userId}
								{currentUser}
								{name}
								depth={depth + 1}
								{getUserById}
								{getAvatarUrl}
								{processMessageContentWithReplyable}
								{latestMessageId}
								toggleReplies={handleToggleReplies}
								{hiddenReplies}
								{sendMessage}
								{aiModel}
								{promptType}
							/>
						{:else}
							<div
								class="deep-nested-reply"
								in:fly={{ y: -200, duration: 300 }}
								out:fade={{ duration: 200 }}
							>
								<p>
									{reply.role}:
									{#if isPromise(reply.content)}
										{#await reply.content}
											Loading...
										{:then resolvedContent}
											{@html resolvedContent.substring(0, 100)}...
										{:catch error}
											Error loading content
										{/await}
									{:else}
										{@html String(reply.content).substring(0, 100)}...
									{/if}
								</p>
								<a href="#{reply.id}" class="view-full-link">View full message</a>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if message.role === 'thinking'}
		<div class="loading">
			<div class="loader"></div>
			<span>
				{getRandomThinkingPhrase()}
			</span>
		</div>
	{/if}

	{#if message.role === 'assistant'}
		<div class="message-footer">
			<Reactions
				{message}
				{userId}
				{isDualResponse}
				{isPrimaryDualResponse}
				on:update
				on:notification
				on:reply={() => handleReply()}
				on:createTask={(event) => {
					console.log('createTask event received:', event.detail);
					generateTask(event.detail);
				}}
				on:selectResponse={(event) => {
					console.log('selectResponse event received:', event.detail);
					handleSelectResponse(event);
				}}
			/>
		</div>
	{/if}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	:global(.navigation-buttons .nav-container) {
		position: fixed !important;
		bottom: 0 !important;
		right: 4rem !important;
		z-index: 9999 !important;
		overflow: visible !important;
		display: flex;
		flex-direction: row;
		align-items: center;
		background: var(--bg-color);
		border-radius: 1rem;
		padding: 0.5rem;
	}
	.navigation-buttons {
		display: flex;
		justify-content: center;
		flex-direction: row;
		align-items: center;
		position: relative;
		right: 1rem;
		width: 12rem;
	}

	span.message-indicator {
		width: 6rem;
		display: flex;
		justify-content: center;
		background: transparent !important;
		z-index: 2;
	}
	.tooltip {
		position: absolute;
		margin-top: 1rem;
		margin-left: 0;
		left: 12rem;
		font-size: 0.7rem;
		white-space: nowrap;
		background-color: var(--secondary-color);
		backdrop-filter: blur(80px);
		border: 1px solid var(--secondary-color);
		font-weight: 100;
		animation: glowy 0.5s 0.5s initial;
		padding: 4px 8px;
		border-radius: var(--radius-s);
		z-index: 2000;
		transition: all 0.2s ease;
	}
	.nav-btn {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		background-color: var(--bg-color);
		color: var(--placeholder-color);
		border: 1px solid transparent;
		// box-shadow: 0 2px 10px 2px rgba(0, 0, 0, 0.01);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
		&:hover {
			color: var(--text-color);
		}
	}

	.message.clickable {
		cursor: pointer;
		transition: all 0.3s ease;

		padding-left: 1rem !important;
		width: calc(100% - 1rem) !important;
		height: auto;
		background: linear-gradient(to bottom, transparent, var(--bg-color));

		overflow-y: hidden;
		overflow-y: hidden !important;
	}

	.message.clickable:hover {
		background: var(--primary-color);
		// transform: translateX(10px);
	}

	// .message.clickable::before {
	// 	content: '';
	// 	position: absolute;
	// 	top: -150%;
	// 	left: -150%;
	// 	width: 300%;
	// 	max-height: 50vh;
	// 	height: 300%;
	// 	background: linear-gradient(
	// 		45deg,
	// 		rgba(255, 255, 255, 0.2),
	// 		rgba(255, 255, 255, 0.2),
	// 		rgba(255, 255, 255, 0.2)
	// 	);
	// 	transform: translateX(-100%) rotate(45deg);
	// 	opacity: 0;
	// 	transition: opacity 0.3s ease;
	// 	pointer-events: none;

	// }

	// .message.clickable:hover::before {
	// 	animation: swipe 0.5s cubic-bezier(0.42, 0, 0.58, 1);
	// 	opacity: 1;
	// }
	.message.depth-0 {
		// box-shadow: 10px -20px 50px -15px var(--primary-color, 0.01);
		// backdrop-filter: blur(12px);
		display: flex;
		align-items: stretch;
		padding-left: 1rem !important;
		padding-bottom: 1rem !important;
		flex-grow: 1;
		padding: 0;
		border-radius: 1rem;
		font-size: 1.25rem;
		font-weight: 900 !important;
		.avatar-container {
			position: relative;
			left: 0rem;
			& img {
				width: 2rem;
			}
		}
	}

	.message.depth-1 {
		margin-left: 1.5rem;
		max-width: calc(100% - 1.5rem);
		// box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
		font-size: 0.9rem;

		p {
			padding-inline-start: 1rem;
		}
		.avatar-container {
			position: relative;
			left: 0.5rem;
			width: 2rem;
			padding: 0;
			height: 2rem;
		}
	}

	.message.depth-2 {
		margin-left: 1.5rem;
		max-width: calc(100% - 3rem);
		// box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
		border-radius: 1rem;
	}

	.message.depth-3,
	.message.depth-4,
	.message.depth-5 {
		margin-left: 1.5rem;
		max-width: calc(100% - 4rem);
		// box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
		border-radius: 1rem;
	}

	.deep-nested-reply {
		padding: 0.5rem;
		border: 1px dashed #ccc;
		border-radius: 0.5rem;
		margin: 0.5rem 0;
		font-size: 0.9rem;
	}

	.view-full-link {
		color: var(--link-color, #0077cc);
		text-decoration: none;
		font-size: 0.8rem;
	}

	.replies-container {
		margin-right: 2rem;
		margin-top: 0;
		border-left: 1px solid var(--line-color);
		border-radius: 0 0 2rem 2rem;
		background: linear-gradient(to bottom, transparent, var(--bg-color));

		// padding-left: 0.75rem;
	}

	.highlighted {
		box-shadow: 20px -20px 10px -10px var(--primary-color, 0.01);
	}

	/* Reply input styling */
	.reply-input-container {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
		position: relative;
		border: 1px solid var(--inline-color);
		border-radius: 0.5rem;
		background: var(--primary-color);
		padding: 0.5rem;
		width: 100%;
	}

	.reply-input-container textarea {
		width: 100%;
		border: none;
		resize: none;
		min-height: 60px;
		background-color: transparent;
		padding: 0.5rem;
		font-family: inherit;
		font-size: 1.3rem;
		color: var(--text-color, #333);
		outline: none;
	}

	.reply-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.25rem;
		height: auto;
	}

	.cancel-btn,
	.send-btn {
		padding: 0.25rem 0.5rem;
		height: 3rem;
		width: 3rem;
		border: none;
		border-radius: 0.25rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		&:hover {
			color: var(--tertiary-color);
		}
	}

	.cancel-btn {
		background-color: transparent;
		color: var(--text-color);
	}

	.send-btn {
		background-color: var(--secondary-color);
		border-radius: 50%;
		color: white;
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.x-icon {
		font-size: 1.2rem;
		line-height: 1;
	}
	.avatar-container {
		width: auto;
		height: auto;
		border-radius: 50%;
		justify-content: center;
		align-items: center;
		overflow: hidden;
		position: relative;
		display: flex;
		object-fit: cover;
		& img {
			width: 1.5rem;
		}

		& .avatar,
		& .avatar-placeholder {
			width: auto;
			height: auto;
			object-fit: cover;
		}
		& .avatar-placeholder {
			display: flex;
			justify-content: center;
			align-items: center;
			& svg {
				width: 20px;
				height: 20px;
				color: white;
			}
		}
	}

	.toggle-replies-btn {
		background: var(--bg-color);
		color: var(--text-color);
		cursor: pointer;
		border: 1px solid transparent;
		display: inline-flex;
		width: auto;
		min-width: 4rem;
		max-width: fit-content;
		border-radius: 1rem 1rem 1rem 0;
		font-size: 0.9rem;
		padding: 0.5rem;
		text-align: left;
		justify-content: center;
		align-self: flex-start;
		border: 1px solid var(--line-color);
		transition: all 0.3s ease;
		&.selected {
			background: var(--primary-color);
		}

		&:hover {
			background: var(--secondary-color);
		}
	}

	.replies-indicator {
		display: flex;
		align-items: center;
		justify-content: space-around;
		width: 100%;
	}
	.message-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: auto;
		color: var(--placeholder-color);
		font-weight: 200;
		padding: 0rem 0rem 1rem 1rem;
	}

	.message.typing::after {
		content: '▋';
		display: inline-block;
		vertical-align: bottom;
		animation: blink 0.7s infinite;
	}
	.message-header {
		display: flex;
		flex-direction: row;
		align-items: center;
		margin: 0;
		justify-content: flex-start;
		width: auto;
		gap: 1rem;
		padding-top: 0.5rem;
	}
	.user-header {
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		align-items: center;
		width: auto;
		gap: 1rem;
		margin-left: 0;
		font-size: 0.9rem;
		user-select: none;
		&.ai {
			display: flex;
			background: var(--bg-gradient-left);
			border-radius: 0 1rem 1rem 0;
			padding: 0.5rem;
			flex-direction: row;
			justify-content: flex-start;
			align-items: center;
			width: auto;
			gap: 1rem;
			margin-left: 0;
			font-size: 0.9rem;
			user-select: none;
		}
	}

	.prompt-type {
		cursor: pointer;
		opacity: 0.8;
		transition: opacity 0.2s ease;
		text-transform: lowercase;
		&::first-letter {
			text-transform: capitalize;
		}
	}

	.prompt-type:hover {
		opacity: 1;
	}
	.replies-section {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: auto;
		overflow-y: hidden;
		overflow-x: hidden;
		margin-left: 0;
		margin-bottom: 1;

		&.replies-container {
			display: flex;
			flex-direction: column;
			max-height: 100%;
			transition: max-height 0.3s ease;
			overflow-y: auto;
			// background: var(--bg-gradient-right);
			// border: 1px solid var(--line-color);
			padding: 0;
			// border-top: 1px solid var(--line-color);
			// background: var(--primary-color);
		}
	}
	@keyframes highlight-fade {
		0% {
			box-shadow: 0px 10px 10px 1px rgba(255, 255, 255, 0);
		}
		20% {
			box-shadow: 0px 10px 10px 1px rgba(255, 255, 255, 0.3);
		}
		80% {
			box-shadow: 0px 10px 10px 1px rgba(255, 255, 255, 0.3);
		}
		100% {
			box-shadow: 0px 10px 10px 1px rgba(255, 255, 255, 0);
		}
	}

	// .scroll-highlight {
	// 	animation: highlight-fade 1.2s cubic-bezier(0.42, 0, 0.58, 1);
	// }
	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: scale(0);
		}
		40% {
			transform: scale(1);
		}
	}

	.loading {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		width: 300px !important;

		& span {
			width: auto !important;
			display: flex;
			line-height: 1.5;
			font-size: 0.8rem;
			animation: pulsate-color 5s infinite;
		}
	}

	.loader {
		width: 2rem;
		height: 0.5rem;
		border: 1px solid;
		box-sizing: border-box;
		border-radius: 50%;
		display: grid;
		color: var(--tertiary-color);
		box-shadow: 0px 0px 16px 0px rgba(251, 245, 245, 0.9);
		animation: l2 5s infinite linear;
	}
	.loader:before,
	.loader:after {
		content: '';
		grid-area: 1/1;
		border: inherit;
		border-radius: 50%;
		animation: inherit;
		animation-duration: 10s;
	}
	.loader:after {
		--s: -1;
	}
	@keyframes l2 {
		100% {
			transform: rotate(calc(var(--s, 1) * 1turn));
		}
	}

	.message.dual-response {
		border-left: 3px solid var(--primary-color, #3b82f6);
		position: relative;
	}
	.message.was-selected-response {
		border-left: 3px solid var(--success-color, #10b981);
	}
	.message {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		font-weight: 200;
		gap: 1rem;
		margin-bottom: 0;
		width: auto;
		letter-spacing: 0.1rem;
		line-height: 1;
		transition: all 0.3s ease-in-out;

		& p {
			margin: 0;

			display: inline-block;
			flex-direction: column;
			white-space: normal;
			overflow-wrap: break-word;
			word-wrap: break-word;
			hyphens: auto;
			text-align: left;
			height: fit-content;
			line-height: 1.5;
			&::first-letter {
				text-transform: uppercase !important;
			}
		}
		&:hover::before {
			opacity: 0.8;
			background: radial-gradient(
				circle at center,
				rgba(255, 255, 255, 0.2) 0%,
				rgba(255, 255, 255, 0) 100%
			);
		}
		&.thinking {
			display: flex;
			flex-direction: column;
			align-self: center;
			align-items: center;
			text-align: center;
			justify-content: center;
			box-shadow: none !important;
			padding: 2rem;
			width: 100%;
			height: auto;
			font-style: italic;
			border-radius: 50px;
			transition: all 0.3s ease-in;

			& p {
				display: inline-block;
				flex-wrap: wrap;
				margin: 0;
				width: 100%;
				text-align: center;
				justify-content: center;
				align-items: center;
				font-size: var(--font-size-m);
				color: var(--placeholder-color);
				line-height: 1.5;
				animation: blink 3s ease infinite;
			}
		}
		&.assistant {
			display: flex;
			flex-direction: column;
			align-self: flex-start;
			color: var(--text-color);
			height: auto;

			// background: var(--bg-gradient-r);
			margin-left: 0;

			transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		}
		&.options {
			align-self: flex-end;
			background-color: transparent;
			padding: 0;
			margin-right: 20px;
			max-width: 80%;
			box-shadow: none;
			font-style: italic;
			font-size: 30px;
			font-weight: bold;
		}
		&.user {
			display: flex;
			flex-direction: column;
			align-self: flex-start;
			// border: 1px solid var(--line-color);
			color: var(--text-color);
			// background-color: transparent;
			// border-bottom: 1px solid var(--line-color);
			// margin-right: 3.5rem;
			margin-left: 0;
			// border-top: 2px solid var(--line-color);
			max-height: auto;
			height: auto !important;
			width: 100%;
			min-width: 200px;
			font-weight: 500;
			// background: var(--bg-color);
			border: {
				// top: 1px solid var(--primary-color);
				// left: 1px solid red;
			}
			// border-top-left-radius: 1rem!important;
			// box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
			// border-bottom-left-radius: 3rem !important;
			transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		}
		.scroll-bottom-btn {
			position: fixed;
			bottom: 10rem;
			right: 6rem;
			width: 3rem;
			height: 3rem;
			border-radius: 50%;
			background-color: var(--bg-color);
			color: var(--placeholder-color);
			border: 1px solid transparent;
			// box-shadow: 0 2px 10px 2px rgba(0, 0, 0, 0.01);
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			z-index: 100;
			transition: all 0.2s ease;
			&:hover {
				color: var(--text-color);
			}
		}
	}
	@media (max-width: 1000px) {
		.scroll-bottom-btn {
			position: fixed;
			bottom: 10rem;
			right: 2rem !important;
			width: 3rem;
			height: 3rem;
			border-radius: 50%;
			background-color: var(--bg-color);
			color: var(--placeholder-color);
			border: 1px solid transparent;
			// box-shadow: 0 2px 10px 2px rgba(0, 0, 0, 0.01);
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			z-index: 100;
			transition: all 0.2s ease;
			&:hover {
				color: var(--text-color);
			}
		}
	}
	@media (max-width: 450px) {
		.message.depth-0 {
			font-size: 0.7rem;
		}

		.message.depth-1 {
			margin-left: 0;
			max-width: calc(100%);
			// box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
		}

		.message.depth-2 {
			margin-left: 0;
			max-width: calc(100% - 3rem);
			// box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
			border-radius: 1rem;
		}

		.message.depth-3,
		.message.depth-4,
		.message.depth-5 {
			margin-left: 0;
			max-width: calc(100% - 4rem);
			// box-shadow: 0 -20px 60px 0 var(--secondary-color, 0.01);
			border-radius: 1rem;
		}
	}
</style>

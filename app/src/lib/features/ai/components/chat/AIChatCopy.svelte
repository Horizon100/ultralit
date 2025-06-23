<script lang="ts">
	// ===== CORE SVELTE IMPORTS =====
	import { onMount, afterUpdate, createEventDispatcher, onDestroy, tick } from 'svelte';
	import { get, writable, derived } from 'svelte/store';
	import { fade, fly, scale, slide } from 'svelte/transition';
	import { elasticOut, cubicIn, cubicOut } from 'svelte/easing';

	// ===== STORE IMPORTS =====
	import {
		chatStore,
		chatMessages,
		userInput,
		isTypingInProgress,
		typingMessageId,
		thinkingMessageId,
		activeReplyMenu,
		quotedMessage,
		isLoadingMessages
	} from '$lib/stores/chatStore';
	import {
		uiStore,
		expandedSections,
		showPromptCatalog,
		showModelSelector,
		showCollaborators,
		showBookmarks,
		showCites,
		showSysPrompt,
		showAgentPicker,
		isLoading,
		isEditingThreadName,
		searchQuery,
		isThreadListVisible,
		showFavoriteThreads,
		currentPlaceholder,
		isProcessingPromptClick,
		createHovered,
		showTextModal,
		textTooLong
	} from '$lib/stores/uiStore';
	import { currentUser, ensureAuthenticated } from '$lib/pocketbase';
	import { threadsStore, showThreadList, ThreadSortOption } from '$lib/stores/threadsStore';
	import { projectStore } from '$lib/stores/projectStore';
	import { modelStore } from '$lib/stores/modelStore';
	import { t } from '$lib/stores/translationStore';
	import { messagesStore } from '$lib/stores/messagesStore';
	import { apiKey } from '$lib/stores/apiKeyStore';
	import { pendingSuggestion } from '$lib/stores/suggestionStore';
	import {
		isTextareaFocused,
		handleTextareaFocus,
		handleTextareaBlur,
		handleImmediateTextareaBlur,
		adjustFontSize,
		resetTextareaHeight
	} from '$lib/stores/textareaFocusStore';
	import { messageCountsStore, messageCounts, getCountColor } from '$lib/stores/messageCountStore';
	import { promptStore } from '$lib/stores/promptStore';
	import { currentCite, availableCites, type Cite } from '$lib/stores/citeStore';

	// ===== SERVICE IMPORTS =====
	import { MessageService } from '$lib/services/messageService';
	import { ThreadService } from '$lib/services/threadService';
	import { UserService } from '$lib/services/userService';
	import { PromptService } from '$lib/services/promptService';

	// ===== UTILITY IMPORTS =====
	import { TextUtils } from '$lib/utils/textUtils';
	import { DateUtils } from '$lib/utils/dateUtils';
	import { UIUtils } from '$lib/utils/uiUtils';
	import {
		formatDate,
		formatContent,
		formatContentSync,
		getRelativeTime
	} from '$lib/utils/formatters';

	// ===== COMPOSABLE IMPORTS =====
	import { useReplyHandling } from '$lib/composables/useReplyHandling';
	import { useLifecycleManagement } from '$lib/composables/useLifecycleManagement';
	import { useScrollManagement } from '$lib/composables/useScrollManagement';

	// ===== NEW CHAT COMPONENT IMPORTS =====
	import ThreadSidebar from '$lib/components/chat/ThreadSidebar.svelte';
	import ChatHeader from '$lib/components/chat/ChatHeader.svelte';
	import MessageList from '$lib/components/chat/MessageList.svelte';
	import MessageInput from '$lib/components/chat/MessageInput.svelte';

	// ===== EXISTING COMPONENT IMPORTS =====
	import ProjectCard from '$lib/components/cards/ProjectCard.svelte';
	import MsgBookmarks from '$lib/features/ai/components/chat/MsgBookmarks.svelte';
	import ThreadCollaborators from '$lib/features/threads/components/ThreadCollaborators.svelte';
	import PromptCatalog from '../prompts/PromptInput.svelte';
	import ModelSelector from '$lib/features/ai/components/models/ModelSelector.svelte';
	import MessageProcessor from '$lib/features/ai/components/chat/MessageProcessor.svelte';
	import RecursiveMessage from '$lib/features/ai/components/chat/RecursiveMessage.svelte';
	import SysPromptSelector from '../prompts/SysPromptSelector.svelte';
	import Reactions from '$lib/features/ai/components/chat/Reactions.svelte';
	import ReferenceSelector from '$lib/features/ai/components/chat/ReferenceSelector.svelte';
	import AgentPicker from '$lib/features/agents/components/AgentPicker.svelte';

	// ===== ICON IMPORTS =====

	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	// ===== CLIENT IMPORTS =====
	import {
		fetchAIResponse,
		generateTasks as generateTasksAPI,
		createAIAgent
	} from '$lib/clients/aiClient';
	import {
		fetchProjects,
		resetProject,
		fetchThreadsForProject,
		updateProject,
		removeThreadFromProject,
		addThreadToProject
	} from '$lib/clients/projectClient';
	import {
		fetchMessagesForBookmark,
		fetchMessagesForThread,
		resetThread,
		createThread,
		loadThreads,
		threadListVisibility,
		updateThread,
		addMessageToThread,
		deleteThread,
	} from '$lib/clients/threadsClient';

	// ===== POCKETBASE IMPORTS =====
	import {
		pocketbaseUrl,
		getUserById,
		getPublicUsersBatch,
		updateAIAgent,
		checkPocketBaseConnection,
		updateUser
	} from '$lib/pocketbase';

	// ===== FEATURE UTILITY IMPORTS =====
	import { updateThreadNameIfNeeded } from '$lib/features/threads/utils/threadNaming';
	import { getRandomPrompts } from '$lib/features/ai/utils/startPrompts';
	import { defaultModel, availableModels } from '$lib/features/ai/utils/models';
	import { availablePrompts, getPrompt } from '$lib/features/ai/utils/prompts';
	import { processMarkdown, enhanceCodeBlocks } from '$lib/features/ai/utils/markdownProcessor';
	import { prepareReplyContext } from '$lib/features/ai/utils/handleReplyMessage';

	// ===== DATE PICKER IMPORTS =====
	import { DateInput, DatePicker, localeFromDateFnsLocale } from 'date-picker-svelte';
	import { hy } from 'date-fns/locale';

	// ===== GESTURE AND INTERACTION IMPORTS =====
	import { swipeGesture } from '$lib/utils/swipeGesture';
	import { useGlobalSwipe } from '$lib/utils/globalSwipe';
	import { handleFavoriteThread } from '$lib/utils/favoriteHandlers';

	// ===== ASSET IMPORTS =====
	import horizon100 from '$lib/assets/thumbnails/horizon100.svg';

	// ===== TYPE IMPORTS =====
	import type {
		AIModel,
		InternalChatMessage,
		PromptType,
		Threads,
		Projects,
		Messages,
		RoleType,
		Scenario,
		Task,
		Attachment,
		Guidance,
		ThreadGroup,
		MessageState,
		PromptState,
		UIState,
		User,
		UserProfile,
		ChatMessage,
		ThreadStoreState,
		NetworkData,
		AIAgent,
		Network,
		ProviderType,
		ExpandedSections
	} from '$lib/types/types';

	// ===== COMPONENT PROPS =====
	export let message: InternalChatMessage | null = null;
	export let seedPrompt: string = '';
	export let additionalPrompt: string = '';
	export let aiModel: AIModel;
	export let userId: string;
	export let attachment: File | null = null;
	export let promptType: PromptType = 'NORMAL';
	export let threadId: string | null = null;
	export let initialMessageId: string | null = null;
	export let namingThread = true;

	// ===== LOCAL STATE (dramatically reduced!) =====
	let textareaElement: HTMLTextAreaElement | null = null;
	let chatMessagesDiv: HTMLDivElement;
	let messageProcessor;
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;
	let expandedDates = new Set<string>();
	let userPromptData = null;
	let isExpanded = false;
	let searchHovered = false;
	let showDeleteModal = false;
	let threadToDelete: string | null = null;
	const MAX_VISIBLE_CHARS = 200;

	// ===== COMPOSABLE INITIALIZATION =====
	const { setupReplyableHandlers, handleReplyableClick, toggleReplies, clearReplyState } =
		useReplyHandling();

	const {
		initializeApp,
		setupProjectSubscription,
		handleThreadNaming,
		cleanup: lifecycleCleanup,
		addCleanupFunction
	} = useLifecycleManagement();

	const { setupScrollObserver, scrollToBottom, handleNewMessage } = useScrollManagement();

	// ===== THREAD AND PROJECT STATE =====
	let threads: Threads[] = [];
	let currentThread: Threads | null = null;
	let currentThreadId: string | null = null;
	let namingThreadId: string | null = null;
	let currentProject: Projects | null = null;
	let currentProjectId: string | null = null;
	let isCreatingThread = false;
	let isLoadingThreads = false;
	let isLoadingProject = false;
	let showSortOptions = false;
	let showUserFilter = false;
	let drawerSwipeConfig = false;
	let isUpdatingThreadName = false;
	let editedThreadName = '';
	let isMinimized = false;
	let selectedPromptLabel = '';
	let lastMessageCount = 0;
	let latestMessageId: string | null = null;
	let hiddenReplies: Set<string> = new Set();

	// ===== PROMPT AND MODEL STATE =====
	let promptSuggestions: string[] = [];
	let currentGreeting = '';
	let currentQuestion = '';
	let currentQuote = '';
	let selectedModelLabel = '';
	let hasSentSeedPrompt: boolean = false;

	// ===== AUTH STATE =====
	let isAuthenticated = false;
	let name: string = 'You';
	let avatarUrl: string | null = null;

	// ===== SCENARIO/TASK STATE =====
	let scenarios: Scenario[] = [];
	let tasks: Task[] = [];
	let attachments: Attachment[] = [];
	let currentStage:
		| 'initial'
		| 'scenarios'
		| 'guidance'
		| 'tasks'
		| 'refinement'
		| 'final'
		| 'summary' = 'initial';
	let guidance: Guidance | null = null;
	let filteredThreads: Threads[] = [];

	// ===== CONSTANTS =====
	const dispatch = createEventDispatcher();
	const isAiActive = writable(true);
	const smoothSlideIn = { duration: 350, easing: cubicOut, x: -300 };
	const smoothSlideOut = { duration: 300, easing: cubicIn, x: -300 };

	// ===== REACTIVE STATEMENTS (simplified) =====
	$: filteredThreads = (() => {
		let filtered = threads || [];
		if (
			showFavoriteThreads &&
			$currentUser?.favoriteThreads &&
			$currentUser.favoriteThreads.length > 0
		) {
			filtered = filtered.filter((thread) => $currentUser!.favoriteThreads!.includes(thread.id));
		}
		if ($searchQuery?.trim()) {
			const query = $searchQuery.toLowerCase();
			filtered = filtered.filter((thread) => thread.name?.toLowerCase().includes(query));
		}
		return filtered;
	})();

	$: currentThread = threads?.find((t) => t.id === currentThreadId) || null;

	// ===== MAIN FUNCTIONS (using services) =====
	export async function handleSendMessage(message: string = $userInput) {
		if (!message.trim() && $chatMessages.length === 0 && !attachment) return;

		try {
			chatStore.clearUserInput();
			if (textareaElement) {
				TextUtils.resetTextareaHeight(textareaElement);
				setTimeout(() => {
					if (textareaElement) {
						textareaElement.blur();
						handleImmediateTextareaBlur();
					}
				}, 0);
			}

			// Ensure we have a thread
			if (!currentThreadId) {
				const newThread = await ThreadService.createNewThread();
				if (!newThread?.id) return;
				currentThreadId = newThread.id;
			}

			// Send message
			const result = await MessageService.sendMessage(
				message,
				aiModel,
				userId,
				currentThreadId!,
				promptType,
				attachment,
				selectedModelLabel,
				$quotedMessage ?? undefined
			);

			chatStore.setQuotedMessage(null);

			// Generate AI response if active
			if ($isAiActive) {
				await MessageService.generateAIResponse(
					result.userMessage,
					aiModel,
					userId,
					currentThreadId!,
					promptType,
					attachment,
					selectedModelLabel
				);
			}

			// Update thread name
			await ThreadService.updateThreadNameIfNeeded(currentThreadId!, aiModel, userId);
		} catch (error) {
			handleError(error);
		} finally {
			cleanup();
		}
	}

	// ===== EVENT HANDLERS =====
	const onTextareaFocus = () => {
		handleTextareaFocus();
		uiStore.closeAllInputRelatedSections();
		threadsStore.setThreadListVisibility(false);
		uiStore.setCurrentPlaceholder(PromptService.getRandomQuote());
	};

	const onTextareaBlur = () => {
		handleTextareaBlur();
	};

	function handleTextSelection() {
		chatStore.setActiveSelection(TextUtils.getTextSelection());
	}

	function handleSearchChange(event?: Event) {
		if (event) {
			const target = event.target as HTMLInputElement;
			uiStore.setSearchQuery(target.value);
		}
		threadsStore.setSearchQuery($searchQuery);
	}

	function toggleAiActive() {
		isAiActive.update((value) => !value);
	}
	function toggleSection(section: string) {
		uiStore.toggleSection(section as keyof ExpandedSections);
	}
	function handleModelSelection(event: CustomEvent<AIModel>) {
		const selectedModel = event.detail;
		aiModel = { ...selectedModel, provider: selectedModel.provider || 'openai' };
		selectedModelLabel = aiModel.name || '';
		uiStore.setExpandedSectionExclusive('models', false);
	}

	// ===== THREAD MANAGEMENT =====
	async function handleLoadThread(threadId: string) {
		try {
			const loadedThread = await ThreadService.loadThread(threadId);
			if (loadedThread) {
				currentThreadId = threadId;
				currentThread = loadedThread;

				const messages = await messagesStore.fetchMessages(threadId);
				const mappedMessages = messages.map((msg) => ({
					role: (msg.type === 'human' ? 'user' : 'assistant') as RoleType,
					content: msg.text,
					id: msg.id,
					isTyping: false,
					text: msg.text,
					user: msg.user,
					created: msg.created,
					updated: msg.updated,
					parent_msg: msg.parent_msg,
					prompt_type: msg.prompt_type as PromptType,
					prompt_input: msg.prompt_input,
					provider: msg.provider,
					model: msg.model,
					collectionId: msg.collectionId || 'defaultCollectionId',
					collectionName: msg.collectionName || 'defaultCollectionName'
				}));

				chatStore.setMessages(mappedMessages);
				uiStore.closeAllInputRelatedSections();
			}
			return loadedThread;
		} catch (error) {
			console.error('Error loading thread:', error);
			return null;
		}
	}

	async function handleCreateNewThread() {
		try {
			const newThread = await ThreadService.createNewThread();
			if (newThread) {
				currentThreadId = newThread.id;
				currentThread = newThread;
				uiStore.closeAllInputRelatedSections();
				await handleLoadThread(newThread.id);
			}
			return newThread;
		} catch (error) {
			handleError(error);
			return null;
		}
	}

	async function handleDeleteThread(event: MouseEvent, threadId: string) {
		event.stopPropagation();
		const success = await ThreadService.deleteThread(threadId);
		if (success && currentThreadId === threadId) {
			currentThreadId = null;
			currentThread = null;
			chatStore.resetMessages();
		}
	}

	// ===== PROMPT MANAGEMENT =====
	async function handleStartPromptSelection(promptText: string) {
		if ($isProcessingPromptClick) return;

		try {
			uiStore.setProcessingPromptClick(true);
			await handleSendMessage(promptText);
			promptSuggestions = PromptService.refreshPromptSuggestions();
		} catch (error) {
			handleError(error);
		} finally {
			uiStore.setProcessingPromptClick(false);
		}
	}

	// ===== USER MANAGEMENT =====
	async function onFavoriteThread(event: Event, specificThread?: Threads) {
		if (!specificThread) return;
		await UserService.onFavoriteThread(specificThread);
	}

	function getAvatarUrl(user: any): string {
		return UserService.getAvatarUrl(user);
	}

	function startEditingThreadName() {
		const permissions = UserService.getThreadPermissions(currentThread!, userId);
		if (!permissions.canEdit) return;
		uiStore.setEditingThreadName(true, currentThread?.name || '');
	}

	// ===== UTILITY FUNCTIONS =====
	function cleanup() {
		uiStore.setLoading(false);
		chatStore.setThinkingMessageId(null);
		chatStore.setTypingMessageId(null);
		attachment = null;
	}

	function handleError(error: unknown) {
		console.error('Error:', error);
		const errorMessage = error instanceof Error ? error.message : 'An error occurred';
		const errorMsg = MessageService.createMessage(
			'assistant',
			errorMessage,
			undefined,
			undefined,
			userId
		);
		chatStore.addMessage(errorMsg);
	}
	function handleReplyToMessage(text: string, parentMsgId: string, contextMessages: any[]) {
		// Implement reply functionality
		console.log('Reply to message:', { text, parentMsgId, contextMessages });
	}

	function cancelDelete() {
		showDeleteModal = false;
		threadToDelete = null;
	}

	function confirmDelete() {
		if (threadToDelete) {
			handleDeleteThread(new MouseEvent('click'), threadToDelete);
		}
		showDeleteModal = false;
		threadToDelete = null;
	}

	let deleteNotification = 'Are you sure you want to delete this thread?';
	// ===== LIFECYCLE HOOKS =====
	onMount(async () => {
		// Initialize the entire application
		await initializeApp(
			textareaElement,
			chatMessagesDiv,
			currentThreadId,
			aiModel,
			(model) => {
				aiModel = model;
				selectedModelLabel = model.name || '';
			},
			handleSendMessage
		);

		// Setup scroll management
		if (chatMessagesDiv) {
			const cleanup = setupScrollObserver(chatMessagesDiv);
			addCleanupFunction(cleanup);
		}

		// Setup project subscription
		const unsubscribeProject = setupProjectSubscription(
			(id) => (currentProjectId = id),
			(editing) => uiStore.setEditingProjectName(editing),
			(name) => {
				/* handled in store */
			},
			(projectId) => ThreadService.loadProjectThreads(projectId ?? undefined),
			$searchQuery
		);
		addCleanupFunction(unsubscribeProject);

		// Setup model subscription
		const unsubscribeModel = modelStore.subscribe((state) => {
			if (state.selectedModel && (!aiModel || aiModel.id !== state.selectedModel.id)) {
				aiModel = state.selectedModel;
				selectedModelLabel = aiModel.name || '';
			}
		});
		addCleanupFunction(unsubscribeModel);

		// Initialize prompts
		promptSuggestions = PromptService.getRandomPrompts();
		uiStore.setCurrentPlaceholder(PromptService.getRandomQuestion());

		// Load user prompt data
		await PromptService.loadUserPrompt();
	});

	afterUpdate(() => {
		// Setup reply handlers
		if (!$isTypingInProgress) {
			setTimeout(setupReplyableHandlers, 100);
		}

		// Handle auto-scroll for new messages
		if (chatMessagesDiv && $chatMessages.length > lastMessageCount) {
			handleNewMessage(chatMessagesDiv, $chatMessages.length, lastMessageCount);
			lastMessageCount = $chatMessages.length;
		}
	});

	onDestroy(() => {
		lifecycleCleanup();
		clearReplyState();
		if (hideTimeout) {
			clearTimeout(hideTimeout);
		}
	});

	// ===== REACTIVE STATEMENTS =====
	$: filteredThreads = (() => {
		let filtered = threads || [];
		if ($showFavoriteThreads) {
			filtered = filtered.filter((thread) => $currentUser!.favoriteThreads!.includes(thread.id));
		}
		if ($searchQuery?.trim()) {
			const query = $searchQuery.toLowerCase();
			filtered = filtered.filter((thread) => thread.name?.toLowerCase().includes(query));
		}
		return filtered;
	})();

	$: groupedThreads = DateUtils.groupThreadsByTime(threads);
	$: currentThread = threads?.find((t) => t.id === currentThreadId) || null;
	$: placeholderText = $isTextareaFocused ? $currentPlaceholder : $t('chat.manualPlaceholder');

	// ===== REACTIVE PROMPT UPDATES =====
	$: {
		const greetings = $t('extras.greetings') as string[];
		if (Array.isArray(greetings) && greetings.every((item) => typeof item === 'string')) {
			currentGreeting = greetings[Math.floor(Math.random() * greetings.length)];
		}
	}

	$: {
		const questions = $t('extras.questions') as string[];
		if (Array.isArray(questions) && questions.every((item) => typeof item === 'string')) {
			currentQuestion = questions[Math.floor(Math.random() * questions.length)];
		}
	}

	$: {
		const quotes = $t('extras.quotes') as string[];
		if (Array.isArray(quotes) && quotes.every((item) => typeof item === 'string')) {
			currentQuote = quotes[Math.floor(Math.random() * quotes.length)];
		}
	}

	$: {
		const prompts = $t('startPrompts') as string[];
		if (Array.isArray(prompts)) {
			promptSuggestions = PromptService.refreshPromptSuggestions();
		}
	}

	// ===== THREAD REACTIVE UPDATES =====
	$: threads = (() => {
		let allThreads = $threadsStore.threads || [];
		const currentProjectId = $threadsStore.project_id || $projectStore.currentProjectId;
		if (currentProjectId) {
			allThreads = allThreads.filter((thread) => thread.project_id === currentProjectId);
		}
		if ($showFavoriteThreads && $currentUser?.favoriteThreads?.length) {
			allThreads = allThreads.filter((thread) => $currentUser.favoriteThreads!.includes(thread.id));
		}
		if ($searchQuery?.trim()) {
			const query = $searchQuery.toLowerCase();
			allThreads = allThreads.filter(
				(thread) =>
					thread.name?.toLowerCase().includes(query) ||
					thread.last_message?.content?.toLowerCase().includes(query)
			);
		}
		return allThreads;
	})();
	$: sortOptionInfo = threadsStore.sortOptionInfo;
	$: allSortOptions = threadsStore.allSortOptions;
	$: selectedUserIds = threadsStore.selectedUserIds;
	$: availableUsers = threadsStore.availableUsers;
	$: selectedIcon = $promptStore?.selectedPromptId
		? availablePrompts.find((option) => option.value === $promptStore.promptType)?.icon
		: null;
	// ===== INPUT MANAGEMENT =====
	$: if ($userInput === '' && textareaElement) {
		TextUtils.resetTextareaHeight(textareaElement);
	}

	$: if ($currentUser?.avatar) {
		avatarUrl = UserService.updateAvatarUrl();
	}

	$: if (seedPrompt && !hasSentSeedPrompt) {
		handleSendMessage(seedPrompt);
		hasSentSeedPrompt = true;
	}

	// ===== THREAD NAMING LOGIC =====
	$: if ($threadsStore.namingThreadId) {
		handleThreadNaming($threadsStore.namingThreadId, currentThreadId, threads);
	}

	// ===== SEARCH MANAGEMENT =====
	$: if ($searchQuery !== undefined) {
		threadsStore.setSearchQuery($searchQuery);
	}

	// ===== UI SECTION MANAGEMENT =====
	$: if ($expandedSections.models) {
		uiStore.setExpandedSectionExclusive('models', true);
	} else if ($expandedSections.collaborators) {
		uiStore.setExpandedSectionExclusive('collaborators', true);
	} else if ($expandedSections.sysprompts) {
		uiStore.setExpandedSectionExclusive('sysprompts', true);
	} else if ($expandedSections.prompts) {
		uiStore.setExpandedSectionExclusive('prompts', true);
	} else if ($expandedSections.cites) {
		uiStore.setExpandedSectionExclusive('cites', true);
	} else if ($expandedSections.bookmarks) {
		uiStore.setExpandedSectionExclusive('bookmarks', true);
	}

	// ===== DATE MANAGEMENT =====
	$: if (new Date()) {
		messagesStore.setSelectedDate(new Date().toISOString());
	}

	// ===== MESSAGE DEDUPLICATION =====
	$: if ($chatMessages && $chatMessages.length > 0) {
		MessageService.dedupeCurrentMessages();
		UserService.preloadUserProfilesBatch($chatMessages);
	}

	// ===== THREAD LIST VISIBILITY =====
	$: if ($isTextareaFocused && $showThreadList) {
		threadsStore.setThreadListVisibility(false);
	}
</script>

{#if $currentUser}
	<div class="chat-interface" in:fly={{ y: -200, duration: 300 }} out:fade={{ duration: 200 }}>
		<div
			class="chat-container"
			transition:fly={{ x: 300, duration: 300 }}
			class:drawer-visible={$showThreadList}
		>
			<!-- Thread Sidebar Component -->
			<ThreadSidebar
				{threads}
				{currentThreadId}
				{isCreatingThread}
				{isLoadingProject}
				{isLoadingThreads}
				searchQuery={$searchQuery}
				{isExpanded}
				{showSortOptions}
				{showUserFilter}
				{drawerSwipeConfig}
				on:createThread={handleCreateNewThread}
				on:loadThread={(e) => handleLoadThread(e.detail.threadId)}
				on:deleteThread={(e) => handleDeleteThread(e.detail.event, e.detail.threadId)}
				on:favoriteThread={(e) => onFavoriteThread(e.detail.event, e.detail.thread)}
				on:searchChange={(e) => handleSearchChange(e.detail.query)}
			>
				<!-- Sort Options Slot -->
				<div slot="sortOptions">
					{#each $allSortOptions as option}
						<button
							class="dropdown-item"
							class:selected={$sortOptionInfo.value === option.value}
							on:click={() => UIUtils.setSortOption(option.value)}
						>
							<svelte:component this={option.icon} />
							<span>{option.label}</span>
							{#if $sortOptionInfo.value === option.value}
								<span class="check-icon">
									{@html getIcon('Check', { size: 16 })}
								</span>
							{/if}
						</button>
					{/each}
				</div>

				<!-- User Filter Slot -->
				<div slot="userFilter">
					<div class="dropdown-header">
						<h3>Filter by Users</h3>
						{#if $selectedUserIds.size > 0}
							<button class="clear-button" on:click={UIUtils.clearSelectedUsers}>
								Clear all
							</button>
						{/if}
					</div>

					{#if $availableUsers.length === 0}
						<div class="no-users">No users found</div>
					{:else}
						{#each $availableUsers as user}
							<button
								class="dropdown-item"
								class:selected={$selectedUserIds.has(user.id)}
								on:click={() => UIUtils.toggleUserSelection(user.id)}
							>
								<span>{user.name}</span>
								{#if $selectedUserIds.has(user.id)}
									<span class="check-icon">
										{@html getIcon('Check', { size: 16 })}
									</span>
								{/if}
							</button>
						{/each}
					{/if}
				</div>
			</ThreadSidebar>

			<!-- Main Chat Area -->
			<div class="chat-container" in:fly={{ x: 200, duration: 1000 }} out:fade={{ duration: 200 }}>
				<div
					class="chat-content"
					class:drawer-visible={$showThreadList}
					in:fly={{ x: 200, duration: 300 }}
					out:fade={{ duration: 200 }}
				>
					<!-- Chat Header Component -->
					<ChatHeader
						{currentThread}
						{userId}
						{name}
						{isUpdatingThreadName}
						{editedThreadName}
						{isMinimized}
						{promptSuggestions}
						on:startEditing={(e) => startEditingThreadName()}
						on:cancelEditing={() => uiStore.setEditingThreadName(false)}
						on:promptSelected={(e) => handleStartPromptSelection(e.detail.promptText)}
						on:sendMessage={(e) => handleSendMessage(e.detail.message)}
					>
						<!-- Placeholder Input Slot -->
					</ChatHeader>
					<MessageInput
						userInput={$userInput}
						isLoading={$isLoading}
						isAiActive={$isAiActive}
						{currentThreadId}
						{aiModel}
						{selectedModelLabel}
						{selectedPromptLabel}
						{selectedIcon}
						currentPlaceholder={$currentPlaceholder || ''}
						placeholderText={String($currentPlaceholder || '')}
						showTextModal={$showTextModal}
						textTooLong={$textTooLong}
						createHovered={$createHovered}
						isPlaceholder={true}
						bind:textareaElement
						on:sendMessage={(e) => handleSendMessage(e.detail.message)}
						on:textareaFocus={onTextareaFocus}
						on:textareaBlur={onTextareaBlur}
						on:toggleSection={(e) => toggleSection(e.detail.section)}
						on:toggleAiActive={toggleAiActive}
						on:modelSelection={(e) => handleModelSelection(e.detail)}
						on:sysPromptSelect={(e) => console.log('Sys prompt selected:', e.detail)}
						on:promptSelect={(e) => console.log('Prompt selected:', e.detail)}
						on:collaboratorSelect={(e) => console.log('Collaborator selected:', e.detail)}
						on:loadThread={(e) => handleLoadThread(e.detail.threadId)}
						on:inputCleared={() => chatStore.clearUserInput()}
						on:textModalOpen={() => uiStore.setShowTextModal(true)}
					/>
					<!-- Message List Component (only when thread is selected) -->
					{#if currentThread}
						<MessageList
							chatMessages={$chatMessages}
							isLoadingMessages={$isLoadingMessages}
							isTypingInProgress={$isTypingInProgress}
							{userId}
							{name}
							{aiModel}
							{promptType}
							{latestMessageId}
							{hiddenReplies}
							bind:chatMessagesDiv
							on:processMessageContent={(e) =>
								MessageService.processMessageContentWithReplyable(
									e.detail.content,
									e.detail.messageId
								)}
							on:toggleReplies={(e) => toggleReplies(e.detail.messageId)}
							on:replyToMessage={(e) =>
								handleReplyToMessage(e.detail.text, e.detail.parentMsgId, e.detail.contextMessages)}
						/>

						<!-- Message Input Component (main input for existing threads) -->
						{#if !currentThread}
							<MessageInput
								userInput={$userInput}
								isLoading={$isLoading}
								isAiActive={$isAiActive}
								{currentThreadId}
								{aiModel}
								{selectedModelLabel}
								{selectedPromptLabel}
								{selectedIcon}
								currentPlaceholder={$currentPlaceholder || ''}
								placeholderText={String($currentPlaceholder || '')}
								showTextModal={$showTextModal}
								textTooLong={$textTooLong}
								createHovered={$createHovered}
								isPlaceholder={true}
								bind:textareaElement
								on:sendMessage={(e) => handleSendMessage(e.detail.message)}
								on:textareaFocus={onTextareaFocus}
								on:textareaBlur={onTextareaBlur}
								on:toggleSection={(e) => toggleSection(e.detail.section)}
								on:toggleAiActive={toggleAiActive}
								on:modelSelection={(e) => handleModelSelection(e.detail)}
								on:sysPromptSelect={(e) => console.log('Sys prompt selected:', e.detail)}
								on:promptSelect={(e) => console.log('Prompt selected:', e.detail)}
								on:collaboratorSelect={(e) => console.log('Collaborator selected:', e.detail)}
								on:loadThread={(e) => handleLoadThread(e.detail.threadId)}
								on:inputCleared={() => chatStore.clearUserInput()}
								on:textModalOpen={() => uiStore.setShowTextModal(true)}
							/>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Delete Modal -->
	{#if showDeleteModal}
		<div class="modal-overlay" transition:fade={{ duration: 200 }}>
			<div class="modal-content delete" transition:scale={{ duration: 300 }}>
				<div class="modal-header">
					<h3>{$t('generic.delete')} {$t('threads.thread')}</h3>
				</div>
				<div class="modal-body">
					<p>{deleteNotification}</p>
				</div>
				<div class="modal-actions">
					<button class="btn btn-cancel" on:click={cancelDelete}>
						{$t('generic.no')}
					</button>
					<button class="btn btn-delete" on:click={confirmDelete}>
						{$t('generic.yes')}
					</button>
				</div>
			</div>
		</div>
	{/if}
{:else}
	<p>User is not authenticated</p>
{/if}

<link href="https://fonts.googleapis.com/css?family=Montserrat" rel="stylesheet" />

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

	// :global(body) {
	//   --date-picker-background: var(--bg-gradient);
	// 	--date-picker-foreground: white;
	// 	--date-picker-highlight-border: var(--bg-color);
	// 	--date-picker-highlight-shadow: var(--tertiary-color);
	// 	--date-picker-selected-color: var(--text-color);
	// 	--date-picker-selected-background: var(--tertiary-color);

	// }

	:global {
		// Table styles
		.language-table {
			width: 100%;
			// border-collapse: collapse;
			// margin: 1rem 0;
			// background: var(--bg-gradient-left);
			// box-shadow: 0px 1px 40px 1px var(--secondary-color, 0.01);
			// border-radius: var(--radius-m);
			// overflow: hidden;
		}
		.modal-overlay {
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.7);
			backdrop-filter: blur(4px);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 9999;
		}

		.modal-content.delete {
			background: var(--bg-color);
			border: 1px solid var(--line-color);
			border-radius: 1rem !important;
			max-width: 400px;
			width: 90%;
			box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
			overflow: hidden;
		}

		.modal-header {
			padding: 0.5rem;
			justify-content: center;
			display: flex;
			h3 {
				margin: 0;
				font-size: 1.25rem;
				font-weight: 600;
				color: var(--text-color);
				width: 100%;
				text-align: center;
			}
		}

		.modal-body {
			padding: 1rem;

			p {
				margin: 0;
				color: var(--placeholder-color);
				line-height: 1.5;
				text-align: center;
			}
		}

		.modal-actions {
			display: flex;
			gap: 0.75rem;
			padding: 0 1.5rem 1.5rem;
			justify-content: center;
		}

		.btn {
			padding: 0.5rem 1rem;
			border-radius: 0.5rem;
			border: 1px solid transparent;
			font-size: 0.875rem;
			font-weight: 500;
			cursor: pointer;
			transition: all 0.2s ease;

			&.btn-cancel {
				background: transparent;
				border-color: var(--line-color);
				color: var(--text-color);

				&:hover {
					background: var(--hover-color);
				}
			}

			&.btn-delete {
				background: #ef4444;
				color: white;

				&:hover {
					background: #dc2626;
				}
			}
		}
		table {
			margin-top: 2rem;
			margin-bottom: 2rem;
			background: var(--primary-color);
			border-radius: 2rem;
			overflow: hidden; /* Better than `auto` for rounded corners */
			border-collapse: separate; /* Needed for `border-radius` on tables */
			border-spacing: 0; /* Removes default cell spacing */
			width: 100%; /* Ensures table respects padding */
		}

		th {
			// background: var(--bg-gradient-r);
			background: var(--primary-color) !important;
			text-align: left;
			font-weight: 800;
			font-size: auto;
			line-break: strict;
			color: var(--text-color);
			padding-inline-start: 1rem !important;

			border: {
				bottom: 1px solid var(--bg-color);
				right: 1px solid var(--bg-color);
			}
			// font-style: italic;
			padding: 2rem;
			&:last-child {
				border: {
					right: none;
					left: none;
				}
			}
			&:first-child {
				font-weight: 600;
				text-transform: uppercase;
				font-style: normal;
			}
		}

		td {
			padding: 1rem;
			padding-inline-start: 1rem !important;

			border: {
				bottom: 1px solid var(--secondary-color);
				right: 1px solid var(--secondary-color);
			}
			&:first-child {
				font-weight: 600;
				font-size: 0.8rem;
				text-transform: uppercase;
				font-style: normal;
			}
			&:last-child {
				border: {
					right: none;
					left: none;
				}
			}
		}

		tr {
			line-height: 2;

			&:last-of-type td {
				border-bottom: none;
			}
			&:nth-child(even) {
				background: var(--primary-color) !important;
			}
			&:hover {
				background: var(--bg-gradient-right);
			}
		}

		// List styles

		ul {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			margin-bottom: 0;
			margin-left: 0;
			padding-inline-start: 2rem;
			margin-top: 0;
			max-width: 500px;
			list-style-type: none;
			li li {
				background: var(--bg-color);
				border: none !important;
				padding: 1rem;
			}
			li {
				padding: 1rem;
				margin-top: 0;
				margin-bottom: 0;
				transition: all 0.3s ease;
				border-left: 10px solid var(--line-color) !important;
				border: 1px solid var(--line-color);
				backdrop-filter: blur(10px);
				&:hover {
					background: var(--primary-color);
					// transform: translateX(1rem);
					cursor: pointer;
				}
			}
		}

		li {
			margin: 0;
			transform: all;
			margin: {
				block-start: 1.5rem;
				block-end: 1rem;
			}
			letter-spacing: 0.1rem;
			// border-radius: var(--radius-m);
			border-radius: 0.5rem;
			li {
				margin-inline-start: 1.5rem;
				padding-inline-start: 0;
				border-left: 10px solid var(--tertiary-color);
			}
			&:li {
				font-size: 1.2rem;
				font-weight: 600;
				transition: 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);
				background: var(--bg-gradient-right);
			}
		}

		ol {
			display: flex;
			flex-direction: column;
			justify-content: center;
			// list-style-position: outside;
			// padding: 1rem;
			padding-inline-start: 0;
			margin: 0;
			margin-left: 0;
			// border: 1px solid var(--secondary-color);
			border-radius: 2rem;
			width: 100%;
			// border-left: 1px solid var(--line-color);
			border-radius: 0;
			transition: all 0.3s ease;

			p {
				list-style-type: lower-alpha !important;

				font-size: 0.9rem;
				line-height: 1.5;
				margin: {
					left: 0;
					bottom: 0;
				}

				& ol {
					display: flex;
					flex-direction: column;
				}
			}

			li {
				display: flex;
				position: relative;
				// padding: 1rem;
				margin: 0;
				// padding: 2rem;
				padding: 1rem;
				font-size: 0.9rem;
				letter-spacing: 0rem;
				// line-height: 2;
				// border-top: 1px solid var(--placeholder-color);
				// border-bottom: 1px solid var(--placeholder-color);
				list-style-type: lower-alpha !important;

				max-width: 90%;
				// background: var(--bg-gradient-r);
				border-radius: 0;
				// border-top-left-radius: 2rem;
				// border-bottom-left-radius: 2rem;

				transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
				// border-bottom: 3px solid var(--bg-color);
				// border-bottom: 1px solid var(--placeholder-color);

				& strong {
					display: inline-block;
					width: auto !important;
				}

				&:last-child {
					border-bottom: none;
				}
				&::marker {
					font-weight: 600;
					color: var(--text-color);
				}
				li li {
					transform: all;
					border: 1px solid transparent;

					&:hover {
						transition: 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
						transform: translateX(-0.5rem);
						scale: 1.1;
						box-shadow: 0px 1px 2px 1px var(--secondary-color, 0.01);
						background-color: var(--bg-color);
					}
				}
			}
		}

		// First level items
		&:first-child {
			margin-top: 0;
			margin-bottom: 0;
		}

		// Spacing between heading and content
		strong,
		b {
			// font-weight: 800;
			// background: var(--bg-color);
			// color: var(--tertiary-color);
			transition: all 0.3s ease;
			color: var(--text-color);
			border-radius: 1rem;
			// display: block;
			margin-bottom: 1em;
		}
		strong + p,
		b + p {
			display: block;
			margin-top: 1em;
		}

		//       .message.assistant div div {
		//   // Code block styling
		//   margin: 0;
		//   padding: 0;
		//   // padding-inline-start: 1rem !important;
		//   // border-top: 1px solid var(--secondary-color);
		//   // border-bottom: 1px solid var(--secondary-color);
		//       border: none !important;
		//   border-radius: 1rem !important;
		//   overflow-x: auto;
		//   display: flex;
		//   flex-direction: column;

		//   &:hover {
		//     // background: var(--bg-color);
		//   }
		// }

		p div {
			display: flex !important;
			width: auto;
			flex-direction: column;
		}

		// Code styles
		//   .message.assistant div div pre {
		//   // Code block styling
		//   margin: 0;
		//   padding: 1rem;
		//   border-radius: 1rem !important;
		//   // padding-inline-start: 1rem !important;
		//   background-color: var(--primary-color) !important;
		//   overflow-x: auto;
		//   margin-top: 1rem !important;

		// }
		pre {
			background: var(--bg-color) !important;
			border-radius: 1rem !important;
			margin-left: 1rem !important;
			margin-top: 1rem !important;
			white-space: pre-wrap;
			overflow-wrap: break-word;
			word-wrap: break-word;
		}
		pre.language-json {
			margin: 0;
			padding: 0;
			background: none;
		}
		pre code {
			padding: 1rem !important;
			margin-top: 1rem;
			color: var(--text-color);
			max-width: 800px !important;
			display: flex;
			font-size: 1rem;
		}
		code.language-json {
			display: block;
			color: #d4d4d4;
			padding: 1em;
			border-radius: var(--radius-l);
			font-family: 'Fira Code', 'Consolas', monospace;
			font-size: 14px;
			line-height: 1.5;
			overflow-x: auto;
			tab-size: 2;
			counter-reset: line;
			background: var(--secondary-color);

			.property {
				color: #9cdcfe;
			}
			.string {
				color: #ce9178;
			}
			.number {
				color: #b5cea8;
			}
			.boolean {
				color: #569cd6;
			}
			.null {
				color: #569cd6;
			}
			.punctuation {
				color: #d4d4d4;
			}
			.bracket {
				color: #ffd700;
			}

			.error {
				background: rgba(255, 0, 0, 0.2);
				border-bottom: 1px wavy #ff0000;
			}

			.indent-guide {
				border-left: 1px solid rgba(255, 255, 255, 0.1);
				position: absolute;
				left: calc(var(--depth) * 2ch);
				height: 100%;
			}

			> code {
				display: block;
				position: relative;
				padding-left: 3.5em;
				&::before {
					counter-increment: line;
					content: counter(line);
					position: absolute;
					left: -2em;
					width: 1.5em;
					color: #858585;
					text-align: right;
					user-select: none;
				}
			}

			&::selection {
				background: rgba(97, 175, 239, 0.3);
			}

			&:hover {
				box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
			}

			&::-webkit-scrollbar {
				width: 8px;
				height: 8px;
				&-thumb {
					background: #4a4a4a;
					border-radius: 4px;
				}
				&-track {
					background: #2a2a2a;
					border-radius: 4px;
				}
			}
		}
	}

	.calendar {
		// background: var(--bg-gradient);
		width: auto;
		padding: 0.1rem 0.5rem;
		border-radius: var(--radius-m);

		&input {
			background: var(--bg-color);
		}
	}

	//     :global(.depth-1) {
	//   margin-left: 1.5rem !important;
	//   max-width: calc(80% - 1.5rem) !important;
	// }

	// :global(.depth-2) {
	//   margin-left: 3rem !important;
	//   max-width: calc(80% - 3rem) !important;
	// }

	// :global(.depth-3), :global(.depth-4), :global(.depth-5) {
	//   margin-left: 4rem !important;
	//   max-width: calc(80% - 4rem) !important;
	// }

	// :global(.replies-container) {
	//   margin-left: 1rem !important;
	//   margin-top: 0.5rem !important;
	//   border-left: 2px solid var(--reply-border, #ddd) !important;
	//   padding-left: 0.75rem !important;
	// }
	span.header-btns {
		display: flex;
		flex-direction: column;
		position: fixed;
		left: 4rem;
		z-index: 5000;
		bottom: 2rem;
		margin-left: 2rem;
		width: auto;
		margin-right: 0;
	}
	.btn {
		display: flex;
		justify-content: center;
		align-items: center;
		// box-shadow: 2px -4px 20px 1px rgba(255, 255, 255, 0.1);
		transition: all 0.3s ease;
		border: none;
		width: auto;
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
	span.hero {
		display: flex;
		height: auto;
		width: auto;
		flex-direction: column;
		justify-content: center;
		align-items: flex-end;
		position: relative;
		width: 100%;
		top: 0rem;
		margin-bottom: 1rem;
		gap: 0;
		& h3 {
			text-align: center;
			margin: 0;
			font-size: 2rem;
		}
		& p {
			text-align: right;
			font-style: italic;
			margin: 0;
		}
	}
	h1 {
		font-size: 1.5rem;
		display: inline-block;
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

	/// KEYFRAMES
	@at-root {
		@keyframes shake {
			0%,
			100% {
				transform: translateX(0);
			}
			10%,
			30%,
			50%,
			70%,
			90% {
				transform: translateX(-2px);
			}
			20%,
			40%,
			60%,
			80% {
				transform: translateX(2px);
			}
			100% {
				transform: translateX(0);
			}
		}

		@keyframes scaleEffect {
			0% {
				transform: scale(1);
			}
			50% {
				transform: scale(1.5);
			}
			100% {
				transform: scale(1);
			}
		}

		@keyframes pulse {
			0% {
				transform: scale(1);
			}
			50% {
				transform: scale(0.5);
			}
			100% {
				transform: scale(1);
			}
		}

		@keyframes spin {
			from {
				transform: rotate(0deg);
			}
			to {
				transform: rotate(360deg);
			}
		}

		@keyframes glowy {
			0% {
				box-shadow: {
					first:
						0 0 0 #2b2b29,
						0 0 2px #4b505d;
				}
			}
			50% {
				box-shadow: {
					first:
						0 1px 0 #2b2b29,
						0 0 15px #4c4e55;
				}
			}
			100% {
				box-shadow: {
					first:
						0 0 1px #474539,
						0 0 50px #32322e;
				}
			}
		}

		@keyframes pulsate {
			0% {
				box-shadow: {
					first: 0 0 0 var(--secondary-color);
					second: 0 0 4px var(--tertiary-color);
				}
			}
			100% {
				box-shadow: {
					first: 0 0 1px var(--secondary-color);
					second: 0 0 6px var(--bg-color);
				}
			}
		}

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

		@keyframes blink-slow {
			0%,
			100% {
				opacity: 0.2;
			}
			50% {
				opacity: 0.7;
			}
		}
	}

	// .project-section {}
	.calendar {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
	}

	.date-input-container {
		display: flex;
		align-items: center;
		justify-content: right;
		gap: 0.5rem;
		position: relative;
		z-index: 4000;
		width: 99%;
	}

	:global(.date-input) {
		display: flex;
		flex-direction: row;
		justify-content: right;
		gap: 20px;
		user-select: none;
		position: relative;
		z-index: 1000;
		width: 100%;
		z-index: 2000;
		&:hover {
			display: flex;
			flex-wrap: nowrap;
			justify-content: right;
			background-color: red;
		}
	}

	/// CONTAINERS
	.thread-info-container {
		display: flex;
		flex-direction: row;
		width: auto;
		margin-top: 0;
		margin-right: 4rem;
		position: relative;
		justify-content: space-between;
		align-items: flex-start;
		min-height: fit-content;
		overflow: visible;
		z-index: 2000;
	}
	.drawer-container {
		display: flex;
		flex-direction: column;
		margin-left: 64px;
		width: 400px;
		padding-left: 1rem;
		padding-right: 1rem;
		position: fixed;
		padding-top: 1rem;
		margin-right: 0;
		margin-left: 0;
		right: 0;
		left: 0;
		width: 100%;
	}
	.logo-container {
		display: none;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		height: auto;
		width: auto;
		position: relative;
		margin-left: auto;
		margin-right: auto;
		margin-top: 1rem;
		user-select: none;
		gap: 1rem;
		h2 {
			height: auto;
			font-size: 3rem;
		}
	}
	.logo {
		width: 60px;
		height: 60px;
		padding: 0;
	}

	.chat-container {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		position: fixed;
		transition: all 0.3s ease-in-out;
		overflow-y: hidden;
		overflow-x: hidden;
		// /* left: 20%; */
		width: 100%;
		// background: rgba(0, 0, 0, 0.2);
		top: auto;
		left: 0;
		right: 0;
		padding: 0;
		padding-top: 0;
		height: 100vh;
		margin-top: 0;
		margin-left: 0;
	}

	.chat-content {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		// background: var(--bg-gradient);
		justify-content: flex-start;
		align-items: center;
		width: auto !important;
		margin-top: 0.5rem !important;
		margin-left: 0.5rem !important;
		margin-right: 0.5rem;
		margin-bottom: 4rem;
		border: 1px solid var(--line-color);
		border-radius: 2rem;
		margin-top: 0;
		// animation: pulsateShadow 1.5s infinite alternate;
		// background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 50%);

		height: auto;
		// width: 50%;
		// margin: 0 1rem;
		// margin-left: 25%;
		// padding: 0 10px;
		overflow-y: hidden;
		overflow-x: hidden;
		transition: all ease 0.3s;
	}

	.avatar-container {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		justify-content: center;
		align-items: center;
		overflow: hidden;
		position: relative;
		background: var(--primary-color);
		display: flex;
		object-fit: cover;

		& .avatar,
		& .avatar-placeholder {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
		& .avatar-placeholder {
			display: flex;
			justify-content: center;
			align-items: center;
			background-color: #2c3e50;
			& svg {
				width: 20px;
				height: 20px;
				color: white;
			}
		}
	}

	.drawer-visible {
		& .btn-row {
			display: flex;
			flex-direction: row;
			justify-content: center;
			align-items: center;
			gap: 1rem;
			height: auto;
			// z-index: 8000;
			// background: var(--bg-gradient-r);
		}
		& .dashboard-scroll {
			justify-content: flex-start;
			align-items: flex-end;
			width: 100%;
			max-width: 1200px;
			margin-bottom: 0;
		}
		& .prompts {
			display: flex;
			align-items: flex-end;
			& span.prompt {
				font-size: 0.7rem;
			}
		}
		& span.start {
			align-items: flex-end;
			& h3 {
				font-size: 1.2rem;
			}
			& p {
				font-size: 1rem;
				text-align: right;
			}
		}
		& .submission {
			display: flex;
			flex-direction: column;
			gap: 1rem;
			width: 100%;
			height: auto;
			justify-content: flex-end;
			align-self: center;
			// padding: 0.5rem;
			transition: all 0.3s ease;
		}

		& .chat-content {
			margin-left: 0;
			top: 0;
			margin-top: 0;
			width: 100%;
			height: 100%;
		}
		& .chat-container {
			right: 0;
			margin-right: 0;
			width: auto;
			left: 250px;
		}
		& .chat-header {
			right: 0;
			margin-right: 0;
			width: 100%;
			left: 0;
		}
		& .chat-header-thread {
			margin-left: 0;
			left: 0;
			letter-spacing: 0;
			justify-content: center !important;
		}
		& .thread-info {
			margin-left: 0;
			margin-right: 0;
		}
	}

	.illustration {
		position: absolute;
		width: 95%;
		height: auto;
		left: 5%;
		top: 50%;
		transform: translateY(-50%);
		opacity: 0.015;
		z-index: 0;
		pointer-events: none;
	}

	.save-button {
		position: absolute;
		right: 2rem;
		top: 1rem;
		transition: all 0.3s ease;
	}

	.save-button:hover {
		color: #6fdfc4;
	}

	.button-row {
		display: flex;
		flex-direction: row;
	}

	.button-column {
		display: flex;
		flex-direction: column;
	}

	.message {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		font-weight: 200;
		padding: 1rem 1rem;
		gap: 1rem;
		margin-bottom: 1rem;
		width: auto;
		letter-spacing: 0.2rem;
		line-height: 1;
		transition: all 0.3s ease-in-out;

		& p {
			font-size: calc(0.5rem + 1vmin);
			margin: 0;
			display: flex;
			flex-direction: column;
			white-space: pre-wrap;
			overflow-wrap: break-word;
			word-wrap: break-word;
			hyphens: auto;
			text-align: left;
			height: fit-content;
			line-height: 1.5;
			// margin-left: 1rem;
			// margin-right: 1rem;
			// padding-left: 1rem;
			// margin-block-start: 1rem;
			// margin-block-end: 1rem;
		}
		&:hover::before {
			opacity: 0.8;
			background: radial-gradient(
				circle at center,
				rgba(255, 255, 255, 0.2) 0%,
				rgba(255, 255, 255, 0) 100%
			);
		}

		// &::before {
		//   content: '';
		//   position: absolute;
		//   top: 0;
		//   left: 0;
		//   right: 0;
		//   bottom: 0;
		//   background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
		//   opacity: 0.5;
		//   transition: opacity 0.3s ease;
		// }
		&.thinking {
			display: flex;
			flex-direction: column;
			align-self: center;
			align-items: center;
			text-align: center;
			justify-content: center;
			padding: 2rem;
			width: 100%;
			height: auto;
			font-style: italic;
			border-radius: 50px;
			transition: all 0.3s ease-in;

			& p {
				display: flex;
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
			width: fit-content;
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
			height: auto;
			margin-left: 0;
			// border-top: 2px solid var(--line-color);
			border-left: 2px solid var(--line-color);
			border-bottom: 1px solid transparent;
			border-radius: 0;
			max-width: 1000px;
			width: calc(100% - 2rem);
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
			&:hover {
				cursor: pointer;
				// backdrop-filter: blur(30px);
				// box-shadow: -100px -1px 100px 4px rgba(255, 255, 255, 0.2);
				background-color: var(--primary-color);
				// border: 1px solid var(--line-color);
				border-left: 2px solid var(--tertiary-color);
				// background: var(--primary-color) !important;
			}
			&:hidden {
				background-color: red;
			}
		}
	}
	.message-header + p + div > div {
		// border-left: 3px solid #546e7a;
		margin-left: 0;
		padding-left: 12px;
		color: var(--text-color);
		// Styles for the grid container divs
		// This targets the div that contains your code examples
	}

	.message p blockquote,
	.message p > blockquote {
		border-left: 3px solid #546e7a;
		margin-left: 0;
		padding-left: 12px;
		color: #b0bec5;
		font-style: italic;
	}

	/* Style for quoted text in user messages */
	.message.user p > blockquote {
		background-color: rgba(84, 110, 122, 0.1);
		padding: 6px 12px;
		border-radius: 4px;
		margin-bottom: 8px;
	}

	/* Format the quoted prefix in messages */
	.message p:has(> blockquote) + p,
	.message p blockquote + p {
		margin-top: 8px;
	}

	// Target code blocks inside these nested divs
	.message.assistant div div pre {
		// Code block styling
		margin: 0;
		padding: 10px;
		background-color: #f5f5f5 !important;
		border-radius: 4px;
		overflow-x: auto;
	}
	.selector-row {
		display: flex;
		flex-direction: row;
		justify-content: flex-end;
		position: absolute;
		bottom: 10px;
		right: 2rem;
		gap: 20px;

		width: auto;
		/* background-color: black; */
	}
	.options {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		margin-bottom: 20px;

		&button {
			padding: 12px;
			width: 100%;
			height: 100%;
			font-size: 14px;
			/* font-family: 'Roboto', sans-serif; */
			font-weight: 100;
			color: #000;
			background: linear-gradient(
				45deg,
				rgba(255, 255, 255, 0.8) 0%,
				rgba(128, 128, 128, 0.8) 100%
			);
			border: 1px solid #ddd;
			border-radius: 10px;
			cursor: pointer;
			transition: all 0.3s ease;
			text-align: left;
			word-wrap: break-word;
			font-size: calc(10px + 1vmin);
			line-height: 1.5;
			&:hover {
				background-color: #e0e0e0;
				transform: translateY(-2px);
			}
		}
	}
	.option-description {
		display: block;
		margin-bottom: 5px;
	}
	.option-id {
		display: block;
		font-size: 0.8em;
		color: #666;
	}

	.role {
		font-weight: bolder;
		align-self: center;
		justify-content: center;
		height: 100%;
	}

	.thread-actions {
		display: flex;
		flex-direction: row;
		width: 100%;
		margin-bottom: 0.5rem;
		border-radius: var(--radius-l);
	}

	.project-section {
		position: absolute;
		top: 3rem;
		left: 0;
		right: 0;
	}

	.toolbar-section {
		display: flex;
		gap: 0.5rem;
	}

	.button-label {
		display: flex;
		color: var(--placeholder-color);
	}
	@media (min-width: 640px) {
		.button-label {
			display: inline;
		}
	}

	span.filter-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: auto;
		height: 1.25rem;
		color: white;
		border-radius: 1rem;
		font-size: 0.75rem;
		font-weight: bold;
	}

	.user-dropdown {
		right: 0.5rem;
		left: auto;
	}

	.dropdown-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-color, #e2e8f0);
	}

	.dropdown-header h3 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.clear-button {
		background: transparent;
		border: none;
		color: var(--primary-color, #2563eb);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 0.75rem 1rem;
		border: none;
		background: transparent;
		text-align: left;
		cursor: pointer;
		gap: 0.5rem;
	}

	.dropdown-item:hover {
		background-color: var(--secondary-color);
	}

	.dropdown-item.selected {
		background-color: var(--tertiary-color);
	}

	.check-icon {
		margin-left: auto;
		color: var(--primary-color, #2563eb);
	}

	.no-users {
		padding: 1rem;
		text-align: center;
		color: var(--text-secondary, #64748b);
		font-size: 0.875rem;
	}

	.thread-group {
		display: flex;
		flex-direction: column;
		margin-bottom: var(--spacing-md);
		backdrop-filter: blur(20px);
		// border-radius: 10px;
		scrollbar-width: 1px;
		scrollbar-color: #c8c8c8 transparent;
		scroll-behavior: smooth;
		// backdrop-filter: blur(8px);
	}

	.thread-group-header {
		width: 100%;
		padding: 0.5rem 1rem;
		background: transparent;

		border: none;
		cursor: pointer;
		color: var(--text-color);
		text-align: left;
		display: flex;
		align-items: center;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
		transition: 0.1s cubic-bezier(0.075, 0.82, 0.165, 1);
		user-select: none;
		&:hover {
			background-color: var(--primary-color);
			font-weight: 800;
		}

		//   &:active {
		//     background-color: red;
		// }
	}
	// .thread-group-header:hover {

	//         // transform: scale(0.9);
	//         // letter-spacing: 4px;
	//         // width: calc(100% - 40px);
	//         // z-index: 10;
	//         // border-bottom-right-radius: 19px;
	//         // border-left: 40px solid rgb(169, 189, 209);
	//         // border-top: 4px solid rgb(129, 160, 190);
	//         // border-right: 1px solid black;
	//         // border-bottom: 20px solid rgb(80, 80, 80);
	//   }

	.group-icon {
		display: flex;
		justify-content: center;
	}
	.group-header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.5rem;
	}

	.group-title {
		font-weight: 400;
		font-size: 1rem;
		color: var(--placeholder-color);
		margin-right: 1rem;
	}

	.group-title-active {
		font-weight: 800;
		font-size: 1.1rem;
		color: var(--text-color);
		margin-bottom: 1rem;
		margin-right: 1rem;
	}

	.user-header {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		user-select: none;
	}

	.message-header {
		display: flex;
		flex-direction: row;
		margin-left: -2rem;
		margin-top: -2rem;
		justify-content: flex-start;
		align-items: center;
		width: 100%;
		gap: 1rem;

		&.assistant {
			margin-bottom: 0.5rem;
		}
	}

	.message-time {
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		color: var(--placeholder-color);
	}

	.thinking-animation {
		display: flex;
		flex-direction: row;
		justify-content: left;
		align-items: left;
		margin-top: 10px;

		span {
			width: 40px;
			height: 40px;
			margin: 0 5px;
			padding: 10px;
			background-color: transparent;
			animation: bounce 1s infinite ease-in-out both;

			&:nth-child(1) {
				animation-delay: -0.32s;
			}

			&:nth-child(2) {
				animation-delay: -0.16s;
			}
		}
	}
	.icon-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-color);

		:global(svg) {
			color: var(--primary-color);
			stroke: var(--primary-color);
			fill: var(--tertiary-color);
		}
	}

	.highlight {
		background-color: rgba(255, 255, 0, 0.3);
		border-radius: 3px;
		padding: 0 2px;
		font-weight: bold;
	}

	.drag-handle {
		width: 100%;
		height: 20px;
		background-color: transparent;
		border: none;
		cursor: ns-resize;
		display: flex;
		justify-content: center;
		align-items: center;
		color: #888;
	}

	.btn-col-left {
		display: flex;
		flex-direction: column;
		gap: 10px;
		position: fixed;
		left: 0;
		top: 60px;
		height: 94%;
		bottom: 1rem;
		width: auto;
		align-items: left;
		justify-content: flex-end;
		z-index: 10;
		border-radius: 1rem;
		padding: 0.5rem;
		transition: all 0.3s ease-in;
	}

	.btn-col-left:hover {
		backdrop-filter: blur(10px);
	}

	.input-row {
		display: flex;
		flex-direction: row;
		gap: 0.5rem;
		align-items: flex-start;
		width: 100%;
		position: relative;
	}
	.btn-row-right {
		display: flex;
		flex-direction: column;
		height: auto;
		transition: all 0.3s ease;
		z-index: 1000;
		& span {
			height: 100%;
			width: 100%;
			padding: 4px;
			justify-content: center;
			align-items: center;
			background-color: var(--primary-color);
			border-radius: 50%;
			transition: all 0.3s ease;
			&:hover {
				background-color: var(--tertiary-color);
				box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
			}
		}
		&.expanded {
			opacity: 1;
			bottom: 140px;
			gap: 1rem;
			right: 2rem;
			display: flex;

			& > * {
				display: flex;
			}
		}
		& > *:not(:last-child) {
			display: none;
		}

		&:hover {
			opacity: 1;
		}
	}

	.btn-mode {
		position: relative;
		bottom: 200px;
		right: 0;
	}

	.btn-send {
		position: relative;
		bottom: 20px;
		right: 0;
		border: 1px solid rgba(53, 63, 63, 0.5);
	}

	.btn-upload {
		position: relative;
		margin-bottom: 20px;
		right: 0;
		border: 1px solid rgba(53, 63, 63, 0.5);
	}

	// .auth-overlay {
	//   position: fixed;
	//   top: 0;
	//   left: 0;
	//   width: 100%;
	//   height: 100%;
	//   background-color: rgba(0, 0, 0, 0.5);
	//   display: flex;
	//   justify-content: center;
	//   align-items: center;
	//   z-index: 1000;
	// }

	.message-count {
		color: var(--placeholder-color);
	}

	.message-time {
		font-size: 0.8em;
		color: #888;
		width: auto;
		position: relative;
		// margin-top: 5px;
		right: auto;
	}

	.selector-lable {
		color: var(--text-color);
		opacity: 0.5;
		display: flex;
		margin: 0;
		padding: 0;
		font-size: 0.7rem;
		font-style: italic;
		font-weight: normal;
		text-align: left;
		display: flex;
		user-select: none;

		// margin-left: 0.5rem;
	}

	p.selector-lable {
		margin: 0 !important;
		padding: 0 !important;
		width: auto;
	}

	.landing-footer {
		display: flex;
		flex-direction: row;
		width: 98%;
		margin-left: 1%;
	}

	// .thread-name {
	//   display: flex;
	//   flex-direction: row;
	//   justify-content: left;
	//   align-items: center;
	//   gap: 1rem;

	// }

	/// Thread styles
	// .thread-info {
	//   display: flex;
	//   flex-direction: column;
	//   width: auto;
	//   height: auto !important;
	//   flex-wrap: nowrap;
	//   position: relative;
	//   transition: all 0.3s ease;
	//   z-index: 1000;
	//   margin: {
	//     left: 0;
	//     right: 25%;
	//   }
	//   overflow: {
	//     x: hidden;
	//     y: hidden;
	//   }
	//   color: white;
	//   left: auto;

	//   &.minimized {
	//     max-height: 50px;
	//     overflow: hidden;

	//     & h1 {
	//       font-size: 1em;
	//       margin: 0;
	//       padding: 10px 0;
	//       color: var(--text-color);
	//       &:hover {
	//         cursor:text;
	//         color: rgb(113, 249, 243);
	//       }
	//     }
	//   }

	//   & input {
	//     background-color: var(--secondary-color);
	//     border-bottom: 1px solid rgb(134, 134, 134);
	//     width: auto;
	//     border-radius: var(--radius-l);
	//     position: relative;
	//   }

	// }

	.thread-stats {
		display: flex;
		flex-direction: row;
		justify-content: flex-end;
		// align-items: center;
		/* position: absolute; */
		/* right: 2rem; */
		gap: 40px;
		/* width: 100%; */
		font-size: 0.9em;
		color: #666;
		font-size: 20px;
		margin-bottom: 10px;
	}

	button.action-btn {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		background: var(--bg-gradient-r) !important;
		color: var(--placeholder-color) !important;
		border-radius: 50%;
		box-shadow: 0 2px 10px rgba(255, 255, 255, 0.2);
		width: 2rem !important;
		height: 2rem;
		padding: 0.5rem;
		transition: all 0.1s ease;

		&.badge {
			padding: 0.5rem;
			gap: 0.5rem;
			height: 100%;
			display: flex;
			justify-content: center;
			border-radius: var(--radius-s);
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
			user-select: none;
			transition: all 0.2s ease;
		}
		&:hover {
			color: var(--tertiary-color) !important;
			&.delete {
				&:hover {
					color: red;
				}
			}
		}
	}

	.project-name-input {
		width: 200px;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
	}

	.thread-count {
		color: var(--text-secondary);
		font-size: 0.9em;
		color: var(--placeholder-color);
		&.active {
			color: var(--text-secondary);
			color: var(--text-color);
		}
	}
	.thread-message {
		font-size: var(--font-size-xs);
		color: var(--placeholder-color);
	}

	.thread-toggle {
		color: var(--text-color);
		background: var(--bg-gradient-right);
		font-size: 16px;
		border: none;
		cursor: pointer;
		border-radius: 20px;
		display: flex;
		justify-content: center;
		align-items: center;
		width: 50px;
		height: 50px;
		padding: 0.5rem;
		transition: all 0.3s ease-in-out;
		overflow: hidden;
		user-select: none;
	}

	.message-actions {
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.quote-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		margin-left: 10px;
	}

	.quoted-message {
		background-color: rgba(0, 0, 0, 0.1);
		border-left: 3px solid #888;
		padding: 5px 10px;
		margin-bottom: 5px;
		font-size: 0.9em;
		display: flex;
		align-items: center;
	}

	.quoted-message span {
		margin-left: 5px;
	}

	.message.typing::after {
		content: '▋';
		display: inline-block;
		vertical-align: bottom;
		animation: blink 0.7s infinite;
	}

	.drawer-visible .replies-container {
		max-height: 0;
		overflow: hidden;
		border: 1px solid transparent;
		padding: 0;
	}

	.replies-container.hidden {
		max-height: 0;
		overflow: hidden;
		border: 1px solid transparent;
		padding: 0;
		background: transparent;
		display: none;
	}
	.collapse-replies-btn {
		display: block;
		margin: 0.5rem 0;
		padding: 0.25rem 0.5rem;
		font-size: 0.8rem;
		background-color: transparent;
		border: 1px solid #ccc;
		border-radius: 4px;
		cursor: pointer;
	}

	.toggle-icon {
		margin-left: 0.25rem;
		font-size: auto;
		background: var(--primary-color);
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		justify-content: center;
		align-items: center;
		border-radius: 50%;
		border: 2px solid var(--bg-color);
	}

	/* Make sure hidden replies are actually hidden */
	.replies-container.hidden {
		display: none;
	}
	.reply-message {
		display: flex;
		margin-left: 0;
		padding: 1rem;
		padding-bottom: 0rem;

		&.assistant {
			&.assistant + div {
				padding-left: 1rem;
				margin-left: 0;

				& .reply-content {
					border: 1px solid transparent;
					border-left: 1px solid var(--line-color);
				}
			}
		}

		&.user {
			border-left: 1px solid var(--line-color);
			margin-left: 2rem;
			&.user + div {
				margin-left: 2rem;
				border-left: 1px solid var(--line-color);
			}

			& .reply-content {
				border: 1px solid transparent;
				border-left: 1px solid var(--line-color);
			}
		}
	}
	.reply-message[data-depth='1'] {
		margin-left: 20px;
	}
	.reply-message[data-depth='2'] {
		margin-left: 40px;
	}
	.reply-message[data-depth='3'] {
		margin-left: 60px;
	}
	.reply-message[data-depth='4'] {
		margin-left: 80px;
	}
	.reply-message[data-depth='5'] {
		margin-left: 100px;
	}

	.reply-indicator {
		border-left: 2px solid var(--line-color);
		margin-right: 12px;
	}

	.reply-content {
		border-radius: 0;
		margin-left: 1rem;
		margin-top: 1rem;
		border-left: 1px solid var(--line-color);
		backdrop-filter: blur(30px);
		// background-color: #2a2a2a;
		// background: var(--bg-gradient-r);
		backdrop-filter: blur(8px);
		flex-grow: 1;
		padding: 8px 12px;
	}

	.replies-indicator {
		display: flex;
		gap: 0.5rem;
		border-radius: 1rem;
		align-items: center;
		font-size: 1.2rem;
		padding: 0.5rem;
		transition: all 0.3s ease-in-out;
		& p {
			flex-direction: row;
			justify-content: center;
			align-items: center;
			width: auto;
			gap: 0;
			// display: none;
		}
		&:hover {
			& h3 {
				display: flex;
			}
		}
	}

	.reply-menu {
		background-color: #2a2a2a;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		padding: 10px;
		width: 280px;
		z-index: 1000;
	}

	.send-reply {
		background-color: #1976d2;
		border: none;
		border-radius: 6px;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8px;
		transition: background-color 0.2s ease;
	}

	.send-reply:hover {
		background-color: #1565c0;
	}

	.illustration {
		position: absolute;
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: auto;
		left: 0%;
		top: 60%;
		transform: translateY(-50%);
		opacity: 0.025;
		// z-index: 1;
		pointer-events: none;
		backdrop-filter: blur(20px);
	}

	.spinner-overlay {
		position: relative;
		height: 100vh !important;
		width: 100%;
		margin: 0 !important;
		padding: 0 !important;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		color: white;
		margin-bottom: 0;
		backdrop-filter: blur(20px) !important;
	}

	.spinner2 {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 60px;
		height: 60px;
		color: var(--tertiary-color);
		border: 5px dashed #363f3f;
		border-radius: 50%;
		position: relative;
		/* background-color: yellow; */
		animation: nonlinearSpin 4.2s infinite;
		animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
		&.naming {
			background: var(--bg-gradient);
			border-radius: var(--radius-m);
		}
	}

	.bot-icon {
		width: 50%;
		height: 50%;
		color: var(--primary-color);
	}

	.section-header-content {
		display: flex;
		align-items: center;
		width: 100%;
		h3 {
			margin-right: 0.5rem;
		}
	}
	.section-content-sysprompts {
		// width: calc(50% - 1rem);
		// margin-left: calc(50% - 1rem);
		width: 100% !important;

		height: auto;
		display: flex;
		margin-right: 0;
		position: relative;
		right: 0;
		justify-content: flex-end;
	}
	.section-content-collaborators {
		width: 100%;
		height: 50vh;
		overflow: hidden;
		padding: 0.5rem 1rem;
		// background: var(--bg-gradient-left);
		// border-radius: var(--radius-m);
	}

	.section-content-bookmark {
		width: 100%;
		height: 50vh;
		overflow: hidden;
		padding: 0.5rem 1rem;
		// background: var(--bg-gradient-left);
		// border-radius: var(--radius-m);
	}

	.section-content2 {
		width: 100%;
		overflow: hidden;
		padding: 0.5rem 1rem;
		// background: var(--bg-gradient-left);
		// border-radius: var(--radius-m);
	}

	.section-content {
		width: calc(100% - 2rem);
		display: flex;
		justify-content: center;
		align-items: flex-start;
		bottom: 0;
		max-height: 500px;

		// margin-right: 0;

		left: 0;
		right: 0;
		height: auto;
		position: relative;
		overflow: hidden;
		// padding: 0.5rem 1rem;
		scrollbar-width: 1px;
		scrollbar-color: var(--primary-color) transparent;
		scroll-behavior: smooth;
		// background: var(--bg-gradient-left);
		// border-radius: var(--radius-m);
	}

	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
		user-select: none;
		transition: color 0.2s ease;
		color: var(--placeholder-color);

		&.active {
			color: var(--tertiary-color);
		}

		&:hover {
			color: var(--tertiary-color);
		}
	}

	.ai-selector {
		display: flex;
		flex-direction: row;
		justify-content: center;
		// padding-left: 3rem;
		width: 100%;
		margin-left: 0;
		z-index: 9000;
	}

	.create-confirm {
		margin-left: 0.5rem;
		opacity: 0.6;
		transition: opacity 0.2s;
	}

	.create-confirm:not(:disabled):hover {
		opacity: 1;
	}

	@media (min-width: 1900px) {
	}
	@media (max-width: 1900px) {
		.thread-info {
			display: flex;
			flex-direction: column;
			width: auto;
			height: auto !important;
			flex-wrap: nowrap;
			position: relative;
			transition: all 0.3s ease;
			z-index: 1000;
			margin: {
				left: 0;
				right: 0;
			}
			overflow: {
				x: hidden;
				y: hidden;
			}
			color: white;
			left: auto;

			&.minimized {
				max-height: 50px;
				overflow: hidden;

				& h1 {
					font-size: 1em;
					margin: 0;
					padding: 10px 0;
					color: var(--text-color);
					&:hover {
						cursor: text;
						color: rgb(113, 249, 243);
					}
				}
			}

			& input {
				background-color: var(--secondary-color);
				border-bottom: 1px solid rgb(134, 134, 134);
				width: auto;
				border-radius: var(--radius-l);
				position: relative;
			}
		}

		.drawer-visible {
			.chat-container {
				right: 0;
				margin-right: 0;
				width: auto;
				margin-left: 0;
			}

			.chat-messages {
				margin-right: 0;
				right: 0;
				scroll-behavior: smooth;
				overflow-x: hidden;
				overflow-y: scroll;
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

			// &.input-container-start {
			//   margin-left: 3rem;
			// margin-right: 0;
			// width: auto;
			//   & textarea {
			//     border-top: 1px solid var(--primary-color) !important;
			// // max-height: 50vh;
			// margin-left: 0;
			// margin-top: 0;
			//   }
			// }
		}

		.chat-content {
			width: auto;
			margin-right: 0;
			margin-left: 0;
		}

		.chat-placeholder img {
			width: 150%;
			transform: translateX(2%) translateY(-20%);
		}
	}

	@media (max-width: 1000px) {
		.chat-header-thread {
			width: auto !important;
			margin-left: 0 !important;
			text-align: center;
			align-items: center !important;
			justify-content: center !important;
			backdrop-filter: none !important;

			left: 0;
			height: auto !important;
			margin-right: 0;
			margin-top: 0 !important;
			flex-grow: 1;
			h3 {
				line-height: 1.2;
				font-size: 0.8rem !important;
				letter-spacing: 0 !important;
				font-weight: 800 !important;
				color: var(--placeholder-color);

				display: flex;
			}
		}

		.chat-header {
			left: 0 !important;
			position: absolute;
			width: auto !important;
			border-bottom: none;
			// justify-content: space-between;
			// background: var(--bg-color);
			box-shadow: none;
			height: 2.5rem !important;
			top: 0.5rem !important;
			border-top-left-radius: 2rem;
			border-top-right-radius: 2rem;
			background: linear-gradient(
				to top,
				transparent 0%,
				rgba(255, 255, 255, 0.05) 90%,
				rgba(255, 255, 255, 0.05) 40%
			);
			backdrop-filter: blur(2px) !important;
			padding: 0 !important;
		}

		.chat-header-thread {
			margin-top: 0 !important;
			margin-left: 0 !important;
			margin-right: 1rem;
			justify-content: center !important;
			gap: 1rem;
			backdrop-filter: blur(10px);
			& span {
				width: auto;
			}
		}
		.drawer-visible .chat-header {
			justify-content: flex-end;
			align-items: flex-end;
			display: none;
		}
		.btn-col-left:hover {
			width: 96%;
		}

		.thread-toggle {
			bottom: 120px;
		}

		.date-divider {
			margin-right: 2rem;
		}

		.message.assistant {
			width: 100%; /* border: 1px solid black; */
		}

		.message.user {
			display: flex;
			flex-direction: column;
			align-self: center;
			color: var(--text-color);
			background-color: transparent;
			border-radius: var(--radius-m);
			height: auto;
			margin-right: 0;
			width: 100%;
			font-weight: 500;
			// background: var(--bg-color);
			border: {
				// top: 1px solid var(--primary-color);
				// left: 1px solid red;
			}
		}

		span.hero {
			margin-top: 0;
			top: auto;
			align-items: flex-end;
			margin-right: 2rem;
			& h3 {
				display: none;
			}
			& p {
				display: none;
			}
		}

		.dashboard-items {
			display: flex;
			flex-direction: row;
			height: auto;
			justify-content: center;
			align-items: flex-start;
			position: relative;
			// border-top: 1px solid var(--secondary-color);
			padding-inline-start: 2rem;
			left: 0;
			right: 0;
			padding: 0;
			gap: 1rem;
			width: 100%;
			margin-bottom: auto;
			margin-top: 0;
		}

		.chat-content {
			flex-grow: 1;
			display: flex;
			flex-direction: column;
			// background: var(--bg-gradient);
			justify-content: flex-start;
			// align-items: center;
			width: calc(100%) !important;
			margin-left: 0 !important;
			height: auto;
			margin-top: 0;
			margin-right: 1rem !important;
			height: auto;
			// width: 50%;
			// margin: 0 1rem;
			// margin-left: 25%;
			// padding: 0 10px;
			overflow-y: hidden;
			overflow-x: hidden;
			background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 60%);
			transition: all ease 0.3s;
		}

		.chat-messages {
			width: auto;
			margin-right: 0;
			margin-left: 0rem;
			right: 0;
			left: 0;
			padding-inline-start: 0;
			top: 2rem;
			width: 100% !important;
			border: 1px solid transparent !important;
			z-index: 0;
		}

		.thread-info input {
			background-color: var(--secondary-color);
			border-bottom: 1px solid rgb(134, 134, 134);
			width: auto;
			margin-left: 1rem;
			padding: 1rem;
			font-size: 24px;
			border-radius: var(--radius-l);
		}
		.card-container {
			display: flex;
			flex-direction: row;
			position: relative;
			width: 100%;
			margin-left: 0;
			margin-right: 0;
			padding: 0;
			cursor: pointer;

			&:hover {
				box-shadow: none;
				background: var(--secondary-color) !important;

				// background: rgba(226, 226, 226, 0.2);  /* Very subtle white for the glass effect */
				opacity: 1;
				visibility: visible;
				// box-shadow: -5px -1px 5px 4px rgba(255, 255, 255, 0.2);
			}
			&.selected {
				backdrop-filter: blur(30px);
				background: var(--tertiary-color);
			}
		}
		button.card-container {
			width: 100%;
			border-radius: 1rem;
			gap: 1rem;
			padding: 1rem;
		}

		.section-content {
			width: 94%;
			padding: 0;
			left: 1rem;
			margin-bottom: 2rem;
			z-index: 0;
			background: transparent;
		}

		.card-title {
			font-size: 1rem;
			font-style: bold;
		}

		.thread-group-header {
			font-size: 1rem;
		}

		.ai-selector {
			width: 100%;
			align-items: center;
			gap: 1rem;
			justify-content: flex-end;
			margin-right: 2rem;
			right: 2rem;
			padding: 0;
			position: relative;
		}

		.group-title {
			font-size: 1.2rem;
			font-style: bold;
		}

		.group-title-active {
			font-size: 1.5rem;
		}

		.thread-group {
			padding: 0.5rem;
			margin-left: 0;
		}

		h1 {
			font-size: 24px;
			font-weight: bold;
			margin-bottom: 16px;
			padding: 10px;
			border-radius: 5px;
		}

		.drawer-visible .chat-container {
			display: flex;
			z-index: -1;
			left: 250px !important;
			width: 100% !important;
		}
		.drawer-visible .thread-filtered-results {
			padding: 0;
			margin-left: 0;
			margin-right: 0;
			border-radius: 0 2rem 2rem 0;
			backdrop-filter: blur(10px);
			overflow-x: hidden;
			overflow-y: auto;

			&::-webkit-scrollbar {
				width: 0.5rem;
				background-color: transparent;
			}
			&::-webkit-scrollbar-thumb {
				background: var(--secondary-color);
				border-radius: 1rem;
			}
		}
		.drawer-visible .scroll-bottom-btn {
			display: none;
		}

		.drawer-visible .thread-toggle {
			left: 10px;
		}
	}
	@media (max-width: 450px) {
		.chat-messages {
			top: 2rem;
		}
		.drawer-visible .chat-content {
			border: 1px solid transparent;
		}

		.message {
			p {
				font-size: 0.9rem;
				letter-spacing: 0.1rem;
				line-height: 1.5;
			}
		}

		.button-label {
			display: flex;
			color: var(--placeholder-color);
		}

		button.toggle-btn {
			width: rem;
			height: 2rem;
			justify-content: center;
			align-items: center;
			&:hover {
				width: 2rem;
				height: 2rem;
			}
		}
		.chat-header {
			top: 3rem !important;
			left: 0 !important;
			height: 2rem !important;
			width: 100% !important;
			// display: none;
		}
		.chat-header-thread {
			margin-top: 0;
			margin-left: 0 !important;
			flex-direction: column;
			justify-content: center !important;
			align-items: flex-start !important;

			display: none !important;
			& span {
				width: auto;
			}
		}

		.scroll-bottom-btn {
			position: fixed;
			bottom: 10rem !important;
			right: 1rem;
			background-color: #21201d;
			color: white;
			border: 1px solid rgba(53, 63, 63, 0.5);
			border-radius: 50%;
			width: 2rem;
			height: 2rem;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			transition: background-color 0.3s;
			z-index: 6;
			align-self: flex-end;
			padding: 0.5rem;
			margin-right: 0;
			margin-bottom: 0;

			&:hover {
				background-color: #000000;
			}
		}

		.drawer-visible .chat-container {
			right: 0;
			margin-right: 0;
			width: auto;
			left: 300px !important;
		}

		.chat-container {
			padding: 0;
			top: 0;
			left: 0;
		}

		// .drawer-header:hover {
		//   // background-color: var(--hover-color);
		// }

		.section-header-content {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			width: 100%;
		}

		.drawer-header h3 {
			margin: 0;
			font-size: 1rem;
			font-weight: 600;
		}

		.section-content {
			width: 100%;
			overflow: hidden;
			padding: 0;
			margin-left: 0;
			margin-right: 0;
			// background: var(--bg-gradient-left);
			// border-radius: var(--radius-m);
		}

		.icon {
			display: flex;
			align-items: center;
		}
	}

	pre.code-block {
		position: relative;
		color: var(--code-color, #d4d4d4);
		border-radius: var(--radius-m, 0.375rem);
		padding: 1rem;
		margin: 1rem 0;
		overflow-x: auto;

		font-family: 'Fira Code', monospace;
		font-size: 0.9rem;
		line-height: 1.5;
		tab-size: 2;
	}

	/* Inline code styling */

	/* Copy button styling */
	.copy-code-button {
		position: absolute;
		background: red !important;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0.35rem;
		background-color: var(--button-bg, rgba(255, 255, 255, 0.1));
		border: none;
		border-radius: var(--radius-s, 0.25rem);
		color: var(--button-color, rgba(255, 255, 255, 0.6));
		cursor: pointer;
		opacity: 0;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	pre.code-block:hover .copy-code-button {
		opacity: 1;
		background-color: red;
	}

	.copy-code-button:hover {
		background-color: var(--button-hover-bg, rgba(255, 255, 255, 0.2));
		color: var(--button-hover-color, rgba(255, 255, 255, 0.8));
	}

	/* JSON syntax highlighting */
	.json-key {
		color: var(--json-key-color, #9cdcfe);
	}

	.json-string {
		color: var(--json-string-color, #ce9178);
	}

	.json-number {
		color: var(--json-number-color, #b5cea8);
	}

	.json-boolean {
		color: var(--json-boolean-color, #569cd6);
	}

	.json-null {
		color: var(--json-null-color, #569cd6);
	}

	.json-punctuation {
		color: var(--json-punctuation-color, #d4d4d4);
	}

	/* Visual feedback for copy operation */
	.copy-feedback {
		position: absolute;
		top: 3rem;
		right: 1rem;
		background-color: var(--feedback-bg, rgba(0, 0, 0, 0.7));
		color: var(--feedback-color, white);
		padding: 0.3rem 0.6rem;
		border-radius: var(--radius-s, 0.25rem);
		font-size: 0.8rem;
		pointer-events: none;
		opacity: 0;
		transform: translateY(-10px);
		transition: all 0.2s ease;
	}

	.copy-feedback.visible {
		opacity: 1;
		transform: translateY(0);
	}

	.text-preview-container {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px;
		background: var(--bg-color-light);
		border-radius: var(--border-radius);
		margin-bottom: 8px;
	}

	.text-preview-btn {
		flex: 1;
		padding: 8px 12px;
		background: var(--primary-color-light);
		color: var(--text-color);
		border: none;
		border-radius: var(--border-radius);
		cursor: pointer;
		text-align: left;
		transition: background 0.2s;
	}

	.text-preview-btn:hover {
		background: var(--primary-color);
	}

	.text-trash-btn {
		background: transparent;
		border: none;
		color: var(--text-color-muted);
		cursor: pointer;
		padding: 4px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.text-trash-btn:hover {
		color: var(--error-color);
		background: var(--error-color-light);
	}

	/* Modal Styles */
	.text-modal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal-content {
		background: var(--bg-color);
		border-radius: var(--border-radius-lg);
		width: 100%;

		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-lg);
	}

	.modal-header {
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-textarea {
		flex: 1;
		padding: 16px;
		border: none;
		resize: none;
		min-height: 200px;
		font-family: inherit;
		font-size: inherit;
		background: var(--bg-color-light);
	}

	.modal-footer {
		padding: 12px 16px;
		border-top: 1px solid var(--border-color);
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: var(--text-color-muted);
		cursor: pointer;
	}

	.close-btn:hover {
		color: var(--text-color);
	}
</style>

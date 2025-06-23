import { get } from 'svelte/store';
import { currentUser, ensureAuthenticated } from '$lib/pocketbase';
import { modelStore } from '$lib/stores/modelStore';
import { projectStore } from '$lib/stores/projectStore';
import { apiKey } from '$lib/stores/apiKeyStore';
import { pendingSuggestion } from '$lib/stores/suggestionStore';
import { threadsStore } from '$lib/stores/threadsStore';
import { messagesStore } from '$lib/stores/messagesStore';
import { threadListVisibility } from '$lib/clients/threadsClient';
import { enhanceCodeBlocks } from '$lib/features/ai/utils/markdownProcessor';
import { availableModels, defaultModel } from '$lib/features/ai/utils/models';
import { UserService } from '$lib/services/userService';
import { ThreadService } from '$lib/services/threadService';
import { PromptService } from '$lib/services/promptService';
import type {
	AIModel,
	ProviderType,
	InternalChatMessage,
	Messages,
	RoleType,
	Threads
} from '$lib/types/types';

interface LifecycleState {
	isAuthenticated: boolean;
	modelInitialized: boolean;
	projectSubscriptionInitialized: boolean;
	observer: MutationObserver | null;
	cleanupFunctions: (() => void)[];
}

export function useLifecycleManagement() {
	const state: LifecycleState = {
		isAuthenticated: false,
		modelInitialized: false,
		projectSubscriptionInitialized: false,
		observer: null,
		cleanupFunctions: []
	};

	/**
	 * Initializes the entire application
	 */
	async function initializeApp(
		textareaElement: HTMLTextAreaElement | null,
		chatMessagesDiv: HTMLDivElement | null,
		currentThreadId: string | null,
		aiModel: AIModel,
		setAiModel: (model: AIModel) => void,
		handleSendMessage: (message: string) => Promise<void>
	): Promise<void> {
		try {
			console.log('onMount initiated');

			// Authentication
			state.isAuthenticated = await ensureAuthenticated();

			// Wait a bit for the user to be set in the store
			let currentUserValue = get(currentUser);
			let retries = 0;
			while (!currentUserValue?.id && retries < 10) {
				await new Promise((resolve) => setTimeout(resolve, 100));
				currentUserValue = get(currentUser);
				retries++;
			}

			if (!currentUserValue?.id) {
				console.error('No authenticated user found after retries');
				return;
			}

			console.log('Current user:', currentUserValue);

			// Initialize user-related data
			await initializeUserData();

			// Initialize models
			if (!state.modelInitialized) {
				const initializedModel = await initializeModels(currentUserValue.id, aiModel);
				if (initializedModel) {
					setAiModel(initializedModel);
				}
				state.modelInitialized = true;
			}

			// Initialize projects and threads
			await initializeProjectsAndThreads(handleSendMessage);

			// Setup DOM observers and handlers
			setupDOMObservers(textareaElement, chatMessagesDiv);

			// Load thread-specific data if needed
			if (currentThreadId) {
				await loadThreadSpecificData(chatMessagesDiv);
			}
		} catch (error) {
			console.error('Error during app initialization:', error);
		}
	}

	/**
	 * Initializes user-related data
	 */
	async function initializeUserData(): Promise<void> {
		const currentUserValue = get(currentUser);
		if (!currentUserValue) return;

		try {
			// Load user avatar
			UserService.updateAvatarUrl();

			// Load user prompts
			await PromptService.loadUserPrompt();
		} catch (error) {
			console.error('Error initializing user data:', error);
		}
	}
	/**
	 * Initializes AI models for the user
	 */
	async function initializeModels(
		userId: string,
		currentAiModel: AIModel
	): Promise<AIModel | null> {
		try {
			console.log('Initializing models for user:', userId);
			await modelStore.initialize(userId);
			return currentAiModel;
		} catch (error) {
			console.error('Error initializing models:', error);

			// Fallback model selection
			if (!currentAiModel?.api_type) {
				await apiKey.ensureLoaded();
				const availableKeys = get(apiKey);
				const providersWithKeys = Object.keys(availableKeys).filter((p) => !!availableKeys[p]);
				const validProvider =
					providersWithKeys.length > 0 ? (providersWithKeys[0] as ProviderType) : 'deepseek';

				const fallbackModel =
					availableModels.find((m) => m.provider === validProvider) || defaultModel;
				console.log('Using fallback model after initialization error:', fallbackModel);
				return fallbackModel;
			}

			return currentAiModel;
		}
	}

	/**
	 * Initializes projects and threads
	 */
	async function initializeProjectsAndThreads(
		handleSendMessage: (message: string) => Promise<void>
	): Promise<void> {
		try {
			console.log('Loading initial thread data...');
			const currentProjectId = get(projectStore).currentProjectId;

			// Load projects if not loaded
			const projectStoreState = get(projectStore);
			if (projectStoreState.threads.length === 0) {
				console.log('Loading projects first...');
				await projectStore.loadProjects();

				// Handle pending suggestions
				const suggestion = get(pendingSuggestion);
				if (suggestion) {
					await handleSendMessage(suggestion);
					pendingSuggestion.set(null);
				}
			}

			if (currentProjectId) {
				console.log(`Project ${currentProjectId} selected, loading project threads`);
				await ThreadService.loadProjectThreads(currentProjectId);
			} else {
				console.log('No project selected, loading all threads including unassigned ones');
				// Load all threads including unassigned threads
				await ThreadService.loadProjectThreads();
			}
		} catch (error) {
			console.error('Error initializing projects and threads:', error);
		}
	}

	/**
	 * Sets up DOM observers and event handlers
	 */
	function setupDOMObservers(
		textareaElement: HTMLTextAreaElement | null,
		chatMessagesDiv: HTMLDivElement | null
	): void {
		// Setup textarea auto-resize
		if (textareaElement) {
			const adjustTextareaHeight = () => {
				if (!textareaElement) return;
				textareaElement.style.height = 'auto';
				textareaElement.style.height = `${textareaElement.scrollHeight}px`;
			};

			textareaElement.addEventListener('input', adjustTextareaHeight);
			state.cleanupFunctions.push(() => {
				textareaElement.removeEventListener('input', adjustTextareaHeight);
			});
		}

		// Setup chat messages observer
		if (chatMessagesDiv) {
			state.observer = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
						handleChatMutations(chatMessagesDiv);
					}
				});
			});

			state.observer.observe(chatMessagesDiv, {
				childList: true,
				subtree: true
			});
		}
	}

	/**
	 * Handles mutations in the chat messages container
	 */
	function handleChatMutations(chatMessagesDiv: HTMLDivElement): void {
		// Enhance code blocks in new messages
		const messageContents = chatMessagesDiv.querySelectorAll(
			'.message-content:not([data-processed="true"])'
		);

		messageContents.forEach((content) => {
			enhanceCodeBlocks(content as HTMLElement);
			content.setAttribute('data-processed', 'true');
		});

		// Auto-scroll if user is at bottom
		const { scrollTop, scrollHeight, clientHeight } = chatMessagesDiv;
		const scrollBottom = scrollTop + clientHeight;
		if (scrollHeight - scrollBottom < 100) {
			chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
		}
	}

	async function loadThreadSpecificData(chatMessagesDiv: HTMLDivElement | null): Promise<void> {
		try {
			// Get messages and convert them to InternalChatMessage format
			const messages = get(threadsStore).messages;
			if (messages?.length > 0) {
				// Convert Messages[] to InternalChatMessage[]
				const internalMessages: InternalChatMessage[] = messages.map((msg) =>
					convertToInternalChatMessage(msg)
				);
				await UserService.preloadUserProfilesBatch(internalMessages);
			}

			// Enhance existing code blocks
			if (chatMessagesDiv) {
				enhanceCodeBlocks(chatMessagesDiv);
			}
		} catch (error) {
			console.error('Error loading thread-specific data:', error);
		}
	}

	// Helper function to convert Messages to InternalChatMessage
	function convertToInternalChatMessage(message: Messages): InternalChatMessage {
		return {
			id: message.id,
			content: message.text, // Map text to content
			text: message.text,
			user: message.user,
			collectionId: message.collectionId,
			collectionName: message.collectionName,
			parent_msg: message.parent_msg,
			prompt_type: message.prompt_type,
			prompt_input: message.prompt_input,
			model: message.model,
			provider: 'openai' as ProviderType, // You may need to determine this from your data
			thread: message.thread,
			role: message.type === 'human' ? ('user' as RoleType) : ('assistant' as RoleType),
			created: message.created,
			updated: message.updated,
			// Optional properties with defaults
			reactions: {
				upvote: 0,
				downvote: 0,
				bookmark: [],
				highlight: [],
				question: 0
			}
		};
	}
	/**
	 * Sets up project store subscription
	 */
	function setupProjectSubscription(
		setCurrentProjectId: (id: string | null) => void,
		setIsEditingProjectName: (editing: boolean) => void,
		setEditedProjectName: (name: string) => void,
		loadThreads: (projectId: string | null) => Promise<void>,
		searchQuery: string
	): () => void {
		let isFirstCall = true;
		let lastProjectId: string | null = null;

		return projectStore.subscribe((state) => {
			// Skip the first subscription call (initialization)
			if (isFirstCall) {
				isFirstCall = false;
				lastProjectId = state.currentProjectId;
				setCurrentProjectId(state.currentProjectId);
				setIsEditingProjectName(state.isEditingProjectName);
				setEditedProjectName(state.editedProjectdName);
				return;
			}

			const newProjectId = state.currentProjectId;

			// Only handle change if project actually changed
			if (newProjectId !== lastProjectId) {
				console.log(`Project changed from ${lastProjectId} to ${newProjectId || 'none'}`);
				lastProjectId = newProjectId;
				handleProjectChange(newProjectId, loadThreads, searchQuery);
			}

			setCurrentProjectId(newProjectId);
			setIsEditingProjectName(state.isEditingProjectName);
			setEditedProjectName(state.editedProjectdName);
		});
	}

	/**
	 * Handles project changes
	 */
	async function handleProjectChange(
		newProjectId: string | null,
		loadThreads: (projectId: string | null) => Promise<void>,
		searchQuery: string
	): Promise<void> {
		try {
			// Load threads for new project
			await loadThreads(newProjectId);

			// Update threads in store after loading
			const storeThreads = get(threadsStore).threads;
			if (storeThreads) {
				const filteredThreads = storeThreads.filter(
					(thread) =>
						(newProjectId ? thread.project_id === newProjectId : true) &&
						(!searchQuery || thread.name?.toLowerCase().includes(searchQuery.toLowerCase()))
				);
				threadsStore.update((state) => ({ ...state, threads: filteredThreads }));
			}
		} catch (error) {
			console.error('Error handling project change:', error);
		}
	}

	/**
	 * Handles thread naming logic
	 */
	function handleThreadNaming(
		namingThreadId: string | null,
		currentThreadId: string | null,
		threads: Threads[]
	): void {
		if (!namingThreadId || currentThreadId !== namingThreadId) return;

		// Check if manual naming was recently done
		const manuallyNamed =
			typeof window !== 'undefined' &&
			window.localStorage.getItem(`thread_${currentThreadId}_manual_name`) === 'true';

		const timestamp =
			typeof window !== 'undefined' &&
			window.localStorage.getItem(`thread_${currentThreadId}_name_timestamp`);

		const isRecent = timestamp && Date.now() - parseInt(timestamp) < 10000; // 10 seconds

		// Skip auto-naming if manually named recently
		if (manuallyNamed && isRecent) {
			console.log('Skipping auto-naming because thread was manually named recently');
			threadsStore.update((state) => ({ ...state, namingThreadId: null }));
		} else {
			// Find and update current thread
			const currentThread = threads?.find((t) => t.id === currentThreadId) || null;
			if (currentThread) {
				threadsStore.update((state) => ({ ...state, namingThreadId: null }));
			}
		}
	}

	/**
	 * Cleanup function for all resources
	 */
	function cleanup(): void {
		// Disconnect observer
		if (state.observer) {
			state.observer.disconnect();
			state.observer = null;
		}

		// Run all cleanup functions
		state.cleanupFunctions.forEach((fn) => fn());
		state.cleanupFunctions = [];

		// Cleanup stores
		messagesStore.cleanup();
		threadListVisibility.set(false);

		// Clear URL parameters
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.delete('threadId');
			url.searchParams.delete('messageId');
			url.searchParams.delete('autoTrigger');
			window.history.replaceState({}, '', url);
		}

		// Reset state
		state.isAuthenticated = false;
		state.modelInitialized = false;
		state.projectSubscriptionInitialized = false;
	}

	/**
	 * Adds a cleanup function to be called on destroy
	 */
	function addCleanupFunction(fn: () => void): void {
		state.cleanupFunctions.push(fn);
	}

	return {
		initializeApp,
		setupProjectSubscription,
		handleThreadNaming,
		cleanup,
		addCleanupFunction,
		state
	};
}

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
import { debugApiKeys } from '$lib/clients/aiClient';
import { debugCompleteApiKeyFlow } from '$lib/stores/apiKeyStore';
import { getRuntimeDefaultModel, checkLocalServerAvailability } from '$lib/features/ai/utils/models';
import type { SelectableAIModel } from '$lib/types/types';

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
 * Enhanced initializeApp that prioritizes local models
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
		console.log('🎯 App initialization started with local model priority');
		await debugApiKeys();

		// Authentication
		state.isAuthenticated = await ensureAuthenticated();

		// Wait for user to be set in the store
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

		// PRIORITY: Check local models first
		console.log('🎯 Checking local models before API models...');
		const localModel = await checkAndInitializeLocalModels();
		
		if (localModel) {
			console.log('🎯 Local model available, setting as default:', localModel.name);
			
			// Convert to AIModel format
			const localAIModel: AIModel = {
				id: localModel.id,
				name: localModel.name,
				provider: 'local',
				api_key: '',
				base_url: 'http://localhost:11434',
				api_type: localModel.api_type || localModel.id,
				api_version: 'v1',
				description: localModel.description || '',
				user: [],
				created: new Date().toISOString(),
				updated: new Date().toISOString(),
				collectionId: 'local_models',
				collectionName: 'local_models'
			};
			
			setAiModel(localAIModel);
			
			// Set in model store
			if (currentUserValue?.id) {
				try {
					await modelStore.setSelectedProvider(currentUserValue.id, 'local');
					console.log('🎯 Set local provider in model store');
				} catch (error) {
					console.warn('Error setting local provider in store:', error);
				}
			}
		} else {
			// Fallback to API models initialization
			console.log('🎯 No local models, initializing API models...');
			if (!state.modelInitialized) {
				const initializedModel = await initializeModels(currentUserValue.id, aiModel);
				if (initializedModel) {
					setAiModel(initializedModel);
				}
				state.modelInitialized = true;
			}
		}

		// Initialize projects and threads
		await initializeProjectsAndThreads(handleSendMessage);

		// Setup DOM observers and handlers
		setupDOMObservers(textareaElement, chatMessagesDiv);

		// Load thread-specific data if needed
		if (currentThreadId) {
			await loadThreadSpecificData(chatMessagesDiv);
		}
		
		console.log('🎯 App initialization completed with model:', aiModel?.name);
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
 * Enhanced initializeModels function that prioritizes local models
 */
async function initializeModels(
	userId: string,
	currentAiModel: AIModel
): Promise<AIModel | null> {
	try {
		console.log('🎯 Initializing models for user:', userId);
		await debugCompleteApiKeyFlow();

		console.log('🔍 Ensuring API keys loaded in lifecycle...');
		await apiKey.ensureLoaded();

		// First priority: Check if local models are available
		console.log('🎯 Checking local model availability first...');
		const localAvailable = await checkLocalServerAvailability();
		
		if (localAvailable) {
			console.log('🎯 Local models available! Using local as primary option');
			
			// Get local runtime default
			try {
				const runtimeDefault = await getRuntimeDefaultModel();
				if (runtimeDefault.provider === 'local') {
					console.log('🎯 Using local runtime default model:', runtimeDefault.name);
					
					// Convert SelectableAIModel to AIModel for compatibility
					const localAIModel: AIModel = {
						id: runtimeDefault.id,
						name: runtimeDefault.name,
						provider: runtimeDefault.provider,
						api_key: '',
						base_url: 'http://localhost:11434',
						api_type: runtimeDefault.api_type || runtimeDefault.id,
						api_version: 'v1',
						description: runtimeDefault.description || '',
						user: [],
						created: new Date().toISOString(),
						updated: new Date().toISOString(),
						collectionId: 'local_models',
						collectionName: 'local_models'
					};
					
					// Set local provider in model store
					await modelStore.setSelectedProvider(userId, 'local');
					console.log('🎯 Set local provider in model store');
					
					return localAIModel;
				}
			} catch (error) {
				console.warn('Error getting local runtime default, falling back to API models:', error);
			}
		} else {
			console.log('🎯 Local models not available, checking API providers...');
		}

		// Second priority: API providers (only if local not available)
		const providers = ['deepseek', 'anthropic', 'grok', 'google', 'openai']; // deepseek first
		const availableProviders = providers.filter((provider) => apiKey.hasKey(provider));
		console.log('🔍 Lifecycle - Available API key providers:', availableProviders);

		// If no API keys and no local, can't initialize properly
		if (availableProviders.length === 0 && !localAvailable) {
			console.log('❌ No API keys and no local models available, using static default');
			return defaultModel;
		}

		// Load existing models from database
		await modelStore.loadModels(userId);

		// Get current state after loading
		let currentState: any = null;
		const unsubscribe = modelStore.subscribe((state) => {
			currentState = state;
		});
		unsubscribe();

		console.log('Loaded models from database:', currentState?.models?.length || 0);

		// FILTER MODELS BY AVAILABLE API KEYS (only for API providers)
		const validModels = (currentState?.models || []).filter((model: AIModel) => {
			if (model.provider === 'local') {
				// Local models are valid if local server is available
				return localAvailable;
			}
			
			const hasKey = availableProviders.includes(model.provider);
			if (!hasKey) {
				console.log(`🚫 Lifecycle filtering out ${model.name} - no key for ${model.provider}`);
			}
			return hasKey;
		});

		console.log('Valid models (including local):', validModels.length);

		// If we have local models and local is available, prioritize them
		const localModels = validModels.filter((m: AIModel) => m.provider === 'local');
		if (localModels.length > 0 && localAvailable) {
			console.log('🎯 Found valid local models, using first local model');
			const selectedLocal = localModels[0];
			await modelStore.setSelectedProvider(userId, 'local');
			return selectedLocal;
		}

		// Check if current AI model is valid
		let modelToUse: AIModel | null = null;

		if (currentAiModel?.id) {
			// For local models, check if local server is available
			if (currentAiModel.provider === 'local' && localAvailable) {
				modelToUse = currentAiModel;
				console.log('Current local model is valid:', modelToUse.id);
			} 
			// For API models, check if we have the API key
			else if (currentAiModel.provider !== 'local' && availableProviders.includes(currentAiModel.provider)) {
				modelToUse = validModels.find((m: AIModel) => m.id === currentAiModel.id) || null;
				console.log('Current API model is valid and found:', modelToUse?.id);
			}
		}

		if (!modelToUse) {
			// Priority order: local first, then preferred API providers
			const allPreferredProviders = localAvailable ? 
				['local', 'deepseek', 'anthropic', 'grok'] : 
				['deepseek', 'anthropic', 'grok'];

			for (const provider of allPreferredProviders) {
				let providerModels: AIModel[] = [];
				
				if (provider === 'local' && localAvailable) {
					providerModels = validModels.filter((m: AIModel) => m.provider === 'local');
				} else if (provider !== 'local' && availableProviders.includes(provider)) {
					providerModels = validModels.filter((m: AIModel) => m.provider === provider);
				}
				
				if (providerModels.length > 0) {
					modelToUse = providerModels[0];
					console.log(`🎯 Selected model from preferred provider ${provider}:`, modelToUse.name);
					break;
				}
			}
		}

		if (!modelToUse && validModels.length > 0) {
			// Use first valid model
			modelToUse = validModels[0];
			console.log('🎯 Using first valid model:', modelToUse.name);
		}

		if (modelToUse) {
			if (modelToUse.provider === 'local') {
				await modelStore.setSelectedProvider(userId, 'local');
			} else {
				await modelStore.setSelectedModel(userId, modelToUse);
			}
			return modelToUse;
		}

		// Final fallback to model store initialize
		console.log('🎯 No valid model found, using model store initialize as fallback');
		const initializedModel = await modelStore.initialize(userId);
		return initializedModel;
		
	} catch (error) {
		console.error('Error initializing models:', error);

		// Enhanced fallback: try local first, then API providers
		try {
			const localAvailable = await checkLocalServerAvailability();
			if (localAvailable) {
				console.log('🎯 Error fallback: using local model');
				const runtimeDefault = await getRuntimeDefaultModel();
				if (runtimeDefault.provider === 'local') {
					return {
						id: runtimeDefault.id,
						name: runtimeDefault.name,
						provider: 'local' as ProviderType,
						api_key: '',
						base_url: 'http://localhost:11434',
						api_type: runtimeDefault.api_type || runtimeDefault.id,
						api_version: 'v1',
						description: runtimeDefault.description || '',
						user: [],
						created: new Date().toISOString(),
						updated: new Date().toISOString(),
						collectionId: 'local_models',
						collectionName: 'local_models'
					};
				}
			}
		} catch (localError) {
			console.warn('Local fallback also failed:', localError);
		}

		// API fallback
		await apiKey.ensureLoaded();
		const availableProviders = ['deepseek', 'anthropic', 'grok', 'google', 'openai'].filter(
			(provider) => apiKey.hasKey(provider)
		);

		if (availableProviders.length > 0) {
			const validProvider = availableProviders[0] as ProviderType;
			const fallbackModel =
				availableModels.find((m) => m.provider === validProvider) || defaultModel;
			console.log('🎯 Using API fallback model after error:', fallbackModel.name);
			return fallbackModel;
		}

		return defaultModel;
	}
}
/**
 * Checks and initializes local models if available
 */
async function checkAndInitializeLocalModels(): Promise<SelectableAIModel | null> {
	try {
		console.log('🎯 Checking for local models...');
		
		const response = await fetch('/api/ai/local/models');
		const result = await response.json();
		
		if (result.success && result.data?.models?.length > 0) {
			console.log('🎯 Local models found:', result.data.models.length);
			
			// Return the first available local model
			const firstModel = result.data.models[0];
			return {
				id: firstModel.api_type,
				name: firstModel.name,
				provider: 'local' as ProviderType,
				api_type: firstModel.api_type,
				description: `${firstModel.parameters} - ${firstModel.families?.join(', ') || 'Local Model'}`,
				parameters: firstModel.parameters,
				size: firstModel.size
			};
		}
		
		return null;
	} catch (error) {
		console.log('🎯 Local models not available:', error);
		return null;
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
			provider: 'openai' as ProviderType,
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

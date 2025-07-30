import { writable, derived } from 'svelte/store';
import type { ExpandedSections } from '$lib/types/types';

interface UIState {
	// Expanded sections
	expandedSections: ExpandedSections;

	// Visibility states
	showSysPrompt: boolean;
	showPromptCatalog: boolean;
	showModelSelector: boolean;
	showCollaborators: boolean;
	showBookmarks: boolean;
	showCites: boolean;
	showAgentPicker: boolean;
	showNetworkVisualization: boolean;
	showSortOptions: boolean;
	showUserFilter: boolean;
	showDeleteModal: boolean;
	showTextModal: boolean;
	showFavoriteThreads: boolean;
	showFavoriteThreadTooltip: boolean;

	// Loading states
	isLoading: boolean;
	isLoadingFavorites: boolean;
	isLoadingThreads: boolean;
	isLoadingProject: boolean;
	isLoadingPrompt: boolean;
	isUpdatingModel: boolean;
	isUpdatingThreadName: boolean;
	isProcessingPromptClick: boolean;

	// Focus and interaction states
	isSubmissionAreaActive: boolean;
	isFocused: boolean;
	isMinimized: boolean;
	isExpanded: boolean;
	isDragging: boolean;
	isUserScrolling: boolean;
	isAtBottom: boolean;
	isCleaningUp: boolean;

	// Project and thread editing states
	isEditingThreadName: boolean;
	isEditingProjectName: boolean;
	isCreatingThread: boolean;
	isCreatingProject: boolean;

	// Layout states
	isThreadListVisible: boolean;
	isProjectListVisible: boolean;

	// Text and content states
	textTooLong: boolean;
	currentPlaceholder: string;
	currentManualPlaceholder: string;
	favoriteThreadTooltipText: string;

	// Counters and metrics
	scrollPercentage: number;
	userScrollPosition: number;
	lastScrollTop: number;
	currentPage: number;

	// Hover states
	createHovered: boolean;
	searchHovered: boolean;
	favoritesHovered: boolean;

	// Selection and editing
	editedThreadName: string;
	editedProjectName: string;
	editingProjectId: string | null;
	searchQuery: string;
	bookmarkId: string;
}

const initialUIState: UIState = {
	// Expanded sections
	expandedSections: {
		prompts: false,
		sysprompts: false,
		models: false,
		bookmarks: false,
		cites: false,
		collaborators: false
	},

	// Visibility states
	showSysPrompt: false,
	showPromptCatalog: false,
	showModelSelector: false,
	showCollaborators: false,
	showBookmarks: false,
	showCites: false,
	showAgentPicker: false,
	showNetworkVisualization: false,
	showSortOptions: false,
	showUserFilter: false,
	showDeleteModal: false,
	showTextModal: false,
	showFavoriteThreads: false,
	showFavoriteThreadTooltip: false,

	// Loading states
	isLoading: false,
	isLoadingFavorites: false,
	isLoadingThreads: false,
	isLoadingProject: false,
	isLoadingPrompt: true,
	isUpdatingModel: false,
	isUpdatingThreadName: false,
	isProcessingPromptClick: false,

	// Focus and interaction states
	isSubmissionAreaActive: false,
	isFocused: false,
	isMinimized: false,
	isExpanded: false,
	isDragging: false,
	isUserScrolling: false,
	isAtBottom: true,
	isCleaningUp: false,

	// Project and thread editing states
	isEditingThreadName: false,
	isEditingProjectName: false,
	isCreatingThread: false,
	isCreatingProject: false,

	// Layout states
	isThreadListVisible: true,
	isProjectListVisible: false,

	// Text and content states
	textTooLong: false,
	currentPlaceholder: '',
	currentManualPlaceholder: '',
	favoriteThreadTooltipText: '',

	// Counters and metrics
	scrollPercentage: 0,
	userScrollPosition: 0,
	lastScrollTop: 0,
	currentPage: 1,

	// Hover states
	createHovered: false,
	searchHovered: false,
	favoritesHovered: false,

	// Selection and editing
	editedThreadName: '',
	editedProjectName: '',
	editingProjectId: null,
	searchQuery: '',
	bookmarkId: ''
};

// Create collapsed sections object for reuse
const collapsedSections: ExpandedSections = {
	prompts: false,
	sysprompts: false,
	models: false,
	bookmarks: false,
	cites: false,
	collaborators: false
};

function createUIStore() {
	const { subscribe, set, update } = writable<UIState>(initialUIState);

	// Helper function to collapse sections when needed
	const collapseExpandedSections = (state: UIState): UIState => ({
		...state,
		expandedSections: { ...collapsedSections }
	});

	return {
		subscribe,
		set,
		update,

		// Expanded sections
		toggleSection: (section: keyof ExpandedSections) => {
			update((state) => {
				const isCurrentlyExpanded = state.expandedSections[section];

				return {
					...state,
					expandedSections: {
						...collapsedSections,
						[section]: !isCurrentlyExpanded
					}
				};
			});
		},

		closeAllSections: () => {
			update((state) => ({
				...state,
				expandedSections: { ...collapsedSections }
			}));
		},

		// Visibility toggles
		togglePromptCatalog: () => {
			update((state) => ({ ...state, showPromptCatalog: !state.showPromptCatalog }));
		},

		toggleModelSelector: () => {
			update((state) => ({ ...state, showModelSelector: !state.showModelSelector }));
		},

		toggleCollaborators: () => {
			update((state) => ({ ...state, showCollaborators: !state.showCollaborators }));
		},

		toggleBookmarks: () => {
			update((state) => ({ ...state, showBookmarks: !state.showBookmarks }));
		},

		toggleCites: () => {
			update((state) => ({ ...state, showCites: !state.showCites }));
		},

		// Set specific visibility states
		setPromptCatalog: (show: boolean) => {
			update((state) => ({ ...state, showPromptCatalog: show }));
		},

		setSysPrompt: (show: boolean) => {
			update((state) => ({ ...state, showSysPrompt: show }));
		},

		setModelSelector: (show: boolean) => {
			update((state) => ({ ...state, showModelSelector: show }));
		},

		setCollaborators: (show: boolean) => {
			update((state) => ({ ...state, showCollaborators: show }));
		},

		setShowTextModal: (show: boolean) => {
			update((state) => ({ ...state, showTextModal: show }));
		},

		setBookmarks: (show: boolean) => {
			update((state) => ({ ...state, showBookmarks: show }));
		},

		setCites: (show: boolean) => {
			update((state) => ({ ...state, showCites: show }));
		},

		// Loading states with automatic section closing
		setLoading: (isLoading: boolean) => {
			update((state) => ({ ...state, isLoading }));
		},

		setLoadingFavorites: (isLoading: boolean) => {
			update((state) => ({ ...state, isLoadingFavorites: isLoading }));
		},

		setLoadingThreads: (isLoading: boolean) => {
			update((state) => {
				const updatedState = { ...state, isLoadingThreads: isLoading };
				// Close expanded sections when threads start loading
				return isLoading ? collapseExpandedSections(updatedState) : updatedState;
			});
		},

		setLoadingProject: (isLoading: boolean) => {
			update((state) => {
				const updatedState = { ...state, isLoadingProject: isLoading };
				// Close expanded sections when project starts loading
				return isLoading ? collapseExpandedSections(updatedState) : updatedState;
			});
		},

		setLoadingPrompt: (isLoading: boolean) => {
			update((state) => ({ ...state, isLoadingPrompt: isLoading }));
		},

		// Enhanced thread creation with section closing
		setCreatingThread: (isCreating: boolean) => {
			update((state) => {
				const updatedState = { ...state, isCreatingThread: isCreating };
				// Close expanded sections when thread creation starts
				return isCreating ? collapseExpandedSections(updatedState) : updatedState;
			});
		},

		// Enhanced project creation with section closing
		setCreatingProject: (isCreating: boolean) => {
			update((state) => {
				const updatedState = { ...state, isCreatingProject: isCreating };
				// Close expanded sections when project creation starts
				return isCreating ? collapseExpandedSections(updatedState) : updatedState;
			});
		},

		// Editing states
		setEditingThreadName: (isEditing: boolean, threadName: string = '') => {
			update((state) => ({
				...state,
				isEditingThreadName: isEditing,
				editedThreadName: threadName
			}));
		},

		setEditingProjectName: (
			isEditing: boolean,
			projectId: string | null = null,
			projectName: string = ''
		) => {
			update((state) => ({
				...state,
				isEditingProjectName: isEditing,
				editingProjectId: projectId,
				editedProjectName: projectName
			}));
		},

		// Layout states
		setThreadListVisibility: (visible: boolean) => {
			update((state) => ({ ...state, isThreadListVisible: visible }));
		},

		setProjectListVisibility: (visible: boolean) => {
			update((state) => ({ ...state, isProjectListVisible: visible }));
		},

		// Search and filtering
		setSearchQuery: (query: string) => {
			update((state) => ({ ...state, searchQuery: query }));
		},

		// Scroll management
		setScrollPosition: (position: number) => {
			update((state) => ({ ...state, userScrollPosition: position }));
		},

		setScrollPercentage: (percentage: number) => {
			update((state) => ({ ...state, scrollPercentage: percentage }));
		},

		setAtBottom: (atBottom: boolean) => {
			update((state) => ({ ...state, isAtBottom: atBottom }));
		},

		// Hover states
		setCreateHovered: (hovered: boolean) => {
			update((state) => ({ ...state, createHovered: hovered }));
		},

		setSearchHovered: (hovered: boolean) => {
			update((state) => ({ ...state, searchHovered: hovered }));
		},

		setCurrentPlaceholder: (placeholder: string) => {
			update((state) => ({ ...state, currentPlaceholder: placeholder }));
		},

		setProcessingPromptClick: (isProcessing: boolean) => {
			update((state) => ({ ...state, isProcessingPromptClick: isProcessing }));
		},

		setExpandedSectionExclusive: (section: keyof ExpandedSections, value: boolean) => {
			update((state) => ({
				...state,
				expandedSections: {
					...collapsedSections,
					[section]: value
				}
			}));
		},

		// Reset operations
		reset: () => {
			set(initialUIState);
		},

		// Bulk operations for focus handling
		closeAllInputRelatedSections: () => {
			update((state) => ({
				...state,
				showPromptCatalog: false,
				showSysPrompt: false,
				showModelSelector: false,
				showBookmarks: false,
				showCites: false,
				showCollaborators: false
			}));
		},

		// NEW: Batch operations for better performance
		setBatchLoadingState: (
			isLoadingThreads: boolean,
			isLoadingProject: boolean,
			isCreatingThread: boolean = false
		) => {
			update((state) => {
				let updatedState = {
					...state,
					isLoadingThreads,
					isLoadingProject,
					isCreatingThread
				};

				// Close sections if any loading/creating operation is starting
				if (isLoadingThreads || isLoadingProject || isCreatingThread) {
					updatedState = collapseExpandedSections(updatedState);
				}

				return updatedState;
			});
		},

		// NEW: Smart section management
		handleThreadOperation: (operation: 'loading' | 'creating' | 'editing', state: boolean) => {
			update((currentState) => {
				const updates: Partial<UIState> = {};

				switch (operation) {
					case 'loading':
						updates.isLoadingThreads = state;
						break;
					case 'creating':
						updates.isCreatingThread = state;
						break;
					case 'editing':
						updates.isEditingThreadName = state;
						break;
				}

				const updatedState = { ...currentState, ...updates };

				// Close expanded sections when starting any thread operation
				return state ? collapseExpandedSections(updatedState) : updatedState;
			});
		}
	};
}

export const uiStore = createUIStore();

// Optimized derived stores with memoization
export const expandedSections = derived(uiStore, ($store) => $store.expandedSections);
export const showPromptCatalog = derived(uiStore, ($store) => $store.showPromptCatalog);
export const showModelSelector = derived(uiStore, ($store) => $store.showModelSelector);
export const showCollaborators = derived(uiStore, ($store) => $store.showCollaborators);
export const showBookmarks = derived(uiStore, ($store) => $store.showBookmarks);
export const showCites = derived(uiStore, ($store) => $store.showCites);
export const showSysPrompt = derived(uiStore, ($store) => $store.showSysPrompt);
export const showAgentPicker = derived(uiStore, ($store) => $store.showAgentPicker);
export const showNetworkVisualization = derived(
	uiStore,
	($store) => $store.showNetworkVisualization
);
export const isLoading = derived(uiStore, ($store) => $store.isLoading);
export const isEditingThreadName = derived(uiStore, ($store) => $store.isEditingThreadName);
export const isEditingProjectName = derived(uiStore, ($store) => $store.isEditingProjectName);
export const isCreatingThread = derived(uiStore, ($store) => $store.isCreatingThread);
export const isCreatingProject = derived(uiStore, ($store) => $store.isCreatingProject);
export const searchQuery = derived(uiStore, ($store) => $store.searchQuery);
export const isThreadListVisible = derived(uiStore, ($store) => $store.isThreadListVisible);
export const isProjectListVisible = derived(uiStore, ($store) => $store.isProjectListVisible);
export const showFavoriteThreads = derived(uiStore, ($store) => $store.showFavoriteThreads);
export const currentPlaceholder = derived(uiStore, ($store) => $store.currentPlaceholder);
export const isProcessingPromptClick = derived(uiStore, ($store) => $store.isProcessingPromptClick);
export const createHovered = derived(uiStore, ($store) => $store.createHovered);
export const searchHovered = derived(uiStore, ($store) => $store.searchHovered);
export const favoritesHovered = derived(uiStore, ($store) => $store.favoritesHovered);
export const showTextModal = derived(uiStore, ($store) => $store.showTextModal);
export const textTooLong = derived(uiStore, ($store) => $store.textTooLong);

// NEW: Derived stores for loading states
export const isLoadingThreads = derived(uiStore, ($store) => $store.isLoadingThreads);
export const isLoadingProject = derived(uiStore, ($store) => $store.isLoadingProject);

// NEW: Composite derived stores for better performance
export const isAnyLoading = derived(
	uiStore,
	($store) =>
		$store.isLoading ||
		$store.isLoadingThreads ||
		$store.isLoadingProject ||
		$store.isCreatingThread ||
		$store.isCreatingProject
);

export const hasAnyExpandedSection = derived(expandedSections, ($sections) =>
	Object.values($sections).some(Boolean)
);

export const isInEditMode = derived(
	uiStore,
	($store) => $store.isEditingThreadName || $store.isEditingProjectName
);

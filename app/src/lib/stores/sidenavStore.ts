import { writable, derived } from 'svelte/store';

interface SidenavState {
	showSidenav: boolean;
	showInput: boolean;
	showRightSidenav: boolean;
	showFilters: boolean;
	showOverlay: boolean;
	showSettings: boolean;
	showExplorer: boolean;
	showEditor: boolean;
	showSearch: boolean;
	showDebug: boolean;
	showThreadList: boolean;
}

function createSidenavStore() {
	const { subscribe, update } = writable<SidenavState>({
		showSidenav: false,
		showInput: false,
		showRightSidenav: false,
		showFilters: false,
		showOverlay: false,
		showSettings: false,
		showExplorer: false,
		showEditor: false,
		showSearch: false,
		showDebug: false,
		showThreadList: false
	});

	return {
		subscribe,

		showLeft: () => update((state) => ({ ...state, showSidenav: true })),
		hideLeft: () => update((state) => ({ ...state, showSidenav: false })),
		toggleLeft: () => update((state) => ({ ...state, showSidenav: !state.showSidenav })),

		showInput: () => update((state) => ({ ...state, showInput: true })),
		hideInput: () => update((state) => ({ ...state, showInput: false })),
		toggleInput: () => update((state) => ({ ...state, showInput: !state.showInput })),

		showRight: () => update((state) => ({ ...state, showRightSidenav: true })),
		hideRight: () => update((state) => ({ ...state, showRightSidenav: false })),
		toggleRight: () => update((state) => ({ ...state, showRightSidenav: !state.showRightSidenav })),

		showFilters: () => update((state) => ({ ...state, showFilters: true })),
		hideFilters: () => update((state) => ({ ...state, showFilters: false })),
		toggleFilters: () => update((state) => ({ ...state, showFilters: !state.showFilters })),

		showOverlay: () => update((state) => ({ ...state, showOverlay: true })),
		hideOverlay: () => update((state) => ({ ...state, showOverlay: false })),
		toggleOverlay: () => update((state) => ({ ...state, showOverlay: !state.showOverlay })),

		showSettings: () => update((state) => ({ ...state, showSettings: true })),
		hideSettings: () => update((state) => ({ ...state, showSettings: false })),
		toggleSettings: () => update((state) => ({ ...state, showSettings: !state.showSettings })),

		showEditor: () => update((state) => ({ ...state, showEditor: true })),
		hideEditor: () => update((state) => ({ ...state, showEditor: false })),
		toggleEditor: () => update((state) => ({ ...state, showEditor: !state.showEditor })),

		showExplorer: () => update((state) => ({ ...state, showExplorer: true })),
		hideExplorer: () => update((state) => ({ ...state, showExplorer: false })),
		toggleExplorer: () => update((state) => ({ ...state, showExplorer: !state.showExplorer })),

		showSearch: () => update((state) => ({ ...state, showSearch: true })),
		hideSearch: () => update((state) => ({ ...state, showSearch: false })),
		toggleSearch: () => update((state) => ({ ...state, showSearch: !state.showSearch })),

		showDebug: () => update((state) => ({ ...state, showDebug: true })),
		hideDebug: () => update((state) => ({ ...state, showDebug: false })),
		toggleDebug: () => update((state) => ({ ...state, showDebug: !state.showDebug })),

		showThreadList: () => update((state) => ({ ...state, showThreadList: true })),
		hideThreadList: () => update((state) => ({ ...state, showThreadList: false })),
		toggleThreadList: () =>
			update((state) => ({ ...state, showThreadList: !state.showThreadList })),

		// Legacy methods (for backward compatibility)
		show: () => update((state) => ({ ...state, showSidenav: true })),
		hide: () => update((state) => ({ ...state, showSidenav: false })),
		toggle: () => update((state) => ({ ...state, showSidenav: !state.showSidenav })),
		set: (value: boolean) => update((state) => ({ ...state, showSidenav: value })),

		// Utility methods
		closeAll: () =>
			update(() => ({
				showSidenav: false,
				showInput: false,
				showRightSidenav: false,
				showFilters: false,
				showOverlay: false,
				showSettings: false,
				showEditor: false,
				showExplorer: false,
				showSearch: false,
				showDebug: false,
				showThreadList: false
			})),
		setLeft: (value: boolean) => update((state) => ({ ...state, showSidenav: value })),
		setInput: (value: boolean) => update((state) => ({ ...state, showInput: value })),
		setRight: (value: boolean) => update((state) => ({ ...state, showRightSidenav: value })),
		setFilters: (value: boolean) => update((state) => ({ ...state, showFilters: value })),
		setOverlay: (value: boolean) => update((state) => ({ ...state, showOverlay: value })),
		setSettings: (value: boolean) => update((state) => ({ ...state, showSettings: value })),
		setEditor: (value: boolean) => update((state) => ({ ...state, showEditor: value })),
		setExplorer: (value: boolean) => update((state) => ({ ...state, showExplorer: value })),
		setSearch: (value: boolean) => update((state) => ({ ...state, showSearch: value })),
		setDebug: (value: boolean) => update((state) => ({ ...state, showDebug: value })),
		setThreadList: (value: boolean) => update((state) => ({ ...state, showThreadList: value }))
	};
}

export const sidenavStore = createSidenavStore();

// Derived stores for convenience
export const showSidenav = derived(sidenavStore, ($store) => $store.showSidenav);
export const showInput = derived(sidenavStore, ($store) => $store.showInput);
export const showRightSidenav = derived(sidenavStore, ($store) => $store.showRightSidenav);
export const showFilters = derived(sidenavStore, ($store) => $store.showFilters);
export const showOverlay = derived(sidenavStore, ($store) => $store.showOverlay);
export const showSettings = derived(sidenavStore, ($store) => $store.showSettings);
export const showEditor = derived(sidenavStore, ($store) => $store.showEditor);
export const showExplorer = derived(sidenavStore, ($store) => $store.showExplorer);
export const showSearch = derived(sidenavStore, ($store) => $store.showSearch);
export const showDebug = derived(sidenavStore, ($store) => $store.showDebug);
export const showThreadList = derived(sidenavStore, ($store) => $store.showThreadList);

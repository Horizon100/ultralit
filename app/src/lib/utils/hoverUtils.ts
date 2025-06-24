import { writable } from 'svelte/store';
import { sidenavStore } from '$lib/stores/sidenavStore';

export interface HoverConfig {
	hoverZone: number; // Width/height of the hover zone in pixels
	minScreenWidth: number; // Minimum screen width for hover to be active
	debounceDelay?: number; // Delay before triggering hover actions
	controls: Array<keyof SidenavControls>; // Which sidebars to control
	direction?: 'left' | 'right' | 'top' | 'bottom'; // Direction of hover detection
	extendedZone?: number; // Extended zone size when condition is met
	extendCondition?: () => boolean; // Condition to check for extended zone
}

export interface HoverState {
	isHovering: boolean;
	isOpenedByToggle: boolean;
}

// Map of all available sidenav controls
export interface SidenavControls {
	sidenav: { show: () => void; hide: () => void; toggle: () => void };
	input: { show: () => void; hide: () => void; toggle: () => void };
	rightSidenav: { show: () => void; hide: () => void; toggle: () => void };
	filters: { show: () => void; hide: () => void; toggle: () => void };
	overlay: { show: () => void; hide: () => void; toggle: () => void };
	settings: { show: () => void; hide: () => void; toggle: () => void };
	explorer: { show: () => void; hide: () => void; toggle: () => void };
	editor: { show: () => void; hide: () => void; toggle: () => void };
	search: { show: () => void; hide: () => void; toggle: () => void };
}

// Create mapping of control names to store methods
const sidenavControls: SidenavControls = {
	sidenav: {
		show: () => sidenavStore.showLeft(),
		hide: () => sidenavStore.hideLeft(),
		toggle: () => sidenavStore.toggleLeft()
	},
	input: {
		show: () => sidenavStore.showInput(),
		hide: () => sidenavStore.hideInput(),
		toggle: () => sidenavStore.toggleInput()
	},
	rightSidenav: {
		show: () => sidenavStore.showRight(),
		hide: () => sidenavStore.hideRight(),
		toggle: () => sidenavStore.toggleRight()
	},
	filters: {
		show: () => sidenavStore.showFilters(),
		hide: () => sidenavStore.hideFilters(),
		toggle: () => sidenavStore.toggleFilters()
	},
	overlay: {
		show: () => sidenavStore.showOverlay(),
		hide: () => sidenavStore.hideOverlay(),
		toggle: () => sidenavStore.toggleOverlay()
	},
	settings: {
		show: () => sidenavStore.showSettings(),
		hide: () => sidenavStore.hideSettings(),
		toggle: () => sidenavStore.toggleSettings()
	},
	explorer: {
		show: () => sidenavStore.showExplorer(),
		hide: () => sidenavStore.hideExplorer(),
		toggle: () => sidenavStore.toggleExplorer()
	},
	editor: {
		show: () => sidenavStore.showEditor(),
		hide: () => sidenavStore.hideEditor(),
		toggle: () => sidenavStore.toggleEditor()
	},
	search: {
		show: () => sidenavStore.showSearch(),
		hide: () => sidenavStore.hideSearch(),
		toggle: () => sidenavStore.toggleSearch()
	}
};

export function createHoverManager(config: HoverConfig) {
	const { 
		hoverZone = 50, 
		minScreenWidth = 700, 
		debounceDelay = 100, 
		controls = [],
		direction = 'left',
		extendedZone,
		extendCondition
	} = config;
	
	// Store for tracking hover state
	const hoverState = writable<HoverState>({
		isHovering: false,
		isOpenedByToggle: false
	});

	let hoverTimeout: NodeJS.Timeout | null = null;
	let leaveTimeout: NodeJS.Timeout | null = null;

	// Clear any pending timeouts
	function clearTimeouts() {
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}
		if (leaveTimeout) {
			clearTimeout(leaveTimeout);
			leaveTimeout = null;
		}
	}

	// Check if screen width allows hover functionality
	function isScreenWidthValid(): boolean {
		return typeof window !== 'undefined' && window.innerWidth >= minScreenWidth;
	}

	// Show all controlled sidebars
	function showControlledSidebars() {
		controls.forEach(controlName => {
			sidenavControls[controlName]?.show();
		});
	}

	// Hide all controlled sidebars
	function hideControlledSidebars() {
		controls.forEach(controlName => {
			sidenavControls[controlName]?.hide();
		});
	}

	// Toggle all controlled sidebars
	function toggleControlledSidebars() {
		controls.forEach(controlName => {
			sidenavControls[controlName]?.toggle();
		});
	}

	// Check if mouse is in hover zone based on direction
	function isInHoverZone(clientX: number, clientY: number): boolean {
		const currentZone = (extendCondition && extendCondition()) ? 
			(extendedZone || window.innerHeight) : hoverZone;

		switch (direction) {
			case 'left':
				return clientX <= currentZone;
			case 'right':
				return clientX >= (window.innerWidth - currentZone);
			case 'top':
				return clientY <= currentZone;
			case 'bottom':
				return clientY >= (window.innerHeight - currentZone);
			default:
				return false;
		}
	}
	// Handle mouse enter on hover zone
	function handleEdgeHover() {
		if (!isScreenWidthValid()) return;

		clearTimeouts();
		
		hoverTimeout = setTimeout(() => {
			hoverState.update(state => ({
				...state,
				isHovering: true
			}));
			showControlledSidebars();
		}, debounceDelay);
	}

	// Handle mouse leave from menu area
	function handleMenuLeave() {
		if (!isScreenWidthValid()) return;

		clearTimeouts();
		
		leaveTimeout = setTimeout(() => {
			hoverState.update(state => {
				// Only hide if not opened by toggle
				if (!state.isOpenedByToggle) {
					hideControlledSidebars();
					return {
						...state,
						isHovering: false
					};
				}
				return {
					...state,
					isHovering: false
				};
			});
		}, debounceDelay);
	}

	// Toggle menu manually (e.g., by button click)
	function toggleMenu() {
		hoverState.update(state => {
			const newToggleState = !state.isOpenedByToggle;
			if (newToggleState) {
				showControlledSidebars();
			} else {
				hideControlledSidebars();
			}
			return {
				...state,
				isOpenedByToggle: newToggleState
			};
		});
	}

	// Set up mouse move listener for edge detection
	function setupEdgeDetection(element?: HTMLElement) {
		const targetElement = element || (typeof document !== 'undefined' ? document.body : null);
		
		if (!targetElement) return () => {};

		function handleMouseMove(event: MouseEvent) {
			if (!isScreenWidthValid()) return;

			const { clientX, clientY } = event;
			
			// Check if mouse is in the hover zone based on direction
			if (isInHoverZone(clientX, clientY)) {
				handleEdgeHover();
			}
		}

		targetElement.addEventListener('mousemove', handleMouseMove);

		// Return cleanup function
		return () => {
			targetElement.removeEventListener('mousemove', handleMouseMove);
			clearTimeouts();
		};
	}

	// Handle window resize to check screen width
	function handleResize() {
		if (!isScreenWidthValid()) {
			hoverState.update(state => {
				if (!state.isOpenedByToggle) {
					hideControlledSidebars();
				}
				return {
					...state,
					isHovering: false
				};
			});
		}
	}

	// Set up resize listener
	function setupResizeListener() {
		if (typeof window === 'undefined') return () => {};

		window.addEventListener('resize', handleResize);
		
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	}

	// Initialize all listeners
	function initialize(element?: HTMLElement) {
		const cleanupEdgeDetection = setupEdgeDetection(element);
		const cleanupResize = setupResizeListener();

		return () => {
			cleanupEdgeDetection();
			cleanupResize();
			clearTimeouts();
		};
	}

	return {
		hoverState,
		handleEdgeHover,
		handleMenuLeave,
		toggleMenu,
		setupEdgeDetection,
		initialize,
		// Utility functions
		isScreenWidthValid,
		clearTimeouts,
		// Control functions
		showControlledSidebars,
		hideControlledSidebars,
		toggleControlledSidebars,
		// Access to individual controls
		controls: sidenavControls
	};
}
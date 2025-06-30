<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/stores';
	import { navigating } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { fly, fade, slide } from 'svelte/transition';
	import horizon100 from '$lib/assets/thumbnails/horizon100.svg';
	import TaskNotification from '$lib/components/feedback/TaskNotification.svelte';
	import { taskNotifications } from '$lib/stores/taskNotificationStore';
	// Components
	import Kanban from '$lib/features/tasks/Kanban.svelte';
	import ModelSelector from '$lib/features/ai/components/models/ModelSelector.svelte';
	import PromptSelector from '$lib/features/ai/components/prompts/PromptSelector.svelte';
	import Profile from '$lib/features/users/components/Profile.svelte';
	import Auth from '$lib/features/auth/components/Auth.svelte';
	import StyleSwitcher from '$lib/features/users/components/StyleSwitcher.svelte';
	import LoadingSpinner from '$lib/components/feedback/LoadingSpinner.svelte';
	import TimeTracker from '$lib/components/buttons/TimeTracker.svelte';
	import ProjectDropdown from '$lib/components/buttons/ProjectDropdown.svelte';
	import { projectStore } from '$lib/stores/projectStore';
	import SearchEngine from '$lib/components/navigation/SearchEngine.svelte';
	import {
		getWallpaperSrc,
		parseWallpaperPreference,
		AVAILABLE_WALLPAPERS
	} from '$lib/utils/wallpapers';
	import type { WallpaperPreference } from '$lib/utils/wallpapers';
	import type { User, PromptSelectEvent, PromptAuxClickEvent } from '$lib/types/types';
	// Stores
	import { currentUser, refreshCurrentUser, pocketbaseUrl, signOut } from '$lib/pocketbase';
	import { currentTheme } from '$lib/stores/themeStore';
	import {
		currentLanguage,
		setLanguage,
		languages,
		initializeLanguage
	} from '$lib/stores/languageStore';
	import { threadsStore } from '$lib/stores/threadsStore';
	import { isNavigating } from '$lib/stores/navigationStore';
	import { t } from '$lib/stores/translationStore';
	import { timerStore } from '$lib/stores/timerStore';
	import { threadListVisibility } from '$lib/clients/threadsClient';
	import { showAuth, toggleAuth } from '$lib/stores/authStore';
	import {
		sidenavStore,
		showSidenav,
		showInput,
		showRightSidenav,
		showFilters,
		showSearch,
		showOverlay,
		showSettings,
		showEditor,
		showExplorer,
		showDebug,
		showThreadList
	} from '$lib/stores/sidenavStore';
	import Toast from '$lib/components/modals/Toast.svelte';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import { swipeGesture } from '$lib/utils/swipeGesture';
	import {
		clientTryCatch,
		fetchTryCatch,
		storageTryCatch,
		isSuccess,
		isFailure
	} from '$lib/utils/errorUtils';
	import { createHoverManager } from '$lib/utils/hoverUtils';

	// Component props
	export let onStyleClick: (() => void) | undefined = undefined;
	export let isOpen = false;
	export let isSearchFocused = false;

	// Local state
	let avatarTimestamp = Date.now();
	let showLanguageNotification = false;
	let selectedLanguageName = '';
	let isStylesOpen = false;
	let placeholderText = '';
	let username: string = 'You';
	let isMenuOpen = true;
	let innerWidth: number;
	let isNavExpanded = false;
	let showAuthModal = false;
	let showProfile = false;
	let showStyles = false;
	let currentStyle = 'default';
	let activeLink = '/';
	let activeSection = '';
	let activeRevealButton: string | null = null;
	let isDropdownOpen = false;
	let wallpaperPreference: WallpaperPreference = { wallpaperId: null, isActive: false };
	let wallpaperSrc: string | null = null;
	let preference: WallpaperPreference;
	let isLogoHovered = false;

	// Reactive declarations
	$: placeholderText = getRandomQuote();
	$: isThreadListVisible = $showThreadList;
	$: currentPath = $page.url.pathname;
	$: showBottomButtons = currentPath === '/';
	$: isNarrowScreen = innerWidth <= 1000;
	$: user = $currentUser;

	// Event handling
	const dispatch = createEventDispatcher<{
		promptSelect: PromptSelectEvent;
		promptAuxclick: PromptAuxClickEvent;
		threadListToggle: void;
	}>();

	// Styles configuration
	const styles = [
		{ name: 'Daylight Delight', value: 'default', icon: 'Sun' as IconName },
		{ name: 'Midnight Madness', value: 'dark', icon: 'Moon' as IconName },
		{ name: 'Sunrise Surprise', value: 'light', icon: 'Sunrise' as IconName },
		{ name: 'Sunset Serenade', value: 'sunset', icon: 'Sunset' as IconName },
		{ name: 'Laser Focus', value: 'focus', icon: 'Focus' as IconName },
		{ name: 'Bold & Beautiful', value: 'bold', icon: 'Bold' as IconName },
		{ name: 'Turbo Mode', value: 'turbo', icon: 'Gauge' as IconName },
		{ name: 'Bone Tone', value: 'bone', icon: 'Bone' as IconName },
		{ name: 'Ivory Tower', value: 'ivoryx', icon: 'Component' as IconName }
	];

	const pageHoverManager = createHoverManager({
		hoverZone: 50,
		minScreenWidth: 700,
		debounceDelay: 100,
		controls: ['settings'],
		direction: 'left'
	});

	const {
		hoverState: pageHoverState,
		handleMenuLeave: handlePageMenuLeave,
		toggleMenu: togglePageMenu
	} = pageHoverManager;
	

	let pageCleanup: (() => void) | null = null;

	// Functions
	function getRandomQuote(): string {
		const quotes = $t('extras.quotes');

		if (Array.isArray(quotes) && quotes.every((item) => typeof item === 'string')) {
			return quotes[Math.floor(Math.random() * quotes.length)];
		}

		return 'The question of whether a computer can think is no more interesting than the question of whether a submarine can swim. - Edsger W. Dijkstra';
	}
	function handleAvatarUpdate(event: CustomEvent) {
		console.log('🔄 Layout received avatar update event');
		avatarTimestamp = event.detail.timestamp;
	}
	function toggleSidenav() {
		sidenavStore.toggle();
	}
	function toggleThreadList() {
		threadListVisibility.toggle();
		dispatch('threadListToggle');
	}

	function toggleStyles() {
		showStyles = !showStyles;
	}

	function handleStyleClick() {
		showStyles = !showStyles;
	}

	function handleStyleClose() {
		showStyles = false;
	}
	function handleLinkClick(event: CustomEvent) {
		const notification = event.detail;
		if (notification.link?.url) {
			goto(notification.link.url);
		}
	}
	async function handleStyleChange(event: CustomEvent) {
		const { style } = event.detail;
		await currentTheme.set(style);
		showStyles = false;
	}
	function updateActiveSection(sectionId: string) {
		activeSection = sectionId;
	}
	function toggleNav() {
		isNavExpanded = !isNavExpanded;
	}

	function toggleAuthOrProfile() {
		if ($currentUser) {
			showProfile = !showProfile;
			showAuthModal = false;
		} else {
			showAuthModal = !showAuthModal;
			showProfile = false;
		}
	}

	function handleAuthSuccess() {
		showAuthModal = false;
	}

	function handleLogout() {
		showProfile = false;
		goto('/welcome');
		showAuthModal = false;
	}

	function handleOverlayClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			showAuthModal = false;
			showProfile = false;
			showStyles = false;
		}
	}

	function navigateTo(path: string) {
		goto(path);
		showProfile = false;
	}

	function setActiveLink(path: string) {
		goto(path);
		activeLink = path;
	}

	function handleLogoClick(event: MouseEvent) {
		event.preventDefault();
		setActiveLink('/');
	}

	function scrollToSection(sectionId: string) {
		const section = document.getElementById(sectionId);
		if (section) {
			section.scrollIntoView({ behavior: 'smooth' });
			updateActiveSection(sectionId);
		}
	}

	function handlePromptSelect(event: CustomEvent) {
		dispatch('promptSelect', event.detail);
		console.log('Layout: Received promptSelect:', event.detail);
	}

	function handlePromptAuxclick(event: CustomEvent) {
		console.log('Layout: Received promptAuxclick:', event.detail);
		dispatch('promptAuxclick', event.detail);
		handlePromptSelect(event);
	}

	function handleThreadListToggle() {
		toggleThreadList();
	}

	function getAvatarUrl(user: User): string {
		if (!user) return '';

		// If avatarUrl is already provided (e.g., from social login)
		if (user.avatarUrl) return user.avatarUrl;

		// For PocketBase avatars
		if (user.avatar) {
			return `${pocketbaseUrl}/api/files/${user.collectionId || 'users'}/${user.id}/${user.avatar}`;
		}

		// Fallback - no avatar
		return '';
	}

	async function handleLanguageChange() {
		showLanguageNotification = true;

		const currentLang = $currentLanguage;
		const currentIndex = languages.findIndex((lang) => lang.code === currentLang);
		const nextIndex = (currentIndex + 1) % languages.length;
		const nextLanguage = languages[nextIndex];

		await setLanguage(nextLanguage.code);
		selectedLanguageName = nextLanguage.name;

		await tick();

		setTimeout(() => {
			showLanguageNotification = true;
		}, 0);
		setTimeout(() => {
			showLanguageNotification = false;
		}, 600);
	}

	async function logout() {
		const result = await clientTryCatch(signOut(), 'User logout');

		if (isSuccess(result)) {
			showProfile = false;
			goto('/welcome');
		} else {
			console.error('Error during logout:', result.error);
		}
	}
	// function isUsernameRoute(path: string): boolean {
	// 	// Match /username or /username/posts or /username/posts/id
	// 	return /^\/[^\/]+(?:\/posts(?:\/[^\/]+)?)?$/.test(path);
	// }
	$: searchPlaceholder = $t('nav.searchEverything') as string;
	$: {
		if ($currentUser?.wallpaper_preference) {
			wallpaperPreference = parseWallpaperPreference($currentUser.wallpaper_preference);
		} else if (!$currentUser) {
			wallpaperPreference = { wallpaperId: 'aristoles', isActive: true };
		} else {
			wallpaperPreference = { wallpaperId: null, isActive: false };
		}

		wallpaperSrc = getWallpaperSrc(wallpaperPreference);
		console.log('Layout wallpaper updated:', { wallpaperPreference, wallpaperSrc });
	}

	onMount(() => {
		if (browser) {
			window.addEventListener('avatarUpdated', handleAvatarUpdate);
		}
		let unsubscribe: (() => void) | undefined;
		let themeUnsubscribe: (() => void) | undefined;
		pageCleanup = pageHoverManager.initialize();

		const initialize = async () => {
			console.log('Layout onMount initiated');

			// Initialize theme and language (global)
			currentTheme.initialize();

			const languageResult = await clientTryCatch(initializeLanguage(), 'Language initialization');

			if (isFailure(languageResult)) {
				console.error('Failed to initialize language:', languageResult.error);
			}

			if (browser) {
				// Clean up old timer state format (one-time migration)
				const migrationResult = storageTryCatch(
					() => {
						const oldState = localStorage.getItem('timer_state');
						if (oldState) {
							const parsed = JSON.parse(oldState);
							// Check if old format had 'currentPath' property
							if (parsed.currentPath !== undefined) {
								localStorage.removeItem('timer_state');
								console.log('Migrated old timer state format');
							}
						}
						return true;
					},
					false, // fallback value
					'Timer state migration'
				);

				if (!migrationResult) {
					// Clear invalid state as fallback
					storageTryCatch(
						() => {
							localStorage.removeItem('timer_state');
							console.log('Cleared invalid timer state');
							return true;
						},
						false,
						'Timer state cleanup'
					);
				}

				// Initialize timer store
				timerStore.initialize();
			}

			// Set up user info (global)
			if ($currentUser && $currentUser.id) {
				console.log('Current user:', $currentUser);
				username = $currentUser.username || $currentUser.email;

				// Force refresh user data to get wallpaper_preference
				console.log('🔄 Fetching fresh user data with wallpaper_preference...');

				const userDataResult = await fetchTryCatch<{ success: boolean; user: User }>(
					`/api/verify/users/${$currentUser.id}`,
					{
						credentials: 'include'
					}
				);

				if (isSuccess(userDataResult)) {
					console.log('📦 Fresh user data:', userDataResult.data);

					if (userDataResult.data.success && userDataResult.data.user) {
						console.log(
							'🎯 Fresh wallpaper_preference:',
							userDataResult.data.user.wallpaper_preference
						);
						// Update the currentUser store with fresh data
						currentUser.set(userDataResult.data.user);
						console.log('✅ Updated currentUser store with fresh data');
					}
				} else {
					console.error('❌ Failed to fetch user data:', userDataResult.error);
				}

				// Initialize projects and restore saved project selection
				console.log('🚀 Initializing project state...');

				const projectLoadResult = await clientTryCatch(
					projectStore.loadProjects(),
					'Project loading'
				);

				if (isSuccess(projectLoadResult)) {
					console.log('✅ Projects loaded');

					const projectInitResult = await clientTryCatch(
						projectStore.initializeFromStorage(),
						'Project state initialization'
					);

					if (isSuccess(projectInitResult)) {
						console.log('✅ Project state initialized from storage');
					} else {
						console.error('❌ Error initializing project state:', projectInitResult.error);
					}
				} else {
					console.error('❌ Error loading projects:', projectLoadResult.error);
				}
			}
		};

		// Set up navigation tracking (global)
		unsubscribe = navigating.subscribe((navigationData) => {
			if (navigationData) {
				isNavigating.set(true);
			} else {
				setTimeout(() => {
					isNavigating.set(false);
				}, 300);
			}
		});

		// Set up theme tracker (global)
		themeUnsubscribe = currentTheme.subscribe((theme) => {
			document.documentElement.className = theme;
		});

		// Initialize async operations - call initialize() directly since onMount can't be async
		initialize().catch((error) => {
			console.error('Failed to initialize layout:', error);
		});

		// Return cleanup function synchronously
		return () => {
			unsubscribe?.();
			themeUnsubscribe?.();
		};
	});
	onDestroy(() => {
		if (browser) {
			window.removeEventListener('avatarUpdated', handleAvatarUpdate);
		}
		if (pageCleanup) {
			pageCleanup();
		}
	});
</script>

<svelte:window bind:innerWidth />

<div class="app-container {$currentTheme}">
	<!-- Debug info (remove this in production) -->
	<!-- <div style="position: fixed; top: 10px; left: 300px; background: rgba(0,0,0,0.8); color: white; padding: 10px; font-size: 12px; z-index: 9999; max-width: 300px;">
<strong>Wallpaper Debug:</strong><br>
	User ID: {$currentUser?.id || 'None'}<br>
	Raw Preference: {$currentUser?.wallpaper_preference || 'None'}<br>
	Raw Type: {typeof $currentUser?.wallpaper_preference}<br>
	Raw Length: {$currentUser?.wallpaper_preference?.length || 0}<br>
	Parsed Active: {wallpaperPreference?.isActive}<br>
	Parsed ID: {wallpaperPreference?.wallpaperId || 'None'}<br>
	Available Count: {AVAILABLE_WALLPAPERS?.length || 0}<br>
	Source: {wallpaperSrc || 'None'}<br>
	Should Show: {!!wallpaperSrc}<br>
	Current Route: {$page?.url?.pathname || 'Unknown'}
	</div> -->

	{#if wallpaperSrc}
		<img
			src={wallpaperSrc}
			alt="Background illustration"
			class="illustration"
			in:fade={{ duration: 1000, delay: 200 }}
			on:load={() => console.log('Wallpaper image loaded successfully')}
			on:error={(e) => console.error('Wallpaper image failed to load:', e)}
		/>
	{:else}
		<!-- Debug: Show when no wallpaper -->
		<div
			style="position: fixed; bottom: 10px; left: 10px; background: rgba(255,0,0,0.8); color: white; padding: 5px; font-size: 12px;"
		>
			No wallpaper: {wallpaperPreference?.isActive ? 'Active but no src' : 'Inactive'}
		</div>
	{/if}
	<TaskNotification notifications={$taskNotifications} on:remove on:linkClick={handleLinkClick} />
	<header>
		{#if $currentUser}{:else}
			<span class="header-auth">
				<button
					class="nav-link login"
					on:click={() => toggleAuthOrProfile()}
					in:fly={{ y: 0, duration: 500, delay: 400 }}
					out:fly={{ y: 50, duration: 500, delay: 400 }}
				>
					<Icon name="LogIn" size={16} />
					<span>
						{$t('profile.login')}
					</span>
				</button>
				<span class="auth-language">
					<button class="nav-link language" on:click={handleLanguageChange}>
						<Icon name="Languages" size={16} />
						<span>{$t('lang.flag')}</span>
					</button>
				</span>
			</span>
		{/if}
	</header>
	<nav style="z-index: 1000;"></nav>
	<div class="sidenav" class:expanded={isNavExpanded} transition:slide={{ duration: 300 }}>
			<div class="toggle-container">
					<button
						class="nav-button drawer"

						on:click={() => {
							toggleNav();
							if (showProfile || showAuthModal) {
								showProfile = false;
								showAuthModal = false;
							}
						}}
					>
						{#if isNavExpanded}
							<Icon name="PanelLeftClose" />
						{:else}
							<Icon name="PanelLeftOpen" />
						{/if}
					</button>
					<!-- <button
						class="nav-button drawer"
						class:expanded={isNavExpanded}
						class:active={$showSettings}
						class:reveal-active={$showSettings}
						use:swipeGesture={{
							threshold: 50,
							enableVisualFeedback: true,
							onSwipeRight: () => {
								console.log('🟢 Left button swiped right - showing sidenav');
								if (innerWidth <= 450) {
									sidenavStore.hideInput();
									sidenavStore.hideRight();
								}
								if (!$showSettings) {
									sidenavStore.toggleSettings();
								}
								isNavExpanded = false;
							},
							onSwipeLeft: () => {
								console.log('🟢 Left button swiped left - hiding sidenav');
								if ($showSettings) {
									sidenavStore.hideSettings();
								}
								isNavExpanded = false;
							}
						}}
						on:click={(event) => {
							event.preventDefault();
							if (innerWidth <= 450) {
								// Mobile: close others first
								sidenavStore.hideInput();
								sidenavStore.hideRight();
							}
							sidenavStore.toggleSettings();
							isNavExpanded = false;
						}}
					>
						{#if $showSettings}
							<Icon name="ChevronLeft" />
						{:else}
							<Icon name="MoreVertical" />
						{/if}
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.sidebar')}</span>
						{/if}
					</button> -->
				</div>
		<div
			class="navigation-buttons"
			class:hidden={isNarrowScreen}
			in:fly={{ x: -200, duration: 300 }}
			out:fly={{ x: 200, duration: 300 }}
		>
			{#if $currentUser}



				<!-- Home Route Navigation -->
				{#if currentPath.startsWith('/home') || (currentPath.split('/').length >= 2 && !['chat', 'lean', 'game', 'canvas', 'ask', 'notes', 'map', 'ide', 'html-canvas', 'api'].includes(currentPath.split('/')[1]))}
					<button
						class="nav-button drawer"
						class:expanded={isNavExpanded}
						class:active={$showSidenav}
						class:reveal-active={$showSidenav}
						use:swipeGesture={{
							threshold: 50,
							enableVisualFeedback: true,
							onSwipeRight: () => {
								console.log('🟢 Left button swiped right - showing sidenav');
								if (innerWidth <= 450) {
									sidenavStore.hideInput();
									sidenavStore.hideRight();
								}
								if (!$showSidenav) {
									sidenavStore.toggleLeft();
								}
								isNavExpanded = false;
							},
							onSwipeLeft: () => {
								console.log('🟢 Left button swiped left - hiding sidenav');
								if ($showSidenav) {
									sidenavStore.hideLeft();
								}
								isNavExpanded = false;
							}
						}}
						on:click={(event) => {
							event.preventDefault();
							if (innerWidth <= 450) {
								// Mobile: close others first
								sidenavStore.hideInput();
								sidenavStore.hideRight();
							}
							sidenavStore.toggleLeft();
							isNavExpanded = false;
						}}
					>
						{#if $showSidenav}
							<Icon name="ChevronLeft" />
						{:else}
							<Icon name="Filter" />
						{/if}
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.sidebar')}</span>
						{/if}
					</button>

					<!-- Composer Button -->
					<button
						class="nav-button drawer"
						class:expanded={isNavExpanded}
						class:active={$showInput}
						class:reveal-active={$showInput}
						use:swipeGesture={{
							threshold: 50,
							enableVisualFeedback: true,
							onSwipeUp: () => {
								console.log('🟢 Composer button swiped up - showing input');
								if (innerWidth <= 450) {
									sidenavStore.hideLeft();
									sidenavStore.hideRight();
								}
								if (!$showInput) {
									sidenavStore.toggleInput();
								}
								isNavExpanded = false;
							},
							onSwipeDown: () => {
								console.log('🟢 Composer button swiped down - hiding input');
								if ($showInput) {
									sidenavStore.hideInput();
								}
								isNavExpanded = false;
							}
						}}
						on:click={(event) => {
							event.preventDefault();
							if (innerWidth <= 450) {
								// Mobile: close others first
								sidenavStore.hideLeft();
								sidenavStore.hideRight();
							}
							sidenavStore.toggleInput();
							isNavExpanded = false;
						}}
					>
						{#if $showInput}
							<Icon name="ChevronDown" />
						{:else}
							<Icon name="MessageCirclePlus" />
						{/if}
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.compose')}</span>
						{/if}
					</button>

					<!-- Right Navigation Button (Right Sidenav) -->
					<button
						class="nav-button drawer"
						class:expanded={isNavExpanded}
						class:active={$showRightSidenav}
						class:reveal-active={$showRightSidenav}
						use:swipeGesture={{
							threshold: 50,
							enableVisualFeedback: true,
							onSwipeLeft: () => {
								console.log('🟢 Right button swiped left - showing right sidenav');
								if (innerWidth <= 450) {
									sidenavStore.hideLeft();
									sidenavStore.hideInput();
								}
								if (!$showRightSidenav) {
									sidenavStore.toggleRight();
								}
								isNavExpanded = false;
							},
							onSwipeRight: () => {
								console.log('🟢 Right button swiped right - hiding right sidenav');
								if ($showRightSidenav) {
									sidenavStore.hideRight();
								}
								isNavExpanded = false;
							}
						}}
						on:click={(event) => {
							event.preventDefault();
							if (innerWidth <= 450) {
								// Mobile: close others first
								sidenavStore.hideLeft();
								sidenavStore.hideInput();
							}
							sidenavStore.toggleRight();
							isNavExpanded = false;
						}}
					>
						{#if $showRightSidenav}
							<Icon name="ChevronRight" />
						{:else}
							<Icon name="ScanFace" />
						{/if}
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.profile')}</span>
						{/if}
					</button>
				{/if}

				<!-- Chat Route Navigation -->
				{#if currentPath === '/chat'}


					<!-- <button
						class="nav-button drawer reveal"
						class:expanded={isNavExpanded}
						class:active={true}
						class:reveal-active={activeRevealButton === 'chat'}
						on:click={(event) => {
							event.preventDefault();
							activeRevealButton = activeRevealButton === 'chat' ? null : 'chat';
							toggleThreadList();
							isNavExpanded = false;
						}}
					>
						{#if $showThreadList}
							<Icon name="ChevronLeft" />
						{:else}
							<Icon name="ListCollapse" />
						{/if}
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.chat')}</span>
						{/if}
					</button> -->


				{/if}

				<!-- Kanban/Lean Route Navigation -->
				{#if currentPath === '/lean'}
					<!-- <button
						class="nav-button drawer"
						class:expanded={isNavExpanded}
						class:active={$showSidenav}
						class:reveal-active={$showSidenav}
						use:swipeGesture={{
							threshold: 50,
							enableVisualFeedback: true,
							onSwipeRight: () => {
								console.log('🟢 Left button swiped right - showing sidenav');
								if (innerWidth <= 450) {
									sidenavStore.hideInput();
									sidenavStore.hideRight();
								}
								if (!$showSidenav) {
									sidenavStore.toggleLeft();
								}
								isNavExpanded = false;
							},
							onSwipeLeft: () => {
								console.log('🟢 Left button swiped left - hiding sidenav');
								if ($showSidenav) {
									sidenavStore.hideLeft();
								}
								isNavExpanded = false;
							}
						}}
						on:click={(event) => {
							event.preventDefault();
							if (innerWidth <= 450) {
								// Mobile: close others first
								sidenavStore.hideInput();
								sidenavStore.hideRight();
							}
							sidenavStore.toggleLeft();
							isNavExpanded = false;
						}}
					>
						{#if $showSidenav}
							<Icon name="ListX" /> Stages
						{:else}
							<Icon name="ListFilter" />
						{/if}
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.sidebar')}</span>
						{/if}
					</button> -->

					<!-- <button
						class="nav-button drawer"
						class:expanded={isNavExpanded}
						class:active={$showRightSidenav}
						class:reveal-active={$showRightSidenav}
						use:swipeGesture={{
							threshold: 50,
							enableVisualFeedback: true,
							onSwipeLeft: () => {
								console.log('🟢 Right button swiped left - showing right sidenav');
								if (innerWidth <= 450) {
									sidenavStore.hideLeft();
									sidenavStore.hideInput();
								}
								if (!$showRightSidenav) {
									sidenavStore.toggleRight();
								}
								isNavExpanded = false;
							},
							onSwipeRight: () => {
								console.log('🟢 Right button swiped right - hiding right sidenav');
								if ($showRightSidenav) {
									sidenavStore.hideRight();
								}
								isNavExpanded = false;
							}
						}}
						on:click={(event) => {
							event.preventDefault();
							if (innerWidth <= 450) {
								// Mobile: close others first
								sidenavStore.hideLeft();
								sidenavStore.hideInput();
							}
							sidenavStore.toggleRight();
							isNavExpanded = false;
						}}
					>
						{#if $showRightSidenav}
							<Icon name="CalendarOff" />
						{:else}
							<Icon name="Calendar" />
						{/if}
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.profile')}</span>
						{/if}
					</button> -->


				{/if}
				{#if currentPath === '/chat'}
					<!-- <button
						class="nav-button drawer"
						class:expanded={isNavExpanded}
						class:active={$showOverlay}
						class:reveal-active={$showOverlay}
						use:swipeGesture={{
							threshold: 50,
							enableVisualFeedback: true,
							onSwipeLeft: () => {
								console.log('🟢 Right button swiped left - showing right sidenav');
								if (innerWidth <= 450) {
									sidenavStore.hideLeft();
									sidenavStore.hideInput();
								}
								if (!$showOverlay) {
									sidenavStore.toggleOverlay();
								}
								isNavExpanded = false;
							},
							onSwipeRight: () => {
								console.log('🟢 Right button swiped right - hiding right sidenav');
								if ($showOverlay) {
									sidenavStore.hideOverlay();
								}
								isNavExpanded = false;
							}
						}}
						on:click={(event) => {
							event.preventDefault();
							if (innerWidth <= 450) {
								// Mobile: close others first
								sidenavStore.hideLeft();
								sidenavStore.hideInput();
							}
							sidenavStore.toggleOverlay();
							isNavExpanded = false;
						}}
					>
						{#if $showOverlay}
							<Icon name="MessageCircleOff" />
						{:else}
							<Icon name="MessageSquare" />
						{/if}
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.profile')}</span>
						{/if}
					</button>
				{#if $showOverlay}
					<button
						class="nav-button drawer"
						class:expanded={isNavExpanded}
						class:active={$showThreadList}
						class:reveal-active={activeRevealButton === 'chat'}
						on:click={(event) => {
							event.preventDefault();
							activeRevealButton = activeRevealButton === 'chat' ? null : 'chat';
							sidenavStore.toggleThreadList(); // Use sidenavStore instead of toggleThreadList()
							isNavExpanded = false;
						}}
					>
						{#if $showThreadList}
							<Icon name="ListCollapseIcon" />
						{:else}
							<Icon name="ListCollapse" />
						{/if}
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.chat')}</span>
						{/if}
					</button>
				{/if} -->
					<!-- <button
						class="nav-button drawer"
						class:expanded={isNavExpanded}
						class:active={$showEditor}
						class:reveal-active={$showEditor}
						use:swipeGesture={{
							threshold: 50,
							enableVisualFeedback: true,
							onSwipeLeft: () => {
								console.log('🟢 Right button swiped left - showing right sidenav');
								if (innerWidth <= 450) {
									sidenavStore.hideLeft();
									sidenavStore.hideInput();
								}
								if (!$showOverlay) {
									sidenavStore.toggleEditor();
								}
								isNavExpanded = false;
							},
							onSwipeRight: () => {
								console.log('🟢 Right button swiped right - hiding right sidenav');
								if ($showOverlay) {
									sidenavStore.hideEditor();
								}
								isNavExpanded = false;
							}
						}}
						on:click={(event) => {
							event.preventDefault();
							if (innerWidth <= 450) {
								// Mobile: close others first
								sidenavStore.hideLeft();
								sidenavStore.hideInput();
							}
							sidenavStore.toggleEditor();
							isNavExpanded = false;
						}}
					>
						{#if $showEditor}
							<Icon name="Notebook" />
						{:else}
							<Icon name="NotebookPen" />
						{/if}
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.profile')}</span>
						{/if}
					</button>
					{#if $showEditor}
						<button
							class="nav-button drawer"
							class:expanded={isNavExpanded}
							class:active={$showExplorer}
							class:reveal-active={activeRevealButton === 'lean'}
							on:click={(event) => {
								event.preventDefault();
								if (innerWidth <= 450) {
									// Mobile: close others first
									sidenavStore.hideLeft();
									sidenavStore.hideInput();
								}
								sidenavStore.toggleExplorer();
								isNavExpanded = false;
							}}
						>
							{#if $showExplorer}
								<Icon name="ListCollapseIcon" />
							{:else}
								<Icon name="ListCollapse" />
							{/if}
							{#if isNavExpanded}
								<span class="nav-text">{$t('nav.chat')}</span>
							{/if}
						</button>
					{/if} -->
				{/if}
				<!-- Game Route Navigation -->
				{#if currentPath.startsWith('/game')}
					<button
						class="nav-button"
						class:expanded={isNavExpanded}
						on:click={() => {
							navigateTo('/home');
							if (isNavExpanded) isNavExpanded = false;
						}}
					>
						<Icon name="HomeIcon" />
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.home')}</span>
						{/if}
					</button>

					<button
						class="nav-button"
						class:expanded={isNavExpanded}
						on:click={() => {
							navigateTo('/chat');
							if (isNavExpanded) isNavExpanded = false;
						}}
					>
						<Icon name="MessageCircle" />
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.chat')}</span>
						{/if}
					</button>

					<button
						class="nav-button"
						class:expanded={isNavExpanded}
						on:click={() => {
							navigateTo('/lean');
							if (isNavExpanded) isNavExpanded = false;
						}}
					>
						<Icon name="SquareKanban" />
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.kanban')}</span>
						{/if}
					</button>

					<button
						class="nav-button drawer reveal"
						class:expanded={isNavExpanded}
						class:active={true}
						class:reveal-active={activeRevealButton === 'game'}
						on:click={(event) => {
							event.preventDefault();
							activeRevealButton = activeRevealButton === 'game' ? null : 'game';
							toggleSidenav();
							isNavExpanded = false;
						}}
					>
						{#if $showSidenav}
							<Icon name="PanelLeftClose" />
						{:else}
							<Icon name="Gamepad" />
						{/if}
						{#if isNavExpanded}
							<span class="nav-text">{$t('nav.game')}</span>
						{/if}
					</button>
				{/if}
				<!-- <button
					class="nav-button drawer"
					class:expanded={isNavExpanded}
					class:active={$showSearch}
					class:reveal-active={$showSearch}
					use:swipeGesture={{
						threshold: 50,
						enableVisualFeedback: true,
						onSwipeUp: () => {
							console.log('🟢 Composer button swiped up - showing input');
							if (innerWidth <= 450) {
								sidenavStore.hideLeft();
								sidenavStore.hideRight();
							}
							if (!$showSearch) {
								sidenavStore.toggleSearch();
							}
							isNavExpanded = false;
						},
						onSwipeDown: () => {
							console.log('🟢 Composer button swiped down - hiding input');
							if ($showSearch) {
								sidenavStore.hideSearch();
							}
							isNavExpanded = false;
						}
					}}
					on:click={(event) => {
						event.preventDefault();
						if (innerWidth <= 450) {
							// Mobile: close others first
							sidenavStore.hideLeft();
							sidenavStore.hideRight();
						}
						sidenavStore.toggleSearch();
						isNavExpanded = false;
					}}
				>
					{#if $showInput}
						<Icon name="ChevronDown" />
					{:else}
						<Icon name="Search" />
					{/if}
					{#if isNavExpanded}
						<span class="nav-text">{$t('nav.compose')}</span>
					{/if}
				</button> -->
			{:else}
				<!-- Unauthenticated state -->
				<!-- <LogIn /> -->
			{/if}
		</div>
	</div>

	{#if showLanguageNotification}
		<div class="language-notification" transition:fade={{ duration: 300 }}>
			{$t('lang.notification')}
		</div>
	{/if}

	{#if showAuthModal}
		<div class="auth-overlay" on:click={handleOverlayClick} transition:fade={{ duration: 300 }}>
			<div class="auth-content" transition:fade={{ duration: 300 }}>
				<button
					on:click={() => (showAuthModal = false)}
					class="close-button"
					in:fly={{ y: 50, duration: 500, delay: 400 }}
					out:fly={{ y: 50, duration: 500, delay: 400 }}
				>
					<Icon name="X" />
				</button>
				<Auth on:success={handleAuthSuccess} on:logout={handleLogout} />
			</div>
		</div>
	{/if}

	{#if showLanguageNotification}
		<div class="language-overlay" transition:fade={{ duration: 300 }}>
			<div class="language-notification" transition:fade={{ duration: 300 }}>
				{$t('lang.notification')}
				<div class="quote">
					{placeholderText}
				</div>
			</div>
		</div>
	{/if}

	{#if showStyles}
		<div class="style-overlay" transition:fly={{ x: -200, duration: 300 }}>
			<!-- <button class="close-button" transition:fly={{ x: -200, duration: 300}} on:click={() => showStyles = false}>
        <X size={24} />
    </button> -->
			<div
				class="style-content"
				on:click={handleOverlayClick}
				transition:fly={{ x: -20, duration: 300 }}
			>
				<StyleSwitcher on:close={handleStyleClose} on:styleChange={handleStyleChange} />
			</div>
		</div>
	{/if}

	{#if $isNavigating}
		<LoadingSpinner />
	{/if}

	{#if showAuthModal}
		<div
			class="auth-overlay"
			on:click={handleOverlayClick}
			transition:fly={{ y: -20, duration: 300 }}
		>
			<div class="auth-content">
				<button
					on:click={() => (showAuthModal = false)}
					class="close-button"
					in:fly={{ y: 50, duration: 500, delay: 400 }}
					out:fly={{ y: 50, duration: 500, delay: 400 }}
				>
					<Icon name="X" />
				</button>
				<Auth on:success={handleAuthSuccess} on:logout={handleLogout} />
			</div>
		</div>
	{/if}

	<main>
		<slot />
	</main>
	<Toast />
	{#if $showSettings}
		<div
			class="navigator-menu"
			class:expanded={isNavExpanded}
			on:mouseleave={() => {
				handlePageMenuLeave();
			}}
			in:fly={{ x: -100, duration: 300, delay: 100 }}
			out:fly={{ x: -100, duration: 300, delay: 100 }}
		>
			<div
				class="logo-container"
				on:click|stopPropagation={() => {
					// Set a flag before navigating to root
					sessionStorage.setItem('directNavigation', 'true');
					navigateTo('/welcome');
				}}
				style="cursor: pointer;"
			>
				<img src={horizon100} alt="Horizon100" class="logo" />
				<h2>vRAZUM</h2>
			</div>
			<button
				class="shortcut"
				class:expanded={isNavExpanded}
				class:active={$showDebug}
				class:reveal-active={$showDebug}
				use:swipeGesture={{
					threshold: 50,
					enableVisualFeedback: true,
					onSwipeLeft: () => {
						console.log('🟢 Right button swiped left - showing right sidenav');
						if (innerWidth <= 450) {
							sidenavStore.hideLeft();
							sidenavStore.hideInput();
						}
						if (!$showDebug) {
							sidenavStore.toggleRight();
						}
						isNavExpanded = false;
					},
					onSwipeRight: () => {
						console.log('🟢 Right button swiped right - hiding right sidenav');
						if ($showDebug) {
							sidenavStore.hideRight();
						}
						isNavExpanded = false;
					}
				}}
				on:click={(event) => {
					event.preventDefault();
					if (innerWidth <= 450) {
						// Mobile: close others first
						sidenavStore.hideLeft();
						sidenavStore.hideInput();
					}
					sidenavStore.toggleDebug();
					isNavExpanded = false;
				}}
			>
				{#if $showSettings}
					<Icon name="AlertCircle" />
				{:else}
					<Icon name="AlertCircle" />
				{/if}
				{#if isNavExpanded}
					<span class="nav-text">{$t('nav.debug')}</span>
				{/if}
			</button>

			<a
				class="shortcut"
				class:expanded={isNavExpanded}
				class:active={currentPath === '/home'}
				on:click={() => {
					navigateTo('/home');
					if (isNavExpanded) {
						isNavExpanded = false;
					}
				}}
			>
				<Icon name="Compass" /> <span class="nav-text">{$t('nav.chat')}</span>
				{#if isNavExpanded}{/if}
			</a>
			<a
				class="shortcut"
				class:expanded={isNavExpanded}
				class:active={currentPath === '/lean'}
				on:click={() => {
					navigateTo('/lean');
					if (isNavExpanded) {
						isNavExpanded = false;
					}
				}}
			>
				<Icon name="Command" /> <span class="nav-text">{$t('nav.tools')}</span>
				{#if isNavExpanded}{/if}
			</a>
			<a
				class="shortcut"
				class:expanded={isNavExpanded}
				class:active={currentPath === '/chat'}
				on:click={() => {
					navigateTo('/chat');
					if (isNavExpanded) {
						isNavExpanded = false;
					}
				}}
			>
				<Icon name="MessageSquare" /> <span class="nav-text">{$t('nav.chat')}</span> 
				{#if isNavExpanded}{/if}
			</a>
			<!-- <a
				class="shortcut"
				class:expanded={isNavExpanded}
				class:active={currentPath === '/game'}
				on:click={() => {
					navigateTo('/game');
					if (isNavExpanded) {
						isNavExpanded = false;
					}
				}}
			>
				<Icon name="Gamepad" />				<span class="nav-text">{$t('nav.game')}</span>
				{#if isNavExpanded}
				{/if}
			</a>
			<a
				class="shortcut"
				class:expanded={isNavExpanded}
				class:active={currentPath === '/ide'}
				on:click={() => {
					navigateTo('/ide');
					if (isNavExpanded) {
						isNavExpanded = false;
					}
				}}
			>
				<Icon name="Code" />				<span class="nav-text">{$t('nav.ide')}</span>
				{#if isNavExpanded}
				{/if}
			</a>
			<a
				class="shortcut"
				class:expanded={isNavExpanded}
				class:active={currentPath === '/canvas'}
				on:click={() => {
					navigateTo('/canvas');
					if (isNavExpanded) {
						isNavExpanded = false;
					}
				}}
			>
				<Icon name="Combine" />				<span class="nav-text">{$t('nav.canvas')}</span>
				{#if isNavExpanded}
				{/if}
			</a> -->
			<a
				href="https://github.com/Horizon100/ultralit"
				target="_blank"
				rel="noopener noreferrer"
				class:expanded={isNavExpanded}
			>
				<Icon name="Github" /> <span class="nav-text">GitHub</span>
				{#if isNavExpanded}{/if}
			</a>
			<button
				class="shortcut"
				class:expanded={isNavExpanded}
				use:swipeGesture={{
					threshold: 50,
					enableVisualFeedback: true,
					onSwipeDown: () => {
						console.log('🟢 User button swiped down - showing profile');
						if (!showProfile) {
							toggleAuthOrProfile();
						}
						if (isNavExpanded) {
							isNavExpanded = false;
						}
					},
					onSwipeUp: () => {
						console.log('🟢 User button swiped up - hiding profile');
						if (showProfile) {
							showProfile = false;
						}
						if (isNavExpanded) {
							isNavExpanded = false;
						}
					}
				}}
				on:click={() => {
					toggleAuthOrProfile();
					// Only close the nav if it's expanded
					if (isNavExpanded) {
						isNavExpanded = false;
					}
				}}
			>
				<div class="user-wrapper">
					<div class="user-shortcuts">
						{#if $currentUser?.id}
							<img 
								src="/api/users/{$currentUser.id}/avatar?t={avatarTimestamp}" 
								alt="User avatar" 
								class="user-avatar" 
							/>
						{:else}
							<div class="default-avatar">?</div>
						{/if}
						<!-- <span class="nav-text">{username} </span> -->
						<div class="tracker">
							<TimeTracker />
						</div>
						<div class="project" on:click|stopPropagation>
							<ProjectDropdown />
						</div>

						<span
							class="icon"
							on:click|stopPropagation={() => {
								logout();
								// Only close the nav if it's expanded
								if (isNavExpanded) {
									isNavExpanded = false;
								}
							}}
						>
							<Icon name="LogOutIcon" size={16} />
						</span>
					</div>
				</div>
			</button>

			{#if isNavExpanded}
				<!-- <h2>vRAZUM</h2> -->
			{/if}
		</div>
	{/if}
	{#if showProfile}
		<div
			class="profile-overlay"
			on:click={handleOverlayClick}
			transition:fly={{ y: -200, duration: 300 }}
		>
			<div class="profile-content" transition:fly={{ y: -20, duration: 300 }}>
				<Profile
					user={$currentUser}
					onClose={() => (showProfile = false)}
					onStyleClick={handleStyleClick}
				/>
			</div>
		</div>
	{/if}
	{#if $showSearch}
		<!-- Search wrapper - hidden when logo is hovered -->
		<div
			class="search-wrapper"
			in:fly={{ x: 50, duration: 500, delay: 400 }}
			out:fly={{ x: 50, duration: 500, delay: 400 }}
			class:dropdown-open={isDropdownOpen}
			class:search-open={isSearchFocused}
		>
			<SearchEngine size="large" placeholder={searchPlaceholder} bind:isFocused={isSearchFocused} />
		</div>
	{/if}
	<footer>
		<!-- Footer content -->
	</footer>
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	.middle-buttons {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: flex-start;
		height: auto;
		margin-left: 1rem;
		position: absolute;
		bottom: 1rem;
		padding: 0;
		width: auto;
		gap: 1rem;
		margin-bottom: 0;
	}
	.navigator-menu {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		position: absolute;
		flex: 1;
		top: 0;
		padding: 0.5rem;
		gap: 1rem;
		bottom: 3rem;
		left: 0;
		width: auto;
		// background: var(--primary-color);
		z-index: 9999;
		// border-right: 1px solid var(--secondary-color);

		&:hover {
			width: auto !important;
		}
		& button.shortcut {
			padding: 0;
			margin: 0;
			background: transparent;
			border: 1px solid transparent;
			width: 60px;
			height: 60px;
			& .user-avatar {
				width: 60px !important;
				height: 60px !important;
				border-radius: 50%;
				object-fit: cover;
			}
			& .nav-text {
				display: none;
			}
			& .icon {
				display: none;
			}
			& .tracker {
				display: none;
			}

			&:hover {
				& .nav-text {
					display: flex;
				}
				& .icon {
					display: flex;
				}
				& .tracker {
					display: flex;
				}
			}
		}
		button.user-wrapper {
			display: flex;
			flex-direction: row !important;
			align-items: flex-start;
			justify-content: flex-end;
			background: transparent !important;
			height: auto;
			width: 100%;
			gap: 0;
		}
		.user-shortcuts {
			display: flex;
			align-items: center;
			width: 100%;
			border: 1px solid var(--line-color);
			gap: 0.5rem;
			border-radius: 2rem;
			transition: all 0.2s ease;
			&:hover {
				transform: translateX(2rem);
				padding-right: 1rem;
				background: var(--primary-color);
			}
		}
		&.expanded {
			width: 200px !important;
			& button.shortcut {
				padding: 0;
				margin: 0;
				background: transparent;
				border: 1px solid transparent;
				width: 100%;
				height: 60px;
				.user-shortcuts {
					width: 200px;
					&:hover {
						transform: translateX(1rem);
						padding-right: 0;
					}
				}

				& .nav-text {
					display: flex;
				}
				& .icon {
					display: flex;
				}
				& .tracker {
					display: flex;
				}
			}
			& a {
				flex-direction: row !important;
				width: 100% !important;
				border-radius: 3rem;
			}
			& .nav-text {
				display: flex;
			}
			& .logo-container {
				width: 200px !important;
			}
			& h2 {
				display: flex !important;
			}
		}
		& a {
			display: flex;
			justify-content: center;
			color: var(--placeholder-color);
			width: 60px !important;
			height: 60px;
			gap: 0.5rem !important;
			background: var(--primary-color);
			opacity: 0.5;
			border-radius: 50%;
			border: 1px solid var(--line-color);
			align-items: center;
			/* padding: 20px; */
			text-decoration: none;
			transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
			&:hover {
				color: var(--tertiary-color);
				opacity: 100%;
				cursor: pointer;
			}
			& .nav-text {
				display: none;
			}
		}
		& .logo-container {
			position: absolute;
			top: 0.5rem;
			left: 0;
			width: 80px;
		}
	}
	button {
		transition: all 0.3s ease;
		&.icon {
			// background: var(--bg-gradient);
			border: 1px solid var(--secondary-color);
			border-radius: 50%;
			width: 2rem;
			height: 2rem;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}

	.toggle-container {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		height: 3rem;
		gap: 1rem;
		position: fixed;
		left: 1rem;
	}

	.nav-button {
		color: var(--text-color);
		// background: var(--bg-gradient-right);
		font-size: 16px;
		border: none;
		cursor: pointer;
		display: flex;
		justify-content: center;
		align-items: center;
		width: 50px;
		height: 50px;
		padding: 0.5rem;
		transition: all 0.2s ease-in-out;
		overflow: hidden;
		user-select: none;
		&.info.logo {
			padding: 0;
			width: 3rem;
			position: absolute !important;
			right: 0;
			gap: 1.5rem;
			background: transparent;
			&.shortcut-buttons {
				display: none;
				flex-direction: row;
				gap: 0.5rem;
			}
			&:hover {
				backdrop-filter: blur(10px);
				width: auto;
				padding: 0.5rem;
				height: auto;
				flex-direction: row;
				border-left: 4px solid var(--tertiary-color);
				background: var(--primary-color);
				justify-content: space-around;
				border-radius: 3rem 0 0 3rem !important;

				.shortcut-buttons {
					display: flex;
				}
				h2 {
					display: flex;
				}
			}
			& img.logo {
				width: 2rem;
				height: 2rem;
				position: relative;
			}
		}
	}
	img.logo {
		width: 2rem;
		height: 2rem;
		position: relative;
	}

	.auth-overlay {
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		/* background-color: rgba(0, 0, 0, 0.5); */
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.auth-content {
		position: absolute;
		top: 25% !important;
		left: 25%;
		right: 25% !important;
		/* background-color: #2b2a2a; */
		/* padding: 2rem; */
		width: 50% !important;
		/* max-width: 500px; */
		height: auto;
		overflow-y: auto;
		transition: all 0.3s ease;
		/* background-color: #2b2a2a; */
		/* padding: 2rem; */
		/* max-width: 500px; */
		height: auto;
	}
	.profile-overlay {
		position: fixed;
		left: 5rem !important;
		top: 0;
		height: auto !important;
		justify-content: flex-start;
		align-items: flex-start;
		display: flex;
		margin: 0;
		/* box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);  */
		z-index: 1002;

		transition: all 0.3s ease;
		box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);
	}

	.project {
		width: auto !important;
		justify-content: center;
		align-items: center;
		margin: 0;
		padding: 0;
		// z-index: 999;
		display: none;
		// overflow: visible;
	}

	.profile-content {
		position: relative;
		width: auto;
		height: calc(100vh - 3rem);
		width: 500px;
		top: 0;
		margin-bottom: auto;
		padding: 0;
		margin: 0;
		/* right: 0; */
		/* background-color: #2b2a2a; */
		/* box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);  */
		border-radius: 2rem;
		/* max-width: 500px; */
		/* max-height: 90vh; */
		overflow: none;
		transition: all 0.3s ease;
		backdrop-filter: blur(30px);
		border: 1px solid var(--secondary-color);
	}

	.profile-button {
		display: flex;
		flex-direction: row;
	}

	.user-button {
		background-color: #3c3c3c;
		color: white;
		padding: 5px 10px;
		border-radius: 4px;
		font-size: 14px;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.user-button:hover {
		background-color: #4a4a4a;
	}

	main {
		background: var(--bg-gradient-r);
		color: var(--text-color);
		width: 100%;
		height: 100%;
		height: auto;
		left: 0;
		top: 0;
		bottom: 0;
		position: fixed;
		display: flex;
		flex-grow: 1;
	}

	:global(.loading-spinner) {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: rgba(0, 0, 0, 0.5);
		z-index: 9999;
	}
	.app-container {
		display: flex;

		/* justify-content: center; */
		/* align-items: center; */
		overflow: hidden;
		/* height: 100vh; */
		//   /* width: 100vw;; */;
	}

	header {
		display: flex;
		flex-direction: row;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		justify-content: center;
		align-items: center;
		/* height: 80px; */
		/* margin-top: 0; */
		/* align-items: center; */
		height: 3rem;
		/* padding: 5px 5px; */
		/* z-index: 100;; */
		transition: all 0.3s ease;
		/* box-shadow: 0 0 10px rgba(0, 0, 0, 0.2); */
		/* background: linear-gradient(to bottom, #3f4b4b, #333333); */

		/* background: linear-gradient(
        to bottom, 
        rgba(117, 118, 114, 0.9) 0%,
        rgba(117, 118, 114, 0.85) 5%,
        rgba(117, 118, 114, 0.8) 10%,
        rgba(117, 118, 114, 0.75) 15%,
        rgba(117, 118, 114, 0.7) 20%,
        rgba(117, 118, 114, 0.65) 25%,
        rgba(117, 118, 114, 0.6) 30%,
        rgba(117, 118, 114, 0.55) 35%,
        rgba(117, 118, 114, 0.5) 40%,
        rgba(117, 118, 114, 0.45) 45%,
        rgba(117, 118, 114, 0.4) 50%,
        rgba(117, 118, 114, 0.35) 55%,
        rgba(117, 118, 114, 0.3) 60%,
        rgba(117, 118, 114, 0.25) 65%,
        rgba(117, 118, 114, 0.2) 70%,
        rgba(117, 118, 114, 0.15) 75%,
        rgba(117, 118, 114, 0.1) 80%,
        rgba(117, 118, 114, 0.05) 85%,
        rgba(117, 118, 114, 0) 100%
        
      ); */
		/* backdrop-filter: blur(3px); */
		/* padding: 1rem 0; */
		& .header-auth {
			display: flex;
			flex-direction: row;
			position: absolute;
			left: 0.5rem;
		}
		& .nav-link.home {
			position: absolute;
			right: 0;
		}
	}

	.header-logo {
		display: flex;
		flex-direction: row;
		/* position: absolute; */
		/* margin-left: 10%; */
		/* border: 1px solid #000000; */
		/* background-color: #2a3130; */
		/* box-shadow: #000000 5px 5px 5px 1px; */
		text-decoration: none;
		transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		justify-content: center;
		align-items: center;
		height: auto;
		user-select: none;
		gap: 8px;
		padding: 5px 10px;
		color: white;
		text-decoration: none;
		font-size: 16px;
	}

	.logo-container {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		height: auto;
		width: auto;
		gap: 1rem;
		position: relative;
		user-select: none;

		& h2 {
			padding: 0 !important;
			height: auto !important;
			margin: 0;
			font-style: normal;
			display: none;
		}
	}

	a.logo-link {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		color: inherit;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		width: 100%;
		z-index: 6000;
		& h2 {
			display: none;
		}
	}

	.h1 {
		font-size: 20px;
		line-height: 1.5;
	}

	.style-switcher-button {
		background-color: transparent;
		border: none;
		padding: 0;
		margin-right: 16px;
	}
	.project-dropdown {
		display: flex;
		flex-direction: row;
		position: absolute;
		left: 5rem;
		justify-content: center;
		align-items: center;
		width: auto;
		height: 40px;
		& span {
			display: flex;
			justify-content: center;
			gap: 0.5rem;
			padding: 1rem;
		}
	}

	.style-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1002;
	}

	.style-content {
		background-color: #2b2a2a;
		border: 1px solid rgb(69, 69, 69);
		border-radius: 20px;
		position: relative;
		max-width: 90%;
		max-height: 90%;
		overflow: auto;
	}

	.search-wrapper {
		display: flex;
		flex-direction: row;
		justify-content: flex-end;
		align-items: flex-end;
		position: fixed;
		bottom: 3rem;
		left: 50%;
		right: 0.5rem;
		height: 3rem;
		padding: 1rem;
		// backdrop-filter: blur(3px);
		transition:
			opacity 0.2s ease,
			transform 0.2s ease;
		&.search-open {
			height: 100%;
		}
		&.dropdown-open {
			height: auto !important;
			min-height: 2rem;
			flex-direction: column;
			align-items: stretch;
			padding: 0;
		}
	}

	nav {
		display: flex;
		justify-content: center;
		align-items: center;
		/* padding: 5px 10px; */
		/* background-color: #2b2a2a; */
		/* border-radius: 20px; */
		/* background-color: black; */
		/* height: 80px; */
		gap: 2rem;
		width: 100%;

		/* margin-right: 10%; */
		/* padding: 10px; */
	}

	nav a {
		display: flex;
		justify-content: center;
		align-items: center;
		width: auto;
		font-weight: bold;
		text-decoration: none;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		border-radius: 20px;
		color: var(--text-color);
	}

	a {
		display: flex;
		justify-content: center;
		color: var(--placeholder-color);
		width: auto !important;
		align-items: center;
		/* padding: 20px; */
		text-decoration: none;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		&:hover {
			color: var(--tertiary-color);
		}
	}

	.nav-links {
		display: flex;
		flex-direction: row;
		font-size: 1.25rem;
		gap: 1rem;
		// font-style: italic;
		align-items: center;
		justify-content: space-between;
		/* padding: 10px; */
		font-family: var(--font-family);
		// max-width: 1000px;
		width: 100%;
		max-width: 1200px;
		height: 3rem;
		transition: all 0.3s ease-in;
		& span {
			display: flex;
			flex-direction: row;
			gap: 2rem;
		}
		& span.auth-language {
			display: flex;
			justify-content: space-between;
			// background: var(--secondary-color);
			width: auto;
			padding: 0 1rem;
			border-radius: 2rem;
			gap: 0;
		}
	}

	button.nav-link {
		width: auto;
		display: flex;
		background: transparent;
	}

	.nav-link {
		display: flex;
		flex-direction: row;
		flex: 0;
		gap: 0.5rem;
		font-weight: 400;
		letter-spacing: 0.2rem;
		justify-content: center;
		align-items: center;
		/* background-color: red; */
		text-decoration: none;
		font-size: auto;
		/* padding: 5px 10px; */
		/* border-radius: 20px; */
		// transition: all 0.2s cubic-bezier(0.075, 0.82, 0.165, 1);
		/* border-left: 1px solid rgb(130, 130, 130); */
		user-select: none;
		color: var(--text-color);
		// background: var(--bg-gradient-right);
		padding: 0 0.5rem;
		font-size: 1rem;
		border: none;
		border-radius: 0;
		cursor: pointer;
		width: auto;
		height: 2rem;
		transition: all 0.3s ease;

		&.login {
			width: auto;
			display: flex;
			& span {
				display: flex;
				font-size: 0.7rem;
				width: auto;
			}
		}
		&.language {
			display: flex;
			width: 2rem;
		}
		& span.hover {
			transition: all 0.2s ease;
			display: none;
		}
		&.home {
			letter-spacing: 0;
			width: auto;
			flex: 0;
		}
		&:hover {
			transform: none;
			border-radius: 0;
			color: var(--tertiary-color);
		}
	}
	.nav-link.active {
		background: transparent;
		// color: var(--tertiary-color);
		padding: 0 0.5rem;
		margin: 0;

		&:hover {
			background: rgba(255, 255, 255, 0.1);
			transform: none;
		}
	}
	.nav-link.home.active {
		letter-spacing: 0;
	}
	.svg-container {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;

		text-align: center;
		color: white;
		font-size: 20px;
		border-radius: 8px;
		/* border: 2px solid #4b4b4b; */
		cursor: pointer;
		text-decoration: none;
		transition: all 0.3s ease;
		/* background-color: #352e2e; */
		height: auto;
		width: auto;
	}

	.svg-container:hover {
		/* opacity: 0.8; */
		background-color: #222222;
		border: none;
	}

	.menu-button {
		display: flex;
		flex-direction: row;
		/* width: 200px; */
		/* min-width: 200px; */
		align-items: center;
		justify-content: center;
		/* padding: 10px; */
		background-color: transparent;
		border: none;
		/* position: absolute; */
		/* right: 2rem; */
		transition: all ease-in 0.2s;
		/* margin-right: 0; */
		gap: 10px;
		/* padding: 0 20px; 
        /* border: 20px; */
		/* background-color: red; */
		cursor: pointer;
		/* font-size: 20px; */
	}

	.profile-button {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		gap: 20px;
		margin-left: 1rem;
	}

	.hover-button {
		color: var(--text-color);
		border: none;
		background-color: transparent;
	}

	// button.menu-button {
	// 	/* display: flex; */
	// 	/* flex-direction: row; */
	// }

	.user-name {
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.illustration {
		position: fixed;
		width: 100%;
		max-width: 1000px;
		height: auto;
		right: 0;
		left: 30%;
		bottom: 50%;
		display: static;
		overflow-x: hidden !important;
		transform: translateY(50%) translateX(10%);
		opacity: 0.05;
		z-index: 1;
		pointer-events: none;
		mix-blend-mode: multiply;
		filter: contrast(20) brightness(0.1);
		border-radius: 10rem;
		object-fit: content;
	}

	.mobile-menu {
		display: flex;
		align-items: center;
		justify-content: center;
		position: fixed;
		bottom: 0;
		width: 100%;
		/* bottom: calc(100% - 280px); */
		/* width: calc(100% - 60px); */
		/* padding: 20px; */
		z-index: 99;
		/* border: 1px solid #000000; */
		/* background: linear-gradient(to top, #3f4b4b, #333333); */
		/* background-color: #2b2a2a; */
		// background: var(--bg-gradient-r);

		/* border-radius: 20px; */
		/* background-color: black; */
		/* height: 80px; */
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
		// border-top-left-radius: 20px;
		// border-top-right-radius: 20px;
	}

	.mobile-btns {
		margin-left: 0;
		bottom: 0;
		margin-bottom: 0;
		margin-right: 0;
		height: 100%;
		width: 100%;
		gap: 2rem;
		padding: 0.75rem 1rem;
		border: none;
		cursor: pointer;
		color: var(--text-color);
		text-align: left;
		align-items: center;
		justify-content: space-between;
		transition: background-color 0.2s;
		// border-radius: var(--radius-m);
		display: flex;
		flex-direction: row;
		//   background: var(--bg-gradient) !important;
		margin-bottom: 0.5rem;
		left: 0;
		right: 0;
		border-radius: var(--radius-l);
	}

	.mobile-btns a {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		width: 60px;
		// padding: 0 1rem;
		position: relative;
		// padding: 0.5rem 1rem;
		height: 60px;
		border: none;
		border-radius: 50%;
		// background: var(--secondary-color);
		color: var(--placeholder-color);
		cursor: pointer;
		transition: all 0.2s ease-in-out;
		& h3 {
			margin: 0;
			font-weight: 300;
			font-size: var(--font-size-sm);
			font-weight: 600;
			line-height: 1.4;
			&.active {
				background: var(--primary-color) !important;
				color: var(--tertiary-color);
				font-size: var(--font-size-xs);
			}
			&:hover {
				background: rgba(255, 255, 255, 0.1);
			}
		}
	}

	/* .auth-button {
	  background-color: rgb(4, 4, 4);
	  padding: 20px 40px;
	  border-radius: 20px;
	  color: white;
	  
	  font-size: 30px;
	  cursor: pointer;
	  transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
	  
	}
  
	.auth-button:hover {
	  opacity: 0.9;
	  transform: scale(1.05);
	} */

	/* main {
	  /* flex-grow: 1; */
	/* padding: 2rem 10%; */
	/* width: 100%; */

	/* .svg-container { */
	/* display: flex; */
	/* justify-content: center; */
	/* text-align: center; */
	/* background: linear-gradient(to top, #3f4b4b, #333333); */
	/* color: white; */
	/* font-size: 1rem; */
	/* height: 40px; */
	/* border-radius: 8px; */
	/* border: 2px solid #222222; */
	/* padding: 5px; */
	/* cursor: pointer; */
	/* margin-left: 200px; */

	/* } */

	/* .svg-container:hover { */
	/* opacity: 0.8; */
	/* background-color: blue; */
	/* } */

	h2 {
		font-size: 1.5rem;
	}
	button {
		display: flex;
		justify-content: center;
		text-align: center;
		color: var(--text-color);
		font-size: 1rem;
		border-radius: 8px;
		border: 2px solid #222222;
		padding: 5px;
		cursor: pointer;
	}

	footer {
		/* background-color: #1d2026; */
		color: white;
		text-align: center;
		justify-content: center;
		align-items: center;
		/* padding: 1rem; */
		width: 100%;
		position: fixed;
		bottom: 0;
		height: 0;
	}

	.style-switcher-container {
		display: flex;
		align-items: center;
		margin-right: 16px;
		z-index: 1001;
	}

	.user-button {
		background-color: #3c3c3c;
		color: white;
		padding: 5px 10px;
		border-radius: 4px;
		font-size: 14px;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.user-button:hover {
		background-color: #4a4a4a;
	}

	.avatar-container {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		overflow: hidden;
		margin-right: 10px;
	}

	.avatar {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: #444;
		color: #fff;
	}

	.close-button {
		position: fixed;
		top: 10px;
		left: 10px;
		width: 30px;
		height: 30px;
		border: none;
		color: white;
		cursor: pointer;
		background: none;
		display: flex;
		justify-content: center;
		text-align: center;
		font-size: 1rem;
		border-radius: 8px;
		padding: 5px;
		transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);
	}

	.close-button:hover {
		opacity: 0.8;
		background-color: rgb(62, 137, 194);
	}

	.no-user-message {
		text-align: center;
		padding: 2rem;
	}
	.navigation-buttons {
		display: flex;
		flex-direction: row;
		gap: 0.5rem;
		width: 100%;
		max-width: 1000px;
		justify-content: center;
		align-items: center;
		backdrop-filter: blur(3px);
		// border: 1px solid var(--line-color);

		border-bottom: 1px solid transparent;
		// padding: 0.5rem;
		overflow-x: hidden;
		overflow-y: hidden;
		& .hidden {
			display: none;
		}
	}
	.sidenav {
		display: flex;
		flex-direction: row;
		align-items: flex-end;
		justify-content: center;
		position: fixed;
		left: 0;
		right: 0 !important;
		top: auto;
		bottom: 0;
		padding: 0;
		z-index: 1000;
		width: 100%;
		border-radius: 0 1rem 1rem 0;
		transition: all 0.3s ease-in;
		border: 0px solid transparent;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
		transform: none !important;
		will-change: auto;
		pointer-events: auto;
		box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);

		/* Lock positioning */
		transform: translateZ(0) !important;
		backface-visibility: hidden;
		&.expanded {
			width: 100%;

			backdrop-filter: blur(10px);
			justify-content: flex-end;
			align-items: stretch;
			flex-direction: column;
			& .toggle-container {
				align-items: center;
				width: 150px;
			}

			// backdrop-filter: blur(30px);
			// border-right: 1px solid var(--bg-color);
			& .navigation-buttons {
				flex-direction: row !important;
				justify-content: flex-start;
				align-items: flex-start;
				touch-action: none;
				transform: none !important;
				max-width: 100%;
				margin-left: 10rem;
			}
		}
	}

	// .sidenav:hover {
	//   /* backdrop-filter: blur(10px); */
	// }

	.nav-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		// background: var(--bg-gradient-right);
		color: var(--text-color);
		border: none;
		cursor: pointer;
		transition: all 0.2s ease-in-out;
		width: auto;

		&.active {
			background: var(--tertiary-color);
			// box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
			&.expanded {
				width: 250px;
				justify-content: flex-start;
				padding: 0.5rem 1rem;
				border-radius: var(--radius-s);
				opacity: 1 !important;

				&:hover {
					box-shadow: none !important;
				}
			}
		}

		&:hover {
			background: var(--secondary-color);
		}

		&.expanded {
			width: 250px;
			justify-content: flex-start;
			padding: 0.5rem 1rem;
			border-radius: var(--radius-s);
			opacity: 1;
			animation: none !important;
			border-radius: 2rem !important;
		}

		&.profile {
			margin-top: auto;
		}
	}

	.nav-text {
		display: flex;
		justify-content: center;
		align-items: center;
		font-size: 1rem;
		white-space: nowrap;
		margin: 0;
		padding: 0;
	}

	.user-button {
		background-color: #3c3c3c;
		color: white;
		padding: 5px 10px;
		border-radius: 4px;
		font-size: 14px;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.user-button:hover {
		background-color: #4a4a4a;
	}

	.style-switcher-container {
		display: flex;
		align-items: center;
		margin-right: 16px;
		z-index: 1001;
	}

	.style-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1002;
	}

	.style-content {
		background-color: #b11f1feb;
		padding: 1rem;
		border: 1px solid rgb(69, 69, 69);
		border-radius: 20px;
		position: relative;
		overflow: auto;
	}

	.nav-button.info {
		display: flex;
		justify-content: flex-start;
		align-items: center;
		top: 0;
		animation: none !important;
		box-shadow: none !important;
		border-radius: 1rem !important;
		transition: all 0.3s ease;
		height: 3rem;

		// & button.shortcut {
		// 	background: var(--primary-color);
		// 	display: flex;
		// 	justify-content: center;
		// 	align-items: center;
		// 	width: 2rem;
		// 	height: 2rem;
		// 	border-radius: 50%;
		// 	&:hover {
		// 		background: var(--tertiary-color);
		// 	}
		// }
		& h2 {
			font-size: 1.2rem;
		}
		&.logo {
			&.expanded {
				max-width: 50%;
				display: grid;
				grid-template-columns: 1fr 1fr 1fr;
				flex-direction: row;
				width: 100%;
				height: 100vh;
				justify-content: flex-start;
				z-index: 10;
				top: 3rem;
				padding: 1rem;
				backdrop-filter: blur(10px);
			}
		}
		&.user {
			display: flex;
			flex-direction: column !important;
			justify-content: flex-start;
			align-items: flex-start;
			width: auto;
			max-width: 500px;

			&:hover {
				flex-direction: column !important;
				justify-content: flex-start;
				width: auto;
				align-items: center;
				height: auto;
				flex: 1;
				// background: var(--primary-color) !important;
				flex-direction: column;
				& .user-wrapper {
					// margin-top: 3rem;
					width: auto;
					padding: 0 !important;
				}

				& .project {
					display: flex;
				}
				& .tracker {
					display: flex;
					justify-content: center;
				}
			}
		}
		&.user,
		.logo {
			position: fixed;
			flex-direction: row !important;
			background: transparent !important;
			width: auto;
			padding: 0;
			top: 0;
			left: 0.5rem;
			&:hover {
				padding: 0;
			}
			& .user-avatar {
				width: 2rem !important;
				height: 2rem;
				border-radius: 50%;
				object-fit: cover;
			}
			&.expanded {
				height: 3rem;
				max-width: 350px;
				justify-content: flex-start;
				z-index: 10;
				left: 0;
			}

			&:hover {
				// padding: 0.5rem !important;
				// background: var(--primary-color) !important;
				flex-direction: column;
				width: 100% !important;
				& .project {
					display: flex;
				}
			}
		}
		span.icon {
			display: none;
			justify-content: center;
			align-items: center;
			padding: 0;
			border-radius: 50%;
			transition: all 0.2s ease;
			&:hover {
				background: red;
				padding: 0.5rem;
			}
		}
		h2 {
			display: none;
		}

		a {
			display: none;
		}
		& .nav-text {
			display: none;
		}

		&:hover {
			justify-content: space-around;
			// background: var(--primary-color);
			opacity: 1;
			width: 300px;
			border-radius: 0;

			& .nav-text {
				display: flex;
			}
			& h2 {
				display: flex;
			}
			& a {
				display: flex;
			}
			span.icon {
				display: flex;
				justify-content: center;
			}
		}
		&.expanded {
			// width: 100%;
			height: auto;
			flex-direction: column;
			justify-content: space-around;
			&:hover {
				background: transparent;
			}
			& .shortcut-buttons {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				width: 100%;
			}
			& button.shortcut {
				width: 100%;
				border-radius: 2rem;
				gap: 0.5rem;
				height: 3rem;
				justify-content: flex-start;
				padding-inline-start: 1rem;
				&.expanded {
					max-width: 350px;
				}
			}
			& a {
				width: 100%;
				justify-content: flex-start;
				& button.icon {
					width: 100%;
					border-radius: 2rem;
				}
			}
			h2 {
				display: flex;
			}
			a {
				display: flex;
			}
			& .nav-text {
				display: flex;
			}
			span.icon {
				display: flex;
			}
		}
	}

	.nav-button.config {
		bottom: 3rem;
		left: 1rem;
		right: 1rem;
		z-index: 5000;
	}

	.close-button {
		position: fixed;
		top: 10px;
		left: 10px;
		width: 30px;
		height: 30px;
		border: none;
		color: white;
		cursor: pointer;
		background: var(--secondary-color) !important;
		display: flex;
		justify-content: center;
		text-align: center;
		font-size: 1rem;
		border-radius: 8px;
		transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);
	}

	.close-button:hover {
		opacity: 0.8;
		background-color: rgb(62, 137, 194);
	}

	.avatar-container {
		overflow: hidden;
	}

	.avatar {
		border-radius: 50%;
		width: 90%;
		height: 90%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: #444;
		color: #fff;
	}

	.top-buttons {
		display: flex;
		flex-direction: row;
		position: relative;
	}

	.bottom-buttons {
		display: flex;
		flex-direction: column;
		position: absolute;
		bottom: 3rem;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.nav-button,
	.thread-toggle,
	.close-button {
		color: var(--tertiary-color);
		background: transparent;
		font-size: auto;
		border: none;
		cursor: pointer;
		display: flex;
		justify-content: center;
		align-items: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border-radius: 50%;
		transition: all 0.2s ease-in-out;
		overflow: hidden;
		user-select: none;
	}

	.nav-button.active {
		border: 1px solid var(--secondary-color);
		background: var(--bg-color);
		width: 2.5rem;
		height: 2.5rem;
		box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);

		&.expanded {
			height: 3rem;
		}
	}

	.thread-list-visible .thread-toggle {
		left: 0;
	}

	.nav-button:hover,
	.thread-toggle:hover {
		box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
		animation: nonlinearSpin 3.3s ease;
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

	:global(.sidenav .nav-button svg),
	:global(.sidenav .thread-toggle svg) {
		transition: transform 0.1s ease;
	}

	:global(.sidenav .nav-button:hover svg),
	:global(.sidenav .thread-toggle:hover svg) {
		transform: scale(1.1);
	}

	.language-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);
		backdrop-filter: blur(40px);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1002;
	}

	.language-notification {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		/* background-color: var(--primary-color); */
		color: var(--text-color);
		padding: 20px;
		border-radius: var(--radius-m);
		z-index: 1000;
		/* border: 1px solid var(--tertiary-color); */
		display: flex;
		flex-direction: column;
		text-justify: center;
		justify-content: center;
		align-items: center;
		gap: 2rem;
		font-size: 2rem;
	}

	.language-notification p {
		margin: 0;
	}

	.quote {
		font-size: 16px;
		font-style: italic;
		line-height: 1.5;
	}

	.mobile-menu {
		display: flex;
		align-items: center;
		justify-content: center;
		position: fixed;
		bottom: 0;
		width: 100%;
		/* bottom: calc(100% - 280px); */
		/* width: calc(100% - 60px); */
		/* padding: 20px; */
		z-index: 99;
		/* border: 1px solid #000000; */
		/* background: linear-gradient(to top, #3f4b4b, #333333); */
		/* background-color: #2b2a2a; */
		// background: var(--bg-gradient-r);

		/* border-radius: 20px; */
		/* background-color: black; */
		/* height: 80px; */
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
		// border-top-left-radius: 20px;
		// border-top-right-radius: 20px;
	}

	.mobile-btns {
		margin-left: 0;
		bottom: 0;
		margin-bottom: 0;
		margin-right: 0;
		height: 100%;
		width: 100%;
		gap: 2rem;
		padding: 0.75rem 1rem;
		border: none;
		cursor: pointer;
		color: var(--text-color);
		text-align: left;
		align-items: center;
		justify-content: space-between;
		transition: background-color 0.2s;
		// border-radius: var(--radius-m);
		display: flex;
		flex-direction: row;
		//   background: var(--bg-gradient) !important;
		margin-bottom: 0.5rem;
		left: 0;
		right: 0;
		border-radius: var(--radius-l);
	}

	.mobile-btns a {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		width: 60px;
		// padding: 0 1rem;
		position: relative;
		// padding: 0.5rem 1rem;
		height: 60px;
		border: none;
		border-radius: 50%;
		// background: var(--secondary-color);
		color: var(--placeholder-color);
		cursor: pointer;
		transition: all 0.2s ease-in-out;
		& h3 {
			margin: 0;
			font-weight: 300;
			font-size: var(--font-size-sm);
			font-weight: 600;
			line-height: 1.4;
			&.active {
				background: var(--primary-color) !important;
				color: var(--tertiary-color);
				font-size: var(--font-size-xs);
			}
			&:hover {
				background: rgba(255, 255, 255, 0.1);
			}
		}
	}
	.nav-button.drawer {
		left: 1rem;
		bottom: 1rem;
		height: 3rem !important;
		width: 3rem !important;
		color: var(--tertiary-color);
		border: 1px solid transparent !important;
		&.expanded {
			width: auto !important;
		}
	}
	.nav-button.reveal {
		&.reveal-active {
			background: var(--primary-color);
			
		}
	}
	.nav-button.drawer.active,
	.nav-button.toggle.active {
		border: 1px solid var(--secondary-color);
		border-radius: 1rem !important;
		background: var(--bg-color) !important;
		width: auto !important;
		height: 3rem !important;
		box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
		&:hover {
			animation: none;
		}
		&.expanded {
			height: 3rem;
		}
	}

	.search-wrapper.logo-hovered {
		opacity: 0;
		transform: translateY(-10px);
		pointer-events: none;
		transition:
			opacity 0.2s ease,
			transform 0.2s ease;
	}
	@media (max-width: 1000px) {
		main {
			overflow-y: hidden;
		}

		.navigator-menu {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: flex-end;
			position: absolute;
			flex: 1;
			height: auto;
			padding: 0.5rem;
			gap: 1rem;
			bottom: 4rem;
			left: 0;
			top: auto;
			width: auto;
			background: transparent;
			padding-bottom: 0;
			z-index: 9999;
			border-right: none;
			border-radius: 2rem;
			&:hover {
				width: auto !important;
			}
			& button.shortcut {
				padding: 0;
				margin: 0;
				background: transparent;
				border: 1px solid transparent;
				width: 60px;
				height: 60px;
				& .user-avatar {
					width: 60px !important;
					height: 60px !important;
					border-radius: 50%;
					object-fit: cover;
				}
				& .nav-text {
					display: none;
				}
				& .icon {
					display: none;
				}
				& .tracker {
					display: none;
				}

				&:hover {
					& .nav-text {
						display: flex;
					}
					& .icon {
						display: flex;
					}
					& .tracker {
						display: flex;
					}
				}
			}
			button.user-wrapper {
				display: flex;
				flex-direction: row !important;
				align-items: flex-start;
				justify-content: flex-end;
				background: transparent !important;
				height: auto;
				width: 100%;
				gap: 0;
			}
			.user-shortcuts {
				display: flex;
				align-items: center;
				width: 100%;
				border: 1px solid var(--line-color);
				gap: 0.5rem;
				border-radius: 2rem;
				transition: all 0.2s ease;

				&:hover {
					transform: scale(1.05);
					padding-right: 1rem;
					width: 200px !important;
					background: var(--primary-color);
					box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
				}
			}
			&.expanded {
				width: 200px !important;
				& button.shortcut {
					padding: 0;
					margin: 0;
					background: transparent;
					border: 1px solid transparent;
					width: 100%;
					height: 60px;
					.user-shortcuts {
						width: 200px;
						&:hover {
							transform: translateX(0.5rem);
							padding-right: 0;
						}
					}

					& .nav-text {
						display: flex;
					}
					& .icon {
						display: flex;
					}
					& .tracker {
						display: flex;
					}
				}
				& a {
					flex-direction: row !important;
					width: 100% !important;
					border-radius: 3rem;
				}
				& .nav-text {
					display: flex;
				}
				& .logo-container {
					width: 200px !important;
				}
				& h2 {
					display: flex !important;
				}
			}
			& a {
				display: flex;
				justify-content: center;
				color: var(--placeholder-color);
				width: 60px !important;
				height: 60px;
				gap: 0.5rem !important;
				background: var(--primary-color);
				opacity: 1;
				border-radius: 50%;
				border: 1px solid var(--line-color);
				align-items: center;
				/* padding: 20px; */
				text-decoration: none;
				// transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
				transform: all 0.4s ease;
				box-shadow: -20px 40px 40px 60px rgba(0, 0, 0, 0.1);

				&:hover {
					box-shadow: -20px 40px 40px 60px rgba(251, 245, 245, 0.1);
					color: var(--tertiary-color);
					opacity: 100%;
					cursor: pointer;
				}
				& .nav-text {
					display: none;
				}
			}
			& .logo-container {
				position: relative;
				top: 0.5rem;
				left: 0;
				width: 80px;
			}
		}
		.illustration {
			position: fixed;
			width: auto;
			height: auto;
			max-width: 70vh;
			left: auto;
			top: 50%;
			transform: translateY(-50%) translateX(50%);
			border-radius: 10rem;
			opacity: 0.1;
			z-index: 1;
			pointer-events: none;
			mix-blend-mode: multiply;
			filter: contrast(2.5) brightness(0.8);
			object-fit: contain;
		}
		.auth-content {
			position: absolute;
			overflow: hidden;
			display: flex;
			top: 10rem;
			left: 0;
			right: auto !important;
			/* background-color: #2b2a2a; */
			/* padding: 2rem; */
			width: 100% !important;
			max-width: 600px;
			/* max-width: 500px; */
			overflow-y: auto;
			transition: all 0.3s ease;
			/* background-color: #2b2a2a; */
			/* padding: 2rem; */
			/* max-width: 500px; */
			height: auto;
		}
		.header-auth {
			position: relative !important;
		}
		a {
			img {
				display: none;
			}
			h2 {
				display: none !important;
			}
		}

		.nav-links {
			margin: 0;
			// justify-content: flex-end;
			width: calc(100% - 4rem);
			span {
				gap: 1.5rem;
			}
		}

		.nav-link {
			font-size: 1rem;
			padding: 0 !important;
			margin: 0 !important;
			width: auto;

			& span {
				gap: 1rem;
				font-size: 1rem;
			}
			&.home {
				width: auto;
				justify-content: flex-end;

				& h2 {
					font-size: 1rem;
				}
			}
		}
		h1 {
			display: none;
		}

		.profile-content {
			position: relative;
			width: 100%;
			top: 1rem;
			bottom: auto;
			padding: 0;
			margin: 0;
			/* right: 0; */
			/* background-color: #2b2a2a; */
			/* box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);  */
			border-radius: 2rem;
			/* max-width: 500px; */
			/* max-height: 90vh; */
			overflow: none;
			transition: all 0.3s ease;
			backdrop-filter: blur(30px);
			border: 1px solid var(--secondary-color);
		}
		.nav-button {
			background: transparent !important;
		}

		.nav-button:hover,
		.thread-toggle:hover {
			box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
			animation: none;
			transform: scale(0.9);
		}

		.nav-button.info {
			display: flex !important;
			position: fixed !important;
			background-color: transparent;
			top: 0;
			left: 0;
			& .shortcut-buttons {
				display: none;
			}

			// display: none !important;
			&:hover {
				border-radius: 2rem;
				gap: 1rem;
				padding: 0;
				&.nav-button {
					backdrop-filter: blur(20px);
				}
				& .shortcut-buttons {
					display: flex;
					gap: 1rem;
				}
				& .nav-button {
					display: flex;
				}
			}
			&:first-child {
				display: flex;
			}
			& .nav-button {
				display: none;
				&:first-child {
					display: flex;
				}
			}
		}
		.nav-button.info.logo {
			position: relative !important;
			flex-direction: row !important;
			&:hover {
				width: 100% !important;
			}
		}
		.nav-button.info.user {
			// display: flex !important;
			// position: relative !important;
			// height: auto !important;
			// width: auto !important;
			// cursor: pointer;
			// top: 0;
			// left: auto;
			// background: transparent !important;
			width: auto;

			& img.user-avatar {
				height: 2rem !important;
				padding: 0;
			}
			&:hover {
				box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
				// width: 6rem !important;
				// height: 6rem !important;
				justify-content: center;
				width: auto !important;
				padding: 0 !important;
				z-index: 9999;
			}
		}
		.user-wrapper {
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
			align-self: flex-start;
			width: 100%;
			gap: 1rem;
		}
		.user-shortcuts {
			display: flex;
			flex-direction: row;
			align-items: center;
			width: auto;
			justify-content: flex-start;
		}
		.project {
			left: 0;
			right: 0;
		}

		.logo-container {
			background-color: transparent;
			box-shadow: none;
			align-items: center;
			justify-content: center;
		}

		header {
			gap: 0;
			justify-content: space-around;
			// justify-content: center;
		}

		.header-logo {
			display: flex;
		}

		.menu-button {
			position: absolute;
			right: 2rem;
		}

		footer {
			color: white;
			text-align: center;
			width: 100%;
			padding: 1rem 0;
		}

		.project {
			margin-left: 0;
		}
		.nav-button.info {
			display: flex;
			flex-direction: row;
			justify-content: center;
			border-radius: 1rem !important;
			animation: none !important;

			span.icon {
				display: none;
				padding: 1rem;
				border-radius: 50%;
				&:hover {
					background: red;
					padding: 1rem;
				}
			}
			h2 {
				display: none;
			}

			a {
				display: none;
			}
			& .nav-text {
				display: none;
			}

			&:hover {
				justify-content: flex-start;

				opacity: 1;

				border-radius: 2rem;
				padding: 0;

				& .nav-text {
					display: none;
				}
				& h2 {
					display: none;
				}
				& a {
					display: flex;
				}
				span.icon {
					display: none;
				}
			}
			&.expanded {
				display: none;
				width: 350px;
				justify-content: space-around;
				h2 {
					display: flex;
				}
				a {
					display: flex;
				}
				& .nav-text {
					display: flex;
				}
				span.icon {
					display: flex;
				}
			}
		}

		.nav-button.toggle {
			display: none;
		}

		.sidenav {
			display: flex;
			justify-content: center;
			// backdrop-filter: blur(30px);
			background: var(--bg-gradient);
			flex-direction: row;
			height: auto;
			overflow-x: hidden;
			overflow-y: hidden;
			bottom: 0 !important;
			border-radius: 0 !important;
			gap: 10px;
			width: 100%;
			max-width: 100%;

			flex: 1;
			top: auto;
			bottom: 0;
			padding: 0;
			z-index: 1100;
			border-radius: 0;
			transition: all 0.3s ease-in;
			&:hover {
				& .nav-button.info.user,
				& .nav-button.drawer {
					display: flex !important;
				}
			}
		}

		.navigation-buttons {
			flex-direction: row;
			margin-bottom: 0;
			width: 100% !important;
			right: 0;
			left: 0;
			align-items: center;
			justify-content: space-around;
		}

		.bottom-buttons {
			flex-direction: row;
			margin: 0;
			left: auto;
			width: 7rem;
			gap: 2rem;
			height: 97vh;
		}

		.top-buttons {
			flex-direction: row;
			margin: 0;
			gap: 8px;
		}
		.profile-overlay {
			margin-left: 0;
			left: 0;
			height: auto;
			width: 500px !important;
			backdrop-filter: blur(0);
			background: var(--bg-color);
		}
		.nav-button,
		.thread-toggle,
		.avatar-container {
			width: 40px;
			height: 40px;
			padding: 0.3rem;
			border-radius: 50% !important;
		}

		.nav-button.info:hover {
			transform: none;
		}

		.nav-button.toggle {
			display: none;
		}
	}
	@media (max-width: 767px) {
		nav {
			justify-content: center;
			height: auto;
		}
		.nav-links {
			margin: 0;
			gap: 0;
			transition: all 0.1s ease;
			flex-direction: row;
			justify-content: space-between;
			align-items: flex-start;

			width: calc(100% - 2rem);
			& h2 {
				display: flex;
			}
			&:hover {
				margin-top: 1rem;
				flex-direction: column;
				justify-content: center;
				align-items: center;
				gap: 1rem;
				height: auto;
				border-bottom: 1px solid var(--line-color);
				border-bottom-left-radius: 2rem;
				border-bottom-right-radius: 2rem;
				// transform: translateY(50%);
				// & h2 {
				// 	display: none;
				// }
				width: 100%;
				span {
					display: flex;
					flex-direction: column;
					justify-content: center;
					align-items: center;
				}
			}
		}

		button.nav-link {
			span {
				display: none;
				flex-direction: column;
				justify-content: center;
				align-items: center;
				width: 5rem;
			}
			&:hover {
				span {
					display: flex;
				}
			}
		}
		.nav-link {
			font-size: 0.8rem;
			padding: 0 !important;
			margin: 0 !important;
			flex: 0;
			width: auto;

			& span {
				display: none;
			}
			&.home {
				display: flex;
			}
		}
		.modal-overlay {
			width: 100%;
			backdrop-filter: none;
			background: transparent;
		}

		.project {
			margin-left: 0;
		}
		.logo-container a {
			display: none;
		}
	}
	@media (max-width: 450px) {
		main {
			background: var(--bg-gradient-r);
			color: var(--text-color);
			width: 100%;
			height: 100%;
			height: auto;
			left: 0;
			bottom: 0;
			position: fixed;
			overflow: auto;
			overflow-y: hidden;
			display: flex;
			flex-grow: 1;
			height: -webkit-fill-available;
		}

		span.search-wrapper {
			background: var(--secondary-color);
			display: flex;
			flex-direction: row;
			align-items: center;
			position: relative;
			width: 200px !important;
			height: 2rem;
			padding: 0 0.5rem;
			border-radius: 1rem;
			border: 1px solid var(--line-color);
			&.search-open {
				height: 2rem;
				padding: 0;
				flex-direction: column;
				align-items: flex-start;
				justify-content: flex-start;
				background: var(--primary-color);
			}
			&.dropdown-open {
				height: auto !important;
				min-height: 2rem;
				flex-direction: column;
				align-items: stretch;
				padding: 0;
			}
		}
		.nav-link.login {
			span {
				display: none;
			}
		}
		.sidenav {
			display: flex;
			// backdrop-filter: blur(30px);
			background: transparent;
			flex-direction: row;
			align-items: center;
			bottom: 0;
			padding: 0;
			height: 3rem;
			position: absolute;
			width: 99%;
			margin-left: 0.5%;
			border-radius: 0;
			flex: 1;
			overflow-x: hidden !important;
			left: 0;
			right: 0;
			z-index: 10;
			transition: all 0.1s ease-in;

			& .nav-button.info.user,
			& .nav-button.drawer {
				display: flex !important;
				// display: none !important;
				width: 2.5rem !important;
				height: 2.5rem !important;
				&:hover {
					& .nav-button.info.user,
					& .nav-button.drawer {
						display: flex !important;
						width: 3rem !important;
						height: 3rem !important;
					}
				}
				&.reveal {
					display: flex !important;
				}
			}
		}

		.nav-button.drawer {
			background-color: var(--primary-color) !important;
			height: 3rem !important;
			width: 3rem !important;
		}

		.nav-button.info {
			top: 0;
		}

		.navigation-buttons {
			display: flex;
			flex-direction: row;
			// border: 1px solid var(--line-color);
			gap: 0.5rem;
			width: 100% !important;
			height: 4rem;
			// background: var(--secondary-color);
			border-radius: 0;
			align-items: center;
			justify-content: space-around;
			overflow: hidden;
			transition: all 0.2s ease;
		}

		.top-buttons {
			flex-direction: row;
			margin: 0;
			gap: 8px;
		}

		.nav-button,
		.thread-toggle,
		.avatar-container {
			width: 40px;
			height: 40px;
			padding: 0.3rem;
		}

		.nav-button:hover,
		.thread-toggle:hover {
			transform: scale(1.1);
		}
	}
</style>

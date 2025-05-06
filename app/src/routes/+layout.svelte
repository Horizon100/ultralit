<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/stores';
	import { navigating } from '$app/stores';
	import { goto } from '$app/navigation';
	import { fly, fade, slide } from 'svelte/transition';
	import horizon100 from '$lib/assets/horizon100.svg';
	import type { ThreadStoreState } from '$lib/types/types';
	import TaskNotification from '$lib/components/common/containers/TaskNotification.svelte';
	import { taskNotifications } from '$lib/stores/taskNotificationStore';
	// Components
	import Kanban from '$lib/components/lean/Kanban.svelte';
	import ModelSelector from '$lib/components/ai/ModelSelector.svelte';
	import PromptSelector from '$lib/components/ai/PromptSelector.svelte';
	import Profile from '$lib/components/ui/Profile.svelte';
	import Auth from '$lib/components/auth/Auth.svelte';
	import StyleSwitcher from '$lib/components/ui/StyleSwitcher.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import TimeTracker from '$lib/components/features/TimeTracker.svelte';
	import Sidenav from '$lib/components/navigation/Sidenav.svelte';
	import ProjectDropdown from '$lib/components/navigation/ProjectDropdown.svelte';
	
	// Stores
	import { currentUser, pocketbaseUrl, signOut } from '$lib/pocketbase';
	import { currentTheme } from '$lib/stores/themeStore';
	import { currentLanguage, setLanguage, languages, initializeLanguage } from '$lib/stores/languageStore';
	import { threadsStore, showThreadList } from '$lib/stores/threadsStore';
	import { isNavigating } from '$lib/stores/navigationStore';
	import { t } from '$lib/stores/translationStore';
	import { threadListVisibility } from '$lib/clients/threadsClient';
	import { showAuth, toggleAuth } from '$lib/stores/authStore';

	// Icons
	import {
	  MessageSquare,
	  X,
	  PanelLeftClose,
	  PanelLeftOpen,
	  Drill,
	  NotebookTabs,
	  Sun,
	  Moon,
	  Languages,
	  Camera,
	  Plus,
	  LogIn,
	  LogOut,
	  User,
	  Sunrise,
	  Sunset,
	  Focus,
	  Bold,
	  Gauge,
	  Component,
	  Bone,
	  SquareKanban,
	  MapPin,
	  Combine,
	  MessageCircleDashed,
	  MessageCircle,
	  ChevronLeft,
	  HelpCircle,
	  InfoIcon,
	  Settings2,
	  Settings,
	  Brain,
	  Menu,
	  Code,
	  KanbanSquare,
	  Box,
	  ChevronDown,
	  LogOutIcon,
	  Github,

	  CircleDollarSign,

	  Link,

	  Table,

	  ComponentIcon,

	  Home





	} from 'lucide-svelte';
	
	// Component props
	export let onStyleClick: (() => void) | undefined = undefined;
	
	// Local state
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

	// Reactive declarations
	$: placeholderText = getRandomQuote();
	$: isThreadListVisible = $showThreadList;
	$: currentPath = $page.url.pathname;
	$: showBottomButtons = currentPath === '/';
	$: isNarrowScreen = innerWidth <= 1000;
	$: user = $currentUser;
	
	// Event handling
	const dispatch = createEventDispatcher<{
	  promptSelect: any;
	  promptAuxclick: any;
	  threadListToggle: void;
	}>();
	
	// Styles configuration
	const styles = [
	  { name: 'Daylight Delight', value: 'default', icon: Sun },
	  { name: 'Midnight Madness', value: 'dark', icon: Moon },
	  { name: 'Sunrise Surprise', value: 'light', icon: Sunrise },
	  { name: 'Sunset Serenade', value: 'sunset', icon: Sunset },
	  { name: 'Laser Focus', value: 'focus', icon: Focus },
	  { name: 'Bold & Beautiful', value: 'bold', icon: Bold },
	  { name: 'Turbo Mode', value: 'turbo', icon: Gauge },
	  { name: 'Bone Tone', value: 'bone', icon: Bone },
	  { name: 'Ivory Tower', value: 'ivoryx', icon: Component }
	];
	
	// Functions
	function getRandomQuote() {
	  const quotes = $t('extras.quotes');
	  return quotes[Math.floor(Math.random() * quotes.length)];
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
	  goto('/');
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
	
	function getAvatarUrl(user: any): string {
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
	  try {
		await signOut();
		showProfile = false;
		goto('/');
	  } catch (error) {
		console.error('Error during logout:', error);
	  }
	}
	
	// Lifecycle hooks
	onMount(async () => {
		try {
			console.log('onMount initiated');
			
			// Initialize theme and language
			currentTheme.initialize();
			await initializeLanguage();
			
			// Set up user info
			if ($currentUser && $currentUser.id) {
			console.log('Current user:', $currentUser);
			username = $currentUser.username || $currentUser.email;
			}
			
			// Set up navigation tracking
			const unsubscribe = navigating.subscribe((navigationData) => {
			if (navigationData) {
				isNavigating.set(true);
			} else {
				setTimeout(() => {
				isNavigating.set(false);
				}, 300);
			}
			});
			
			// Set up theme tracker
			const themeUnsubscribe = currentTheme.subscribe((theme) => {
			document.documentElement.className = theme;
			});
			
			// Define function to update active section
			function updateActiveSection(sectionId: string) {
			activeSection = sectionId;
			}
			
			// Add IntersectionObserver for active section tracking
			const observerOptions = {
			root: null, // Use the viewport
			rootMargin: '0px',
			threshold: 0.5 // Consider section visible when 50% visible
			};
			
			const sectionObserver = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
				updateActiveSection(entry.target.id);
				}
			});
			}, observerOptions);
			
			// Observe all sections with IDs including specific divs
			const sections = document.querySelectorAll('section[id], div[id="start"], div[id="features"], div[id="pricing"], div[id="integrations"], div[id="comparison"]');
			sections.forEach(section => {
			sectionObserver.observe(section);
			});
			
			// Add hash change listener
			const handleHashChange = () => {
			activeSection = window.location.hash.slice(1);
			};
			window.addEventListener('hashchange', handleHashChange);
			handleHashChange(); // Initial check
			
			// Return cleanup function
			return () => {
			unsubscribe();
			themeUnsubscribe();
			sectionObserver.disconnect();
			window.removeEventListener('hashchange', handleHashChange);
			};
		} catch (error) {
			console.error('Error during onMount:', error);
		}
	});
  </script>

<svelte:window bind:innerWidth />
	{#if $currentUser}
		<div class="project">
			<ProjectDropdown/>
		</div>
	{/if}
<div class="app-container {$currentTheme}">
	<TaskNotification 
  notifications={$taskNotifications} 
  on:remove 
  on:linkClick={handleLinkClick}
/>
	<header>
		<nav style="z-index: 1000;">
			<!-- <TimeTracker /> -->
			<!-- <button class="nav-button" on:click={handleLanguageChange}> -->
			<!-- <Languages size={24} /> -->
			<!-- <span class="language-code">{$currentLanguage.toUpperCase()}</span> -->
			<!-- <span>{$t('lang.flag')}</span>
		
			  </button> -->


			<!-- {#if isNarrowScreen} -->


			<!-- {:else} -->
				{#if currentPath === '/'}
					{#if $currentUser}
						
					{:else}
					<div class="nav-links" transition:fly={{ y: -200, duration: 300 }}>

						<button 
							class="nav-link"
							on:click={toggleAuth}
							in:fly={{ y: 0, duration: 500, delay: 400 }}
							out:fly={{ y: 50, duration: 500, delay: 400 }}
							>
							<LogIn/>
							<span>
								{$t('profile.login')}
							</span>
						</button>
						<span>
							<a
								href="#features"
								class="nav-link {activeSection === 'features' ? 'active' : ''}"
								on:click|preventDefault={() => scrollToSection('features')}
							>
								<!-- <ComponentIcon/> -->
								<span>
									{$t('nav.features')}
								</span>
							</a>
							<a
								href="#pricing"
								class="nav-link {activeSection === 'pricing' ? 'active' : ''}"
								on:click|preventDefault={() => scrollToSection('pricing')}
							>
								<!-- <CircleDollarSign/> -->
								<span>
									{$t('nav.pricing')}
								</span>
							</a>
							<a
								href="#integrations"
								class="nav-link {activeSection === 'integrations' ? 'active' : ''}"
								on:click|preventDefault={() => scrollToSection('integrations')}
							>
								<!-- <Link/> -->
								<span>
									{$t('nav.integrations')}
								</span>
							</a>
							<!-- <a
								href="#comparison"
								class="nav-link {activeSection === 'comparison' ? 'active' : ''}"
								on:click|preventDefault={() => scrollToSection('comparison')}
							> -->
								<!-- <span>
									{$t('nav.comparison')}
								</span>
							</a> -->
						</span>
						<a
							href="#start"
							class="nav-link home {activeSection === 'start' ? 'active' : ''}"
							on:click|preventDefault={() => scrollToSection('start')}
						>
							<img src={horizon100} alt="Horizon100" class="logo" />
							<h2>vRAZUM</h2>                         
						</a>
					</div>

					{/if}
				{/if}
			<!-- {/if} -->


		</nav>
	</header>

	<div class="sidenav" 
	class:expanded={isNavExpanded} 
	transition:slide={{ duration: 300 }}
	>
	<div
		class="navigation-buttons"
		class:hidden={isNarrowScreen}
		in:fly={{ x: -200, duration: 300 }}
		out:fly={{ x: 200, duration: 300 }}
	>

	{#if $currentUser}

		<button
			class="nav-button drawer"
			class:expanded={isNavExpanded}
			class:active={currentPath === '/chat'}
			on:click={(event) => {
			if (currentPath === '/chat') {
				event.preventDefault();
				toggleThreadList();
				isNavExpanded = false;
			} else {
				navigateTo('/chat');
				if (isNavExpanded) {
					isNavExpanded = false;
				}
			}
			}}
		>
			{#if currentPath === '/chat' && showThreadList}
			<PanelLeftClose />
			{:else if currentPath === '/chat'}
			<MessageCircleDashed />
			{:else}
			<MessageCircle />
			{/if}
			
			{#if isNavExpanded}
			<span class="nav-text">Chat</span>
			{/if}
		</button>
		<button
			class="nav-button drawer"
			class:expanded={isNavExpanded}
			class:active={currentPath === '/lean'}
			on:click={() => navigateTo('/lean')}
		>
			<SquareKanban />
			{#if isNavExpanded}
				<span class="nav-text">Lean</span>
			{/if}
		</button>

				<button 
				class="nav-button info user" 
				class:expanded={isNavExpanded}
				on:click={() => {
				  toggleAuthOrProfile();
				  // Only close the nav if it's expanded
				  if (isNavExpanded) {
					isNavExpanded = false;
				  }
				}}
			  >
				{#if getAvatarUrl($currentUser)}
				<img 
					src={getAvatarUrl($currentUser)}
					alt="User avatar" 
					class="user-avatar" 
				/>
				{:else}
					<div class="default-avatar">
						{($currentUser?.name || $currentUser?.username || $currentUser?.email || '?')[0]?.toUpperCase()}
					</div>
				{/if}
				<span class="nav-text">{username}

				</span>
				<span class="icon"
				on:click={() => {
					logout();
					// Only close the nav if it's expanded
					if (isNavExpanded) {
					  isNavExpanded = false;
					}
				  }}
				on:click={logout} >
					<LogOutIcon size={24} />

				</span>
					{#if isNavExpanded}


					{/if}
				</button>
				<button
				class="nav-button info"
				class:expanded={isNavExpanded}
		
				>
				<div 
					class="logo-container" 
					on:click|stopPropagation={() => {
					// Set a flag before navigating to root
					sessionStorage.setItem('directNavigation', 'true');
					navigateTo('/');
					}}
					style="cursor: pointer;"
				>
					<img src={horizon100} alt="Horizon100" class="logo" />
					<h2>vRAZUM</h2>
				</div>
				<div class="shortcut-buttons">
					<a
					href="https://github.com/Horizon100/ultralit"
					target="_blank"
					rel="noopener noreferrer"
				>
					<button class="shortcut"
					class:expanded={isNavExpanded}
					>
						<Github size="30" /> 
						{#if isNavExpanded}
							<span class="nav-text">GitHub</span>
						{/if}
					</button>
					</a>
					<button
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
					<Combine />
					
					{#if isNavExpanded}
					<span class="nav-text">Canvas</span>
				{/if}
					</button>
					<button
						class="shortcut"
						class:expanded={isNavExpanded}
						class:active={currentPath === '/notes'}
						on:click={() => {
							navigateTo('/notes');
							if (isNavExpanded) {
							isNavExpanded = false;
							}
						}}	
						>
						<NotebookTabs />
						{#if isNavExpanded}
						<span class="nav-text">Notes</span>
						{/if}
					</button>
					
		
			</div>
				{#if isNavExpanded}
				<!-- <h2>vRAZUM</h2> -->
		
				{/if}
			</button>
				<button class="nav-button toggle" on:click={() => {
					toggleNav();
					if (showProfile || showAuthModal) {
					  showProfile = false;
					  showAuthModal = false;
					}
				  }}>
					{#if isNavExpanded}
					<PanelLeftClose  />
					{:else}
					<PanelLeftOpen />
					{/if}
				  </button>


		{:else}
			<!-- <LogIn /> -->
		{/if}
	</div>

	<!-- Navigation Buttons -->

</div>



{#if showLanguageNotification}
	<div class="language-notification" transition:fade={{ duration: 300 }}>
		{$t('lang.notification')}
	</div>
{/if}

{#if showAuthModal}
	<div
		class="auth-overlay"
		on:click={handleOverlayClick}
		transition:fade={{ duration: 300 }}
	>
		<div class="auth-content" transition:fade={{ duration: 300 }}>
			<button
				on:click={() => (showAuthModal = false)}
				class="close-button"
				in:fly={{ y: 50, duration: 500, delay: 400 }}
				out:fly={{ y: 50, duration: 500, delay: 400 }}
			>
				<X size={24} />
			</button>
			<Auth on:success={handleAuthSuccess} on:logout={handleLogout} />
		</div>
	</div>
{/if}

{#if showProfile}
	<div
		class="profile-overlay"
		on:click={handleOverlayClick}
		transition:fly={{ y: -200, duration: 300 }}
	>
		<div class="profile-content" transition:fly={{ y: -20, duration: 300 }}>
			<!-- <button
				class="close-button"
				transition:fly={{ y: -200, duration: 300 }}
				on:click={() => (showProfile = false)}
			>
				<ChevronLeft size={24} />
			</button> -->
			<Profile
				user={$currentUser}
				onClose={() => (showProfile = false)}
				onStyleClick={handleStyleClick}
			/>
		</div>
	</div>
{/if}
<!-- {#if showProfile}
<div
	class="profile-overlay"
	on:click={handleOverlayClick}
	transition:fly={{ y: -200, duration: 300 }}
>
	<div class="profile-content" transition:fly={{ y: -20, duration: 300 }}>
		<button
			class="close-button"
			transition:fly={{ y: -200, duration: 300 }}
			on:click={() => (showProfile = false)}
		>
			<X size={24} />
		</button>
		<Profile
			user={$currentUser}
			onClose={() => (showProfile = false)}
			onStyleClick={handleStyleClick}
		/>
	</div>
</div>
{/if} -->
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
	<div
		class="style-overlay"
		on:click={handleOverlayClick}
		transition:fly={{ x: -200, duration: 300 }}
	>
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
			<div class="auth-content" >
				<button
					on:click={() => (showAuthModal = false)}
					class="close-button"
					in:fly={{ y: 50, duration: 500, delay: 400 }}
					out:fly={{ y: 50, duration: 500, delay: 400 }}
				>
					<X size={24} />
				</button>
				<Auth on:success={handleAuthSuccess} on:logout={handleLogout} />
			</div>
		</div>
	{/if}


	<main>
		<slot />
	</main>

	<footer>
		<!-- Footer content -->
	</footer>
</div>

<style lang="scss">
	@use 'src/styles/themes.scss' as *;
	* {
		//   font-family: 'Source Code Pro', monospace;
		font-family: var(--font-family);
		transition: all 0.3s ease;
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

	button {
		transition: all 0.3s ease;
		&.icon {
			background: var(--bg-gradient);
			border: 1px solid var(--secondary-color);
			border-radius: 50%;
			width: 2rem;
			height: 2rem;
			display: flex;
			align-items: center;
			justify-content: center;


		}

	}

	.nav-button {
		color: var(--text-color);
		background: var(--bg-gradient-right);
		padding: 4px;
		font-size: 16px;
		border: none;
		cursor: pointer;
		border-radius: 12px;
		display: flex;
		justify-content: center;
		align-items: center;
		width: 50px;
		height: 50px;
		padding: 0.5rem;
		transition: all 0.2s ease-in-out;
		overflow: hidden;
		user-select: none;

		& img.logo {
			width: 2rem;
			height: 2rem;
		}
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
		position: relative;
		top: 0;
		/* background-color: #2b2a2a; */
		/* padding: 2rem; */
		width: auto;
		/* max-width: 500px; */
		height: auto;
		overflow-y: auto;
		transition: all 0.3s ease;

	}
	.profile-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		flex-grow: 1;
		/* box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);  */
		justify-content: flex-end !important;
		align-items: flex-start !important;
		z-index: 1002;
		transition: all 0.3s ease;
	}

	.project {

		margin-left: 0;
		top: 0;
		// z-index: 999;
		display: flex;
		// overflow: visible; 
	}

	.profile-content {
		position: relative;
		width:auto;
		height: 94vh;
		max-width: 500px;
		top: 4rem;
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


	.auth-content {
		position: fixed;
		top: 0;
		/* background-color: #2b2a2a; */
		/* padding: 2rem; */
		width: 100%;
		/* max-width: 500px; */
		height: auto;
		overflow-y: auto;
	}

	header {
		display: flex;
		flex-direction: row;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		justify-content: center;
		/* height: 80px; */
		/* margin-top: 0; */
		/* align-items: center; */
		height: auto;
		z-index: 1;
		/* padding: 5px 5px; */
		background: var(--bg-color);
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

	.header-logo:hover {
		background-color: rgba(255, 255, 255, 0.1);
		transform: translateY(-2px);
	}

	.logo-container {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		height: 3rem;

		gap: 0.5rem;
		position: relative;

		user-select: none;
		width: 10rem;

		& h2 {
			padding: 0 !important;
			height: auto !important;
			margin: 0;
			font-style: normal;
		}
		&:hover {
			h2 {
				// font-size: 1rem;
			}
			}

		}
	

	.logo {
		width: 2rem;
		height: auto;

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
			display: flex;

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
		width: auto !important;
		align-items: center;
		/* padding: 20px; */
		text-decoration: none;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

	}

	.nav-links {
		display: flex;
		flex-direction: row;
		font-size: 1.25rem;
		gap: 1rem;
		// font-style: italic;
		align-items: center;
		justify-content: center;
		/* padding: 10px; */
		font-family: var(--font-family);
		// max-width: 1000px;
		width: 100vw;
		height: 3rem;
		& span {
			display: flex;
			flex-direction: row;
			gap: 2rem;
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
		flex: 1;
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
		height: 3rem;
		&.home {
			letter-spacing: 0;
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
	.profile-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		flex-grow: 1;
		justify-content: center;
		align-items: center;
		z-index: 1002;
		box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);
		transition: all 0.3s ease;
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
	.sidenav {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		justify-content: flex-end;
		gap: 10px;
		position: absolute;
		left: 0;
		right: 50% !important;
		top: 4rem;
		bottom: 1rem;
		padding: 0 0.5rem;
		z-index:1000;
		width: 3rem;

		border-radius: 0 1rem 1rem 0;
		transition: all 0.3s ease-in;
		border: 0px solid transparent;
		border-right: 1px solid transparent;
		&.expanded {
			width: 380px;
			backdrop-filter: blur(30px);
			border-right: 1px solid var(--bg-color);
		}
	}





	// .sidenav:hover {
	//   /* backdrop-filter: blur(10px); */
	// }

	.navigation-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
	justify-content: left;
	align-items: left;

	& .hidden {
		display: none;
	}
  }

  .nav-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-gradient-right);
    color: var(--text-color);
    border: none;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    width: auto;


    &.active {
      background: var(--tertiary-color);
      box-shadow: 0 0 10px rgba(74, 158, 255, 0.3);
	  &.expanded {
		width: 380px;
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
      width: 380px;
      justify-content: flex-start;
      padding: 0.5rem 1rem;
	  border-radius: var(--radius-s);
	  opacity: 1;
	  animation: none !important;
	  border-radius: 2rem !important;

    }

    &.toggle {
      margin-top: auto;

	  &:hover {
	  }
    }

    &.profile {
      margin-top: auto;
    }
  }

  .nav-text {
    font-size: 1rem;
    white-space: nowrap;
  }



	.auth-content {
		position: fixed;
		top: 0;
		/* background-color: #2b2a2a; */
		/* padding: 2rem; */
		width: 100%;
		/* max-width: 500px; */
		height: auto;
		overflow-y: auto;
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


	.shortcut-buttons {
			display: flex;
			flex-direction: row;
			gap: 0.5rem;
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
		& button.shortcut {
			background: var(--primary-color);
			display: flex;
			justify-content: center;
			align-items: center;
			width: 2rem;
			height: 2rem;
			border-radius: 50%;
			&:hover {
				background: var(--tertiary-color);
			}
		}
		& h2 {
			font-size: 1.2rem;
		}
		&.user {
			position: relative;
			justify-content: space-around;
			flex-direction: row !important;
			width: auto;
			padding: 0;
			top: 0;

			&.expanded {
				height: 3rem;
				width: 100%;
				justify-content: space-between;

			}

			&:hover {
				padding: 1rem;
				
			}

		}
		span.icon {
			display: none;
			padding: 0;
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
			}
		}
		&.expanded {
		width: 100%;
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
		}
		& a {
			width: 100%;
			justify-content: flex-start;
			& button.icon {
				width: 100%;
				border-radius: 2rem;;
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
		right: 1rem ;
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
	.close-button
	 {
		color: var(--text-color);
		background: var(--bg-gradient-right);
		padding: 4px;
		font-size: auto;
		border: none;
		cursor: pointer;
		border-radius: 50%;
		display: flex;
		justify-content: center;
		align-items: center;
		width: 2.5rem;
		height: 2.5rem;
		padding: 0.25rem;
		transition: all 0.2s ease-in-out;
		overflow: hidden;
		user-select: none;
	}
	

	.nav-button.active {
		border: 1px solid var(--secondary-color);
		background: var(--bg-color);
		width: 4rem;
		height: 4rem;
		box-shadow: 0 0 10px rgba(74, 158, 255, 0.3);

		&.expanded {
			height: 3rem;
		}
	}

	.thread-list-visible .thread-toggle {
		left: 310px;
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

	@media (max-width: 1000px) {
	main {
		overflow-y: hidden;

	}

	.nav-links {
		margin: 0;
		justify-content: flex-end;
		width: 100%;
		span {
			gap: 1.5rem;
		}
		button {
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
			width: 2rem !important;

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
		.nav-button.drawer {
			left: 1rem;
			bottom: 1rem;
			padding: 0;
			height: 2rem !important;
			width: 2rem !important;
			color: var(--placeholder-color);
			border: 1px solid transparent !important;
		}
		.nav-button.info {
			display: flex !important;
			position: fixed !important;
			background-color: transparent;
			top: 0.5rem;
			left: 0.5rem;
			& .shortcut-buttons {
				display: none;
			}
			
			// display: none !important;
			&:hover {
				max-width: 500px;
				border-radius: 2rem;
				padding: 0;
				&.nav-button {
					backdrop-filter: blur(20px);
				}
				& .shortcut-buttons {
					display: flex;
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
		.nav-button.info.user {
			display: flex !important;
			position: fixed !important;
			top: 0.5rem;
			left: 4rem;
			z-index: -1;

			& img.user-avatar {
					width: 2rem !important;
					height: 2rem !important;
					padding: 0;

				}
			&:hover {
				// width: 6rem !important;
				// height: 6rem !important;
				justify-content: center;
				width: 4rem !important;
				padding: 0;

				& img.user-avatar {
					width: 4rem !important;
					height: 4rem !important;
					padding: 0;

				}

			}
		}


		.project {
			position: absolute;
			left: 0;
			right: 0;
		}

		.logo-container   {
			background-color: transparent;
			box-shadow: none;
			align-items: center;
			justify-content: center;
		}

		header {
			// justify-content: center;
		}

		.header-logo {
			display: flex;
		}

		.menu-button {
			position: absolute;
			right: 2rem;
		}

		main {
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
		flex-direction: row-reverse;
		justify-content: center;
		border-radius: 1rem !important;
		animation: none !important;
		&.user {
			position: relative;
			bottom: auto;
		}
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
			justify-content: space-around;
			background: var(--primary-color);
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
		background-color: red;
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
	

	.profile-overlay {
		margin-left: 0;
		left: 0;
		height: auto;
		margin-top: 5rem;
	}
	
	.sidenav {
		display: flex;
		justify-content: left;
		// backdrop-filter: blur(30px);
		height: 50px !important;
		flex-direction: row;
		height: auto;
		width: auto;
		bottom: 0;
		gap: 10px;
		left: 0;
		top: auto;
		bottom: 0;
		padding: 1rem;
		z-index: 1100;
		border-radius: 0 1rem 1rem 0;
		transition: all 0.3s ease-in;
	}

	.navigation-buttons {
		flex-direction: row;
		margin-bottom: 0;
		width: auto;
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

	.nav-button,
	.thread-toggle,
	.avatar-container {
		width: 40px;
		height: 40px;
		padding: 0.3rem;
		border-radius: 50% !important;
	}

	.nav-button:hover,
	.thread-toggle:hover {
		transform: scale(1.1);
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
				width: auto !important;
				display: flex;

			}
		}
		.modal-overlay {
			width: 100%;
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
			display: flex;
			flex-grow: 1;
			height: -webkit-fill-available; 

		}		
		.sidenav {
			display: flex;
			// backdrop-filter: blur(30px);
			background: transparent;
			flex-direction: row;
			height: 2rem;
			bottom: 0;
			gap: 10px;
			left: 0;
			top: auto;
			bottom: 0;
			padding: 0;
			z-index: 10;
			border-radius: 0;
			transition: all 0.3s ease-in;
		}

		.nav-button.drawer {
		}

		.navigation-buttons {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			margin-bottom: 1rem;
			width: 100%;
			margin-left: 0.5rem;

			align-items: flex-start;
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

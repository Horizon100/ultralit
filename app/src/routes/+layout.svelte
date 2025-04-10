<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fly, fade, slide } from 'svelte/transition';
	import horizon100 from '$lib/assets/horizon100.svg';
	import {
		Brain,
		Menu,
		LogIn,
		User,
		LogOut,
		MessageCircle,
		Drill,
		NotebookTabs,
		X,
		Languages,
		Code,
		Bone,

		Combine,

		KanbanSquare,

		Box,

		ChevronDown




	} from 'lucide-svelte';
	import { Moon, Sun, Sunset, Sunrise, Focus, Bold, Gauge } from 'lucide-svelte';
	import { navigating } from '$app/stores';
	import { isNavigating } from '$lib/stores/navigationStore';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import TimeTracker from '$lib/components/features/TimeTracker.svelte';
	import { pb, currentUser } from '$lib/pocketbase';
	import { Camera } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { currentTheme } from '$lib/stores/themeStore';
	import {
		currentLanguage,
		languages,
		setLanguage,
		initializeLanguage
	} from '$lib/stores/languageStore';
	import { t } from '$lib/stores/translationStore';
	import Sidenav from '$lib/components/navigation/Sidenav.svelte';
	import '$lib/stores/threadsStore';
	import { threadsStore } from '$lib/stores/threadsStore';
	import Auth from '$lib/components/auth/Auth.svelte';
	import Profile from '$lib/components/ui/Profile.svelte';
	import ProjectDropdown from '$lib/components/navigation/ProjectDropdown.svelte';

	export let onStyleClick: (() => void) | undefined = undefined;

	let showLanguageNotification = false;
	let selectedLanguageName = '';
	let placeholderText = '';
	let isMenuOpen = true;
	let isStylesOpen = true;
	let currentStyle = 'default';
	let isNavExpanded = false;
	let showAuth = false;
	let showProfile = false;
	let showStyles = false;

	let innerWidth: number;
	let activeLink = '/';
	const styles = [
		{ name: 'Daylight Delight', value: 'default', icon: Sun },
		{ name: 'Midnight Madness', value: 'dark', icon: Moon },
		{ name: 'Sunrise Surprise', value: 'light', icon: Sunrise },
		{ name: 'Sunset Serenade', value: 'sunset', icon: Sunset },
		{ name: 'Laser Focus', value: 'focus', icon: Focus },
		{ name: 'Bold & Beautiful', value: 'bold', icon: Bold },
		{ name: 'Turbo Mode', value: 'turbo', icon: Gauge },
		{ name: 'Bone Tone', value: 'bone', icon: Bone }
	];

	// Handle style changes
	function handleStyleClick() {
		showStyles = !showStyles;
	}
	function handlePromptSelect(event: CustomEvent<any>) {
		console.log('Layout: Received promptSelect:', event.detail);
	}

	function handlePromptAuxclick(event: CustomEvent<any>) {
		console.log('Layout: Received promptAuxclick:', event.detail);
		handlePromptSelect(event);
	}

	function handleThreadListToggle() {
		threadsStore.toggleThreadList();
	}

	function getRandomQuote() {
		const quotes = $t('extras.quotes');
		return quotes[Math.floor(Math.random() * quotes.length)];
	}

	function toggleAuthOrProfile() {
		if ($currentUser) {
			showProfile = !showProfile;
			showAuth = false;
		} else {
			showAuth = !showAuth;
			showProfile = false;
		}
	}
	function toggleNav() {
		isNavExpanded = !isNavExpanded;
	}
	function handleAuthSuccess() {
		showAuth = false;
	}

	function handleLogout() {
		showProfile = false;
		showAuth = false;
		goto('/');
	}

	function handleOverlayClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			showAuth = false;
			showProfile = false;
			showStyles = false;
		}
	}

	function navigateTo(path: string) {
		goto(path);
	}
	$: placeholderText = getRandomQuote();
	$: showThreadList = $threadsStore.showThreadList;
	$: isNarrowScreen = innerWidth <= 1000;
	$: user = $currentUser;
	
	onMount(async () => {
		currentTheme.initialize();
		await initializeLanguage();

		const unsubscribe = navigating.subscribe((navigationData) => {
			if (navigationData) {
				isNavigating.set(true);
			} else {
				setTimeout(() => {
					isNavigating.set(false);
				}, 300);
			}
		});

		return () => {
			unsubscribe();
		};
	});
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

	/*
	 * async function handleLanguageChange() {
	 * 	showLanguageNotification = false; // Reset notification state
	 * 	await tick(); // Wait for the DOM to update
	 * 	await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure reset
	 */

	/*
	 * 	const currentLang = $currentLanguage;
	 * 	const currentIndex = languages.findIndex(lang => lang.code === currentLang);
	 * 	const nextIndex = (currentIndex + 1) % languages.length;
	 * 	const nextLanguage = languages[nextIndex];
	 */

	/*
	 * 	await setLanguage(nextLanguage.code);
	 * 	selectedLanguageName = nextLanguage.name;
	 */

	/*
	 * 	await tick(); // Wait for the DOM to update after language change
	 * 	// await new Promise(resolve => setTimeout(resolve, 10)); // Delay before showing notification
	 */

	/*
	 * 	setTimeout(() => {
	 * 		showLanguageNotification = true;
	 * 	}, 0);
	 * 	setTimeout(() => {
	 * 		showLanguageNotification = false;
	 * 	}, 600);
	 * }
	 */

	function setActiveLink(path: string) {
		goto(path);
		activeLink = path;
	}

	function handleLogoClick(event: MouseEvent) {
		event.preventDefault();
		setActiveLink('/');
	}

	function scrollToSection(id: string) {
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth' });
		}
	}
	$: {
		if ($t) {
			placeholderText = getRandomQuote();
		}
	}
	onMount(() => {
		return currentTheme.subscribe((theme) => {
			document.documentElement.className = theme;
		});
	});
</script>

<svelte:window bind:innerWidth />
	{#if $currentUser}
		<div class="project">
			<ProjectDropdown/>
		</div>
	{/if}
<div class="app-container {$currentTheme}">
	<header>
		<nav style="z-index: 1000;">
			<!-- <TimeTracker /> -->
			<!-- <button class="nav-button" on:click={handleLanguageChange}> -->
			<!-- <Languages size={24} /> -->
			<!-- <span class="language-code">{$currentLanguage.toUpperCase()}</span> -->
			<!-- <span>{$t('lang.flag')}</span>
		
			  </button> -->


			{#if isNarrowScreen}
				<!-- <button class="menu-button" on:click={toggleAuthOrProfile}>
                    {#if $currentUser}
                        <User size={24} />
                    {:else}
                        <LogIn size={24} />
                    {/if}
                </button> -->
			{:else}
				<div class="nav-links" transition:fly={{ y: -200, duration: 300 }}>
					{#if $currentUser}{:else}
						<a
							href="#features"
							class="nav-link"
							on:click|preventDefault={() => scrollToSection('features')}
						>
							{$t('nav.features')}
						</a>
						<a
							href="#pricing"
							class="nav-link"
							on:click|preventDefault={() => scrollToSection('pricing')}
						>
							{$t('nav.pricing')}
						</a>
						<a
							href="#docs"
							class="nav-link"
						>
							{$t('nav.docs')}
						</a>
					{/if}
				</div>
			{/if}

			<div class="logo-container" on:click={handleLogoClick}>
				<a href="/" class="logo-link">
					<img src={horizon100} alt="Horizon100" class="logo" />
					<h2>vRAZUM</h2>
				</a>
			</div>
		</nav>
	</header>
	<Sidenav

		on:promptSelect={handlePromptSelect}
		on:promptAuxclick={handlePromptAuxclick}
		on:threadListToggle={handleThreadListToggle}
		
	/>

	<!-- {#if showGamePlay}
		<div class="gameplay-overlay" transition:fade={{duration: 300}} on:click|self={toggleGamePlay}>
		<div class="gameplay-content" transition:fly={{y: 50, duration: 300}}>
			<GamePlay />
			<button class="close-button" on:click={toggleGamePlay}>Close</button>
		</div>
		</div>
	{/if} -->

	{#if $isNavigating}
		<LoadingSpinner />
	{/if}

	{#if showAuth}
		<div
			class="auth-overlay"
			on:click={handleOverlayClick}
			transition:fly={{ y: -20, duration: 300 }}
		>
			<div class="auth-content" transition:fly={{ y: -20, duration: 300 }}>
				<button
					on:click={() => (showAuth = false)}
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
	}

	.auth-overlay {
		position: fixed;
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

	.auth-container {
		background-color: #fff;
		padding: 2rem;
		border-radius: 10px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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
	.profile-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		flex-grow: 1;
		/* box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);  */
		backdrop-filter: blur(10px);
		justify-content: center;
		align-items: center;
		z-index: 1002;
		transition: all 0.3s ease;
	}

	.project {
		position: absolute;
		width: auto;
		left: 4rem;
		top: 0;
		// z-index: 999;
		display: flex;
		align-items: center;
		// overflow: visible; 
	}

	.profile-content {
		position: absolute;
		width: auto;
		height: auto;
		top: 0;
		bottom: auto;
		/* right: 0; */
		/* background-color: #2b2a2a; */
		/* box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);  */
		backdrop-filter: blur(40px);
		border-bottom: 1px solid var(--secondary-color);
		background: var(--bg-gradient-r);
		border-bottom-left-radius: var(--radius-m);
		border-bottom-right-radius: var(--radius-m);
		width: 100%;
		/* max-width: 500px; */
		/* max-height: 90vh; */
		overflow: none;
		transition: all 0.3s ease;
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
		top: 3rem;
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

	.auth-container {
		background-color: #fff;
		padding: 2rem;
		border-radius: 10px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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
		/* height: 80px; */
		/* margin-top: 0; */
		/* align-items: center; */
		height: auto;
		/* padding: 5px 5px; */
		background: var(--bg-gradient);
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
		align-items: flex-end;
		height: 60px;
		position: relative;
		margin-right: 0;
		user-select: none;
	}

	.logo {
		width: 30px;
		height: 30px;
		margin-right: 10px;
	}

	.logo-link {
		display: flex;
		flex-direction: row;
		align-items: center;
		text-decoration: none;
		color: inherit;
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
		padding: 1rem;
		border: 1px solid rgb(69, 69, 69);
		border-radius: 20px;
		position: relative;
		max-width: 90%;
		max-height: 90%;
		overflow: auto;
	}

	nav {
		display: flex;
		flex-direction: row;
		justify-content: right;
		align-items: center;
		width: 100%;

		/* padding: 5px 10px; */
		/* background-color: #2b2a2a; */
		/* border-radius: 20px; */
		/* background-color: black; */
		/* height: 80px; */
		gap: 1rem;
		padding: 0 10px;
		border-bottom-left-radius: 20px;
		border-bottom-right-radius: 20px;
		border-top-left-radius: 20px;
		border-top-right-radius: 20px;
		/* margin-right: 10%; */
		/* padding: 10px; */
	}

	nav a {
		justify-content: center;
		align-items: center;
		font-weight: bold;
		text-decoration: none;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		border-radius: 20px;
		color: var(--text-color);
	}

	nav a:hover {
		opacity: 0.8;
		/* background-color: rgba(255, 255, 255, 0.1); */
		transform: scale(1.1);
	}

	a {
		justify-content: center;
		align-items: center;
		/* padding: 20px; */
		text-decoration: none;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
	}

	.nav-links {
		display: flex;
		gap: 2rem;
		align-items: center;
		justify-content: center;
		/* padding: 10px; */
		width: auto;
		font-family: var(--font-family);
	}

	.nav-link {
		display: flex;
		flex-direction: row;
		gap: 8px;
		font-weight: 400;
		justify-content: center;
		align-items: center;
		/* background-color: red; */
		text-decoration: none;
		font-size: auto;
		/* padding: 5px 10px; */
		/* border-radius: 20px; */
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		/* border-left: 1px solid rgb(130, 130, 130); */
		user-select: none;
		color: var(--text-color);
		// background: var(--bg-gradient-right);
		padding: 4px;
		font-size: auto;
		border: none;
		cursor: pointer;
		border-radius: 50%;
		width: 60px !important;
		height: 60px;
	}

	.nav-link:hover {
		background-color: rgba(255, 255, 255, 0.1);
		color: #6fdfc4;
	}

	.nav-link.active {
		background: var(--secondary-color) !important;
		color: var(--tertiary-color);
		font-size: var(--font-size-s);
		width: fit-content;
		flex: 1;
		justify-content: center;

		&:hover {
			background: rgba(255, 255, 255, 0.1);
		}
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

	button:hover {
		opacity: 0.8;
		background-color: var(--tertiary-color);
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

	.profile-content {
		position: absolute;
		width: 94%;
		height: auto;
		top: 60px;
		/* background-color: #2b2a2a; */
		box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);
		backdrop-filter: blur(40px);
		border: 1px solid var(--tertiary-color);
		padding: 2rem;
		border-radius: 50px;
		/* width: 90%; */
		/* max-width: 500px; */
		/* max-height: 90vh; */
		overflow: none;
		transition: all 0.3s ease;
	}
	.auth-overlay {
		position: fixed;
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
	@media (max-width: 1000px) {
		.nav-links,
		h1 {
			display: none;
		}

		.project {
			position: absolute;
			left: 0;
			top: 0;
		}

		.logo-container   {
			width: 50%;
			margin-left: 50%;
			align-items: flex-end;
			justify-content: flex-end;
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
			flex-grow: 1;
		}

		nav {
			justify-content: center;
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

	}

	@media (max-width: 767px) {
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
			top: 3rem;
			bottom: 0;
			position: fixed;
			display: flex;
			flex-grow: 1;
		}

	}
</style>

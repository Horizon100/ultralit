<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {onMount} from 'svelte'
	import { get } from 'svelte/store';
	import Kanban from '$lib/components/lean/Kanban.svelte';
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

		Settings










	} from 'lucide-svelte';
	import { currentUser, pb } from '$lib/pocketbase';
	import { currentTheme } from '$lib/stores/themeStore';
	import { currentLanguage, setLanguage, languages } from '$lib/stores/languageStore';
	import ModelSelector from '$lib/components/ai/ModelSelector.svelte';
	import PromptSelector from '$lib/components/ai/PromptSelector.svelte';
	import { threadsStore } from '$lib/stores/threadsStore';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { fly, fade, slide } from 'svelte/transition';
	import { t } from '$lib/stores/translationStore';
	import { tick } from 'svelte';
	import Profile from '$lib/components/ui/Profile.svelte';
	import Auth from '$lib/components/auth/Auth.svelte';
	import StyleSwitcher from '$lib/components/ui/StyleSwitcher.svelte';
	import type { SlideParams } from 'svelte/transition';

	let showLanguageNotification = false;
	let selectedLanguageName = '';
	let isStylesOpen = false;
	let showThreadList: boolean;
	let placeholderText = '';
	let username: string = 'You';
	let isMenuOpen = true;

	let innerWidth: number;
	let isNavExpanded = false;

	let showAuth = false;
	let showProfile = false;
	let showStyles = false;
	let currentStyle = 'default';

	function getRandomQuote() {
		const quotes = $t('extras.quotes');
		return quotes[Math.floor(Math.random() * quotes.length)];
	}

	$: placeholderText = getRandomQuote();
	$: showThreadList = $threadsStore.showThreadList;
	$: currentPath = $page.url.pathname;
	$: showBottomButtons = currentPath === '/';
	$: isNarrowScreen = innerWidth <= 1000;

	const dispatch = createEventDispatcher<{
		promptSelect: any;
		promptAuxclick: any;
		threadListToggle: void;
	}>();

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

	// Handle style changes
	function handleStyleClick() {
		showStyles = !showStyles;
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

	$: showThreadList = $threadsStore.showThreadList;

	export function toggleThreadList() {
		threadsStore.toggleThreadList();
	}
	function toggleStyles() {
		showStyles = !showStyles;
	}

	function handleStyleClose() {
		showStyles = false;
	}

	async function handleStyleChange(event: CustomEvent) {
		const { style } = event.detail;
		await currentTheme.set(style);
		showStyles = false;
	}

	export function toggleNav() {
		isNavExpanded = !isNavExpanded;
	}

	// function setActiveLink(path: string) {
	// 	goto(path);
	// 	setactiveLink = path;
	// }

	// function handleLogoClick(event: MouseEvent) {
	// 	event.preventDefault();
	// 	setActiveLink('/');
	// }
	function toggleAuthOrProfile() {
		if ($currentUser) {
			showProfile = !showProfile;
			showAuth = false;
		} else {
			showAuth = !showAuth;
			showProfile = false;
		}
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

	function handlePromptSelect(event: CustomEvent) {
		dispatch('promptSelect', event.detail);
	}
	onMount(async () => {
  try {
    console.log('onMount initiated');


    // Set up user info
    if ($currentUser && $currentUser.id) {
      console.log('Current user:', $currentUser);
      username = $currentUser.username || $currentUser.email;
    }
  } catch (error) {
    console.error('Error during onMount:', error);
  }
});

</script>

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
        class="nav-button user" 
        class:expanded={isNavExpanded}
        on:click={toggleAuthOrProfile}
    >
    {#if $currentUser?.avatar}
        <img 
            src={`${pb.baseUrl}/api/files/${$currentUser.collectionId}/${$currentUser.id}/${$currentUser.avatar}`}
            alt="User avatar" 
            class="user-avatar" 
        />
    {:else}
        <div class="default-avatar">
            {($currentUser?.name || $currentUser?.username || $currentUser?.email || '?')[0]?.toUpperCase()}
        </div>
    {/if}
		{#if isNavExpanded}
			<span class="nav-text">{username} </span>
		{/if}
		</button>
		<button
			class="nav-button"
			class:expanded={isNavExpanded}
			class:active={currentPath === '/'}
			on:click={(event) => {
			if (currentPath === '/') {
				event.preventDefault();
				toggleThreadList();
				isNavExpanded = false;
			} else {
				navigateTo('/');
			}
			}}
		>
			{#if currentPath === '/' && showThreadList}
			<PanelLeftClose />
			{:else if currentPath === '/'}
			<MessageCircleDashed />
			{:else}
			<MessageCircle />
			{/if}
			
			{#if isNavExpanded}
			<span class="nav-text">Chat</span>
			{/if}
		</button>
			<button
				class="nav-button" 
				class:expanded={isNavExpanded}
				class:active={currentPath === '/canvas'}
				on:click={() => navigateTo('/canvas')}
			>
				<Combine />
				{#if isNavExpanded}
				<span class="nav-text">Canvas</span>
			  {/if}
			</button>
			<button
				class="nav-button"
				class:expanded={isNavExpanded}
				class:active={currentPath === '/notes'}
				on:click={() => navigateTo('/notes')}
			>
				<NotebookTabs />
				{#if isNavExpanded}
				  <span class="nav-text">Notes</span>
				{/if}
			</button>
			<button
				class="nav-button"
				class:expanded={isNavExpanded}
				class:active={currentPath === '/lean'}
				on:click={() => navigateTo('/lean')}
			>
				<SquareKanban />
				{#if isNavExpanded}
					<span class="nav-text">Lean</span>
				{/if}
			</button>
			<!-- <div class="bottom-buttons">
				<button
					class="nav-button config"
					class:expanded={isNavExpanded}
					class:active={currentPath === '/lean'}
					on:click={() => navigateTo('/lean')}
				>
					<InfoIcon />
					{#if isNavExpanded}
						<span class="nav-text">Guides</span>
					{/if}
				</button>
				<button
					class="nav-button config"
					class:expanded={isNavExpanded}
					class:active={currentPath === '/lean'}
					on:click={() => navigateTo('/lean')}
				>
					<Settings />
					{#if isNavExpanded}
						<span class="nav-text">Settings</span>
					{/if}
				</button>
			</div> -->

			<button class="nav-button toggle" on:click={toggleNav}>
				{#if isNavExpanded}
				<PanelLeftClose size={24} />
				{:else}
				<PanelLeftOpen size={24} />
				{/if}
			</button>
		{:else}
			<!-- <LogIn /> -->
		{/if}
	</div>

	<!-- Navigation Buttons -->

	<div class="middle-buttons"></div>

	<div class="bottom-buttons">
		{#if showBottomButtons}
			<!-- Language Toggle -->
			<!-- <button class="nav-button" on:click={handleLanguageChange}> -->
			<!-- <Languages size={24} /> -->
			<!-- <span class="language-code">{$currentLanguage.toUpperCase()}</span> -->
			<!-- <span>{$t('lang.flag')}</span> -->

			<!-- </button> -->

			<!-- Theme Toggle -->
			<!-- <button class="nav-button" on:click={toggleStyles} transition:fly={{ y: -200, duration: 300}}>
        <svelte:component this={styles.find(s => s.value === currentStyle)?.icon || Sun} size={24} />
    </button> -->
			<!-- <ModelSelector /> -->
			<!-- <PromptSelector on:select={handlePromptSelect} /> -->

		{/if}
	</div>
</div>



{#if showLanguageNotification}
	<div class="language-notification" transition:fade={{ duration: 300 }}>
		{$t('lang.notification')}
	</div>
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
				<ChevronLeft size={24} />
			</button>
			<Profile
				user={$currentUser}
				onClose={() => (showProfile = false)}
				onStyleClick={handleStyleClick}
			/>
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

<svelte:window bind:innerWidth />

<style lang="scss">
	@use 'src/styles/themes.scss' as *;
	* {
		//   font-family: 'Source Code Pro', monospace;
		font-family: var(--font-family);
		transition: all 0.3s ease;
	}
	.sidenav {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		justify-content: flex-start;
		gap: 10px;
		position: fixed;
		left: 0;
		top: 0;
		bottom: 0;
		padding: 0.5rem 1rem;
		z-index:1000;
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
	justify-content: space-between;
	align-items: center;

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
		background: var(--primary-color);
		opacity: 1 !important;

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
	  opacity: 0.5;
	  animation: none !important;
	  border-radius: 2rem !important;

    }

    &.toggle {
      margin-top: auto;
    }

    &.profile {
      margin-top: auto;
    }
  }

  .nav-text {
    font-size: 1rem;
    white-space: nowrap;
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
		left: 5rem;
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

	.profile-content {
		position: absolute;
		width: auto;
		height: auto;
		top: 0;
		left: 0;
		bottom: auto;
		/* right: 0; */
		/* background-color: #2b2a2a; */
		/* box-shadow: 0 4px 6px rgba(236, 7, 7, 0.1);  */
		backdrop-filter: blur(40px);
		border-bottom: 1px solid var(--secondary-color);
		background: var(--bg-gradient-r);
		border-bottom-left-radius: var(--radius-m);
		border-bottom-right-radius: var(--radius-m);
		width:400px;
		/* max-width: 500px; */
		/* max-height: 90vh; */
		overflow: none;
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

	.nav-button.toggle {
		position: fixed;
		bottom: 0;
		left: 1rem;
		z-index: 5000;
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
		border: 1px solid var(--tertiary-color);
		background: var(--bg-color);
		width: 4rem;
		height: 4rem;
		box-shadow: 0 0 10px rgba(74, 158, 255, 0.3);
	}

	.thread-list-visible .thread-toggle {
		left: 310px;
	}

	.nav-button:hover,
	.thread-toggle:hover {
		box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
		transform: scale(1.1);
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
		


		.profile-overlay {
			margin-left: 0;
			left: 0;
			height: 100%;
		}
		
		.sidenav {
			display: flex;
			justify-content: center;
			// backdrop-filter: blur(30px);
			height: 50px !important;
			flex-direction: row;
			height: auto;
			width: 100%;
			bottom: 0;
			gap: 10px;
			left: 0;
			top: auto;
			bottom: 0;
			padding: 1rem;
			z-index: 10;
			border-radius: 0 1rem 1rem 0;
			transition: all 0.3s ease-in;
		}

		.navigation-buttons {
			flex-direction: row;
			margin-bottom: 0;
			right: 0;
			left: 0;
			align-items: flex-end;
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

	@media (max-width: 450px) {



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

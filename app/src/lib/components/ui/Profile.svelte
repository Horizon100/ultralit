<script lang="ts">
	import { fade, fly, slide } from 'svelte/transition';
	import { pb } from '$lib/pocketbase';
	import { Camera, LogOutIcon, Languages, Palette, X, Bone, Save, TextCursorIcon, Pen, User2, UserCircle, MailCheck, Mail, KeyIcon, Cake, History, Shield, Layers, MessageCirclePlus, Group, ChevronLeft } from 'lucide-svelte';
	import { Moon, Sun, Sunset, Sunrise, Focus, Bold, Gauge, Key } from 'lucide-svelte';
	import { onMount, tick } from 'svelte';

	import { currentUser } from '$lib/pocketbase';
	import { createEventDispatcher } from 'svelte';
	import { t } from '$lib/stores/translationStore';
	import { currentLanguage, languages, setLanguage } from '$lib/stores/languageStore';
	import { currentTheme } from '$lib/stores/themeStore';
	import StyleSwitcher from '$lib/components/ui/StyleSwitcher.svelte';
	import StatsContainer from '$lib/components/common/cards/StatsContainer.svelte';
	import APIKeyInput from '$lib/components/common/keys/APIKeyInput.svelte';
	import { apiKey } from '$lib/stores/apiKeyStore';
	import KeyStatusButton from '$lib/components/common/buttons/KeyStatusButton.svelte';

	$: hasApiKey = $apiKey !== '';

	export let user: any;
	export let onClose: () => void;
	export let onStyleClick: () => void;

	let showSaveConfirmation = false;
	let showKeyInput = false;
	let isEditing = false;
	let editedUser = user ? { ...user } : {};
	let showLanguageNotification = false;
	let showLanguageSelector = false;
	let selectedLanguageName = '';
	let placeholderText = '';

	let showStyles = false;
	let currentStyle = 'default';

	// Tab management
	let activeTab = 'profile'; // 'profile' or 'stats'

	let threadCount = 0;
	let messageCount = 0;
	let threadMessageCounts: Record<string, number> = {};
	let tagCount = 0;
	let timerCount: number = 0;
	let lastActive: Date | null = null;

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

	const dispatch = createEventDispatcher();

	function getRandomQuote() {
		const quotes = $t('extras.quotes');
		return quotes[Math.floor(Math.random() * quotes.length)];
	}

	function toggleEdit() {
		isEditing = !isEditing;
	}

	function toggleStyles() {
		showStyles = !showStyles;
	}

	function handleStyleClose() {
		showStyles = false;
	}

	function switchTab(tab: string) {
		activeTab = tab;
	}

	async function saveChanges() {
		try {
			if (user && user.id) {
				await pb.collection('users').update(user.id, editedUser);
				user = { ...editedUser };
				isEditing = false;
				showSaveConfirmation = true;
				// Hide the confirmation after 2 seconds
				setTimeout(() => {
					showSaveConfirmation = false;
				}, 2000);
			}
		} catch (error) {
			console.error('Error updating user:', error);
		}
	}

	function handleOutsideClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
			showStyles = false;
		}
	}

	function handleOverlayClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			showStyles = false;
		}
	}

	async function logout() {
		try {
			await pb.authStore.clear();
			currentUser.set(null);
			dispatch('logout');
			onClose();
		} catch (err) {
			console.error('Logout error:', err);
		}
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

	async function handleStyleChange(event: CustomEvent) {
		const { style } = event.detail;
		await currentTheme.set(style);
		showStyles = false;
	}

	$: placeholderText = getRandomQuote();

	onMount(() => {
		currentTheme.initialize(); // Initialize theme when profile mounts
		return currentTheme.subscribe((theme) => {
			document.documentElement.className = theme;
		});
	});
</script>

<div
	class="modal-overlay {$currentTheme}"
	on:click={handleOutsideClick}
	transition:fade={{ duration: 300 }}
>
	<div class="modal-content" on:click|stopPropagation transition:fade={{ duration: 300 }}>
		<div class="settings-row">
			<div class="btn-row">
				<div class="btn-row" >
					<button class="settings-button" on:click={onClose}>
						<ChevronLeft/>
					</button>
					{#if isEditing}
						<button class="settings-button" on:click={saveChanges}>
							<span>
								<Save/>
								{$t('profile.save')}
							</span>
						</button>
					{:else}
						<button class="settings-button" on:click={toggleEdit}>
							<Pen/>
							<span>{$t('profile.edit')}</span>
						</button>
					{/if}
	
					<button class="settings-button" on:click={handleLanguageChange}>
						<Languages size={24} />
						<span>{$t('lang.flag')}</span>
					</button>
					<button
						class="settings-button"
						on:click={toggleStyles}
						transition:fly={{ y: -200, duration: 300 }}
					>
						<svelte:component
							this={styles.find((s) => s.value === currentStyle)?.icon || Sun}
							size={24}
						/>
					</button>
				</div>
				
				<button class="logout-button" on:click={logout} transition:fade={{ duration: 300 }}>
					<LogOutIcon size={24} />
					<span>{$t('profile.logout')}</span>
				</button>
			</div>
		</div>

		{#if showStyles}
		<div
			class="style-overlay"
			on:click={handleOverlayClick}
			transition:fly={{ x: -200, duration: 300 }}
		>
			<div
				class="style-content"
				on:click={handleOverlayClick}
				transition:fly={{ x: -20, duration: 300 }}
			>
				<StyleSwitcher on:close={handleStyleClose} on:styleChange={handleStyleChange} />
			</div>
		</div>
		{/if}

		{#if user}
			<div class="profile-header">
				<div class="info-column">
					<div class="header-wrapper">
						<div class="avatar-container">
							{#if user.avatar}
								<img src={pb.getFileUrl(user, user.avatar)} alt="User avatar" class="avatar" />
							{:else}
								<div class="avatar-placeholder">
									<Camera size={48} />
								</div>
							{/if}
						</div>
						<div class="info-row">
							{#if isEditing}
								<input bind:value={editedUser.name} />
							{:else}
								<span class="name">{user.name || 'Not set'}</span>
							{/if}
						</div>
						<div class="info-row">
							{#if isEditing}
								<input bind:value={editedUser.username} />
							{:else}
								<span class="username">{user.username || 'Not set'}</span>
							{/if}
						</div>
					</div>
				</div>
				<div class="info-stats">
					<div class="info-column">
						<span class="stat">{$t('profile.projects')}</span>
						343
					</div>
					<div class="info-column">
						<span class="stat">{$t('profile.posts')}</span>
						343
					</div>							
					<div class="info-column">
						<span class="stat">{$t('profile.connections')}</span>
						343
					</div>						
				</div>
				<div class="button-column-wrapper">
					<button class="small-button">
						<MessageCirclePlus/>
						Message
					</button>
					<button class="small-button">
						<Group/>
						Connect
					</button>
				</div>
			</div>

			<!-- Tab Navigation -->
			<div class="tabs-container">
				<div class="tabs-navigation">
					<button 
						class="tab-button {activeTab === 'profile' ? 'active' : ''}" 
						on:click={() => switchTab('profile')}
					>
						<User2 size={20} />
						<span>Profile</span>
					</button>
					<button 
						class="tab-button {activeTab === 'stats' ? 'active' : ''}" 
						on:click={() => switchTab('stats')}
					>
						<Layers size={20} />
						<span>Stats</span>
					</button>
				</div>

				<!-- Tab Content -->
				<div class="tab-content">
					{#if activeTab === 'profile'}
						<div class="profile-info" transition:fade={{ duration: 200 }}>
							<div class="info-row-profile">
								{#if isEditing}
									<textarea class="textarea-description" bind:value={editedUser.description}></textarea>
								{:else}
									<span class="description">{user.description || 'Not set'}</span>
								{/if}
							</div>
							<div class="selector-row">
								<button class="selector-button">
									<MessageCirclePlus/>
									Message
								</button>
								<button class="selector-button">
									<Group/>
									Connect
								</button>
								<button class="selector-button">
									x
								</button>
								<button class="selector-button">
									x
								</button>
							</div>

							<div class="info-column">
								<div class="info-row">
									<span class="label">
										<span class="data">{$t('profile.email')}</span>
									</span>
									<span>{user.email}</span>
								</div>
								<span class="info-avatar">
									@
								</span>
							</div>			
							<div class="info-column">	
								<div class="info-row">
									<span class="label">
										<span class="data">{$t('profile.role')}</span>
									</span>
									<span>{user.role}</span>
								</div>
								<KeyIcon size="50"/>
							</div>	
							<div class="info-column">	
								<div class="info-row">
									<span class="label">
										<span class="data">{$t('profile.created')}</span>
									</span>
									<span>{new Date(user.created).toLocaleString()}</span>
								</div>
								<Cake size="50"/>
							</div>	
							<div class="info-column">	
								<div class="info-row">
									<span class="label">
										<span class="data">{$t('profile.updated')}</span>
									</span>
									<span>{new Date(user.updated).toLocaleString()}</span>
								</div>
								<History size="50"/>
							</div>	
							<div class="info-column">	
								<div class="info-row">
									<span class="label">
										<span class="data">{$t('profile.verified')}</span>
									</span>
									<span>{user.verified ? 'Yes' : 'No'}</span>
								</div>
								<Shield size="50"/>
							</div>	
						</div>
					{:else if activeTab === 'stats'}
						<div class="stats-tab" transition:fade={{ duration: 200 }}>
							<StatsContainer {threadCount} {messageCount} {tagCount} {timerCount} {lastActive} />
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="no-user-message">
				<p>No user information available.</p>
			</div>
		{/if}
		
		{#if showSaveConfirmation}
			<div class="save-confirmation" 
				in:fly={{ y: 20, duration: 300 }} 
				out:fade={{ duration: 200 }}>
				Saved!
			</div>
		{/if}
	</div>
	<div class="swipe-indicator">
		<div class="indicator-bar"></div>
	</div>
</div>

{#if showLanguageNotification}
	<div class="language-overlay" transition:fade={{ duration: 300 }}>
		<div class="language-notification">
			{$t('lang.notification')}
			<div class="quote">
				{placeholderText}
			</div>
		</div>
	</div>
{/if}

{#if !hasApiKey}
	<div class="key-overlay">
		<APIKeyInput />
	</div>
{/if}

<style lang="scss">
	@use 'src/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
		color: var(--text-color);
	}
	.modal-overlay {
		display: flex;
		justify-content: flex-start;
		align-items: flex-start;
		padding: 2rem;
		width: calc(100% - 6rem);
		height: 90vh;
		border-radius: 20px;
		overflow-y: scroll;
		transition: all 0.3s ease;
	}

	.btn-row {
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		width: 100%;
		gap: 1rem;
		user-select: none;
	}

	.modal-content {
		height: auto;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		width: 100%;
	}

	/* Tab Styles */
	.tabs-container {
		width: 100%;
		max-width: 800px;
		margin-bottom: 1rem;
	}

	.tabs-navigation {
		display: flex;
		border-bottom: 1px solid var(--border-color);
		margin-bottom: 1rem;
	}

	.tab-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		font-size: 1.5rem;
		background: transparent;
		border: none;
		border-bottom: 3px solid transparent;
		cursor: pointer;
		transition: all 0.2s ease;
		color: var(--text-color);
		opacity: 0.7;
	}

	.tab-button.active {
		border-bottom: 3px solid var(--accent-color, #6b7280);
		opacity: 1;
		font-weight: 600;
	}

	.tab-button:hover {
		background: var(--primary-color);
		border-radius: 0.5rem 0.5rem 0 0;
	}

	.tab-content {
		min-height: 300px;
	}

	.stats-tab {
		padding: 1rem 0;
	}

	.key-overlay {
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

	.profile-header {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: flex-start;
		width: 100%;
		max-width: 800px;
		height: auto;
		margin-bottom: 1rem;
		color: white;

		&.info-column {
			display: flex;
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
			height: 100%;
			width: 100%;
			padding: 1rem;
			border-radius: 1rem;
		}
		.info-row {
			display: flex;
			height: auto;
			padding: 0.5rem;
			font-size: 2.5rem;
			letter-spacing: 0.1rem;
			font-weight: 800;
			max-width: 800px;
			width: 100%;

			input {
				background: var(--primary-color);
				border-radius: var(--radius-m);
				padding: 1rem;
				font-size: 1.5rem;
				resize: vertical;
				width: auto;;
				display: flex;
				height: auto;
			}
		}
		.info-stats {
			display: flex;
			flex-direction: row;

			align-items: center;
			height: auto;
			padding: 0.5rem;
			font-size: 2rem;
			letter-spacing: 0.1rem;
			font-weight: 800;
			max-width: 800px;
			width: auto;
			&.activity {
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: center;
			}
		}
	}

	.header-wrapper {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: left;
		min-width: 300px;
	}

	button.small-button {
		width: auto;
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 1.5rem;
		color: var(--text-color);
		background: var(--primary-color);
		outline: transparent;
		border: 1px solid var(--bg-color);
		border-radius: 1rem;
		line-height: 2;
		transition: all 0.3s ease;
		&:hover {
			transform: translateX(-1rem);
			background: var(--bg-color);
		};
	}

	.button-column-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.swipe-indicator {
		width: 100%;
		height: 24px;
		display: flex;
		justify-content: center;
		position: absolute;
		bottom: 1rem;
	}

	.indicator-bar {
		width: 100px;
		height: 4px;
		background: white;
		border-radius: 2px;
		opacity: 0.5;
	}

	.avatar-container {
		width: 150px;
		height: 150px;
		border-radius: 50%;
		overflow: hidden;
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
		background-color: #e0e0e0;
		color: #757575;
	}

	.style-overlay {
		position: relative;
		top: auto;
		left: 0;
		margin-top: 0;
		margin-bottom: 2rem;
		width: 600px;
		height: auto;
		display: flex;
		justify-content: right;
		align-items: top;
		z-index: 1444;
	}

	.style-content {
		display: flex;
		justify-content: right;
		border: 1px solid rgb(69, 69, 69);
		border-radius: 50px;
		position: relative;
		height: 100%;
		width: 100%;
	}

	.profile-info {
		margin-bottom: 1rem;
		color: white;
		margin: 0;
		width: 100%;
		height: 100%;
		max-width: 800px;
		height: auto;
		gap: 0.5rem;
		display: flex;
		flex-direction: column;
		
		.info-column {
			display: flex;
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
			height: 100%;
			width: 100%;
			padding: 1rem;
			background: var(--primary-color);
			border-radius: 1rem;
		}
		
		.info-row {
			font-size: 1.2rem;
			line-height: 1.5;
			padding: 0;
			display: flex;
			flex-direction: column;
			border-radius: 0.5rem;
			height: auto;
			gap: 1rem;
		}
		
		.info-row-profile {
			font-size: 1.2rem;
			line-height: 1.5;
			padding: 0;
			display: flex;
			flex-direction: column;
			border-radius: 0.5rem;
			gap: 1rem;
		}
		
		.textarea-description {
			font-size: 1rem;
			width: 100%;
			line-height: 1.5;
			padding: 1.5rem;
			min-height: 200px;
			scroll-behavior: smooth;
			scrollbar-color: var(--secondary-color) transparent;
			overflow-y: auto;
			border-radius: 2rem;
			background: var(--primary-color);
			resize: none;
			white-space: pre-wrap;
			word-wrap: break-word;
		}
	}

	span.info-avatar {
		font-size: 3rem;
	}

	span.stat {
		font-size: 0.8rem;
	}
	span.name {
		font-size: 2rem;
	}

	span.username {
		font-size: 1.2rem;
		color: var(--placeholder-color);
	}
	
	span.description {
		font-size: 1rem;
		line-height: 1.5;
		letter-spacing: 0.2rem;
	}
	
	.info-row {
		display: flex;
		height: auto;
		padding: 0.5rem;
		font-size: 2.5rem;
		letter-spacing: 0.1rem;
		font-weight: 800;
		max-width: 800px;
		width: 100%;

		& input {
			background: var(--primary-color);
			border-radius: var(--radius-m);
			padding: 1rem;
			font-size: 1.5rem;
			resize: vertical;
			display: flex;
			height: auto;
			min-width: 300px;
		}
	}

	.label {
		font-weight:300;
		font-size: 1.1rem;
		letter-spacing: 0.1rem;
		width: 100px;
		user-select: none;
	}

	.save-confirmation {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		background: var(--tertiary-color);
		color: var(--text-color);
		padding: 0.75rem 1.5rem;
		border-radius: var(--radius-m);
		font-weight: 500;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		z-index: 2000;
	}

	.logout-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 20px;
		min-width: 120px;
		width: auto;
		height: 60px;
		background: var(--secondary-color);
		opacity: 0.5;
		border: 1px solid var(--border-color);
		color: var(--text-color);
		transition: all 0.2s ease;

		&:hover {
			transform: translateY(-4px);
			background: red;
			box-shadow: 0 4px 6px rgba(255, 0, 0, 0.5);
			font-weight: bold;
		}

		span {
			font-size: 0.9rem;
		}
	}

	.settings-row {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 800px;
		gap: 1rem;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.settings-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 20px;
		width: auto;
		height: 60px;
		background: var(--bg-gradient);
		border: 1px solid var(--border-color);
		color: var(--text-color);
		transition: all 0.2s ease;

		&:hover {
			transform: translateY(-4px);
			box-shadow: 0 4px 6px rgba(255, 255, 255, 0.2);
		}

		span {
			font-size: 0.9rem;
		}
	}

	.selector-row {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		width: 100%;
		margin: 0;
		padding: 1rem;
		gap: 0.5rem;
		height: 8rem;
		max-width: 800px;
	}

	button.selector-button {
		width: 100%;
		height: 100%;
		border-radius: 2rem;
		font-size: 2rem;
		background: var(--bg-gradient-r);
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
		color: var(--text-color);
		padding: 20px;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		text-justify: center;
		justify-content: center;
		align-items: center;
		gap: 2rem;
		font-size: 2rem;
	}

	.quote {
		font-size: 16px;
		font-style: italic;
		line-height: 1.5;
	}

	@media (max-width: 1000px) {
		.modal-overlay {
			width: auto;
			margin: 0;
			margin-top: 2rem;
			justify-content: flex-start !important;
			height: 100vh;
		}

		.header-wrapper {
			width: auto;
			min-width: 100px !important;
		}

		.info-column {
			flex-direction: column;
		}
		
		.info-stats {
			display: flex;
			flex-direction: column !important;
			align-items: flex-start !important;
			justify-content: flex-end !important;
			height: auto;
			padding: 0.5rem;
			font-size: 1.5rem !important;
			letter-spacing: 0.1rem;
			gap: 2rem;
			font-weight: 800;
			max-width: 800px;
			width: 100% !important;
		}
		
		.style-overlay {
			top: auto;
			left: auto;
			width: 100vw;
			height: fit-content;
		}

		.style-content {
			justify-content: center;
			background-color: transparent;
			border: 1px solid rgb(69, 69, 69);
			border-radius: 20px;
			position: relative;
			flex-direction: column;
			width: 100%;
			height: 100%;
			overflow: auto;
		}
		
		.tabs-navigation {
			justify-content: center;
		}
	}

	@media (max-width: 768px) {
		.settings-row {
			display: flex;
			flex-direction: row;
			justify-content: center;
			flex-wrap: wrap;
			gap: 1rem;
			padding: 1rem;
			margin-bottom: 1rem;
		}

		.settings-button {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.5rem 1rem;
			border-radius: 20px;
			width: 60px;
			height: 60px;
			background: var(--bg-gradient);
			border: 1px solid var(--border-color);
			color: var(--text-color);
			transition: all 0.2s ease;

			&:hover {
				transform: translateY(-4px);
				background: var(--bg-gradient);
			}

			span {
				font-size: 0.9rem;
			}
		}
	}
</style>
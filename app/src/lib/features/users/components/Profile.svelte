<script lang="ts">
	import { fade, fly, slide } from 'svelte/transition';
	import { page } from '$app/stores';
	import {
		Camera,
		LogOutIcon,
		Languages,
		Palette,
		X,
		Bone,
		Save,
		TextCursorIcon,
		Pen,
		User2,
		UserCircle,
		MailCheck,
		Mail,
		KeyIcon,
		Cake,
		History,
		Shield,
		Layers,
		MessageCirclePlus,
		Group,
		ChevronLeft,
		TagsIcon,
		Settings,
		SettingsIcon
	} from 'lucide-svelte';
	import { Moon, Sun, Sunset, Sunrise, Focus, Bold, Gauge, Key } from 'lucide-svelte';
	import { onMount, tick } from 'svelte';

	import { currentUser, pocketbaseUrl, updateUser, getUserById, signOut } from '$lib/pocketbase';
	import { createEventDispatcher } from 'svelte';
	import { t } from '$lib/stores/translationStore';
	import { currentLanguage, languages, setLanguage } from '$lib/stores/languageStore';
	import { currentTheme } from '$lib/stores/themeStore';
	import StyleSwitcher from '$lib/features/users/components/StyleSwitcher.svelte';
	import StatsContainer from '$lib/features/users/components/StatsContainer.svelte';
	import APIKeyInput from '$lib/features/ai/components/models/APIKeyInput.svelte';
	import { apiKey } from '$lib/stores/apiKeyStore';
	import KeyStatusButton from '$lib/components/buttons/KeyStatusButton.svelte';
	import TagEditor from '$lib/features/users/components/TagEditor.svelte';
	import AvatarUploader from '$lib/features/users/components/AvatarUploader.svelte';
	import type { ProviderType } from '$lib/types/types';

	interface UserData {
		id: string;
		avatarUrl?: string;
		email?: string;
		name?: string;
		username?: string;
		description?: string;
		role?: string;
		created?: string;
		updated?: string;
		verified?: boolean;
		// Add other fields you expect from the API
	}

	export let user: any;

	export let onClose: () => void;
	export let onStyleClick: () => void;
	let isLoading = false;

	let completeUserData: UserData | null = null;
	let showAvatarUploader = false;

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

	let activeTab = 'profile';

	let threadCount = 0;
	let messageCount = 0;
	let taskCount = 0;
	let tagCount = 0;
	let timerCount: number = 0;
	let lastActive: Date | null = null;

	interface StyleOption {
		name: string;
		value: string;
		icon: any;
	}
	$: console.log('User data:', user);

	const styles: StyleOption[] = [
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

	$: chatRelatedPages = ['/chat', '/canvas', '/ide']; // Add other pages that need API keys
	$: needsApiKey = chatRelatedPages.some(path => $page.url.pathname.startsWith(path));
	$: hasApiKey = needsApiKey ? hasAnyApiKey($apiKey) : true;

	function hasAnyApiKey(apiKeys: any): boolean {
		if (!apiKeys || typeof apiKeys !== 'object') return false;
		return Object.values(apiKeys).some(key => 
			typeof key === 'string' && key.trim() !== ''
		);
	}

	function getRandomQuote(): string {
		const quotes = $t('extras.quotes') as string[];
		return quotes[Math.floor(Math.random() * quotes.length)];
	}

	function toggleEdit(): void {
		isEditing = !isEditing;
	}

	function toggleStyles(): void {
		showStyles = !showStyles;
	}

	function toggleAvatarUploader(): void {
		showAvatarUploader = !showAvatarUploader;
	}
	function handleAvatarUploadSuccess(): void {
		showAvatarUploader = false;
		if (user?.id) {
			getUserById(user.id, true).then((refreshedUser) => {
				if (refreshedUser) {
					user = refreshedUser;
					if (user.avatar) {
						user.avatarUrl = getAvatarUrl(user);
					}
				}
			});
		}
	}

	function handleAvatarUploadError(error: string): void {
		console.error('Avatar upload error:', error);
	}

	function handleStyleClose(): void {
		showStyles = false;
	}

	function switchTab(tab: string): void {
		activeTab = tab;
	}

	async function saveChanges(): Promise<void> {
		try {
			if (user?.id) {
				const updatedUser = await updateUser(user.id, {
					name: editedUser.name,
					username: editedUser.username,
					description: editedUser.description
				});

				// Update both user and completeUserData
				user = { ...user, ...updatedUser };
				completeUserData = {
					...completeUserData,
					...updatedUser,
					name: updatedUser.name || completeUserData?.name || '',
					username: updatedUser.username || completeUserData?.username || '',
					description: updatedUser.description || completeUserData?.description || ''
				};

				isEditing = false;
				showSaveConfirmation = true;
				setTimeout(() => (showSaveConfirmation = false), 2000);
			}
		} catch (error) {
			console.error('Error updating user:', error);
		}
	}

	function handleOutsideClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			onClose();
			showStyles = false;
		}
	}

	function handleOverlayClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			showStyles = false;
		}
	}

	export async function logout(): Promise<void> {
		try {
			await signOut();
			dispatch('logout');
			onClose();
		} catch (err) {
			console.error('Logout error:', err);
		}
	}

	async function handleLanguageChange(): Promise<void> {
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

	async function handleStyleChange(event: CustomEvent): Promise<void> {
		const { style } = event.detail;
		await currentTheme.set(style);
		showStyles = false;
	}

	$: placeholderText = getRandomQuote();

	function getAvatarUrl(user: any): string {
		if (!user) return '';

		if (user.avatarUrl) return user.avatarUrl;

		if (user.avatar) {
			if (user.id && (user.collectionId || 'users')) {
				return `${pocketbaseUrl}/api/files/${user.collectionId || 'users'}/${user.id}/${user.avatar}`;
			}
		}

		return '';
	}

	async function loadUserStats(): Promise<void> {
		try {
			if (user && user.id) {
				// Refresh user data to ensure we have the latest
				const refreshedUser = await getUserById(user.id);
				if (refreshedUser) {
					// Preserve the avatar URL if it already exists
					const existingAvatarUrl = user.avatarUrl;

					// Update user data
					user = refreshedUser;
					editedUser = { ...refreshedUser };

					// Restore or set avatar URL
					if (existingAvatarUrl) {
						user.avatarUrl = existingAvatarUrl;
					} else if (user.avatar) {
						user.avatarUrl = getAvatarUrl(user);
					}

					// Fetch stats from our API endpoint
					console.log('Fetching stats for user ID:', user.id);
					const statsResponse = await fetch(`/api/verify/users/${user.id}/stats`, {
						credentials: 'include'
					});

					if (statsResponse.ok) {
						const statsData = await statsResponse.json();
						console.log('Received stats data:', statsData);

						if (statsData.success) {
							// Update the stats with real data
							threadCount = statsData.threadCount || 0;
							messageCount = statsData.messageCount || 0;
							taskCount = statsData.taskCount || 0;
							tagCount = statsData.tagCount || 0;
							timerCount = statsData.timerCount || 0;

							if (statsData.lastActive) {
								lastActive = new Date(statsData.lastActive);
							} else {
								lastActive = user.updated ? new Date(user.updated) : new Date();
							}

							console.log('Updated stats values:', {
								threadCount,
								messageCount,
								taskCount,
								tagCount,
								timerCount,
								lastActive
							});
						} else {
							console.error('Stats API returned error:', statsData.error);
							// Keep the default values or set fallbacks
						}
					} else {
						console.error('Failed to fetch stats:', statsResponse.status);
						// Keep the default values
					}
				}
			}
		} catch (error) {
			console.error('Error loading user data or stats:', error);
		}
	}

	async function fetchCompleteUserData(userId: string): Promise<UserData> {
		try {
			isLoading = true;
			const response = await fetch(`/api/verify/users/${userId}`);
			if (!response.ok) throw new Error('Failed to fetch user data');
			const data = await response.json();

			// Merge with basic user data
			const completeUser = await getUserById(userId);

			return {
				...completeUser,
				...data.user,
				// Ensure critical fields are always set
				name:
					data.user?.name ||
					completeUser?.name ||
					completeUser?.fullName ||
					completeUser?.displayName ||
					'',
				username:
					data.user?.username || completeUser?.username || completeUser?.email?.split('@')[0] || '',
				description: data.user?.description || completeUser?.description || ''
			};
		} catch (error) {
			console.error('Error fetching user data:', error);
			return {
				id: userId,
				name: '',
				username: '',
				description: ''
			};
		} finally {
			isLoading = false;
		}
	}

	$: if (user?.id) {
		isLoading = true;
		fetchCompleteUserData(user.id).then((data) => {
			completeUserData = data;
			editedUser = {
				name: data.name,
				username: data.username,
				description: data.description
			};
			isLoading = false;
		});
	}

	$: displayUser = completeUserData || user;

	// Helper function to safely format dates
	function formatDate(dateString?: string): string {
		if (!dateString) return 'Not available';

		try {
			return new Date(dateString).toLocaleString();
		} catch (error) {
			console.error('Error formatting date:', dateString, error);
			return 'Invalid date';
		}
	}
	onMount(async () => {
		if (user?.id) {
			try {
				isLoading = true;

				// Fetch complete user data in parallel
				const [completeUser, verifiedData] = await Promise.all([
					getUserById(user.id),
					fetchCompleteUserData(user.id)
				]);

				// Merge all data sources
				user = {
					...user,
					...completeUser,
					...(verifiedData?.user || {}),
					name: completeUser?.name || completeUser?.fullName || completeUser?.displayName || '',
					username: completeUser?.username || completeUser?.email?.split('@')[0] || '',
					description: completeUser?.description || ''
				};

				// Initialize editedUser
				editedUser = {
					name: user.name,
					username: user.username,
					description: user.description
				};

				currentTheme.initialize();
				await loadUserStats();
			} catch (err) {
				console.error('Failed to load user data:', err);
			} finally {
				isLoading = false;
			}
		}
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
				<div class="btn-row">
					<button class="back-button" on:click={onClose}>
						<ChevronLeft />
					</button>
					{#if isEditing}
						<button class="settings-button done" on:click={saveChanges}>
							<span>
								<Save size={16} />
								{$t('profile.close')}
							</span>
						</button>
					{:else if showAvatarUploader && user?.id}
						<div class="avatar-uploader-modal" transition:fade={{ duration: 200 }}>
							<div class="avatar-uploader-content" on:click|stopPropagation>
								<div class="avatar-uploader-header">
									<!-- <h3>{$t('profile.update')}</h3> -->
									<button class="close-button" on:click={toggleAvatarUploader}>
										<X size={20} />
									</button>
									<AvatarUploader
										userId={user.id}
										onSuccess={handleAvatarUploadSuccess}
										onError={handleAvatarUploadError}
									/>
								</div>
							</div>
						</div>
					{:else}
						<button class="settings-button" on:click={toggleEdit}>
							<Settings size={16} />
							<!-- <span class="hover">{$t('profile.edit')}</span> -->
						</button>
						<button class="settings-button" on:click={handleLanguageChange}>
							<Languages size={16} />
							<span>{$t('lang.flag')}</span>
							<!-- <span class="hover">{$t('profile.language')}</span> -->
						</button>
						<button
							class="settings-button"
							on:click={toggleStyles}
							transition:fly={{ y: -200, duration: 300 }}
						>
							<svelte:component
								this={styles.find((s) => s.value === $currentTheme)?.icon || Sun}
								size={16}
							/>
							<!-- <span class="hover">{$t('profile.theme')}</span> -->
						</button>
						<button class="logout-button" on:click={logout} transition:fade={{ duration: 300 }}>
							<LogOutIcon size={16} />
							<span class="hover">{$t('profile.logout')}</span>
						</button>
					{/if}
				</div>
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
					on:click|stopPropagation
					transition:fly={{ x: -20, duration: 300 }}
				>
					<StyleSwitcher on:close={handleStyleClose} on:styleChange={handleStyleChange} />
				</div>
			</div>
		{/if}

		{#if user}
			<!-- Tab Navigation -->
			<div class="tabs-container">
				<div class="tab-header">
					<div class="profile-header">
						<div class="info-column">
							<div class="header-wrapper">
								<div
									class="avatar-container"
									on:click={toggleAvatarUploader}
									role="button"
									tabindex="0"
								>
									{#if getAvatarUrl($currentUser)}
										<img src={getAvatarUrl($currentUser)} alt="User avatar" class="avatar" />
									{:else}
										<div class="default-avatar">
											{($currentUser?.name ||
												$currentUser?.username ||
												$currentUser?.email ||
												'?')[0]?.toUpperCase()}
										</div>
									{/if}
									<div class="avatar-overlay">
										<Camera size={20} />
									</div>
								</div>

								<div class="info-wrapper">
									<div class="info-row">
										{#if isEditing}
											<input
												value={editedUser.username || editedUser.email?.split('@')[0] || ''}
												on:input={(e) => (editedUser.username = e.target.value)}
											/>
										{:else}
											<span class="row">
												<span class="username"
													>{user?.username || user?.email?.split('@')[0] || 'Not set'}</span
												>
												<span class="meta role">
													{displayUser?.role || $t('profile.not_available')}
												</span>
											</span>
										{/if}
									</div>
									<div class="info-row">
										{#if isEditing}
											<input
												value={editedUser.name ||
													editedUser.fullName ||
													editedUser.displayName ||
													''}
												on:input={(e) => (editedUser.name = e.target.value)}
											/>
										{:else}
											<span class="name"
												>{user?.name || user?.fullName || user?.displayName || 'Not set'}</span
											>
										{/if}
									</div>
									<div class="info-row">
										<span class="meta">
											{displayUser?.email || $t('profile.not_available')}
											{#if displayUser?.verified}
												<!-- <MailCheck size={16} class="verified-icon" /> -->
											{/if}
										</span>
									</div>
								</div>
							</div>
						</div>
						<!-- <div class="info-stats">
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
						</div> -->
					</div>
					<div class="tabs-navigation">
						{#if isEditing}{:else}
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
							<button
								class="tab-button {activeTab === 'tags' ? 'active' : ''}"
								on:click={() => switchTab('tags')}
							>
								<TagsIcon size={20} />
								<span>Tags</span>
							</button>
						{/if}
					</div>
				</div>

				<!-- Tab Content -->
				<div class="tab-content">
					{#if activeTab === 'profile'}
						<div class="profile-info" transition:fade={{ duration: 200 }}>
							<div class="info-row-profile">
								{#if isEditing}
									<textarea
										class="textarea-description"
										value={editedUser.description}
										on:input={(e) => (editedUser.description = e.target.value)}
										placeholder="Enter your description"
									></textarea>
								{:else}
									<span class="description">
										{displayUser?.description || $t('profile.not_set')}
									</span>
								{/if}
							</div>

							<!-- <div class="selector-row">
							<button class="selector-button">
							  <MessageCirclePlus/>
							  {$t('profile.message')}
							</button>
							<button class="selector-button">
							  <Group/>
							  {$t('profile.connect')}
							</button>
							<button class="selector-button" disabled>
							  <UserCircle/>
							</button>
							<button class="selector-button" disabled>
							  <Mail/>
							</button>
						  </div> -->

							<!-- Email -->

							<!-- Created Date -->
							<div class="info-column">
								<div class="info-row">
									<span class="label">
										<span class="data">{$t('profile.created')}</span>
									</span>
									<span class="meta">
										{displayUser?.created
											? formatDate(displayUser.created)
											: $t('profile.not_available')}
									</span>
								</div>
								<!-- <Cake size={50}/> -->
							</div>

							<!-- Updated Date -->
							<div class="info-column">
								<div class="info-row">
									<span class="label">
										<span class="data">{$t('profile.updated')}</span>
									</span>
									<span class="meta">
										{user?.updated ? formatDate(user.updated) : $t('profile.not_available')}
									</span>
								</div>
								<!-- <History size={50}/> -->
							</div>

							<!-- Verified Status -->
							<div class="info-column">
								<div class="info-row">
									<span class="label">
										<span class="data">{$t('profile.verified')}</span>
									</span>
									<span class="meta">
										<span class={displayUser?.verified ? 'verified' : 'not-verified'}>
											{displayUser?.verified ? $t('profile.yes') : $t('profile.no')}
										</span>
									</span>
								</div>
								<!-- <Shield size={50}/> -->
							</div>
						</div>
					{:else if activeTab === 'stats'}
						{#if isEditing}{:else}
							<div class="stats-tab" transition:fade={{ duration: 200 }}>
								<StatsContainer
									{threadCount}
									{messageCount}
									{taskCount}
									{tagCount}
									{timerCount}
									{lastActive}
								/>
							</div>
						{/if}
					{:else if activeTab === 'tags'}
						{#if isEditing}{:else}
							<div class="tags-tab" transition:fade={{ duration: 200 }}>
								<TagEditor />
							</div>
						{/if}
					{/if}
				</div>
			</div>
		{:else}
			<div class="no-user-message">
				<p>No user information available.</p>
			</div>
		{/if}

		{#if showSaveConfirmation}
			<div class="save-confirmation" in:fly={{ y: 20, duration: 300 }} out:fade={{ duration: 200 }}>
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
	@use "src/lib/styles/themes.scss" as *;	* {
		font-family: var(--font-family);
		color: var(--text-color);
	}
	.modal-overlay {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 2rem;
		overflow-y: scroll;
		overflow-x: hidden;
		scroll-behavior: smooth;
		scrollbar-color: var(--bg-color) transparent;
		transition: all 0.3s ease;
		background: transparent;
	}

	.btn-row {
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		width: 100%;
		gap: 1rem;
		user-select: none;
		margin-left: 0.5rem;
	}

	.modal-content {
		height: auto;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		width: calc(100% - 2rem);
		padding: 0.5rem;
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

	textarea {
		background: var(--secondary-color) !important;
		border: 1px solid transparent;
		border-radius: 1rem;
		outline: none !important;
		width: 100%;
		font-size: 1rem;
		display: flex;
		&:focus {
			background: var(--primary-color) !important;
			border: 1px solid var(--secondary-color);
		}
	}
	input {
		background: var(--secondary-color) !important;
		border-radius: var(--radius-m);
		padding: 1rem;
		font-size: 1.5rem;
		resize: vertical;
		width: auto;
		display: flex;
		height: auto;
		outline: none !important;
		border: 1px solid transparent;
		transition: all 0.3s ease;

		&:focus {
			background: var(--primary-color) !important;
			border: 1px solid var(--secondary-color);
		}
	}
	.profile-header {
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		align-items: flex-start;
		width: calc(100% - 100px);
		height: auto;
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
			justify-content: center;
			height: auto;
			padding: 0.5rem;
			font-size: 2.5rem;
			letter-spacing: 0.1rem;
			font-weight: 800;
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
		flex-direction: row;
		justify-content: flex-start;
		align-items: center;
	}
	.info-wrapper {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: flex-start;
		gap: 0.5rem;
		margin-left: 0.5rem;
		& .info-row {
			justify-content: flex-start;
			align-items: center;

			padding: 0;
			& span.row {
				display: flex;
				flex-direction: row;
				align-items: center;
			}
		}
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
		}
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
		width: 5rem;
		height: 5rem;
		border-radius: 50%;
		overflow: hidden;
		justify-content: center;
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
		justify-content: center;
		align-items: center;
		// border: 1px solid rgb(69, 69, 69);
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
			padding: 0;
			// background: var(--primary-color);
			border-radius: 0;
		}

		.info-row {
			font-size: 1.2rem;
			padding: 0.5rem 0.25rem;
			display: flex;
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
			height: auto;
			border-top: 1px solid var(--line-color);
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
		font-size: 1rem;
		color: var(--placeholder-color);
	}

	span.username {
		font-size: 1.2rem;
		color: var(--text-color);
	}

	span.description {
		font-size: 0.7em;
		line-height: 2;
		margin-top: 0.5rem;
		letter-spacing: 0.1rem;
		text-align: justify;
		width: 100%;
		display: flex;
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
	span.meta {
		display: flex;
		font-size: 0.8rem;
		color: var(--placeholder-color);
		& .not-verified {
			color: red;
		}
		& .verified {
			color: green;
		}
		&.role {
			position: relative;
			padding: 0.25rem 1rem;
			border-radius: 1rem;
			margin: 0;
			left: 0.5rem;
			background: var(--secondary-color);
			color: var(--tertiary-color);
		}
	}
	.label {
		font-weight: 300;
		font-size: 1rem;
		letter-spacing: 0.1rem;
		width: auto;
		user-select: none;
		padding-inline-start: 1rem;

		& span.data {
			color: var(--placeholder-color);
		}
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
		margin-right: 1rem;
		border-radius: 1rem;
		width: auto;
		height: 2rem;
		background: var(--secondary-color);
		opacity: 0.5;
		border: 1px solid var(--border-color);
		color: var(--text-color);
		transition: all 0.3s ease;

		span.hover {
			display: none;
		}

		&:hover {
			background: red;
			box-shadow: 0 4px 6px rgba(255, 0, 0, 0.5);
			font-weight: bold;
			opacity: 1;
			width: auto;
			span.hover {
				display: flex;
				width: 5rem;
			}
		}

		span {
			font-size: 0.9rem;
		}
	}

	.settings-row {
		display: flex;
		flex-direction: column;
		width: calc(100% - 3rem);
		max-width: 800px;
		gap: 1rem;
		margin-bottom: 2rem;
	}
	button.back-button {
		display: flex;
		align-items: center;
		justify-content: center;
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		border-radius: 50%;
		height: 2rem;
		width: 2rem;
		gap: 0.2rem;
		background: var(--primary-color);
		border: 1px solid var(--border-color);
		color: var(--text-color);
		transition: all 0.2s ease;
		opacity: 0.5;
		cursor: pointer;
		&:hover {
			background: var(--secondary-color);
		}
	}

	button.settings-button {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 1rem;
		width: auto;
		height: 2rem;
		gap: 0.2rem;
		background: var(--primary-color);
		border: 1px solid var(--border-color);
		color: var(--text-color);
		transition: all 0.2s ease;
		opacity: 0.5;
		cursor: pointer;
		&.done {
			background: var(--primary-color);
			border: 1px solid var(--line-color);
			width: 100%;
			&:hover {
				color: var(--tertiary-color);
			}
		}

		& span.hover {
			display: flex;
		}

		&:hover {
			// transform: translateY(-4px);
			box-shadow: 0 4px 6px rgba(255, 255, 255, 0.2);
			opacity: 1;
			& span.hover {
				display: flex;
			}
			& span {
				font-size: 0.9rem;
				display: flex;
				justify-content: center;
				align-items: center;
				gap: 0.5rem;
				margin: 0;
				color: var(--tertiary-color);
				padding: 0;
			}
		}

		span {
			font-size: 0.9rem;
			display: flex;
			justify-content: center;
			align-items: center;
			gap: 0.5rem;
			margin: 0;
			padding: 0;
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

	.avatar-container {
		position: relative;
		cursor: pointer;
		border-radius: 50%;
		overflow: hidden;
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.avatar-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s ease;
		color: white;
	}

	.avatar-container:hover .avatar-overlay {
		opacity: 1;
	}

	.avatar-uploader-modal {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: auto;
		// background-color: rgba(0, 0, 0, 0.7);
		// background-color: var(--bg-color);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		background: var(--bg-color);
	}

	.avatar-uploader-content {
		border-radius: 8px;
		padding: 1.5rem;
		width: 90%;
		max-width: 400px;
	}

	.avatar-uploader-header {
		display: flex;
		flex-direction: column;

		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.close-button {
		position: absolute;
		right: 1rem;
		top: 0;
		background: none;
		border: none;
		color: var(--color-text);
		cursor: pointer;
		padding: 0.25rem;
	}

	.avatar-uploader-header h3 {
		margin: 0;
		font-size: 1.25rem;
	}

	@media (max-width: 1000px) {
		.label {
			font-weight: 300;
			font-size: 0.9rem;
			letter-spacing: 0.3rem;
			width: auto;
			user-select: none;
			padding-inline-start: 1rem;

			& span.data {
				color: var(--placeholder-color);
			}
		}
		span.info-avatar {
			font-size: 3rem;
		}

		span.stat {
			font-size: 0.8rem;
		}
		span.name {
			font-size: 1.2rem;
		}

		span.username {
			font-size: 1rem;
		}

		span.description {
			font-size: 0.8rem;
			line-height: 1.5;
			letter-spacing: 0.2rem;
			text-align: justify;
			width: auto;
		}

		.header-wrapper {
			display: flex;
			flex-direction: row;
			justify-content: flex-start;
			align-items: center;
			gap: 0.5rem;
		}

		.profile-header {
			display: flex;
			flex-direction: row;
			justify-content: flex-start;
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
				width: auto;
				padding: 1rem;
				border-radius: 1rem;
			}
			.info-row {
				display: flex;
				justify-content: center;
				height: auto;
				padding: 0;
				font-size: 2.5rem;
				letter-spacing: 0.1rem;
				font-weight: 800;
				max-width: 800px;
				width: auto;
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
			justify-content: flex-start;

			& button.tab-button {
				font-size: 1rem;
			}
		}
	}

	@media (max-width: 768px) {
		.avatar-container {
			width: 4rem;
			height: 4rem;
			border-radius: 50%;
			overflow: hidden;
		}

		// .avatar {
		// 	width: 100%;
		// 	height: 100%;
		// 	object-fit: cover;
		// }

		.avatar-placeholder {
			width: 100%;
			height: 100%;
			display: flex;
			justify-content: center;
			align-items: center;
			background-color: #e0e0e0;
			color: #757575;
		}

		.settings-row {
			display: flex;
			flex-direction: row;
			justify-content: center;
			flex-wrap: wrap;
			gap: 1rem;
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
				// transform: translateY(-4px);
				background: var(--bg-gradient);
			}

			span {
				font-size: 0.9rem;
			}
		}
	}
	@media (max-width: 450px) {
		.header-wrapper {
			gap: 0;
		}
		.info-wrapper {
			gap: 0.25rem;
		}
		span.username {
			line-height: 1.5;
		}
		span.name {
			font-size: 0.8rem;
			line-height: 1.5;
		}
		span.meta {
			font-size: 0.6rem;
			line-height: 1.5;
		}
	}
</style>

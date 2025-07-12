<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { page } from '$app/stores';
	import { onMount, tick } from 'svelte';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import {
		currentUser,
		refreshCurrentUser,
		uploadAvatar,
		updateUser,
		getUserById,
		signOut
	} from '$lib/pocketbase';
	import { createEventDispatcher } from 'svelte';
	import { t } from '$lib/stores/translationStore';
	import { currentLanguage, languages, setLanguage } from '$lib/stores/languageStore';
	import { currentTheme } from '$lib/stores/themeStore';
	import StyleSwitcher from '$lib/features/users/components/StyleSwitcher.svelte';
	import StatsContainer from '$lib/features/users/components/StatsContainer.svelte';
	import { apiKey } from '$lib/stores/apiKeyStore';
	import TagEditor from '$lib/features/users/components/TagEditor.svelte';
	import AvatarUploader from '$lib/features/users/components/AvatarUploader.svelte';
	import WallpaperSelector from '$lib/features/users/components/WallpaperSelector.svelte';
	import TimeTracker from '$lib/components/buttons/TimeTracker.svelte';
	import { clientTryCatch, fetchTryCatch, tryCatchSync, isFailure } from '$lib/utils/errorUtils';
	import type { User } from '$lib/types/types';
	import { getAvatarUrl } from '$lib/features/users/utils/avatarHandling';
	import { refreshAvatar } from '$lib/stores/avatarStore';
	import EmailModal from '$lib/features/email/components/EmailModal.svelte';

	export let user: User | null;
	export let onClose: () => void;
	export let onStyleClick: () => void;

	let isLoading = false;
	let completeUser: User | null = null;
	let showAvatarUploader = false;
	let fileInput: HTMLInputElement | undefined;
	let isUploading = false;
	let showSaveConfirmation = false;
	let showKeyInput = false;
	let isEditing = false;
	let editedUser: Partial<User> = user
		? { ...user }
		: {
				name: '',
				username: '',
				description: ''
			};
	let showLanguageNotification = false;
	let showLanguageSelector = false;
	let selectedLanguageName = '';
	let placeholderText = '';

	let showStyles = false;
	let showWallpapers = false;
	let currentStyle = 'default';

	let activeTab = 'profile';

	let threadCount = 0;
	let messageCount = 0;
	let taskCount = 0;
	let tagCount = 0;
	let timerCount: number = 0;
	let lastActive: Date | null = null;

	let showEmailModal = false;
	$: currentUserId = $currentUser?.id || '';

	interface StyleOption {
		name: string;
		value: string;
		icon: IconName;
	}
	$: console.log('User data:', user);

	const styles: StyleOption[] = [
		{ name: 'Daylight Delight', value: 'default', icon: 'Sun' },
		{ name: 'Midnight Madness', value: 'dark', icon: 'Moon' },
		{ name: 'Sunrise Surprise', value: 'light', icon: 'Sunrise' },
		{ name: 'Sunset Serenade', value: 'sunset', icon: 'Sunset' },
		{ name: 'Laser Focus', value: 'focus', icon: 'Focus' },
		{ name: 'Bold & Beautiful', value: 'bold', icon: 'Bold' },
		{ name: 'Turbo Mode', value: 'turbo', icon: 'Gauge' },
		{ name: 'Bone Tone', value: 'bone', icon: 'Bone' }
	];

	const dispatch = createEventDispatcher();

	/*
	 * $: chatRelatedPages = ['/chat', '/canvas', '/ide']; // Add other pages that need API keys
	 * $: needsApiKey = chatRelatedPages.some(path => $page.url.pathname.startsWith(path));
	 * $: hasApiKey = needsApiKey ? hasAnyApiKey($apiKey) : true;
	 */

	/*
	 * function hasAnyApiKey(apiKeys: any): boolean {
	 * 	if (!apiKeys || typeof apiKeys !== 'object') return false;
	 * 	return Object.values(apiKeys).some(key =>
	 * 		typeof key === 'string' && key.trim() !== ''
	 * 	);
	 * }
	 */

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
	function toggleWallpapers(): void {
		showWallpapers = !showWallpapers;
	}

	function toggleAvatarUploader(): void {
		showAvatarUploader = !showAvatarUploader;
	}
	let avatarTimestamp = Date.now();

	function handleAvatarUploadSuccess(): void {
		console.log('Avatar upload completed successfully');
		showAvatarUploader = false;

		// Just force avatar refresh with cache busting - no API calls
		avatarTimestamp = Date.now();

		// Don't call getUserById or refreshCurrentUser - they're timing out
		// The avatar API endpoint will serve the new avatar automatically
		console.log('Avatar timestamp updated to:', avatarTimestamp);
	}
	function handleAvatarUploadError(error: string): void {
		console.error('Avatar upload error:', error);
	}
	function handleAvatarClick() {
		console.log('Avatar clicked, fileInput:', fileInput);
		if (fileInput) {
			fileInput.click();
		}
	}
	async function handleFileChange(event: Event) {
		console.log('File change triggered');
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) {
			console.log('No file selected');
			return;
		}

		console.log('File selected:', file.name, file.size, file.type);

		// Validate file
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file');
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			alert('Image must be less than 5MB');
			return;
		}

		const userId = (user || $currentUser)?.id;
		console.log('Uploading for user:', userId);

		if (!userId) {
			console.log('No user ID found');
			return;
		}

		try {
			isUploading = true;
			console.log('Starting upload...');
			await uploadAvatar(userId, file);
			console.log('Upload successful');

			const timestamp = Date.now();

			// Update the profile modal avatar
			const avatarImg = document.querySelector('.avatar') as HTMLImageElement;
			if (avatarImg) {
				avatarImg.src = `/api/users/${userId}/avatar?t=${timestamp}`;
			}

			// Dispatch custom event to update layout avatar
			window.dispatchEvent(
				new CustomEvent('avatarUpdated', {
					detail: { userId, timestamp }
				})
			);
		} catch (error) {
			console.error('Upload failed:', error);
			alert('Upload failed. Please try again.');
		} finally {
			isUploading = false;
			input.value = ''; // Reset input
		}
	}
	function handleWallpaperChangeEvent(event: CustomEvent) {
		const { wallpaperPreference } = event.detail;
		console.log('Wallpaper changed:', wallpaperPreference);

		/*
		 * The currentUser store should automatically update, but you can manually update if needed
		 * currentUser.update(user => ({
		 *     ...user,
		 *     wallpaper_preference: stringifyWallpaperPreference(wallpaperPreference)
		 * }));
		 */

		/*
		 * Optionally close the wallpaper selector after selection
		 * showWallpapers = false;
		 */
	}

	function handleStyleClose(): void {
		showStyles = false;
	}
	function handleWallpaperClose(): void {
		showWallpapers = false;
	}
	function switchTab(tab: string): void {
		activeTab = tab;
	}
	async function saveChanges(): Promise<void> {
		const result = await clientTryCatch(
			(async () => {
				if (!user?.id) {
					throw new Error('User ID not available');
				}

				const updatedUser = await updateUser(user.id, {
					name: editedUser.name,
					username: editedUser.username,
					description: editedUser.description,
					role: editedUser.role
				});

				// Update both user and completeUser with proper typing
				user = { ...user, ...updatedUser };
				completeUser = {
					...completeUser,
					...updatedUser,
					name: updatedUser.name || completeUser?.name || '',
					username: updatedUser.username || completeUser?.username || '',
					description: updatedUser.description || completeUser?.description || '',
					role: updatedUser.role || completeUser?.role || ''
				} as User;

				isEditing = false;
				showSaveConfirmation = true;
				setTimeout(() => (showSaveConfirmation = false), 2000);

				return updatedUser;
			})(),
			`Saving changes for user ${user?.id}`
		);

		if (isFailure(result)) {
			console.error('Error updating user:', result.error);
			// You might want to show an error message to the user here
		}
	}

	function handleOutsideClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			onClose();
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
	}
	async function handleWallpaperChange(event: CustomEvent): Promise<void> {
		const { wallpaper } = event.detail;
		await currentTheme.set(wallpaper);
	}

	$: placeholderText = getRandomQuote();

	async function loadUserStats(): Promise<void> {
		const result = await clientTryCatch(
			(async () => {
				if (!user?.id) {
					console.error('loadUserStats: User ID not available', { user });
					throw new Error('User ID not available');
				}

				console.log('loadUserStats: Starting with user ID:', user.id);

				// Try to refresh user data, but don't fail if it doesn't work
				let refreshedUser = null;
				try {
					refreshedUser = await getUserById(user.id);
					console.log('loadUserStats: getUserById result:', refreshedUser);
				} catch (error) {
					console.error('loadUserStats: getUserById failed:', error);
					// Continue with existing user data instead of failing
					console.log('loadUserStats: Continuing with existing user data');
				}

				// Use refreshed data if available, otherwise keep existing user data
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
					console.log('loadUserStats: User data updated successfully');
				} else {
					console.log('loadUserStats: Using existing user data');
				}

				// Fetch stats from our API endpoint
				console.log('loadUserStats: Fetching stats for user ID:', user.id);

				const statsResult = await fetchTryCatch<{
					success: boolean;
					threadCount?: number;
					messageCount?: number;
					taskCount?: number;
					tagCount?: number;
					timerCount?: number;
					lastActive?: string;
					error?: string;
				}>(`/api/verify/users/${user.id}/stats`, {
					credentials: 'include'
				});

				if (isFailure(statsResult)) {
					console.error('loadUserStats: Failed to fetch stats:', statsResult.error);
					// Keep the default values
					return { userRefreshed: !!refreshedUser, statsLoaded: false };
				}

				const statsData = statsResult.data;
				console.log('loadUserStats: Received stats data:', statsData);

				if (statsData.success) {
					// Update the stats with real data
					threadCount = statsData.threadCount || 0;
					messageCount = statsData.messageCount || 0;
					taskCount = statsData.taskCount || 0;
					tagCount = statsData.tagCount || 0;
					timerCount = statsData.timerCount || 0;

					if (statsData.lastActive) {
						const lastActiveValue = statsData.lastActive;
						const dateResult = tryCatchSync(() => new Date(lastActiveValue));
						if (isFailure(dateResult)) {
							console.error('loadUserStats: Error parsing lastActive date:', dateResult.error);
							lastActive = user.updated ? new Date(user.updated) : new Date();
						} else {
							lastActive = dateResult.data;
						}
					} else {
						lastActive = user.updated ? new Date(user.updated) : new Date();
					}

					console.log('loadUserStats: Updated stats values:', {
						threadCount,
						messageCount,
						taskCount,
						tagCount,
						timerCount,
						lastActive
					});

					return { userRefreshed: !!refreshedUser, statsLoaded: true };
				} else {
					console.error('loadUserStats: Stats API returned error:', statsData.error);
					// Keep the default values or set fallbacks
					return { userRefreshed: !!refreshedUser, statsLoaded: false };
				}
			})(),
			`Loading user stats for ${user?.id}`
		);

		if (isFailure(result)) {
			console.error('loadUserStats: Error loading user data or stats:', result.error);
			// Don't throw here, just log the error and continue
		}
	}

	async function fetchCompleteUser(userId: string): Promise<User> {
		const result = await clientTryCatch(
			(async () => {
				isLoading = true;

				const fetchResult = await fetchTryCatch<{ success: boolean; data: { user: User } }>(
					`/api/verify/users/${userId}`
				);

				if (isFailure(fetchResult)) {
					throw new Error(`Failed to fetch user data: ${fetchResult.error}`);
				}

				const data = fetchResult.data.data;

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
						data.user?.username ||
						completeUser?.username ||
						completeUser?.email?.split('@')[0] ||
						'',
					description: data.user?.description || completeUser?.description || '',
					role: data.user?.role || completeUser?.role || 'client'
				};
			})(),
			`Fetching complete user data for ${userId}`
		);

		// Always set isLoading to false
		isLoading = false;

		if (isFailure(result)) {
			console.error('Error fetching user data:', result.error);
			return {
				id: userId,
				name: '',
				username: '',
				description: '',
				email: '',
				emailVisibility: false,
				avatar: '',
				role: 'client',
				created: '',
				updated: '',
				verified: false,
				theme_preference: '',
				wallpaper_preference: [],
				profileWallpaper: '',
				model_preference: [],
				taskAssignments: [],
				userTaskStatus: {
					backlog: 0,
					todo: 0,
					focus: 0,
					inprogress: 0,
					done: 0,
					hold: 0,
					postpone: 0,
					cancel: 0,
					review: 0,
					delegate: 0,
					archive: 0
				},
				collectionId: '',
				collectionName: 'users',
				network_preferences: [],
				preferences: [],
				messages: [],
				last_login: '',
				location: '',
				website: '',
				status: 'offline' as const,
				bookmarks: [],
				favoriteThreads: [],
				timer_sessions: [],
				token_balance: 0,
				lifetime_tokens: 0,
				current_subscription: '',
				activated_features: [],
				keys: [],
				selected_provider: '',
				model: '',
				prompt_preference: [],
				sysprompt_preference: '',
				projects: [],
				hero: '',
				api_keys: [],
				followers: [],
				following: []
			} as User;
		}

		return result.data;
	}

	function cancelEdit() {
		descriptionValue = user?.description || '';
	}
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			saveChanges();
		} else if (event.key === 'Escape') {
			cancelEdit();
		}
	}
	$: if (user?.id) {
		isLoading = true;
		fetchCompleteUser(user.id).then((data) => {
			completeUser = data;
			editedUser = {
				name: data.name,
				username: data.username,
				description: data.description
			};
			isLoading = false;
		});
	}

	$: displayUser = completeUser || user;

	function formatDate(dateString?: string): string {
		if (!dateString) return 'Not available';

		const result = tryCatchSync(() => {
			const date = new Date(dateString);

			// Check if the date is valid
			if (isNaN(date.getTime())) {
				throw new Error('Invalid date string');
			}

			return date.toLocaleString();
		});

		if (isFailure(result)) {
			console.error('Error formatting date:', dateString, result.error);
			return 'Invalid date';
		}

		return result.data;
	}
	onMount(async () => {
		if (user?.id) {
			try {
				isLoading = true;

				// Fetch complete user data in parallel
				const [completeUser, verifiedData] = await Promise.all([
					getUserById(user.id),
					fetchCompleteUser(user.id)
				]);

				// Safely extract user data from verifiedData

				const verifiedUser =
					verifiedData && typeof verifiedData === 'object' && 'user' in verifiedData
						? (verifiedData as unknown as { user: User }).user
						: verifiedData;
				// Merge all data sources
				user = {
					...user,
					...completeUser,
					...(verifiedUser || {}),
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
				<button class="back-button" on:click={onClose}>
					<Icon name="ChevronLeft" size={20} />
				</button>

				{#if isEditing}
					<div class="info-row">
						{#if isEditing}
							<input
								value={editedUser.name || editedUser.fullName || editedUser.displayName || ''}
								on:input={(e) => {
									if (e.target instanceof HTMLInputElement) {
										editedUser.name = e.target.value;
									}
								}}
							/>
						{:else}
							<span class="name">{user.name || user.fullName || user.displayName || 'Not set'}</span
							>
						{/if}
					</div>
					<button class="settings-button done" on:click={saveChanges}>
						<span>
							<Icon name="Save" size={16} />
							{$t('profile.close')}
						</span>
					</button>
				{:else}{/if}
			</div>
		</div>

		<!-- Keep the avatar uploader modal section as is -->
		{#if showAvatarUploader && user?.id}{/if}

		{#if user}
			<!-- Tab Navigation -->
			<div class="tabs-container">
				<div class="tab-content">
					{#if activeTab === 'profile'}
						<div class="profile-header">
							<div class="info-column">
								<div class="header-wrapper">
									<div class="avatar-container" role="button" tabindex="0">
										<input
											type="file"
											accept="image/*"
											bind:this={fileInput}
											on:change={handleFileChange}
											style="display: none;"
										/>
										{#if (user || $currentUser)?.id}
											<img
												src="/api/users/{(user || $currentUser).id}/avatar"
												alt="User avatar"
												class="avatar {isUploading ? 'uploading' : ''}"
												on:click={handleAvatarClick}
											/>
										{:else}
											<div class="default-avatar" on:click={handleAvatarClick}>
												{((user || $currentUser)?.name ||
													(user || $currentUser)?.username ||
													(user || $currentUser)?.email ||
													'?')[0]?.toUpperCase()}
											</div>
										{/if}

										<!-- Make the overlay clickable too -->
										<div class="avatar-overlay" on:click={handleAvatarClick}>
											<Icon name="Camera" size={20} />
										</div>
									</div>

									<div class="info-wrapper">
										<div class="info-row">
											{#if isEditing}
												<input
													value={editedUser.username || editedUser.email?.split('@')[0] || ''}
													on:input={(e) => {
														if (e.target instanceof HTMLInputElement) {
															editedUser.username = e.target.value;
														}
													}}
												/>
											{:else}
												<span class="row">
													<span class="username">
														{user.username || user.email?.split('@')[0] || 'Not set'}
													</span>
													<span class="meta role">
														{displayUser?.role || $t('profile.not_available')}
													</span>
												</span>
											{/if}
										</div>

										<div class="info-row">
											<span class="meta">
												{user.email}
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
						<div class="profile-info" transition:fade={{ duration: 200 }}>
							<div class="info-row-profile">
								{#if isEditing}
									<textarea
										class="textarea-description"
										value={editedUser.description}
										placeholder="Enter your description"
										on:input={(e) => {
											if (e.target instanceof HTMLInputElement) {
												editedUser.description = e.target.value;
											}
										}}
									></textarea>
								{:else}
									<!-- <span class="meta">
										{displayUser?.description || $t('profile.not_available')}
									</span> -->
								{/if}
							</div>

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
							</div>
						</div>
					{:else if activeTab === 'stats'}
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
						<!-- {:else if activeTab === 'tags'}
						<div class="tags-tab" transition:fade={{ duration: 200 }}>
							<TagEditor />
						</div> -->
					{:else if activeTab === 'settings'}
						<div class="settings-tab" transition:fade={{ duration: 200 }}>
							<div class="settings-content">
								<div class="settings-section">
									<h3>Account Settings</h3>
									<div class="settings-row">
										<button class="settings-button" on:click={toggleEdit}>
											<Icon name="Settings" size={20} />
											<span>Edit Profile</span>
										</button>
										<button class="settings-button" on:click={handleLanguageChange}>
											<Icon name="Languages" size={20} />
											<span>Change Language ({$t('lang.flag')})</span>
										</button>
										<button class="settings-button logout" on:click={logout}>
											<Icon name="LogOut" size={20} />
											<span>Logout</span>
										</button>
									</div>
								</div>
								<div class="settings-section">
									<h3>Profile</h3>
									<div class="settings-row">
										<AvatarUploader
											userId={user.id}
											onSuccess={handleAvatarUploadSuccess}
											onError={handleAvatarUploadError}
										/>
									</div>
								</div>
							</div>
						</div>
					{:else if activeTab === 'theme'}
						<div class="theme-tab" transition:fade={{ duration: 200 }}>
							<StyleSwitcher on:styleChange={handleStyleChange} />
						</div>
					{:else if activeTab === 'wallpaper'}
						<div class="wallpaper-tab" transition:fade={{ duration: 200 }}>
							<WallpaperSelector
								currentWallpaper={$currentUser?.wallpaper_preference?.[0] || {
									wallpaperId: null,
									isActive: false
								}}
								on:styleChange={handleWallpaperChangeEvent}
							/>
						</div>
					{:else if activeTab === 'email'}
						<div class="email-tab" transition:fade={{ duration: 200 }}>
							<EmailModal userId={currentUserId} />
						</div>
					{/if}
				</div>
				<div class="tabs-navigation">
					{#if isEditing}
						<!-- Show only basic tabs during editing -->
						<button
							class="tab-button {activeTab === 'profile' ? 'active' : ''}"
							on:click={() => switchTab('profile')}
							title="Profile"
						>
							<Icon name="User2" size={20} />
							<span>Profile</span>
						</button>
					{:else}
						<!-- All tabs when not editing -->
						<button
							class="tab-button {activeTab === 'profile' ? 'active' : ''}"
							on:click={() => switchTab('profile')}
							title="Profile"
						>
							<Icon name="User2" size={20} />
							<span>{$t('profile.profile')}</span>
						</button>
						<button
							class="tab-button {activeTab === 'stats' ? 'active' : ''}"
							on:click={() => switchTab('stats')}
							title="Stats"
						>
							<Icon name="Layers" size={20} />
							<span>{$t('generic.stats')}</span>
						</button>
						<!-- <button
								class="tab-button {activeTab === 'tags' ? 'active' : ''}"
								on:click={() => switchTab('tags')}
								title="Tags"
							>
								<Icon name="Tags" size={20} />
								<span>{$t('generic.tags')}</span>
							</button> -->
						<button
							class="tab-button {activeTab === 'settings' ? 'active' : ''}"
							on:click={() => switchTab('settings')}
							title="Settings"
						>
							<Icon name="Settings" size={20} />
							<span>{$t('generic.settings')}</span>
						</button>
						<button
							class="tab-button {activeTab === 'theme' ? 'active' : ''}"
							on:click={() => switchTab('theme')}
							title="Theme"
						>
							<Icon name={styles.find((s) => s.value === $currentTheme)?.icon || 'Sun'} size={20} />
							<span>Theme</span>
						</button>
						<button
							class="tab-button {activeTab === 'wallpaper' ? 'active' : ''}"
							on:click={() => switchTab('wallpaper')}
							title="Wallpaper"
						>
							<Icon name="WallpaperIcon" size={20} />
							<span>{$t('profile.wallpaper')}</span>
						</button>
						<button
							class="tab-button {activeTab === 'email' ? 'active' : ''}"
							on:click={() => switchTab('email')}
							title="Email"
						>
							<div class="tab-icon">@</div>
							<span>{$t('profile.email')}</span>
						</button>
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

<style lang="scss">
	@use '../../../styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	.modal-overlay {
		display: flex;
		align-items: flex-start;
		justify-content: flex-start;
		width: auto;
		height: 100%;
		border-radius: 2rem;
		padding: 1rem 0;
		transition: all 0.3s ease;
		background: transparent;
	}

	.btn-row {
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		width: 100%;
		gap: 0.5rem;
		user-select: none;
		margin-left: 0.5rem;
	}

	.modal-content {
		height: 100%;
		margin-bottom: 3rem;
		margin-left: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: flex-end;
		width: 100%;
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
		color: var(--text-color);
		border-radius: 1rem;
		outline: none !important;
		width: 100%;
		font-size: 1rem;
		display: flex;
		&:focus {
			background: var(--primary-color) !important;
			border: 1px solid var(--secondary-color);
			box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
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
			input {
				background: var(--secondary-color) !important;
				color: var(--text-color);
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
					box-shadow: 0px 8px 16px 0px rgba(251, 245, 245, 0.2);
				}
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
	.url-button .header-wrapper {
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
		max-width: calc(100% - 2rem);
		height: auto;
		display: flex;
		justify-content: right;
		align-items: top;
		z-index: 1444;
	}
	.theme-tab {
		display: flex;
		justify-content: center;
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

	.tab-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		font-weight: 200;
	}
	.profile-info {
		margin-bottom: 1rem;
		color: var(--text-color);
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
			padding: 1rem 0.25rem;
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
			padding: 1rem;
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
		color: var(--text-color);
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
			background: var(--primary-color) !important;
			border-radius: var(--radius-m);
			padding: 1rem;
			font-size: 1.5rem;
			resize: vertical;
			display: flex;
			height: auto;
			min-width: 300px;
		}
	}

	.info-row input {
		background: var(--primary-color) !important;
		border-radius: var(--radius-m);
		padding: 1rem;
		font-size: 1.5rem;
		resize: vertical;
		display: flex;
		height: auto;
		min-width: 300px;
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
		z-index: 1000;
	}
	.tab-button.active {
		background-color: var(--tertiary-color);
		margin-top: 2rem;
		margin-left: 1rem;
		margin-right: -0.5rem;
		left: auto;
		width: 90%;
		font-size: 1.5rem;
		padding: 0.25rem;
		border-radius: 2rem 0 0 2rem;
		display: flex;
		justify-content: center;
		align-items: center;
		& .tab-icon {
			font-size: 1.5rem;
		}
	}
	.tab-button {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.tab-button:hover {
		background-color: var(--bg-color);
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
		justify-content: flex-start;
		border-radius: 1rem;
		width: auto;
		height: 2rem;
		gap: 0.5rem;
		background: var(--bg-gradient-right);
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
	.tab-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		flex: 1;
		margin-top: 1rem;
	}
	.tabs-container {
		margin-top: 1rem;
		margin-bottom: 1rem;
		margin-right: 0;
		display: flex;
		position: relative;
		justify-content: flex-end;
		width: 100%;
	}

	.tabs-navigation {
		display: flex;
		flex-direction: column;
		margin-top: 0;
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
			left: 0;
			width: 100% !important;
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

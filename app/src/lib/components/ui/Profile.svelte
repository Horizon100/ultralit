<script lang="ts">
	import { fade, fly, slide } from 'svelte/transition';
	import { 
		Camera, LogOutIcon, Languages, Palette, X, Bone, Save, 
		TextCursorIcon, Pen, User2, UserCircle, MailCheck, 
		Mail, KeyIcon, Cake, History, Shield, Layers, 
		MessageCirclePlus, Group, ChevronLeft 
	} from 'lucide-svelte';
	import { 
		Moon, Sun, Sunset, Sunrise, Focus, Bold, Gauge, Key 
	} from 'lucide-svelte';
	import { onMount, tick } from 'svelte';

	import { currentUser, pocketbaseUrl, updateUser, getUserById, signOut } from '$lib/pocketbase';
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
      setTimeout(() => showSaveConfirmation = false, 2000);
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

	// Function to get avatar URL safely
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
				
				// Set some mock stats for now
				threadCount = 5;
				messageCount = 42;
				tagCount = 12;
				timerCount = 3;
				lastActive = user.updated ? new Date(user.updated) : new Date();
			}
			}
		} catch (error) {
			console.error("Error loading user data:", error);
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
      name: data.user?.name || completeUser?.name || completeUser?.fullName || completeUser?.displayName || '',
      username: data.user?.username || completeUser?.username || completeUser?.email?.split('@')[0] || '',
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
  fetchCompleteUserData(user.id).then(data => {
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
        ...verifiedData?.user || {},
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
      console.error("Failed to load user data:", err);
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
							<span class="hover">{$t('profile.edit')}</span>
						</button>
					{/if}
	
					<button class="settings-button" on:click={handleLanguageChange}>
						<Languages size={24} />
						<span>{$t('lang.flag')}</span>
						<span class="hover">{$t('profile.language')}</span>

					</button>
					<button
						class="settings-button"
						on:click={toggleStyles}
						transition:fly={{ y: -200, duration: 300 }}
					>
						<svelte:component
							this={styles.find((s) => s.value === $currentTheme)?.icon || Sun}
							size={24}
						/>
						<span class="hover">{$t('profile.theme')}</span>

					</button>
				</div>
				
				<button class="logout-button" on:click={logout} transition:fade={{ duration: 300 }}>
					<LogOutIcon size={24} />
					<span class="hover">{$t('profile.logout')}</span>
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
				on:click|stopPropagation
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
							{#if getAvatarUrl($currentUser)}
							<img 
								src={getAvatarUrl($currentUser)}
								alt="User avatar" 
								class="avatar" 
							/>
							{:else}
								<div class="default-avatar">
									{($currentUser?.name || $currentUser?.username || $currentUser?.email || '?')[0]?.toUpperCase()}
								</div>
							{/if}
						</div>
						<div class="info-row">
							{#if isEditing}
							  <input 
								value={editedUser.name || editedUser.fullName || editedUser.displayName || ''} 
								on:input={(e) => editedUser.name = e.target.value}
							  />
							{:else}
							  <span class="name">{user?.name || user?.fullName || user?.displayName || 'Not set'}</span>
							{/if}
						  </div>
						  <div class="info-row">
							{#if isEditing}
							  <input 
								value={editedUser.username || editedUser.email?.split('@')[0] || ''} 
								on:input={(e) => editedUser.username = e.target.value}
							  />
							{:else}
							  <span class="username">{user?.username || user?.email?.split('@')[0] || 'Not set'}</span>
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
						{#if isLoading}
						  <div class="spinner-container">
							<div class="spinner"></div>
						  </div>
						{:else}
						  <div class="info-row-profile">
							{#if isEditing}
							  <textarea 
								class="textarea-description" 
								bind:value={editedUser.description}
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
						  <div class="info-column">
							<div class="info-row">
							  <span class="label">
								<span class="data">{$t('profile.email')}</span>
							  </span>
							  <span class="meta">
								{displayUser?.email || $t('profile.not_available')}
								{#if displayUser?.verified}
								  <!-- <MailCheck size={16} class="verified-icon" /> -->
								{/if}
							  </span>
							</div>
							<span class="info-avatar">
							  <Mail size={50}/>
							</span>
						  </div>
					  
						  <!-- Role -->
						  <div class="info-column">  
							<div class="info-row">
							  <span class="label">
								<span class="data">{$t('profile.role')}</span>
							  </span>
							  <span class="meta">
								{displayUser?.role || $t('profile.not_available')}
							</span>
							</div>
							<KeyIcon size={50}/>
						  </div>
					  
						  <!-- Created Date -->
						  <div class="info-column">  
							<div class="info-row">
							  <span class="label">
								<span class="data">{$t('profile.created')}</span>
							  </span>
							  <span class="meta">
								{displayUser?.created ? formatDate(displayUser.created) : $t('profile.not_available')}
							  </span>
							</div>
							<Cake size={50}/>
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
							<History size={50}/>
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
							<Shield size={50}/>
						  </div>
						{/if}
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
		justify-content: flex-end;
		align-items: flex-start;
		padding: 2rem;
		width: auto;
		height: 80vh;
		border-radius: 20px;
		overflow-y: scroll;
		overflow-x: hidden;
		scroll-behavior: smooth;
		scrollbar-color: var(--bg-color) transparent;
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
		width: auto !important;
		background: var(--secondary-color) !important;
		border: 1px solid transparent;
		outline: none !important;
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
		width: auto;;
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
			width: calc(100% - 2rem);
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
		text-align: justify;
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
		padding-inline-start: 1rem;
	}
	.label {
		font-weight:300;
		font-size: 1rem;
		letter-spacing: 0.3rem;
		width: auto;
		user-select: none;



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
		border-radius: 20px;
		width: auto;
		height: 60px;
		background: var(--secondary-color);
		opacity: 0.5;
		border: 1px solid var(--border-color);
		color: var(--text-color);
		transition: all 0.3s ease;

		span.hover {
			display: none;
			
		}

		&:hover {
			transform: translateY(-4px);
			background: red;
			box-shadow: 0 4px 6px rgba(255, 0, 0, 0.5);
			font-weight: bold;
			opacity: 1;
			min-width: 8rem;
			span.hover {
				display: flex;
			}
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
		opacity: 0.5;

		& span.hover {
			display: none;
		}
		
		&:hover {
			transform: translateY(-4px);
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

		.avatar-container {
		width: 3rem;
		height:3rem;
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
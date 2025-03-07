<script lang="ts">
	import { fade, fly, slide } from 'svelte/transition';
	import { pb } from '$lib/pocketbase';
	import { Camera, LogOutIcon, Languages, Palette, X, Bone, Save, TextCursorIcon, Pen } from 'lucide-svelte';
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
			
<!-- 
			<KeyStatusButton bind:showKeyInput />
			{#if showKeyInput}
				<APIKeyInput />
			{/if} -->
			<div class="btn-row">
				<button class="settings-button" on:click={handleLanguageChange}>
					<Languages size={24} />
					<!-- <span>{$currentLanguage.toUpperCase()}</span> -->
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
				<button class="logout-button" on:click={logout} transition:fade={{ duration: 300 }}>
					<LogOutIcon size={24} />
					<span>{$t('profile.logout')}</span>
				</button>
			</div>


		</div>

		{#if user}
			<div class="profile-header">
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
						<input bind:value={editedUser.username} />
					{:else}
						<span>{user.username || 'Not set'}</span>
					{/if}
				</div>
			</div>
			<div class="profile-info">
				<div class="info-row">
					<span class="label">
						<span>{$t('profile.name')}</span>
					</span>
					{#if isEditing}
						<input bind:value={editedUser.name} />
					{:else}
						<span>{user.name || 'Not set'}</span>
					{/if}
				</div>
				<div class="info-row">
					<span class="label">
						<span class="data">{$t('profile.email')}</span>
					</span>
					<span>{user.email}</span>
				</div>
				<div class="info-row">
					<span class="label">
						<span class="data">{$t('profile.role')}</span>
					</span>
					<span>{user.role}</span>
				</div>
				<div class="info-row">
					<span class="label">
						<span class="data">{$t('profile.created')}</span>
					</span>
					<span>{new Date(user.created).toLocaleString()}</span>
				</div>
				<div class="info-row">
					<span class="label">
						<span class="data">{$t('profile.updated')}</span>
					</span>
					<span>{new Date(user.updated).toLocaleString()}</span>
				</div>
				<div class="info-row">
					<span class="label">
						<span class="data">{$t('profile.verified')}</span>
					</span>
					<span>{user.verified ? 'Yes' : 'No'}</span>
				</div>
			</div>

			<!-- <StatsContainer {threadCount} {messageCount} {tagCount} {timerCount} {lastActive} /> -->
			<div class="actions">
				{#if isEditing}
					<button on:click={saveChanges}>
						<span>
							<Save/>
							{$t('profile.save')}
						</span>
					</button>
				{:else}
					<button on:click={toggleEdit}>
						<!-- <TextCursorIcon/> -->
						 <Pen/>
						<span>{$t('profile.edit')}</span>
					</button>
				{/if}
				<button on:click={onClose}>
					<span>{$t('profile.close')}</span>
				</button>
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
		/* font-family: 'Merriweather', serif; */
		/* font-family: 'Roboto', sans-serif; */
		/* font-family: 'Montserrat'; */
		font-family: var(--font-family);
		color: var(--text-color);
	}
	.modal-overlay {
		/* position: fixed;
        top: 60px;
        left: 0;
        max-width: 100%;
        height: 100%;
        /* background-color: rgba(0, 0, 0, 0.5); */
		display: flex;
		justify-content: center;
		align-items: center;
		/* width: 100%; */
		display: flex;
		padding: 2rem;
		width: 400px;
		/* background-color: #131313;
        color: #ffffff;
        /* border: 1px solid rgb(53, 53, 53); */
		border-radius: 20px;
		/* gap: 20px; */
		/* height: 50px; */
		/* padding: 10px 20px; */
		transition: all 0.3s ease;
		background: var(--bg-gradient-r);
	}

	.btn-row {
		display: flex;
		flex-direction: row;
		gap: 1rem;
		user-select: none;
	}

	.modal-content {
		height: auto;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
	}
	.modal-content {
		/* background: linear-gradient(
            to top, 
            rgba(70, 118, 114, 0.9) 0%,
            rgba(70, 118, 114, 0.85) 5%,
            rgba(70, 118, 114, 0.8) 10%,
            rgba(70, 118, 114, 0.75) 15%,
            rgba(70, 118, 114, 0.7) 20%,
            rgba(70, 118, 114, 0.65) 25%,
            rgba(70, 118, 114, 0.6) 30%,
            rgba(70, 118, 114, 0.55) 35%,
            rgba(70, 118, 114, 0.5) 40%,
            rgba(70, 118, 114, 0.45) 45%,
            rgba(70, 118, 114, 0.4) 50%,
            rgba(70, 118, 114, 0.35) 55%,
            rgba(70, 118, 114, 0.3) 60%,
            rgba(70, 118, 114, 0.25) 65%,
            rgba(70, 118, 114, 0.2) 70%,
            rgba(70, 118, 114, 0.15) 75%,
            rgba(70, 118, 114, 0.1) 80%,
            rgba(70, 118, 114, 0.05) 85%,
            rgba(70, 118, 114, 0) 100%
            ); */

		/* border-top-left-radius: 0px;
        border-top-right-radius: 0px;
        border-bottom-left-radius: 8px;
        border-bottom-right-radius: 8px; */
		/* max-width: 100%; */
		/* backdrop-filter: blur(40px);        
        padding: 2rem;
        border-radius: 20px;
        border: 1px solid rgb(53, 53, 53);
        top: 0;
        position: absolute;
        width: 96vw;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); */
		width: 100%;
		/* max-width: 500px; */
		/* height: 100vh; */
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
		align-items: center;
		margin-bottom: 1rem;
		color: white;
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
		width: 80px;
		height: 80px;
		border-radius: 50%;
		overflow: hidden;
		margin-right: 1rem;
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

	.close-button {
		// opacity: 0.9;
		// background: var(--bg-gradient-r);
		// transition: background-image 0.3s ease;
		// height: 50px;
		// width: 50px;
		// border-radius: 50%;
		// display: flex;
		// justify-content: flex-start;
		// align-items: center;
		// position: relative;
		// margin-top: 0;
	}

	.close-button:hover {
		background: var(--tertiary-color);
	}

	h2 {
		margin: 0;
		font-size: 1.5rem;
		color: white;
	}

	.profile-info {
		margin-bottom: 1rem;
		color: white;
		gap: 0;
		display: flex;
		flex-direction: column;
	}

	.info-row {
		display: flex;
		padding: 0.5rem;
		& input {
			background: var(--bg-gradient-left);
			border-radius: var(--radius-m);
			padding: 1rem;
			font-size: 1.5rem;
		}
	}

	.label {
		font-weight: bold;
		width: 100px;
		user-select: none;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		position: relative;
		gap: 1rem;
		right: 2rem;
		padding: 2rem;
		width: 100%;
	& button {
		padding: 0.5rem 1rem;
		border: none;
		display: flex;
		justify-content: center;
		align-items: center;
		border-radius: var(--radius-m);
		cursor: pointer;
		font-size: 1rem;
		background: var(--secondary-color);
		transition: all ease 0.3s;
		width: 100px;
		user-select: none;

		&:hover {
			opacity: 0.8;
			background: var(--tertiary-color);

		}
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
		justify-content: flex-end;
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
			// background: var(--bg-gradient);
			box-shadow: 0 4px 6px rgba(255, 255, 255, 0.2);
		}

		span {
			font-size: 0.9rem;
		}
	}

	.style-overlay {
		position: absolute;
		top: auto;
		left: 0;
		margin-top: 1rem;
		width: 450px;
		height: auto;
		display: flex;
		justify-content: right;
		align-items: top;
		z-index: 1444;
	}

	.style-content {
		display: flex;
		justify-content: right;
		background: var(--bg-gradient-r);
		border: 1px solid rgb(69, 69, 69);
		border-radius: 50px;
		position: relative;
		height: 100%;
		width: 100%;
		overflow: auto;
	}

	.style-switcher-button {
		background-color: transparent;
		border: none;
		padding: 0;
		margin-right: 16px;
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

	.language-notification p {
		margin: 0;
	}

	.quote {
		font-size: 16px;
		font-style: italic;
		line-height: 1.5;
	}

	@media (max-width: 1000px) {

		.modal-overlay {
			width:93vw;
			justify-content: flex-start;
			height: 100%;
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
	}

	@media (max-width: 768px) {
		.modal-content {
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

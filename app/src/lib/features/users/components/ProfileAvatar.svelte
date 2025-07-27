<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { getUserById } from '$lib/pocketbase';
	import type { User } from '$lib/types/types';

	export let userId: string;
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let showName: boolean = false;
	export let placeholder: string = '/api/placeholder/40/40';

	const dispatch = createEventDispatcher();

	let profile: User | null = null;
	let loading = true;
	let error = false;

	async function loadProfile() {
		if (!userId) {
			loading = false;
			return;
		}

		try {
			loading = true;
			error = false;
			profile = await getUserById(userId);
			dispatch('profileLoaded', profile);
		} catch (err) {
			console.error('Error loading profile:', err);
			error = true;
			profile = null;
		} finally {
			loading = false;
		}
	}
	function handleImageError(event: Event) {
		const target = event.target as HTMLImageElement;
		target.src = placeholder;
	}
	$: if (userId) {
		loadProfile();
	}
	$: avatarUrl = profile?.avatar || placeholder;

	onMount(async () => {
		await loadProfile();
	});
</script>

<div class="profile-avatar-container" class:show-name={showName}>
	<div class="avatar-wrapper">
		{#if loading}
			<div class="avatar-placeholder size-{size}"></div>
		{:else if error || !profile}
			<img src={placeholder} alt="User avatar" class="avatar size-{size}" />
		{:else}
			<img
				src={avatarUrl}
				alt="{profile.name || profile.username || 'User'}'s avatar"
				class="avatar size-{size}"
				on:error={handleImageError}
			/>
		{/if}
	</div>

	{#if showName && profile && (profile.name || profile.username)}
		<span class="profile-name size-{size}">
			{profile.name || profile.username || 'User'}
		</span>
	{/if}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.profile-avatar-container {
		display: flex;
		align-items: center;
		gap: 8px;
		z-index: 2;
	}

	.avatar-wrapper {
		position: relative;
	}

	.avatar {
		border: 1px solid var(--line-color);
		border-radius: 50%;
		object-fit: cover;
		transition: all 0.2s ease;
	}

	.avatar:hover {
		transform: scale(1.05);
	}

	.avatar-placeholder {
		border: 1px solid var(--line-color);
		border-radius: 50%;
		background-color: var(--bg-gradient);
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	.profile-name {
		color: var(--text-color);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 150px;
	}

	/* Size variants */
	.size-sm {
		width: 2rem;
		height: 2rem;
	}

	.size-md {
		width: 2.5rem;
		height: 2.5rem;
	}

	.size-lg {
		width: 4rem;
		height: 4rem;
	}

	/* Text size variants */
	.profile-name.size-sm {
		font-size: 0.875rem;
	}

	.profile-name.size-md {
		font-size: 1rem;
	}

	.profile-name.size-lg {
		font-size: 1.125rem;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>

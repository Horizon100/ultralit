<!-- src/lib/components/UserDisplay.svelte -->
<script lang="ts">
	import { getAvatarUrl } from '$lib/features/users/utils/avatarHandling';
	import type { User } from '$lib/types/types';

	export let userId: string;
	export let showAvatar: boolean = false;
	export let className: string = '';

	let user: User | null = null;
	let loading = true;

	async function fetchUserData() {
		if (!userId) return;

		try {
			const response = await fetch(`/api/users/${userId}`);
			if (!response.ok) throw new Error('Failed to fetch user');

			user = await response.json() as User;
			loading = false;
		} catch (error) {
			console.error('Error fetching user:', error);
			loading = false;
		}
	}

	// Trigger the fetch when the component mounts or userId changes
	$: if (userId) fetchUserData();
</script>

{#if loading}
	<span class={className}>...</span>
{:else if user}
	<span class={className}>
		{#if showAvatar && user.avatar}
			<img 
				src={getAvatarUrl(user)} 
				alt={user.username || 'User'} 
				class="user-avatar"
				on:error={(e) => {
					if (e.target && e.target instanceof HTMLImageElement) {
						e.target.style.display = 'none';
					}
				}}
			/>
		{/if}
		{user.name || user.username || 'Unknown User'}
	</span>
{:else}
	<span class={className}>Unknown User</span>
{/if}

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;	
	* {
		font-family: var(--font-family);
	}
	.user-avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		margin-right: 4px;
		vertical-align: middle;
		object-fit: cover;
	}
</style>
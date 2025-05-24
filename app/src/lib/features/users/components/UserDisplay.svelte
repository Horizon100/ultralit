<!-- src/lib/components/UserDisplay.svelte -->
<script lang="ts">
	export let userId: string;
	export let showAvatar: boolean = false;
	export let className: string = '';

	let user = null;
	let loading = true;

	async function fetchUserData() {
		if (!userId) return;

		try {
			const response = await fetch(`/api/users/${userId}`);
			if (!response.ok) throw new Error('Failed to fetch user');

			user = await response.json();
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
			<img src={user.avatar} alt={user.username || 'User'} class="user-avatar" />
		{/if}
		{user.name || user.username || 'Unknown User'}
	</span>
{:else}
	<span class={className}>Unknown User</span>
{/if}

<style>
	.user-avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		margin-right: 4px;
		vertical-align: middle;
	}
</style>

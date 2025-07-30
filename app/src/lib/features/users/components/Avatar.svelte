<script lang="ts">
	export let user: any = null;
	export let size: number = 40;
	export let className: string = '';
	export let timestamp: number | null = null;

	$: displayName = user?.name || user?.username || 'User';

	// Always try server avatar if we have a user ID - server will handle identicon fallback
	$: avatarUrl = user?.id
		? `/api/users/${user.id}/avatar${timestamp ? `?t=${timestamp}` : ''}`
		: '';

	// Fallback initials (only used if server completely fails)
	$: initials = (() => {
		if (user?.name && user.name.trim()) {
			const nameParts = user.name.trim().split(' ');
			return nameParts
				.map((n: string) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2);
		}
		if (user?.username && user.username.trim()) {
			return user.username.slice(0, 2).toUpperCase();
		}
		if (user?.id) {
			return user.id.slice(0, 2).toUpperCase();
		}
		return 'U';
	})();

	$: backgroundColor = (() => {
		if (!user?.id) return '#e2e8f0';
		const colors = [
			'#ef4444',
			'#f97316',
			'#eab308',
			'#22c55e',
			'#06b6d4',
			'#3b82f6',
			'#8b5cf6',
			'#ec4899'
		];
		const hash = user.id.split('').reduce((a: number, b: string) => a + b.charCodeAt(0), 0);
		return colors[hash % colors.length];
	})();

	// Handle image load error
	let imageError = false;
	function handleImageError() {
		imageError = true;
	}
</script>

{#if avatarUrl && !imageError}
	<img
		src={avatarUrl}
		alt="{displayName}'s avatar"
		class="avatar {className}"
		style="width: {size}px; height: {size}px; border-radius: 50%;"
		on:error={handleImageError}
	/>
{:else}
	<!-- Show initials fallback (only if server completely fails) -->
	<div
		class="avatar-placeholder {className}"
		style="width: {size}px; height: {size}px; background-color: {backgroundColor}; border-radius: 50%; font-size: {size *
			0.4}px;"
	>
		{initials}
	</div>
{/if}

<style>
	.avatar {
		object-fit: cover;
		background-color: #f1f5f9;
	}

	.avatar-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: 600;
	}
</style>

<script lang="ts">
	import { generateUserIdenticon, getUserIdentifier } from '$lib/utils/identiconUtils';
	export let user: any = null;
	export let size: number = 40;
	export let className: string = '';
	export let timestamp: number | null = null;

	$: displayName = user?.name || user?.username || 'User';
	$: console.log('Avatar component user data:', user);
	$: console.log('Avatar URL:', avatarUrl);
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
	$: if (user?.id === 'obku3t7s5m1csv9') {
		console.log('Avatar component debug for user obku3t7s5m1csv9:', {
			user: user,
			avatarUrl: avatarUrl,
			imageError: imageError
		});
	}

	let imageError = false;
	let showIdenticon = false;

function handleImageError() {
	console.log('Avatar image load error for:', user);
	imageError = true;
	showIdenticon = true;
}
$: identiconUrl = user?.id ? generateUserIdenticon(getUserIdentifier(user), size) : null;

</script>

{#if avatarUrl && !imageError}
	<img
		src={avatarUrl}
		alt="{displayName}'s avatar"
		class="avatar {className}"
		style="width: {size}px; height: {size}px; border-radius: 50%;"
		on:error={handleImageError}
	/>
{:else if showIdenticon && identiconUrl}
	<!-- Show identicon when server avatar fails -->
	<img
		src={identiconUrl}
		alt="{displayName}'s avatar"
		class="avatar {className}"
		style="width: {size}px; height: {size}px; border-radius: 50%;"
		on:error={() => showIdenticon = false}
	/>
{:else}
	<!-- Show initials fallback only as last resort -->
	<div
		class="avatar-placeholder {className}"
		style="width: {size}px; height: {size}px; background-color: {backgroundColor}; border-radius: 50%; font-size: {size * 0.4}px;"
	>
		{initials}
	</div>
{/if}

<style>
	.avatar {
		object-fit: cover;
		background-color: #c3c3c3;
	}

	.avatar-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-color);
		font-weight: 600;
	}
</style>

<script lang="ts">
	import { getAvatarUrl } from '$lib/features/users/utils/avatarHandling';

	export let user: any = null;
	export let size: number = 40;
	export let className: string = '';

	let imageError = false;

	$: avatarUrl = user
		? getAvatarUrl({
				id: user.id,
				avatar: user.avatar,
				collectionId: '_pb_users_auth_'
			})
		: '';

	$: displayName = user?.name || user?.username || 'Unknown';

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

	$: initialsPlaceholder = `data:image/svg+xml;charset=UTF-8,%3csvg width='${size}' height='${size}' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='${size}' height='${size}' fill='${encodeURIComponent(backgroundColor)}'/%3e%3ctext x='50%25' y='50%25' text-anchor='middle' dy='0.35em' font-family='system-ui, sans-serif' font-size='${Math.round(size * 0.4)}' font-weight='600' fill='white'%3e${initials}%3c/text%3e%3c/svg%3e`;

	// Reset error when URL changes
	$: if (avatarUrl) {
		imageError = false;
	}
</script>

{#if !avatarUrl || imageError}
	<div
		class="avatar-placeholder {className}"
		style="width: {size}px; height: {size}px; background-color: {backgroundColor};"
	>
		{initials}
	</div>
{:else}
	<img
		src={avatarUrl}
		alt="{displayName}'s avatar"
		class="avatar {className}"
		style="width: {size}px; height: {size}px; border-radius: 50%;"
		on:error={() => (imageError = true)}
	/>
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
		border-radius: 50%;
	}
</style>

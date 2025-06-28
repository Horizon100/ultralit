<script lang="ts">
	import type { User, PublicUserProfile, UserProfile, ConversationUser } from '$lib/types/types';

	export let user: User | PublicUserProfile | UserProfile | ConversationUser;
	export let showStatus = true;
	export let clickable = false;
	export let onClick: (() => void) | undefined = undefined;

	function handleClick() {
		if (clickable && onClick) {
			onClick();
		}
	}

	function getDisplayName(user: User | PublicUserProfile | UserProfile | ConversationUser): string {
		const name = user.name || ('username' in user ? user.username : '');
		return name || 'Unknown User';
	}

	function getAvatarSrc(
		user: User | PublicUserProfile | UserProfile | ConversationUser
	): string | null {
		if ('avatarUrl' in user && user.avatarUrl) return user.avatarUrl;
		if ('avatar' in user && user.avatar) return user.avatar;
		return null;
	}
</script>

<div
	class="dm-header"
	class:clickable
	on:click={handleClick}
	role={clickable ? 'button' : undefined}
>
	<div class="avatar-container">
		{#if getAvatarSrc(user)}
			<img src={getAvatarSrc(user)} alt={getDisplayName(user)} class="avatar" />
		{:else}
			<div class="avatar-placeholder">
				{getDisplayName(user).charAt(0).toUpperCase()}
			</div>
		{/if}
		{#if showStatus && 'status' in user && user.status}
			<div class="status-indicator" class:online={user.status === 'online'}></div>
		{/if}
	</div>
	<div class="user-info">
		<h3 class="username">{getDisplayName(user)}</h3>
		{#if showStatus && 'status' in user && user.status}
			<span class="status-text">{user.status}</span>
		{/if}
	</div>
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;

	.dm-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--bg-color);
		border-bottom: 1px solid var(--line-color);
		transition: background-color 0.2s ease;
		height: 3rem;
		&.clickable {
			cursor: pointer;

			&:hover {
				background: var(--secondary-color);
			}
		}
	}

	.avatar-container {
		position: relative;
		flex-shrink: 0;
	}

	.avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--line-color);
	}

	.avatar-placeholder {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--tertiary-color);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
		color: var(--primary-color);
		font-size: 16px;
		border: 2px solid var(--line-color);
	}

	.status-indicator {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid var(--bg-color);
		&.online {
			background: #4ade80;
		}
	}

	.user-info {
		flex: 1;
		min-width: 0;
	}

	.username {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.status-text {
		font-size: 12px;
		color: var(--placeholder-color);
		text-transform: capitalize;
	}

	* {
		font-family: var(--font-family);
	}
</style>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { followStore, fetchFollowData, getFollowers, getFollowing, toggleFollowUser } from '$lib/stores/followStore';
	import { userStatusStore, fetchUserStatus } from '$lib/stores/userStatusStore';
	import type { PublicUserProfile, User } from '$lib/types/types';
	import { currentUser } from '$lib/pocketbase';

	// Props
	export let userId: string;
	export let listType: 'followers' | 'following';
	export let showFollowButton = true;
	export let showStatus = true;
	export let maxHeight = '400px';
	export let emptyMessage = '';
	export let onUserClick: ((user: PublicUserProfile) => void) | undefined = undefined;

	// State
	let users: PublicUserProfile[] = [];
	let loading = true;
	let error: string | null = null;
	let followingUsers = new Set<string>();
	let processingFollow = new Set<string>();
	let processingMainFollow = false;
	let isFollowingProfileOwner = false;

	// Reactive statements
	$: {
		// Update users when store changes
		if (listType === 'followers') {
			users = getFollowers(userId);
		} else {
			users = getFollowing(userId);
		}
		// Don't stay in loading state if we successfully loaded (even if empty)
		// loading should only be true if we haven't attempted to load yet
		console.log(`🔄 Reactive update - ${listType}:`, {
			usersCount: users.length,
			loading,
			error,
			userId
		});
	}

	// Check which users current user is following
	$: if ($currentUser && users.length > 0) {
		updateFollowingStatus();
	}

	// Check if current user is following the profile owner
	$: if ($currentUser && userId && $currentUser.id !== userId && followingUsers.size > 0) {
		isFollowingProfileOwner = followingUsers.has(userId);
	}

	// Auto-generated empty messages
	$: defaultEmptyMessage = listType === 'followers' 
		? 'No followers yet' 
		: 'Not following anyone yet';

	$: displayEmptyMessage = emptyMessage || defaultEmptyMessage;

	async function loadUsers() {
		try {
			loading = true;
			error = null;
			
			console.log(`📋 Loading ${listType} for user:`, userId);
			
			const followData = await fetchFollowData(userId);
			console.log('📥 Follow data received:', followData);
			
			if (!followData) {
				throw new Error(`Failed to load ${listType}`);
			}

			// Fetch status for all users if showStatus is enabled
			if (showStatus) {
				const userIds = listType === 'followers' 
					? followData.followers.map(u => u.id)
					: followData.following.map(u => u.id);
				
				console.log(`🔍 Fetching status for ${userIds.length} users`);
				
				// Fetch status for each user (in parallel)
				await Promise.allSettled(
					userIds.map(id => fetchUserStatus(id))
				);
			}

			console.log(`✅ Successfully loaded ${listType}:`, {
				followers: followData.followers.length,
				following: followData.following.length
			});

			loading = false;
		} catch (err) {
			console.error(`❌ Error loading ${listType}:`, err);
			error = err instanceof Error ? err.message : `Failed to load ${listType}`;
			loading = false;
		}
	}

	async function updateFollowingStatus() {
		if (!$currentUser) return;
		
		try {
			const currentUserFollowData = await fetchFollowData($currentUser.id);
			if (currentUserFollowData) {
				followingUsers = new Set(currentUserFollowData.following.map(u => u.id));
			}
		} catch (err) {
			console.error('Error updating following status:', err);
		}
	}

	async function handleFollowToggle(targetUser: PublicUserProfile) {
		if (!$currentUser || processingFollow.has(targetUser.id)) return;
		
		try {
			processingFollow.add(targetUser.id);
			processingFollow = new Set(processingFollow); // Trigger reactivity
			
			const isCurrentlyFollowing = followingUsers.has(targetUser.id);
			const action = isCurrentlyFollowing ? 'unfollow' : 'follow';
			
			console.log(`🔄 ${action}ing user:`, targetUser.username);
			
			const success = await toggleFollowUser($currentUser.id, targetUser.id, action);
			
			if (success) {
				// Update local following status
				if (action === 'follow') {
					followingUsers.add(targetUser.id);
				} else {
					followingUsers.delete(targetUser.id);
				}
				followingUsers = new Set(followingUsers); // Trigger reactivity
				
				console.log(`✅ Successfully ${action}ed user:`, targetUser.username);
			} else {
				console.error(`❌ Failed to ${action} user:`, targetUser.username);
			}
		} catch (err) {
			console.error('Error toggling follow:', err);
		} finally {
			processingFollow.delete(targetUser.id);
			processingFollow = new Set(processingFollow); // Trigger reactivity
		}
	}

	async function handleMainFollowToggle() {
		if (!$currentUser || processingMainFollow || $currentUser.id === userId) return;
		
		try {
			processingMainFollow = true;
			
			const action = isFollowingProfileOwner ? 'unfollow' : 'follow';
			
			console.log(`🔄 ${action}ing profile owner:`, userId);
			
			const success = await toggleFollowUser($currentUser.id, userId, action);
			
			if (success) {
				// Update local following status
				if (action === 'follow') {
					followingUsers.add(userId);
				} else {
					followingUsers.delete(userId);
				}
				followingUsers = new Set(followingUsers); // Trigger reactivity
				isFollowingProfileOwner = !isFollowingProfileOwner;
				
				console.log(`✅ Successfully ${action}ed profile owner`);
			} else {
				console.error(`❌ Failed to ${action} profile owner`);
			}
		} catch (err) {
			console.error('Error toggling main follow:', err);
		} finally {
			processingMainFollow = false;
		}
	}

	function handleUserClick(user: PublicUserProfile) {
		if (onUserClick) {
			onUserClick(user);
		}
	}

	function getUserStatus(userId: string): 'online' | 'offline' | undefined {
		if (!showStatus) return undefined;
		
		let status: 'online' | 'offline' | undefined;
		userStatusStore.subscribe(statusMap => {
			const userStatus = statusMap.get(userId);
			status = userStatus?.status;
		})();
		return status;
	}

	// Cleanup
	let unsubscribe: (() => void) | null = null;

	onMount(() => {
		loadUsers();
		
		// Subscribe to store changes
		unsubscribe = followStore.subscribe(() => {
			// This will trigger reactive updates
		});
	});

	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
	});
</script>

<div class="user-list" style="max-height: {maxHeight};">
	{#if loading}
		<div class="loading-state">
			<div class="loading-spinner"></div>
			<p>Loading {listType}...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<p class="error-message">{error}</p>
			<button class="retry-button" on:click={loadUsers}>
				Try Again
			</button>
		</div>
	{:else}
		<!-- Debug info -->
		<div style="background: yellow; padding: 10px; margin: 10px; font-size: 12px;">
			<strong>DEBUG:</strong><br>
			listType: {listType}<br>
			currentUser: {currentUser ? 'exists' : 'null'}<br>
			currentUser.id: {currentUser?.id || 'none'}<br>
			userId: {userId}<br>
			users.length: {users.length}<br>
			showButton: {listType === 'followers' && currentUser && currentUser.id !== userId}<br>
			isFollowingProfileOwner: {isFollowingProfileOwner}<br>
			processingMainFollow: {processingMainFollow}
		</div>

		<!-- Main follow button for followers list - ALWAYS show if conditions are met -->
		{#if listType === 'followers' && currentUser && currentUser.id !== userId}
			<div class="main-follow-section">
				<button
					class="main-follow-button"
					class:following={isFollowingProfileOwner}
					class:processing={processingMainFollow}
					disabled={processingMainFollow}
					on:click={handleMainFollowToggle}
				>
					{#if processingMainFollow}
						<div class="button-spinner"></div>
					{:else if isFollowingProfileOwner}
						Following
					{:else}
						Follow
					{/if}
				</button>
				<span class="main-follow-text">
					{isFollowingProfileOwner ? 'You are following this user' : 'Follow to see updates'}
				</span>
			</div>
		{:else}
			<div style="background: red; color: white; padding: 10px; margin: 10px;">
				Button hidden because: 
				{#if listType !== 'followers'}Not followers list (listType = {listType}){/if}
				{#if !currentUser}No current user{/if}
				{#if currentUser && currentUser.id === userId}Same user (currentUser.id = {currentUser.id}, userId = {userId}){/if}
			</div>
		{/if}

		<!-- Users list or empty state -->
		{#if users.length === 0}
			<div class="empty-state">
				<p class="empty-message">{displayEmptyMessage}</p>
			</div>
		{:else}
			<div class="users-container">
				{#each users as user (user.id)}
					<div class="user-item">
						<div class="user-header" class:clickable={!!onUserClick} on:click={() => handleUserClick(user)} role={!!onUserClick ? 'button' : undefined}>
							<div class="avatar-container">
								{#if user.avatar || user.avatarUrl}
									<img src={user.avatarUrl || user.avatar} alt={user.name || user.username} class="avatar" />
								{:else}
									<div class="avatar-placeholder">
										{(user.name || user.username).charAt(0).toUpperCase()}
									</div>
								{/if}
								{#if showStatus && getUserStatus(user.id)}
									<div class="status-indicator" class:online={getUserStatus(user.id) === 'online'}></div>
								{/if}
							</div>
							<div class="user-info">
								<h3 class="username">{user.name || user.username}</h3>
								{#if showStatus && getUserStatus(user.id)}
									<span class="status-text">{getUserStatus(user.id)}</span>
								{/if}
							</div>
						</div>
						
						{#if showFollowButton && currentUser && currentUser.id !== user.id}
							<div class="follow-action">
								<button
									class="follow-button"
									class:following={followingUsers.has(user.id)}
									class:processing={processingFollow.has(user.id)}
									disabled={processingFollow.has(user.id)}
									on:click={() => handleFollowToggle(user)}
								>
									{#if processingFollow.has(user.id)}
										<div class="button-spinner"></div>
									{:else if followingUsers.has(user.id)}
										Following
									{:else}
										Follow
									{/if}
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;

	.user-list {
		background: var(--bg-color);
		border: 1px solid var(--line-color);
		border-radius: 8px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.loading-state,
	.error-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		text-align: center;
		color: var(--placeholder-color);
	}

	.loading-spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--line-color);
		border-top: 2px solid var(--primary-color);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.error-message {
		color: var(--error-color);
		margin-bottom: 1rem;
	}

	.retry-button {
		background: var(--primary-color);
		color: var(--bg-color);
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		transition: background-color 0.2s ease;

		&:hover {
			background: var(--primary-hover-color);
		}
	}

	.empty-message {
		font-style: italic;
		margin: 0;
	}

	.users-container {
		overflow-y: auto;
		flex: 1;
	}

	.user-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem;
		border-bottom: 1px solid var(--line-color);
		transition: background-color 0.2s ease;

		&:last-child {
			border-bottom: none;
		}

		&:hover {
			background: var(--secondary-color);
		}
	}

	.user-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
		transition: background-color 0.2s ease;

		&.clickable {
			cursor: pointer;
			padding: 0.25rem;
			border-radius: 4px;
			
			&:hover {
				background: var(--tertiary-color);
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
		background: var(--placeholder-color);
		
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
		display: block;
		margin-top: 0.125rem;
	}

	.follow-action {
		flex-shrink: 0;
		margin-left: 1rem;
	}

	.follow-button {
		background: var(--primary-color);
		color: var(--bg-color);
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: all 0.2s ease;
		min-width: 80px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;

		&:hover:not(:disabled) {
			background: var(--primary-hover-color);
		}

		&.following {
			background: var(--success-color);
			
			&:hover:not(:disabled) {
				background: var(--error-color);
			}
			
			&:hover:not(:disabled)::after {
				content: 'Unfollow';
				position: absolute;
			}
		}

		&.processing {
			background: var(--placeholder-color);
			cursor: not-allowed;
		}

		&:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	}

	.main-follow-button {
		background: var(--primary-color);
		color: var(--bg-color);
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: all 0.2s ease;
		min-width: 120px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;

		&:hover:not(:disabled) {
			background: var(--primary-hover-color);
			transform: translateY(-1px);
		}

		&.following {
			background: var(--success-color);
			
			&:hover:not(:disabled) {
				background: var(--error-color);
			}
		}

		&.processing {
			background: var(--placeholder-color);
			cursor: not-allowed;
		}

		&:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	}

	.main-follow-section {
		padding: 1rem;
		border-bottom: 1px solid var(--line-color);
		background: var(--secondary-color);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.main-follow-text {
		font-size: 12px;
		color: var(--placeholder-color);
		text-align: center;
	}

	.button-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid transparent;
		border-top: 2px solid currentColor;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	/* Scrollbar styling */
	.users-container::-webkit-scrollbar {
		width: 6px;
	}

	.users-container::-webkit-scrollbar-track {
		background: var(--secondary-color);
	}

	.users-container::-webkit-scrollbar-thumb {
		background: var(--placeholder-color);
		border-radius: 3px;
	}

	.users-container::-webkit-scrollbar-thumb:hover {
		background: var(--text-color);
	}

	/* Firefox scrollbar */
	.users-container {
		scrollbar-width: thin;
		scrollbar-color: var(--placeholder-color) var(--secondary-color);
	}

	* {
		font-family: var(--font-family);
	}
</style>
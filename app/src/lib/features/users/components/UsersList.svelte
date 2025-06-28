<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		followStore,
		fetchFollowData,
		getFollowers,
		getFollowing,
		toggleFollowUser
	} from '$lib/stores/followStore';
	import { userStatusStore, fetchUserStatus } from '$lib/stores/userStatusStore';
	import type { PublicUserProfile, User } from '$lib/types/types';
	import { currentUser, pocketbaseUrl } from '$lib/pocketbase';
	import { sidenavStore, showDebug } from '$lib/stores/sidenavStore';
	import { clientTryCatch, isSuccess, isFailure } from '$lib/utils/errorUtils';
	import Debugger from '$lib/components/modals/Debugger.svelte';

	// Props
	export let userId: string;
	export let listType: 'followers' | 'following';
	export let showFollowButton = true;
	export let showStatus = true;
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

	// Debug items for Debugger component
	$: debugItems = [
		{ label: 'List Type', value: listType },
		{ label: 'Current User', value: $currentUser ? 'exists' : 'null' },
		{ label: 'Current User ID', value: $currentUser?.id || 'none' },
		{ label: 'Profile User ID', value: userId },
		{ label: 'Users Count', value: users.length },
		{ label: 'Loading', value: loading },
		{ label: 'Error', value: error || 'none' },
		{ label: 'Following Users', value: followingUsers.size },
		{
			label: 'Show Button Condition',
			value: listType === 'followers' && $currentUser && $currentUser.id !== userId
		},
		{ label: 'Is Following Profile Owner', value: isFollowingProfileOwner },
		{ label: 'Processing Main Follow', value: processingMainFollow },
		{ label: 'Store Subscribed', value: unsubscribe ? 'yes' : 'no' }
	];

	// Debug buttons for testing
	$: debugButtons = [
		{
			label: 'Reload Users',
			action: async () => {
				console.log('🔄 Manual reload users');
				await loadUsers();
			},
			color: '#28a745'
		},
		{
			label: 'Force Follow Status Update',
			action: async () => {
				console.log('🔄 Force updating follow status');
				await updateFollowingStatus();
			},
			color: '#007bff'
		},
		{
			label: 'Test Main Follow',
			action: async () => {
				if (!$currentUser || $currentUser.id === userId) {
					console.log('❌ Cannot test - no current user or same user');
					return;
				}
				console.log('🧪 Testing main follow functionality');
				await handleMainFollowToggle();
			},
			color: '#6f42c1'
		}
	];

	// Reactive statements
	$: {
		// Update users when store changes
		if (listType === 'followers') {
			users = getFollowers(userId);
		} else {
			users = getFollowing(userId);
		}
		/*
		 * Don't stay in loading state if we successfully loaded (even if empty)
		 * loading should only be true if we haven't attempted to load yet
		 */
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
	$: defaultEmptyMessage =
		listType === 'followers' ? 'No followers yet' : 'Not following anyone yet';

	$: displayEmptyMessage = emptyMessage || defaultEmptyMessage;

	async function loadUsers() {
		loading = true;
		error = null;

		console.log(`📋 Loading ${listType} for user:`, userId);

		const followDataResult = await clientTryCatch(
			fetchFollowData(userId),
			`Loading ${listType} data`
		);

		if (isFailure(followDataResult)) {
			error = followDataResult.error;
			loading = false;
			return;
		}

		const followData = followDataResult.data;
		console.log('📥 Follow data received:', followData);

		if (!followData) {
			error = `Failed to load ${listType}`;
			loading = false;
			return;
		}

		// Fetch status for all users if showStatus is enabled
		if (showStatus) {
			const userIds =
				listType === 'followers'
					? followData.followers.map((u) => u.id)
					: followData.following.map((u) => u.id);

			console.log(`🔍 Fetching status for ${userIds.length} users`);

			// Fetch status for each user (in parallel)
			const statusPromises = userIds.map(async (id) => {
				const result = await clientTryCatch(fetchUserStatus(id), `Fetching status for user ${id}`);
				if (isFailure(result)) {
					console.warn(`Failed to fetch status for user ${id}:`, result.error);
				}
			});

			await Promise.allSettled(statusPromises);
		}

		console.log(`✅ Successfully loaded ${listType}:`, {
			followers: followData.followers.length,
			following: followData.following.length
		});

		loading = false;
	}

	async function updateFollowingStatus() {
		if (!$currentUser) return;

		const result = await clientTryCatch(
			fetchFollowData($currentUser.id),
			'Updating following status'
		);

		if (isSuccess(result) && result.data) {
			followingUsers = new Set(result.data.following.map((u) => u.id));
		}
	}

	async function handleFollowToggle(targetUser: PublicUserProfile) {
		if (!$currentUser || processingFollow.has(targetUser.id)) return;

		processingFollow.add(targetUser.id);
		processingFollow = new Set(processingFollow); // Trigger reactivity

		const isCurrentlyFollowing = followingUsers.has(targetUser.id);
		const action = isCurrentlyFollowing ? 'unfollow' : 'follow';

		console.log(`🔄 ${action}ing user:`, targetUser.username);

		const result = await clientTryCatch(
			toggleFollowUser($currentUser.id, targetUser.id, action),
			`${action}ing user ${targetUser.username}`
		);

		if (isSuccess(result) && result.data) {
			// Update local following status
			if (action === 'follow') {
				followingUsers.add(targetUser.id);
			} else {
				followingUsers.delete(targetUser.id);
			}
			followingUsers = new Set(followingUsers); // Trigger reactivity

			console.log(`✅ Successfully ${action}ed user:`, targetUser.username);
		} else if (isFailure(result)) {
			console.error(`❌ Failed to ${action} user:`, result.error);
		}

		processingFollow.delete(targetUser.id);
		processingFollow = new Set(processingFollow); // Trigger reactivity
	}

	async function handleMainFollowToggle() {
		if (!$currentUser || processingMainFollow || $currentUser.id === userId) return;

		processingMainFollow = true;

		const action = isFollowingProfileOwner ? 'unfollow' : 'follow';

		console.log(`🔄 ${action}ing profile owner:`, userId);

		const result = await clientTryCatch(
			toggleFollowUser($currentUser.id, userId, action),
			`${action}ing profile owner`
		);

		if (isSuccess(result) && result.data) {
			// Update local following status
			if (action === 'follow') {
				followingUsers.add(userId);
			} else {
				followingUsers.delete(userId);
			}
			followingUsers = new Set(followingUsers); // Trigger reactivity
			isFollowingProfileOwner = !isFollowingProfileOwner;

			console.log(`✅ Successfully ${action}ed profile owner`);
		} else if (isFailure(result)) {
			console.error(`❌ Failed to ${action} profile owner:`, result.error);
		}

		processingMainFollow = false;
	}

	function handleUserClick(user: PublicUserProfile) {
		if (onUserClick) {
			onUserClick(user);
		}
	}

	function getUserStatus(userId: string): 'online' | 'offline' | undefined {
		if (!showStatus) return undefined;

		let status: 'online' | 'offline' | undefined;
		userStatusStore.subscribe((statusMap) => {
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

<div class="user-list">
	{#if loading}
		<div class="loading-state">
			<div class="loading-spinner"></div>
			<p>Loading {listType}...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<p class="error-message">{error}</p>
			<button class="retry-button" on:click={loadUsers}> Try Again </button>
		</div>
	{:else}
		<!-- Main follow button for followers list -->
		{#if listType === 'followers' && $currentUser && $currentUser.id !== userId}
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
						<div
							class="user-header"
							class:clickable={!!onUserClick}
							on:click|stopPropagation={() => handleUserClick(user)}
							role={onUserClick ? 'button' : undefined}
						>
							<div class="avatar-header">
								{#if user.avatar || user.avatarUrl}
									<img
										src={user.avatar
											? `${pocketbaseUrl}/api/files/users/${user.id}/${user.avatar}`
											: '/api/placeholder/120/120'}
										alt="{user.name || user.username}'s avatar"
										class="sticky-avatar"
									/>
								{:else}
									<div class="avatar-placeholder">
										{(user.name || user.username).charAt(0).toUpperCase()}
									</div>
								{/if}
								{#if showStatus && getUserStatus(user.id)}
									<div
										class="status-indicator"
										class:online={getUserStatus(user.id) === 'online'}
									></div>
								{/if}
							</div>
							<div class="user-info">
								<h3 class="username">{user.name || user.username}</h3>
								{#if showStatus && getUserStatus(user.id)}
									<span class="status-text">{getUserStatus(user.id)}</span>
								{/if}
							</div>
						</div>

						{#if showFollowButton && $currentUser && $currentUser.id !== user.id}
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

<!-- Debug panel - only shows when showDebug is true -->
{#if $showDebug}
	<Debugger showDebug={$showDebug} title="🔧 UserList Debug" {debugItems} buttons={debugButtons} />
{/if}

<style>
	.user-list {
		display: flex;
		height: 100%;
		width: 100%;
		overflow-y: auto;
		background: var(--bg-color);
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
		gap: 1rem;
	}

	.loading-spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid #f3f3f3;
		border-top: 2px solid #3498db;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.error-state {
		padding: 2rem;
		text-align: center;
	}

	.error-message {
		color: #e74c3c;
		margin-bottom: 1rem;
	}

	.retry-button {
		background: #3498db;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
	}

	.retry-button:hover {
		background: #2980b9;
	}

	.main-follow-section {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid #eee;
		margin-bottom: 1rem;
	}

	.main-follow-button {
		padding: 0.5rem 1rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.main-follow-button.following {
		background: #e8f5e8;
		border-color: #28a745;
		color: #28a745;
	}

	.main-follow-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.main-follow-text {
		color: #666;
		font-size: 0.875rem;
	}

	.empty-state {
		padding: 2rem;
		text-align: center;
	}

	.empty-message {
		color: #666;
	}

	.users-container {
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 1rem;
		gap: 0.5rem;
	}

	.user-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem;
		border-bottom: 1px solid var(--line-color);
	}

	.user-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
	}

	.user-header.clickable {
		cursor: pointer;
	}

	.user-header.clickable:hover {
		background: var(--primary-color);
		border-radius: 4px;
		margin: -0.25rem;
		padding: 0.25rem;
	}

	.avatar-header {
		display: flex;
		position: relative;
		width: auto;
		height: 100%;
		margin-right: 0.5rem;

		& img {
			width: 2.5rem;
			height: 2.5rem;
			object-fit: cover;
			border-radius: 50%;

			border: 1px solid var(--bg-color);
		}
	}

	.avatar {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: #ddd;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
		color: #666;
	}

	.status-indicator {
		position: absolute;
		top: 0;
		left: 0;
		width: 0.25rem;
		height: 0.25rem;
		border-radius: 50%;
		border: 2px solid transparent;
	}

	.status-indicator.online {
		background: #28a745;
		border: 2px solid var(--bg-color);
	}

	.user-info {
		flex: 1;
	}

	.username {
		margin: 0;
		font-size: 1rem;
		font-weight: 500;
	}

	.status-text {
		font-size: 0.75rem;
		color: #666;
	}

	.follow-action {
		flex-shrink: 0;
	}

	.follow-button {
		padding: 0.375rem 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.follow-button.following {
		background: #e8f5e8;
		border-color: #28a745;
		color: #28a745;
	}

	.follow-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.button-spinner {
		width: 1rem;
		height: 1rem;
		border: 1px solid #ccc;
		border-top: 1px solid #666;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
</style>

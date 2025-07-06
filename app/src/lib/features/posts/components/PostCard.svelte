<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PostWithInteractions, CommentWithInteractions } from '$lib/types/types.posts';
	import type { Tag, AIAgent} from '$lib/types/types'; // Add this import
	import { pocketbaseUrl } from '$lib/stores/pocketbase';
	import PostReplyModal from '$lib/features/posts/components/PostReplyModal.svelte';
	import ShareModal from '$lib/components/modals/ShareModal.svelte';
	import { postStore } from '$lib/stores/postStore';
	import { flip } from 'svelte/animate';
	import { t } from '$lib/stores/translationStore';
	import { getExpandedUserAvatarUrl } from '$lib/features/users/utils/avatarHandling';
	import { formatFileSize } from '$lib/utils/fileHandlers';
	import { slide, fly, fade } from 'svelte/transition';
	import { getAvatarUrl } from '$lib/features/users/utils/avatarHandling';
	import Avatar from '$lib/features/users/components/Avatar.svelte';

	import {
		initAudioState,
		registerAudioElement,
		getAudioStatesStore,
		togglePlayPause,
		handleAudioLoaded,
		handleTimeUpdate,
		handleAudioEnded,
		handleProgressChange,
		handleVolumeChange,
		toggleMute,
		formatTime,
		cleanupAudioPlayer,
		pauseOtherAudioPlayers
	} from '$lib/utils/mediaHandlers';
	import AudioPlayer from '$lib/components/media/AudioPlayer.svelte';
	import VideoPlayer from '$lib/components/media/VideoPlayer.svelte';
	import { swipeGesture } from '$lib/utils/swipeGesture';
	import { clientTryCatch, fetchTryCatch, isFailure } from '$lib/utils/errorUtils';
	import { toast } from '$lib/utils/toastUtils';
	import { agentStore } from '$lib/stores/agentStore'; // Add this import
	import LocalAIAnalysisModal from '$lib/features/ai/components/analysis/LocalAIAnalysisModal.svelte';

	export let post: PostWithInteractions | CommentWithInteractions;
	export let showActions: boolean = true;
	export let isRepost: boolean = false;
	export let isPreview: boolean = false;
	export let isOwnRepost: boolean = false;
	export let isComment: boolean = false;
	export let isQuote: boolean = false;

	export let hideHeaderOnScroll: boolean = false;
export let selectedLocalModel: string = 'qwen2.5:0.5b';

	let showTooltip = false;
	let showShareModal = false;
	let showQuoteModal = false;
	let showTagsModal = false;
	let showAIAnalysisModal = false;
	let debugCount = 0;

	// Tags expansion state
	let tagsExpanded = false;
	let tagDetails: Tag[] = [];
	let loadingTags = false;
	let tagsLoaded = false;
	let agentsExpanded = false;

	$: postAgentIds = post.agents || [];
	$: availableAgents = $agentStore.agents || [];
	$: activeAgents = availableAgents.filter((agent) => agent.status === 'active');

	$: postAgents = postAgentIds
		.map((agentId) => activeAgents.find((agent) => agent.id === agentId))
		.filter((agent): agent is AIAgent => agent !== undefined);

	$: totalAgentIds = postAgentIds.length;
	$: agentCount = postAgents.length;
	$: displayedAgents = postAgents.slice(0, 5); // Sh
	$: agentsTitle =
		totalAgentIds === 0
			? 'No agents assigned'
			: agentCount === 0
				? `${totalAgentIds} agents (none active)`
				: agentCount === totalAgentIds
					? agentCount === 1
						? '1 active agent'
						: `${agentCount} active agents`
					: `${agentCount} of ${totalAgentIds} agents active`;
	function handleAgents() {
		console.log('=== AGENT DEBUG ===');
		console.log('Post agent IDs:', postAgentIds);
		console.log('Available agents in store:', availableAgents.length);
		console.log('Available agent details:', availableAgents);
		console.log('Active agents in store:', activeAgents.length);
		console.log('Active agent details:', activeAgents);
		console.log('Matched post agents:', postAgents);
		console.log('Agent count:', agentCount);
		agentsExpanded = !agentsExpanded;
		console.log('Agents expanded:', agentsExpanded);
	}
	function handleAIAnalysis(event: CustomEvent) {
		console.log('AI Analysis complete:', event.detail);
		// Optional: Show toast notification
		toast.success(`Analysis complete using ${selectedLocalModel}`);
	}
	const dispatch = createEventDispatcher<{
		interact: { postId: string; action: 'upvote' | 'repost' | 'read' | 'share' };
		comment: { postId: string };
		quote: { content: string; attachments: File[]; quotedPostId: string };
		tagClick: { tag: Tag; postId: string }; // Add tag click event
	}>();
	const audioStatesStore = getAudioStatesStore();

	// Computed values for tags
	$: tagCount = post.tagCount || 0;
	$: hasTagIds = post.tags && post.tags.length > 0;

	function navigateToPost() {
		const postUrl = `/${post.author_username}/posts/${post.id}`;
		goto(postUrl);
	}
	function handleModelSelect(event: CustomEvent<{ model: string }>) {
	selectedLocalModel = event.detail.model;
	console.log('🔄 Model updated to:', selectedLocalModel);
	}
	function formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		// If less than an hour, show minutes
		if (minutes < 60) return `${minutes}m`;

		// If less than a day, show hours
		if (hours < 24) return `${hours}h`;

		// If more than a day, show date format
		const day = date.getDate();
		const month = date.getMonth(); // 0-11
		const year = date.getFullYear();
		const currentYear = now.getFullYear();

		// Month names array for translation lookup
		const monthKeys = [
			'january',
			'february',
			'march',
			'april',
			'may',
			'june',
			'july',
			'august',
			'september',
			'october',
			'november',
			'december'
		];

		const monthName = $t(`months.${monthKeys[month]}`) as string;

		// If same year, show: "15. March"
		if (year === currentYear) {
			return `${day} ${monthName}`;
		}

		// If different year, show: "15. March 2023"
		return `${day}. ${monthName} ${year}`;
	}
	async function toggleAgentAssignment(agentId: string) {
		console.log('Toggling agent assignment:', agentId);

		const isCurrentlyAssigned = postAgentIds.includes(agentId);
		let newAgentIds: string[];

		if (isCurrentlyAssigned) {
			// Remove agent
			newAgentIds = postAgentIds.filter((id) => id !== agentId);
		} else {
			// Add agent
			newAgentIds = [...postAgentIds, agentId];
		}

		try {
			const response = await fetch(`/api/posts/${post.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					agents: newAgentIds
				})
			});

			if (response.ok) {
				// Update local state
				post.agents = newAgentIds;
				const agent = activeAgents.find((a) => a.id === agentId);
				console.log(`✅ ${isCurrentlyAssigned ? 'Unassigned' : 'Assigned'} agent:`, agent?.name);
			} else {
				console.error('Failed to update agent assignment');
			}
		} catch (error) {
			console.error('Error updating agent assignment:', error);
		}
	}
	function handleInteraction(action: 'upvote' | 'repost' | 'read') {
		dispatch('interact', { postId: post.id, action });
	}

	function handleComment() {
		dispatch('comment', { postId: post.id });
	}

	function handleShare() {
		// Open the share modal instead of directly sharing
		showShareModal = true;
	}
	// Updated handleTags function for inline expansion
	async function handleTags() {
		if (tagCount === 0) return;

		tagsExpanded = !tagsExpanded;

		// Fetch tag details when expanding for the first time
		if (tagsExpanded && !tagsLoaded && hasTagIds) {
			await fetchTagDetails();
		}
	}

	// Fetch tag details

	async function fetchTagDetails() {
		if (!hasTagIds || tagsLoaded || loadingTags) return;

		loadingTags = true;

		const result = await clientTryCatch(
			(async () => {
				console.log('Fetching tag details for post:', post.id, post.tags);

				// Ensure post.tags is an array
				const tagIds = Array.isArray(post.tags) ? post.tags : [];

				if (tagIds.length === 0) {
					console.warn('No tag IDs found');
					return [];
				}

				// Fetch details for each tag ID
				const tagPromises = tagIds.map(async (tagId) => {
					const tagResult = await clientTryCatch(
						(async () => {
							const response = await fetch(`/api/tags/${tagId}`, {
								credentials: 'include'
							});

							if (!response.ok) {
								throw new Error(`HTTP ${response.status}: ${response.statusText}`);
							}

							const responseData = await response.json();

							/*
							 * Your API might return { success: true, data: tag } or just the tag directly
							 * Handle both cases
							 */
							if (responseData.success && responseData.data) {
								return responseData.data;
							} else if (responseData.id) {
								// Direct tag object
								return responseData;
							} else {
								throw new Error('Invalid response format');
							}
						})(),
						`Fetching tag ${tagId}`
					);

					if (isFailure(tagResult)) {
						console.error(`Error fetching tag ${tagId}:`, tagResult.error);
						return null;
					}

					return tagResult.data;
				});

				const results = await Promise.all(tagPromises);
				const validTags = results.filter(Boolean); // Remove null results
				tagDetails = validTags;
				tagsLoaded = true;

				console.log('Fetched tag details:', tagDetails);
				return validTags;
			})(),
			`Fetching tag details for post ${post.id}`
		);

		if (isFailure(result)) {
			console.error('Error fetching tag details:', result.error);
			// Set empty array on error so UI doesn't stay in loading state
			tagDetails = [];
		}

		// Always reset loading state
		loadingTags = false;
	}
	// Handle clicking on individual tags
	function handleTagClick(tag: Tag, event: MouseEvent) {
		event.stopPropagation();
		dispatch('tagClick', { tag, postId: post.id });
	}

	// Generate a color for tags that don't have one
	function getTagColor(tag: Tag): string {
		if (tag.color) return tag.color;

		// Generate a color based on tag name
		const colors = [
			'#3b82f6',
			'#ef4444',
			'#10b981',
			'#f59e0b',
			'#8b5cf6',
			'#06b6d4',
			'#84cc16',
			'#f97316'
		];
		const index = tag.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		return colors[index % colors.length];
	}

	async function handleCopyLink() {
		try {
			// Pass the username to sharePost for proper URL construction
			const result = await postStore.sharePost(post.id, post.author_username);

			if (result.copied) {
				// Success - link copied successfully with normal methods
				toast.success(result.message || 'Link copied to clipboard!');
			} else {
				// Normal copy failed - try aggressive copy method
				console.log('🚀 Normal copy failed, trying aggressive copy...');
				const aggressiveSuccess = await tryAggressiveCopy(result.url);

				if (aggressiveSuccess) {
					// Aggressive copy worked
					if ('shareCount' in result && result.shareCount !== undefined) {
						toast.success('Post shared and link copied to clipboard!');
					} else {
						toast.success('Link copied to clipboard!');
					}
				} else {
					// All copy methods failed
					if ('shareCount' in result && result.shareCount !== undefined) {
						toast.success('Post shared successfully!');
						toast.warning('Could not copy link automatically', 3000);
					} else {
						toast.error('Could not copy link to clipboard');
					}
				}
			}
		} catch (error) {
			console.error('Error sharing post:', error);
			toast.error('Sharing failed');
		}

		// Always close the modal
		showShareModal = false;
	}

	// Simplified aggressive copy method (remove the modal parts)
	async function tryAggressiveCopy(text: string): Promise<boolean> {
		console.log('🚀 Trying aggressive copy methods...');

		// Method 1: Try clipboard API again (might work in different context)
		try {
			await navigator.clipboard.writeText(text);
			console.log('✅ Clipboard API worked in aggressive context');
			return true;
		} catch (e) {
			console.log('❌ Clipboard API still blocked');
		}

		// Method 2: Use a hidden input with different timing and focus
		try {
			const input = document.createElement('input');
			input.type = 'text';
			input.value = text;
			input.style.cssText = 'position: absolute; left: -9999px; top: -9999px; opacity: 0;';

			document.body.appendChild(input);

			// Give it time to be added to DOM
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Try to give it focus and select
			input.focus();
			input.select();
			input.setSelectionRange(0, text.length);

			// Small delay before copy attempt
			await new Promise((resolve) => setTimeout(resolve, 10));

			const success = document.execCommand('copy');
			document.body.removeChild(input);

			if (success) {
				console.log('✅ Aggressive copy method succeeded');
				return true;
			} else {
				console.log('❌ Aggressive copy method failed: execCommand returned false');
			}
		} catch (e) {
			console.log('❌ Aggressive copy method failed with error:', e);
		}

		// Method 3: Try with textarea instead of input
		try {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.cssText = 'position: fixed; left: -9999px; top: -9999px; opacity: 0;';

			document.body.appendChild(textarea);
			await new Promise((resolve) => setTimeout(resolve, 50));

			textarea.focus();
			textarea.select();

			await new Promise((resolve) => setTimeout(resolve, 10));

			const success = document.execCommand('copy');
			document.body.removeChild(textarea);

			if (success) {
				console.log('✅ Textarea copy method succeeded');
				return true;
			}
		} catch (e) {
			console.log('❌ Textarea copy method failed:', e);
		}

		return false;
	}

	function handleQuote() {
		showQuoteModal = true;
	}

	function handleQuoteSubmit(
		event: CustomEvent<{ content: string; attachments: File[]; quotedPostId: string }>
	) {
		dispatch('quote', event.detail);
		showQuoteModal = false;
	}
	/*
	 * $: {
	 *     debugCount++;
	 *     console.log(`PostCard render #${debugCount} for post ${post.id}:`, {
	 *         upvoteCount: post.upvoteCount,
	 *         calculatedUpvoteCount: upvoteCount,
	 *         upvote: post.upvote,
	 *         fullPost: post
	 *     });
	 * }
	 */

    $: upvoteCount = post.upvoteCount !== undefined && post.upvoteCount !== null ? post.upvoteCount : 0;
    $: shareTitle = $t('generic.share') as string;
    $: upvoteTitle = $t('posts.postUpvote') as string;
    $: repostTitle = $t('posts.repost') as string;
    $: tagsTitle = tagsExpanded ? 'Hide tags' : `Show ${tagCount} tags`;
    
    $: postAuthor = {
        id: post.user,
        avatar: post.author_avatar,
        collectionId: '_pb_users_auth_'
    };
    
    $: expandedUser = post.expand?.user ? {
        id: post.expand.user.id,
        avatar: post.expand.user.avatar,
        collectionId: '_pb_users_auth_' 
    } : null;
    
    $: {
        console.log('🔍 Post Data Debug:', {
            post,
            user: post.user,
            author_username: post.author_username,
            author_name: post.author_name,
            expand_user: post.expand?.user
        });
    }
    
    $: avatarUserData = {
        id: post.user,
        avatar: post.author_avatar,
        username: post.author_username || post.expand?.user?.username,
        name: post.author_name || post.expand?.user?.name
    };
    

	onDestroy(() => {
		if (post.attachments) {
			post.attachments.forEach((attachment) => {
				if (attachment.file_type === 'audio') {
					cleanupAudioPlayer(attachment.id);
				}
			});
		}
	});
</script>

<article class="post-card" class:comment={isComment}>
	{#if isRepost}
		<div class="repost-indicator">
			<Icon name="Repeat" size={14} />
			<span>{$t('posts.repostedBy')} {post.author_name || post.author_username}</span>
		</div>
	{:else if isOwnRepost}
		<div class="repost-indicator own-repost">
			<Icon name="Repeat" size={14} />
			<span>{$t('posts.youReposted')}</span>
		</div>
	{/if}
	<div class="post-header" class:scrolled={hideHeaderOnScroll}>
<a href="/{post.author_username}" class="avatar-link" class:hidden={hideHeaderOnScroll}>
    <Avatar 
        user={avatarUserData} 
        size={40} 
        className="post-avatar" 
    />
</a>
		<div class="post-meta">
			<!-- Make author name clickable -->
			<a
				href="/{post.author_username || post.expand?.user?.username}"
				class="author-link"
				class:hidden={hideHeaderOnScroll}
			>
				<div class="post-author">
					{post.author_name ||
						post.author_username ||
						post.expand?.user?.name ||
						post.expand?.user?.username ||
						'Unknown User'}
				</div>
			</a>
			<div class="post-timestamp">{formatTimestamp(post.created)}</div>
		</div>
		{#if showActions}
			<button class="post-options">
				<Icon name="MoreHorizontal" size={16} />
			</button>
		{/if}
	</div>

	{#if !isComment}
		<div class="post-content">
			<a
				href="/{post.author_username}/posts/{post.id}"
				class="post-content-link"
				use:swipeGesture={{
					threshold: 100,
					enableVisualFeedback: true,
					onSwipeLeft: () => {
						console.log('🟢 Post content swiped right - navigating to post');
						navigateToPost();
					},
					onSwipeDown: () => {
						console.log('🟢 Post content swiped down - opening comment');
						handleComment();
					},
					onSwipeUp: () => {
						console.log('🟢 Post content swiped up - opening share');
						handleShare();
					}
				}}
			>
				<p>{post.content}</p>
			</a>

			{#if post.attachments && post.attachments.length > 0}
				<div class="post-attachments">
					{#each post.attachments as attachment}
						<div class="attachment">
							{#if attachment.file_type === 'image'}
								<a href="/{post.author_username}/posts/{post.id}" class="attachment-link">
									<img
										src="{pocketbaseUrl}/api/files/posts_attachments/{attachment.id}/{attachment.file_path}"
										alt={attachment.original_name}
										class="attachment-image"
									/>
								</a>
							{:else if attachment.file_type === 'video'}
								<div class="attachment-video" on:click|stopPropagation>
									<VideoPlayer
										src="{pocketbaseUrl}/api/files/posts_attachments/{attachment.id}/{attachment.file_path}"
										mimeType={attachment.mime_type}
										autoplay={!isComment}
										showControls={true}
										loop={true}
										muted={true}
										threshold={0.8}
										className="post-video-player"
									/>
								</div>
							{:else if attachment.file_type === 'audio'}
								<div class="attachment-audio" on:click|stopPropagation>
									<AudioPlayer
										attachmentId={attachment.id}
										audioSrc="{pocketbaseUrl}/api/files/posts_attachments/{attachment.id}/{attachment.file_path}"
										mimeType={attachment.mime_type}
										fileName={attachment.original_name}
									/>
								</div>
							{:else}
								<a href="/{post.author_username}/posts/{post.id}" class="attachment-link">
									<div class="attachment-file">
										<Icon name="Paperclip" size={16} />
										<span>{attachment.original_name}</span>
										{#if attachment.file_size}
											<span class="filesize">({formatFileSize(attachment.file_size)})</span>
										{/if}
									</div>
								</a>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Comments section stays the same -->
		<div class="post-content">
			<p>{post.content}</p>

			{#if post.attachments && post.attachments.length > 0}
				<div class="post-attachments">
					{#each post.attachments as attachment}
						<div class="attachment">
							{#if attachment.file_type === 'image'}
								<img
									src="{pocketbaseUrl}/api/files/posts_attachments/{attachment.id}/{attachment.file_path}"
									alt={attachment.original_name}
									class="attachment-image"
								/>
							{:else if attachment.file_type === 'video'}
								<div class="attachment-video">
									<VideoPlayer
										src="{pocketbaseUrl}/api/files/posts_attachments/{attachment.id}/{attachment.file_path}"
										mimeType={attachment.mime_type}
										autoplay={false}
										showControls={true}
										loop={false}
										muted={false}
										className="comment-video-player"
									/>
								</div>
							{:else if attachment.file_type === 'audio'}
								<div class="attachment-audio">
									<AudioPlayer
										attachmentId={attachment.id}
										audioSrc="{pocketbaseUrl}/api/files/posts_attachments/{attachment.id}/{attachment.file_path}"
										mimeType={attachment.mime_type}
										fileName={attachment.original_name}
									/>
									<!-- <div class="media-info">
									<Paperclip size={12} />
									<span class="filename">{attachment.original_name}</span>
									<span class="filesize">({formatFileSize(attachment.file_size)})</span>
								</div> -->
								</div>
							{:else}
								<div class="attachment-file">
									<Icon name="Paperclip" size={16} />
									<span>{attachment.original_name}</span>
									{#if attachment.file_size}
										<span class="filesize">({formatFileSize(attachment.file_size)})</span>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if agentsExpanded}
		<div class="agents-row" transition:slide={{ duration: 200 }}>
			{#if activeAgents.length === 0}
				<div class="no-agents-message">
					<p>No active agents available</p>
					<p><small>Total agents in store: {availableAgents.length}</small></p>
				</div>
			{:else}
				<div class="agents-header">
					<span class="agents-title">Click agents to assign/unassign:</span>
				</div>
				{#each activeAgents.slice(0, 5) as agent (agent.id)}
					<div
						class="agent-avatar clickable"
						class:assigned={postAgentIds.includes(agent.id)}
						title="{agent.name} - Click to {postAgentIds.includes(agent.id)
							? 'unassign'
							: 'assign'}"
						on:click={() => toggleAgentAssignment(agent.id)}
						on:keydown={(e) => e.key === 'Enter' && toggleAgentAssignment(agent.id)}
						role="button"
						tabindex="0"
						animate:flip={{ duration: 200 }}
					>
						{#if agent.avatar}
							<img
								src="{pocketbaseUrl}/api/files/ai_agents/{agent.id}/{agent.avatar}"
								alt={agent.name}
								class="avatar-image"
							/>
						{:else}
							<div class="avatar-fallback">
								{agent.name.charAt(0).toUpperCase()}
							</div>
						{/if}
						<span class="agent-name">{agent.name}</span>
						{#if postAgentIds.includes(agent.id)}
							<div class="assigned-indicator">✓</div>
						{/if}
					</div>
				{/each}

				{#if activeAgents.length > 5}
					<div class="agent-overflow" title={`+${activeAgents.length - 5} more agents available`}>
						<span class="overflow-count">+{activeAgents.length - 5}</span>
					</div>
				{/if}

				{#if postAgentIds.length > 0}
					<div class="agents-summary">
						<small
							>{postAgentIds.length} agent{postAgentIds.length === 1 ? '' : 's'} assigned to this post</small
						>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
	{#if showActions}
		<div class="post-actions">
			<button class="action-button comment" title="Comment" on:click={handleComment}>
				<Icon name="MessageSquare" size={16} />
				<span>{post.commentCount || 0}</span>
			</button>

			<button
				class="action-button repost"
				class:active={post.repost}
				on:click={() => handleInteraction('repost')}
				title={repostTitle}
			>
				<Icon name="Repeat" size={16} />
				<span>{post.repostCount || 0}</span>
			</button>

			<button
				class="action-button upvote"
				class:active={post.upvote}
				on:click={() => handleInteraction('upvote')}
				title={upvoteTitle}
			>
				<Icon name="Heart" size={16} />
				<span>{upvoteCount}</span>
			</button>

			<button
				class="action-button share"
				class:shared={post.share}
				title={shareTitle}
				on:click={handleShare}
			>
				<Icon name="Share" size={16} />
				<span>{(post.shareCount || 0) + (post.quoteCount || 0)}</span>
				{#if showTooltip}
					<span class="tooltip">{$t('generic.copiedLink')} </span>
				{/if}
			</button>
			<!-- Read indicator -->
			<div class="action-button read" title="{post.readCount || 0} readers">
				<Icon name="EyeIcon" size={14} />
				<span class="read-count">{post.readCount || 0}</span>
			</div>
			<!-- Updated tags button -->
			<button
				class="action-button tags"
				class:expanded={tagsExpanded}
				class:has-tags={tagCount > 0}
				class:no-tags={tagCount === 0}
				title={tagsTitle}
				on:click={handleTags}
				disabled={tagCount === 0}
			>
				<Icon name="TagsIcon" size={16} />
				<span class="tag-count">{tagCount}</span>

				{#if tagCount > 0}
					<span class="expand-icon">
						{#if tagsExpanded}
							<Icon name="ChevronDown" size={12} />
						{:else}
							<Icon name="ChevronRight" size={12} />
						{/if}
					</span>
				{/if}
			</button>
			<button
				class="action-button agents"
				class:expanded={agentsExpanded}
				class:has-agents={agentCount > 0}
				class:no-agents={agentCount === 0}
				title={agentsTitle}
				on:click={handleAgents}
			>
				<Icon name="Bot" size={16} />
				<span class="agent-count">{activeAgents.length}</span>

				<span class="expand-icon">
					{#if agentsExpanded}
						<Icon name="ChevronDown" size={12} />
					{:else}
						<Icon name="ChevronRight" size={12} />
					{/if}
				</span>
			</button>
			<button 
					class="action-button"
					on:click={() => showAIAnalysisModal = true}
					title="Analyze with Local AI"
					disabled={!post.content?.trim()}
					>
					<Icon name="Brain" size={12} />
				</button>
		</div>

		<!-- Expanded tags section -->
		{#if tagsExpanded && tagCount > 0}
			<div class="tags-expansion" transition:slide={{ duration: 200 }}>
				{#if loadingTags}
					<div class="loading-tags">
						<div class="loading-spinner"></div>
						<span>Loading tags...</span>
					</div>
				{:else if tagDetails.length > 0}
					<div class="tags-list">
						{#each tagDetails as tag (tag.id)}
							<button
								class="tag-chip"
								style="--tag-color: {getTagColor(tag)}"
								on:click={(e) => handleTagClick(tag, e)}
								title="Click to filter posts by '{tag.name}'"
							>
								<span class="tag-name">#{tag.name}</span>
							</button>
						{/each}
					</div>
				{:else if hasTagIds}
					<div class="tags-list">
						<!-- Fallback: show tag IDs if details couldn't be loaded -->
						{#each post.tags as tagId (tagId)}
							<span class="tag-chip fallback">
								<span class="tag-name">#{tagId.slice(0, 8)}...</span>
							</span>
						{/each}
					</div>
				{:else}
					<div class="no-tags-message">
						<span>No tags available</span>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</article>

<LocalAIAnalysisModal
  bind:isOpen={showAIAnalysisModal}
  {post}
  selectedModel={selectedLocalModel}
  on:close={() => showAIAnalysisModal = false}
  on:analyzed={handleAIAnalysis}
/>

<ShareModal
	bind:isOpen={showShareModal}
	{post}
	on:close={() => (showShareModal = false)}
	on:copyLink={handleCopyLink}
	on:quote={handleQuote}
/>

<!-- Quote Modal -->
<PostReplyModal
	bind:isOpen={showQuoteModal}
	{post}
	on:close={() => (showQuoteModal = false)}
	on:quote={handleQuoteSubmit}
/>

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.post-card {
		border-bottom: 1px solid var(--line-color);
		padding: 0.5rem 0;
		transition: all 0.2s ease;
		&:last-child {
			border-bottom: none;
		}
	}

	.post-header {
		display: flex;
		align-items: center;
		padding: 0 0.5rem;
		margin: 0;
		height: auto;
		gap: 0.75rem;
	}
	.post-header.scrolled {
		padding: 0;
		& .avatar-link {
			display: none;
		}
	}

	/* Avatar link styles */
	.avatar-link {
		text-decoration: none;
		border-radius: 50%;
		overflow: hidden;
		transition: transform 0.2s ease;
	}

	.avatar-link:hover {
		transform: scale(1.05);
	}
	.avatar-link.hidden,
	.author-link.hidden {
		opacity: 0;
		transform: translateY(-10px);
		transition:
			opacity 0.2s ease,
			transform 0.2s ease;
		pointer-events: none;
	}
	.post-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
	}

	/* Author link styles */
	.author-link {
		text-decoration: none;
		color: inherit;
		display: inline-block;
		transition: color 0.2s ease;
	}

	.author-link:hover {
		color: var(--primary-color);
	}

	.post-author {
		font-weight: 600;
		color: var(--text-color);
		font-size: 0.95rem;
	}

	.author-link:hover .post-author {
		color: var(--primary-color);
	}
	.post-meta {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-start;
		gap: 1rem;
		flex: 1;
	}

	.post-timestamp {
		color: var(--placeholder-color);
		font-size: 0.85rem;
		display: flex;
		justify-content: flex-end;
		width: 100%;
	}

	.post-options {
		background: none;
		border: none;
		color: var(--placeholder-color);
		padding: 4px;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.post-options:hover {
		background: var(--line-color);
		color: var(--text-color);
	}

	/* Post content link styles */
	.post-content-link {
		text-decoration: none;
		color: inherit;
		display: block;
		transition: all 0.2s ease;
		border-radius: 8px;
		padding: 4px;
		margin: -4px;
	}

	.post-content-link:hover {
		background: rgba(var(--primary-color-rgb), 0.05);
	}

	.post-content {
		color: var(--text-color);
		line-height: 1.5;
		margin-bottom: 0;
		padding: 0.5rem;
		text-align: left;
	}

	.post-content p {
		margin: 0;
		margin-left: 1rem;
		line-height: 1.5;
		font-size: 1rem;
		text-align: left;
	}

	.post-attachments {
		margin-top: 1rem;
		display: flex;
		justify-content: flex-start;
		flex-wrap: wrap;
		gap: 8px;
	}

	.attachment-image {
		margin-left: 1rem;
		max-width: 100%;
		height: 100%;
		max-height: 400px;
		border-radius: 8px;
		border: 1px solid var(--line-color);
	}

	.attachment-file {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: var(--line-color);
		border-radius: 8px;
		color: var(--text-color);
		font-size: 0.9rem;
	}

	.post-actions {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 1rem;
		margin-left: 1rem;
	}

	.action-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		color: var(--placeholder-color);
		font-size: 0.9rem;
		padding: 0.5rem;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-button:hover {
		background: var(--line-color);
		color: var(--text-color);
	}

	.action-button.active {
		color: var(--primary-color);
	}

	.action-button.active:hover {
		color: var(--primary-color);
		background: var(--line-color);
	}

	.action-button.upvote.active {
		color: #e91e63;
	}

	.action-button.repost.active {
		color: #00c853;
	}

	.read-status {
		margin-left: auto;
		color: var(--placeholder-color);
		font-size: 0.85rem;
	}

	.read-count {
		opacity: 0.7;
	}
	.tooltip {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		background: var(--text-color);
		color: var(--bg-color);
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.8rem;
		white-space: nowrap;
		margin-bottom: 4px;
		z-index: 10;
	}

	.tooltip::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 4px solid transparent;
		border-top-color: var(--text-color);
	}
	.action-button.share.shared {
		color: var(--placeholder-color);
	}

	.action-button.share {
		position: relative;
	}

	/* Keep the hover effect for all states */
	.action-button.share:hover {
		background: var(--line-color);
		color: var(--text-color);
	}
	.repost-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--secondary-color);
		font-size: 0.85rem;
		margin-bottom: 12px;
		padding: 6px 12px;
		background: rgba(var(--secondary-color-rgb), 0.1);
		border-radius: 8px;
		border-left: 3px solid var(--secondary-color);
	}

	.repost-indicator.own-repost {
		color: var(--primary-color);
		background: rgba(var(--primary-color-rgb), 0.1);
		border-left-color: var(--primary-color);
	}

	.action-button:hover {
		background-color: var(--hover-bg, #f3f4f6);
		color: var(--text-primary, #111827);
	}

	.action-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-button.active {
		color: var(--accent-color, #3b82f6);
	}

	.action-button.agents.expanded {
		background-color: var(--accent-bg, #dbeafe);
		color: var(--accent-color, #3b82f6);
	}

	.action-button.agents.no-agents {
		opacity: 0.4;
	}

	.expand-icon {
		margin-left: 0.125rem;
		display: flex;
		align-items: center;
	}

	/* Agents row styles */
	.agents-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		padding: 0.25rem;
		background-color: var(--bg-color);
		color: var(--text-color);
		border-radius: 0.5rem;
		border: 1px solid var(--border-color, #e5e7eb);
	}

	.agent-avatar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		cursor: pointer;
		transition: transform 0.2s ease;
	}

	.agent-avatar:hover {
		transform: translateY(-2px);
	}

	.avatar-image,
	.avatar-fallback {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 2px solid var(--border-color, #e5e7eb);
	}

	.avatar-image {
		object-fit: cover;
	}

	.avatar-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--accent-color, #3b82f6);
		color: white;
		font-weight: 600;
		font-size: 0.75rem;
	}

	.agent-name {
		font-size: 0.625rem;
		color: var(--text-muted, #6b7280);
		text-align: center;
		max-width: 48px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.agent-overflow {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background-color: var(--surface-tertiary, #f3f4f6);
		border: 2px solid var(--border-color, #e5e7eb);
		color: var(--text-muted, #6b7280);
		font-size: 0.625rem;
		font-weight: 600;
	}

	/* Read indicator specific styles */
	.action-button.read {
		cursor: default;
		pointer-events: none;
	}
	.agent-avatar.clickable {
		cursor: pointer;
		position: relative;
		border: 2px solid transparent;
		border-radius: 8px;
		padding: 4px;
		transition: all 0.2s ease;
	}

	.agent-avatar.clickable:hover {
		transform: translateY(-2px);
		border-color: var(--accent-color, #3b82f6);
		background-color: var(--accent-bg-light, #f0f9ff);
	}

	.agent-avatar.assigned {
		border-color: var(--success-color, #10b981);
		background-color: var(--success-bg, #ecfdf5);
	}

	.assigned-indicator {
		position: absolute;
		top: -2px;
		right: -2px;
		background-color: var(--success-color, #10b981);
		color: white;
		border-radius: 50%;
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: bold;
	}

	.agents-header {
		width: 100%;
		margin-bottom: 0.5rem;
	}

	.agents-title {
		font-size: 0.75rem;
		color: var(--text-muted, #6b7280);
		font-weight: 500;
	}

	.agents-summary {
		width: 100%;
		text-align: center;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-color, #e5e7eb);
		color: var(--text-muted, #6b7280);
	}
	/* Mobile responsive */
	@media (max-width: 768px) {
		.post-card {
			padding: 12px;
		}

		.post-actions {
			gap: 12px;
		}

		.action-button {
			padding: 4px 6px;
		}
	}
</style>

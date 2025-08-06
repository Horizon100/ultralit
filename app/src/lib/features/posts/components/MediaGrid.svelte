<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { InfiniteScrollManager } from '$lib/utils/infiniteScroll';
	import type { PostAttachment } from '$lib/types/types.posts';
	import { clientTryCatch, isFailure } from '$lib/utils/errorUtils';
	import { pocketbaseUrl } from '$lib/stores/pocketbase';
	import { goto } from '$app/navigation';
	import VideoPlayer from '$lib/components/media/VideoPlayer.svelte';

	export let username: string;
	export let isActive: boolean = false;
	let mediaItems: PostAttachment[] = [];
	let loading = true;
	let loadingMore = false;
	let hasMore = true;
	let currentOffset = 0;
	let error = '';
	let retryCount = 0;
	let lastLoadTime = 0;
	let totalMediaCount = 0;
	let infiniteScrollManager: InfiniteScrollManager | null = null;
	let playingVideo: string | null = null; // Track which video is playing

	const MEDIA_PER_PAGE = 20;
	const MAX_RETRIES = 3;
	const LOAD_THROTTLE_MS = 10000;
	export { totalMediaCount };

	$: console.log('🔍 MediaGrid DEBUG:', {
		username,
		isActive,
		browser,
		mediaItemsLength: mediaItems.length,
		loading
	});

	async function fetchMediaData(offset = 0, append = false) {
		if (!username || !browser || !isActive) return;

		if (!append) {
			loading = true;
			currentOffset = 0;
			hasMore = true;
			mediaItems = [];
		} else {
			loadingMore = true;
		}
		error = '';

		try {
			console.log(`🖼️ Fetching media data with offset: ${offset}, append: ${append}`);

			const response = await fetch(
				`/api/users/username/${username}/media?offset=${offset}&limit=${MEDIA_PER_PAGE}`,
				{
					credentials: 'include'
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));

				if (response.status === 429) {
					error = 'Loading too fast, waiting...';
					console.warn('Rate limit hit, retrying after longer delay');

					const waitTime = Math.min(10000, 3000 + retryCount * 2000);
					setTimeout(() => {
						error = '';
						retryCount++;
						if (retryCount <= MAX_RETRIES) {
							fetchMediaData(offset, append);
						} else {
							error = 'Rate limit exceeded. Please refresh the page in a few minutes.';
						}
					}, waitTime);
					return;
				}

				error = errorData.error || `Failed to load media data (${response.status})`;
				console.error('Media API error:', response.status, errorData);
				return;
			}

			const data = await response.json();
			const actualData = data.data || data;

			if (!append) {
				mediaItems = actualData.items || [];
				console.log(`🖼️ Initial load: ${mediaItems.length} items`);
			} else {
				const newItems = actualData.items || [];
				const existingIds = new Set(mediaItems.map((item) => item.id));
				const uniqueNewItems = newItems.filter((item: PostAttachment) => !existingIds.has(item.id));
				mediaItems = [...mediaItems, ...uniqueNewItems];
				console.log(
					`🖼️ Added ${uniqueNewItems.length} new unique media items (total: ${mediaItems.length})`
				);
			}

			const newItemsCount = (actualData.items || []).length;

			if (actualData.hasMore !== undefined) {
				hasMore = actualData.hasMore;
			} else {
				hasMore = newItemsCount === MEDIA_PER_PAGE;
			}

			currentOffset = append ? currentOffset + newItemsCount : newItemsCount;

			if (actualData.totalItems !== undefined) {
				totalMediaCount = actualData.totalItems;
			}

			if (!append && mediaItems.length > 0 && hasMore && !infiniteScrollManager) {
				console.log('🔄 Setting up infinite scroll after initial data load');
				setTimeout(() => setupInfiniteScroll(), 100);
			}

		} catch (err) {
			console.error('Error fetching media data:', err);
			error = 'Failed to load media data';

			if (retryCount < MAX_RETRIES && !append) {
				retryCount++;
				console.log(`🔄 Retrying media fetch, attempt ${retryCount}/${MAX_RETRIES}`);
				setTimeout(() => fetchMediaData(offset, append), 1000 * retryCount);
				return;
			}
		} finally {
			loading = false;
			loadingMore = false;
		}
	}

	async function retryFetch() {
		retryCount = 0;
		await fetchMediaData();
	}

	async function loadMoreMedia() {
		const now = Date.now();
		if (loadingMore || !hasMore || now - lastLoadTime < LOAD_THROTTLE_MS) {
			return;
		}

		lastLoadTime = now;
		console.log('🚀 Loading more media from offset:', currentOffset, 'current items:', mediaItems.length);
		await fetchMediaData(currentOffset, true);
	}

	function getMediaUrl(attachment: PostAttachment): string {
		if (!attachment.file_path || !attachment.id) {
			console.warn('Invalid attachment data:', attachment);
			return '';
		}
		return `${$pocketbaseUrl}/api/files/posts_attachments/${attachment.id}/${attachment.file_path}`;
	}

	function getThumbnailUrl(attachment: PostAttachment): string {
		if (!attachment.file_path || !attachment.id) {
			console.warn('Invalid attachment data:', attachment);
			return '';
		}
		// Use the thumbnail_url from API if available, otherwise generate
		return attachment.thumbnail_url || `${$pocketbaseUrl}/api/files/posts_attachments/${attachment.id}/${attachment.file_path}?thumb=300x300`;
	}

	function isVideo(attachment: PostAttachment): boolean {
		return attachment.file_type === 'video' || attachment.mime_type?.startsWith('video/');
	}

	function isImage(attachment: PostAttachment): boolean {
		return attachment.file_type === 'image' || attachment.mime_type?.startsWith('image/');
	}

	function openMediaModal(attachment: PostAttachment) {
		const postId = attachment.post;
		if (postId) {
			goto(`/${username}/posts/${postId}`);
		} else {
			console.warn('No post ID found for attachment:', attachment);
		}
	}

	function handleThumbnailClick(attachment: PostAttachment) {
		if (isVideo(attachment)) {
			// For videos, start playing instead of opening modal
			playingVideo = playingVideo === attachment.id ? null : attachment.id;
		} else {
			// For images, open modal as before
			openMediaModal(attachment);
		}
	}

	function handleImageError(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		console.warn('Failed to load image:', img.src);
		img.style.display = 'none';
	}

	function setupInfiniteScroll() {
		if (infiniteScrollManager) {
			infiniteScrollManager.destroy();
		}

		infiniteScrollManager = new InfiniteScrollManager({
			loadMore: async () => {
				try {
					await loadMoreMedia();
				} catch (error) {
					console.error('Error loading more media:', error);
				}
			},
			hasMore: () => hasMore && !loading,
			isLoading: () => loadingMore || loading,
			triggerId: 'media-loading-trigger',
			debug: true
		});

		infiniteScrollManager.setup();
		return infiniteScrollManager;
	}

	onMount(() => {
		console.log('🔄 MediaGrid mounted - setting up...');

		if (isActive && username) {
			(async () => {
				await fetchMediaData(0, false);
				setupInfiniteScroll();

				if (infiniteScrollManager) {
					infiniteScrollManager.attachWithRetry(10, 100).then((success) => {
						if (success) {
							console.log('✅ Media infinite scroll ready!');
						} else {
							console.error('❌ Failed to setup media infinite scroll');
						}
					});
				}
			})();
		}
	});

	$: {
		if (username && browser && isActive && mediaItems.length === 0 && !loading) {
			console.log('🔄 Loading media for first time:', username);
			(async () => {
				await fetchMediaData();
				if (mediaItems.length > 0 && hasMore) {
					setupInfiniteScroll();
					if (infiniteScrollManager) {
						infiniteScrollManager.attachWithRetry(3, 100);
					}
				}
			})();
		}
	}

	$: {
		if (infiniteScrollManager) {
			if (!isActive) {
				console.log('🔇 Disabling media infinite scroll - tab not active');
				infiniteScrollManager.detach();
			} else {
				console.log('🔊 Re-enabling media infinite scroll - tab active');
				infiniteScrollManager.attachWithRetry(3, 100);
			}
		}
	}

	onDestroy(() => {
		if (infiniteScrollManager) {
			infiniteScrollManager.destroy();
		}
	});
</script>

<section
	class="media-section"
	in:fly={{ y: 200, duration: 300 }}
	out:fly={{ y: -200, duration: 200 }}
>
	{#if loading}
		<div class="spinner-container">
			<div class="spinner"></div>
		</div>
	{:else if error}
		<div class="error-container">
			<p>Failed to load media: {error}</p>
			<button class="retry-btn" on:click={retryFetch}> Try Again </button>
		</div>
	{:else if mediaItems.length > 0}
		<div class="media-grid">
			{#each mediaItems as item (item.id)}
				<div
					class="media-item"
					in:fly={{ y: 50, duration: 300 }}
					out:fly={{ y: -50, duration: 200 }}
				>
{#if isVideo(item)}
					<div 
						class="video-thumbnail-wrapper"
						on:click={() => openMediaModal(item)}
						on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openMediaModal(item)}
						role="button"
						tabindex="0"
					>
						<img
							src={getThumbnailUrl(item)}
							alt={item.original_name || 'Video thumbnail'}
							class="media-content thumbnail"
							loading="lazy"
							on:error={handleImageError}
						/>
						<div class="video-overlay">
							<div class="play-icon">▶</div>
						</div>
					</div>
				{:else if isImage(item)}
					<div 
						class="image-wrapper"
						on:click={() => openMediaModal(item)}
						on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openMediaModal(item)}
						role="button"
						tabindex="0"
					>
						<img
							src={getThumbnailUrl(item)}
							alt={item.original_name || 'Image attachment'}
							class="media-content thumbnail"
							loading="lazy"
							on:error={handleImageError}
						/>
					</div>
					{:else}
						<!-- Fallback for other media types -->
						<div class="media-fallback">
							<div class="media-type-icon">📎</div>
							<span class="media-filename">{item.original_name || 'Media file'}</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Loading trigger for infinite scroll -->
		{#if hasMore}
			<div id="media-loading-trigger" class="loading-trigger">
				{#if loadingMore}
					<div class="loading-indicator">
						<div
							class="trigger-loader"
							in:fly={{ y: 50, duration: 300 }}
							out:fly={{ y: -50, duration: 200 }}
						></div>
					</div>
				{:else}
					<div class="loading-indicator">
						<div
							class="trigger-loader"
							in:fly={{ y: 50, duration: 300 }}
							out:fly={{ y: -50, duration: 200 }}
						></div>
					</div>
				{/if}
			</div>
		{:else if mediaItems.length > 0}
			<div class="end-of-media">
				<p>No more media to load</p>
				<p>Total items: {mediaItems.length}</p>
			</div>
		{/if}
	{:else}
		<div class="empty-state">
			<p>{username} hasn't shared any media yet.</p>
		</div>
	{/if}
</section>
<style lang="scss">
	* {
		font-family: var(--font-family);
	}
	.media-section {
		padding: 0;
		width: 100%;
	}

	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		color: var(--color-text-secondary);
		gap: 16px;
	}
// Add these new styles to your existing SCSS:

	.video-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.video-thumbnail-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}

	.image-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}

	.media-content.thumbnail {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		background: transparent;
		transition: transform 0.2s ease;
	}

	.video-thumbnail-wrapper:hover .media-content.thumbnail,
	.image-wrapper:hover .media-content.thumbnail {
		transform: scale(1.05);
	}


	.video-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.4);
		opacity: 1; 
		transition: opacity 0.2s ease;
		border-radius: 8px;
	}

	.video-thumbnail-wrapper:hover .video-overlay {
		background: rgba(0, 0, 0, 0.6); 
	}

	.video-overlay {
		& .play-icon {
		display: none;
		font-size: 2rem;
		}
				&:hover {
					& .play-icon {
		display: block !important;
		color: var(--tertiary-color) !important;
		font-size: 2rem;
				}
	}

}

	.close-video-btn {
		position: absolute;
		top: 8px;
		right: 8px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		border: none;
		border-radius: 50%;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 10;
		font-size: 18px;
		transition: background 0.2s ease;

		&:hover {
			background: rgba(0, 0, 0, 0.9);
		}
	}

	:global(.video-player-grid) {
		border-radius: 8px;
		overflow: hidden;
	}
	.retry-btn {
		background: var(--color-primary);
		color: var(--text-color);
		border: none;
		padding: 8px 16px;
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		transition: background-color 0.2s ease;
	}

	.retry-btn:hover {
		background: var(--color-primary-hover);
	}

	.media-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 4px;
		padding: 0;
	}

	@media (max-width: 768px) {
		.media-grid {
			grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
			gap: 2px;
		}
	}

	@media (max-width: 480px) {
		.media-grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 2px;
		}
	}

	.media-item {
		position: relative;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 8px;
		cursor: pointer;
		transition: transform 0.2s ease;
		background: var(--color-bg-secondary);
	}

	.media-item:hover {
		transform: scale(1.02);
	}

	.media-item:focus {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.media-content {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
			background: transparent;

	}

	.video-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		background: #000;
	}
	video.media-content {
	/* Prevent black bars and ensure proper rendering */
	background: transparent;
	object-fit: cover;
	/* Force hardware acceleration */
	transform: translateZ(0);
	-webkit-transform: translateZ(0);
}

	.media-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.media-item:hover .media-overlay {
		opacity: 1;
	}

	// .play-icon {
	// 	color: var(--text-color);
	// 	font-size: 24px;
	// 	filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
	// }

	.media-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-tertiary, #f1f5f9);
		color: var(--color-text-secondary, #64748b);
		padding: 16px;
		text-align: center;
		gap: 8px;
	}

	.media-type-icon {
		font-size: 24px;
	}

	.media-filename {
		font-size: 12px;
		word-break: break-word;
		max-width: 100%;
	}

	.loading-trigger {
		display: flex;
		justify-content: center;
		padding: 20px;
	}

	.loading-indicator {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--color-text-secondary);
	}

	.trigger-loader {
		width: 20px;
		height: 20px;
		border: 2px solid var(--color-border);
		border-top: 2px solid var(--color-primary);
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

	.end-of-media {
		text-align: center;
		padding: 20px;
		color: var(--color-text-secondary);
	}

	.end-of-media p {
		margin: 4px 0;
	}

	.empty-state {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 60px 20px;
		text-align: center;
		color: var(--color-text-secondary);
	}

	.empty-state p {
		font-size: 16px;
	}
</style>

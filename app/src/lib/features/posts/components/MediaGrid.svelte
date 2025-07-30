<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { InfiniteScrollManager } from '$lib/utils/infiniteScroll';
	import type { PostAttachment } from '$lib/types/types.posts';
	import { clientTryCatch, isFailure } from '$lib/utils/errorUtils';
	import { pocketbaseUrl } from '$lib/stores/pocketbase';
	import { goto } from '$app/navigation';

	export let username: string;
	export let isActive: boolean = false; // Add this prop to control when to load

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

	const MEDIA_PER_PAGE = 20;
	const MAX_RETRIES = 3;
	const LOAD_THROTTLE_MS = 10000; // 10 seconds for your strict rate limits

	// Export the total count so parent component can access it
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
					credentials: 'include' // ADD THIS LINE
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));

				// Handle rate limiting specifically
				if (response.status === 429) {
					error = 'Loading too fast, waiting...';
					console.warn('Rate limit hit, retrying after longer delay');

					// Exponential backoff for rate limits
					const waitTime = Math.min(10000, 3000 + retryCount * 2000); // Max 10 seconds
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

			console.log('🔍 API Response structure:', data);

			const actualData = data.data || data;

			console.log('🔍 Actual data structure:', actualData);
			console.log('🔍 Items array length:', actualData.items?.length || 0);

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

			// Use the hasMore from API response if available, otherwise calculate based on returned items
			if (actualData.hasMore !== undefined) {
				hasMore = actualData.hasMore;
			} else {
				// If we got fewer items than requested, we've reached the end
				hasMore = newItemsCount === MEDIA_PER_PAGE;
			}

			currentOffset = append ? currentOffset + newItemsCount : newItemsCount;

			// Update total count from API response
			if (actualData.totalItems !== undefined) {
				totalMediaCount = actualData.totalItems;
			}

			console.log('🖼️ Media pagination state:', {
				currentOffset,
				newItemsCount,
				hasMore,
				totalInStore: mediaItems.length,
				totalFromAPI: totalMediaCount,
				infiniteScrollActive: !!infiniteScrollManager
			});

			// Setup infinite scroll if we just got initial data
			if (!append && mediaItems.length > 0 && hasMore && !infiniteScrollManager) {
				console.log('🔄 Setting up infinite scroll after initial data load');
				setTimeout(() => setupInfiniteScroll(), 100);
			}

			console.log('🖼️ Media data updated:', {
				itemsCount: mediaItems.length,
				newItemsCount,
				hasMore: hasMore,
				currentOffset: currentOffset
			});
		} catch (err) {
			console.error('Error fetching media data:', err);
			error = 'Failed to load media data';

			// Retry logic for network errors
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
			console.log('⛔ Load more media skipped:', {
				loadingMore,
				hasMore,
				throttled: now - lastLoadTime < LOAD_THROTTLE_MS,
				currentItems: mediaItems.length,
				currentOffset
			});
			return;
		}

		lastLoadTime = now;
		console.log(
			'🚀 Loading more media from offset:',
			currentOffset,
			'current items:',
			mediaItems.length
		);
		await fetchMediaData(currentOffset, true);
	}

	function getMediaUrl(attachment: PostAttachment): string {
		if (!attachment.file_path || !attachment.id) {
			console.warn('Invalid attachment data:', attachment);
			return '';
		}
		return `${$pocketbaseUrl}/api/files/posts_attachments/${attachment.id}/${attachment.file_path}`;
	}

	function isVideo(attachment: PostAttachment): boolean {
		return attachment.file_type === 'video' || attachment.mime_type?.startsWith('video/');
	}

	function isImage(attachment: PostAttachment): boolean {
		return attachment.file_type === 'image' || attachment.mime_type?.startsWith('image/');
	}

	function openMediaModal(attachment: PostAttachment) {
		// Navigate to the post page using the existing post field
		const postId = attachment.post;
		if (postId) {
			goto(`/${username}/posts/${postId}`);
		} else {
			console.warn('No post ID found for attachment:', attachment);
		}
	}

	onMount(() => {
		console.log('🔄 MediaGrid mounted - setting up...');

		// Don't auto-load, wait for isActive
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

	// Update setupInfiniteScroll to match home page pattern
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
			hasMore: () => hasMore && !loading, // Similar to effectiveHasMore
			isLoading: () => loadingMore || loading,
			triggerId: 'media-loading-trigger',
			debug: true
		});

		infiniteScrollManager.setup();
		return infiniteScrollManager;
	}

	// Update the reactive statement to trigger infinite scroll setup
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

	// Handle tab changes - disable/enable infinite scroll
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

	// Setup infinite scroll after data loads or when state changes
	$: {
		console.log('🔍 Reactive check values:', {
			username: !!username,
			browser,
			isActive,
			mediaItemsLength: mediaItems.length,
			loading
		});

		if (username && browser && isActive && mediaItems.length === 0) {
			// Remove && !loading
			console.log('🔄 Loading media for first time:', username);
			fetchMediaData();
		}
	}

	onDestroy(() => {
		if (infiniteScrollManager) {
			infiniteScrollManager.destroy();
		}
	});

	// $: if (username && browser && isActive) { // ADD && isActive
	//     console.log('🔄 Username changed, fetching media for:', username);
	//     // Reset infinite scroll when username changes
	//     if (infiniteScrollManager) {
	//         infiniteScrollManager.destroy();
	//         infiniteScrollManager = null;
	//     }
	//     retryCount = 0;
	//     lastLoadTime = 0;
	//     fetchMediaData().then(() => {
	//         if (mediaItems.length > 0 && hasMore) {
	//             setTimeout(() => setupInfiniteScroll(), 100);
	//         }
	//     });
	// }
	// $: if (isActive && username && browser && mediaItems.length === 0 && !loading) {
	//     console.log('🔥 Tab became active, loading media');
	//     fetchMediaData();
	// }
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
					on:click={() => openMediaModal(item)}
					on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openMediaModal(item)}
					role="button"
					tabindex="0"
				>
					{#if isVideo(item)}
						<div class="video-wrapper">
							<video
								src={getMediaUrl(item)}
								class="media-content"
								muted
								preload="metadata"
								on:mouseenter={(e) => e.target.play()}
								on:mouseleave={(e) => {
									e.target.pause();
									e.target.currentTime = 0;
								}}
							>
								<track kind="captions" />
							</video>
							<div class="media-overlay">
								<div class="play-icon">▶</div>
							</div>
						</div>
					{:else if isImage(item)}
						<img
							src={getMediaUrl(item)}
							alt={item.original_name || 'Media attachment'}
							class="media-content"
							loading="lazy"
							on:error={(e) => {
								console.warn('Failed to load image:', getMediaUrl(item));
								e.target.style.display = 'none';
							}}
						/>
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
						<!-- <span>Loading more media...</span> -->
					</div>
				{:else}
					<div class="loading-indicator">
						<div
							class="trigger-loader"
							in:fly={{ y: 50, duration: 300 }}
							out:fly={{ y: -50, duration: 200 }}
						></div>
						<!-- <span>Scroll for more...</span> -->
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
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.media-section {
		padding: 0;
		width: 100%;
	}

	.loading-container {
		display: flex;
		justify-content: center;
		padding: 40px 20px;
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

	.retry-btn {
		background: var(--color-primary);
		color: white;
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
	}

	.video-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
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

	.play-icon {
		color: white;
		font-size: 24px;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
	}

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

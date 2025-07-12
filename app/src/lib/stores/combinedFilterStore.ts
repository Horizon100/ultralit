// src/lib/stores/combinedFilterStore.ts
import { derived } from 'svelte/store';
import { filteredPosts } from './tagFilterStore';
import { attachmentFilteredPosts, selectedAttachmentFilter } from './attachmentFilterStore';
import { selectedTags } from './tagFilterStore';
import type { PostWithInteractions } from '$lib/types/types.posts';
import type { AttachmentFilterType } from './attachmentFilterStore';

// Helper function to determine attachment types (same as in attachmentFilterStore)
function getAttachmentTypes(post: PostWithInteractions): Set<string> {
	const types = new Set<string>();

	if (post.attachments && post.attachments.length > 0) {
		post.attachments.forEach((attachment) => {
			// Use the file_type field directly from your PostAttachment interface
			const fileType = attachment.file_type;

			if (fileType) {
				switch (fileType) {
					case 'image':
						types.add('image');
						break;
					case 'video':
						types.add('video');
						break;
					case 'audio':
						types.add('audio');
						break;
					case 'document':
					case 'spreadsheet':
					case 'presentation':
					case 'ebook':
					case 'code':
						types.add('document');
						break;
					case 'archive':
						types.add('document'); // Treat archives as documents
						break;
					default:
						// Fallback to mime_type if file_type is not recognized
						const mimeType = attachment.mime_type;
						if (mimeType) {
							if (mimeType.startsWith('image/')) {
								types.add('image');
							} else if (mimeType.startsWith('video/')) {
								types.add('video');
							} else if (mimeType.startsWith('audio/')) {
								types.add('audio');
							} else {
								types.add('document');
							}
						}
						break;
				}
			}
		});
	}

	return types;
}

function filterPostsByAttachmentType(
	posts: PostWithInteractions[],
	filterType: AttachmentFilterType
): PostWithInteractions[] {
	console.log('🔍 Filtering posts by attachment type:', filterType);

	switch (filterType) {
		case 'all':
			return posts;

		case 'posts-only':
			return posts.filter((post) => !post.attachments || post.attachments.length === 0);

		case 'with-images':
			return posts.filter((post) => {
				const types = getAttachmentTypes(post);
				return types.has('image');
			});

		case 'with-documents':
			return posts.filter((post) => {
				const types = getAttachmentTypes(post);
				return types.has('document');
			});

		case 'with-videos':
			return posts.filter((post) => {
				const types = getAttachmentTypes(post);
				return types.has('video');
			});

		case 'with-audio':
			return posts.filter((post) => {
				const types = getAttachmentTypes(post);
				return types.has('audio');
			});

		default:
			return posts;
	}
}

// Combined filtered posts - applies both tag and attachment filters
export const combinedFilteredPosts = derived(
	[filteredPosts, selectedAttachmentFilter],
	([$filteredPosts, $selectedAttachmentFilter]) => {
		console.log('🔄 combinedFilteredPosts derived store update:', {
			tagFilteredCount: $filteredPosts.length,
			attachmentFilter: $selectedAttachmentFilter
		});

		// Apply attachment filter to the already tag-filtered posts
		const finalFiltered = filterPostsByAttachmentType($filteredPosts, $selectedAttachmentFilter);

		console.log('🔄 Combined filtering result:', {
			tagFilteredCount: $filteredPosts.length,
			finalFilteredCount: finalFiltered.length,
			attachmentFilter: $selectedAttachmentFilter
		});

		return finalFiltered;
	}
);

// Derived store for filter status
export const filterStatus = derived(
	[selectedTags, selectedAttachmentFilter],
	([$selectedTags, $selectedAttachmentFilter]) => {
		const hasTagFilter = $selectedTags.length > 0;
		const hasAttachmentFilter = $selectedAttachmentFilter !== 'all';

		return {
			hasTagFilter,
			hasAttachmentFilter,
			hasAnyFilter: hasTagFilter || hasAttachmentFilter,
			activeFilters: {
				tags: $selectedTags,
				attachment: $selectedAttachmentFilter
			}
		};
	}
);

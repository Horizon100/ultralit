// src/lib/stores/attachmentFilterStore.ts
import { writable, derived, get } from 'svelte/store';
import { postStore } from './postStore';
import type { PostWithInteractions } from '$lib/types/types.posts';

export type AttachmentFilterType =
	| 'all'
	| 'posts-only'
	| 'with-images'
	| 'with-documents'
	| 'with-videos'
	| 'with-audio';

export interface AttachmentFilterOption {
	id: AttachmentFilterType;
	label: string;
	icon: string;
	description: string;
}

// Available filter options
export const attachmentFilterOptions: AttachmentFilterOption[] = [
	{
		id: 'all',
		label: 'All Posts',
		icon: 'MessageSquare',
		description: 'Show all posts'
	},
	{
		id: 'posts-only',
		label: 'Posts Only',
		icon: 'Type',
		description: 'Posts without attachments'
	},
	{
		id: 'with-images',
		label: 'With Images',
		icon: 'Image',
		description: 'Posts with image attachments'
	},
	{
		id: 'with-documents',
		label: 'With Documents',
		icon: 'FileText',
		description: 'Posts with document attachments'
	},
	{
		id: 'with-videos',
		label: 'With Videos',
		icon: 'Video',
		description: 'Posts with video attachments'
	},
	{
		id: 'with-audio',
		label: 'With Audio',
		icon: 'Volume2',
		description: 'Posts with audio attachments'
	}
];

// Create the store
export const selectedAttachmentFilter = writable<AttachmentFilterType>('all');

// Helper function to determine attachment types
function getAttachmentTypes(post: PostWithInteractions): Set<string> {
	const types = new Set<string>();

	if (post.attachments && post.attachments.length > 0) {
		post.attachments.forEach((attachment) => {
			const fileType = attachment.file_type || attachment.mime_type;
			if (fileType) {
				if (fileType.startsWith('image')) {
					types.add('image');
				} else if (fileType.startsWith('video')) {
					types.add('video');
				} else if (fileType.startsWith('audio')) {
					types.add('audio');
				} else if (
					fileType.includes('pdf') ||
					fileType.includes('document') ||
					fileType.includes('text') ||
					fileType.includes('spreadsheet') ||
					fileType.includes('presentation') ||
					fileType.includes('word') ||
					fileType.includes('excel') ||
					fileType.includes('powerpoint')
				) {
					types.add('document');
				} else {
					types.add('document'); // Default unknown types to document
				}
			}
		});
	}

	return types;
}

// Filter posts based on attachment type
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

// Store functions
export const attachmentFilterStore = {
	// Set the filter type
	setFilter: (filterType: AttachmentFilterType) => {
		console.log('📎 Setting attachment filter to:', filterType);
		selectedAttachmentFilter.set(filterType);
	},

	// Reset to show all
	resetFilter: () => {
		console.log('📎 Resetting attachment filter');
		selectedAttachmentFilter.set('all');
	},

	// Get filter counts for each type
	getFilterCounts: (posts: PostWithInteractions[]) => {
		const counts: Record<AttachmentFilterType, number> = {
			all: posts.length,
			'posts-only': 0,
			'with-images': 0,
			'with-documents': 0,
			'with-videos': 0,
			'with-audio': 0
		};

		posts.forEach((post) => {
			if (!post.attachments || post.attachments.length === 0) {
				counts['posts-only']++;
			} else {
				const types = getAttachmentTypes(post);
				if (types.has('image')) counts['with-images']++;
				if (types.has('document')) counts['with-documents']++;
				if (types.has('video')) counts['with-videos']++;
				if (types.has('audio')) counts['with-audio']++;
			}
		});

		return counts;
	}
};

// Derived store for posts filtered by attachments
export const attachmentFilteredPosts = derived(
	[postStore, selectedAttachmentFilter],
	([$postStore, $selectedAttachmentFilter]) => {
		console.log('📎 attachmentFilteredPosts derived store update:', {
			totalPosts: $postStore.posts.length,
			selectedFilter: $selectedAttachmentFilter
		});

		const filtered = filterPostsByAttachmentType($postStore.posts, $selectedAttachmentFilter);

		console.log('📎 Attachment filtering result:', {
			originalCount: $postStore.posts.length,
			filteredCount: filtered.length,
			filterType: $selectedAttachmentFilter
		});

		return filtered;
	}
);

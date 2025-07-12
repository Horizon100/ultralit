// src/lib/stores/tagFilterStore.ts
import { writable, derived, get } from 'svelte/store';
import { postStore } from './postStore';

export interface TagCount {
	name: string;
	count: number;
	selected: boolean;
}

// Create the stores
export const selectedTags = writable<string[]>([]);
export const tagCounts = writable<TagCount[]>([]);

// Create the store functions
export const tagFilterStore = {
	// Toggle a tag selection
	toggleTag: (tagName: string) => {
		selectedTags.update((tags) => {
			if (tags.includes(tagName)) {
				return tags.filter((t) => t !== tagName);
			} else {
				return [...tags, tagName];
			}
		});
	},

	// Clear all selected tags
	clearTags: () => {
		selectedTags.set([]);
	},

	// Get all tags from posts and count them
	updateTagCounts: () => {
		const posts = get(postStore).posts;
		console.log('🏷️ updateTagCounts called with posts:', posts.length);

		if (!posts || posts.length === 0) {
			console.log('🏷️ No posts available for tag counting');
			tagCounts.set([]);
			return;
		}

		const tagCountMap = new Map<string, number>();

		// Count all tags across all posts
		posts.forEach((post, index) => {
			// console.log(`🏷️ Processing post ${index + 1}:`, {
			// 	id: post.id,
			// 	tags: post.tags,
			// 	tagCount: post.tagCount,
			// 	tagsType: typeof post.tags,
			// 	tagsIsArray: Array.isArray(post.tags)
			// });

			if (post.tags && Array.isArray(post.tags)) {
				post.tags.forEach((tag, tagIndex) => {
					// console.log(`🏷️ Processing tag ${tagIndex + 1} from post ${post.id}:`, {
					// 	tag,
					// 	tagType: typeof tag,
					// 	tagValue: tag
					// });

					if (typeof tag === 'string' && tag.trim()) {
						const normalizedTag = tag.trim().toLowerCase();
						const currentCount = tagCountMap.get(normalizedTag) || 0;
						tagCountMap.set(normalizedTag, currentCount + 1);
						// console.log(`🏷️ Added tag "${normalizedTag}", count: ${currentCount + 1}`);
					} else if (typeof tag === 'object' && tag !== null) {
						// Handle case where tag might be an object with name property
						const tagName = tag.name || tag.title || tag.label;
						if (tagName && typeof tagName === 'string' && tagName.trim()) {
							const normalizedTag = tagName.trim().toLowerCase();
							const currentCount = tagCountMap.get(normalizedTag) || 0;
							tagCountMap.set(normalizedTag, currentCount + 1);
							// console.log(`🏷️ Added object tag "${normalizedTag}", count: ${currentCount + 1}`);
						}
					}
				});
			} else {
				console.log(`🏷️ Post ${post.id} has no valid tags:`, post.tags);
			}
		});

		console.log('🏷️ Final tag count map:', Object.fromEntries(tagCountMap));

		// Convert to sorted array
		const sortedTags = Array.from(tagCountMap.entries())
			.map(([name, count]) => ({ name, count, selected: false }))
			.sort((a, b) => b.count - a.count);

		console.log('🏷️ Sorted tags:', sortedTags);
		tagCounts.set(sortedTags);
	}
};

// Derived store for filtered posts
export const filteredPosts = derived([postStore, selectedTags], ([$postStore, $selectedTags]) => {
	console.log('🏷️ filteredPosts derived store update:', {
		totalPosts: $postStore.posts.length,
		selectedTags: $selectedTags,
		selectedTagsLength: $selectedTags.length
	});

	// If no tags selected, return all posts
	if (!$selectedTags || $selectedTags.length === 0) {
		console.log('🏷️ No tags selected, returning all posts');
		return $postStore.posts;
	}

	console.log('🏷️ Filtering posts with selected tags:', $selectedTags);

	const filtered = $postStore.posts.filter((post) => {
		console.log(`🏷️ Checking post ${post.id}:`, {
			postTags: post.tags,
			postTagsLength: post.tags?.length || 0,
			postTagsType: typeof post.tags,
			postTagsIsArray: Array.isArray(post.tags)
		});

		if (!post.tags || !Array.isArray(post.tags) || post.tags.length === 0) {
			console.log(`🏷️ Post ${post.id} has no tags, excluding`);
			return false;
		}

		// Check if post has ANY of the selected tags
		const hasMatchingTag = $selectedTags.some((selectedTag) => {
			const tagMatch = post.tags.some((postTag) => {
				// Handle both string tags and object tags
				let tagName = '';
				if (typeof postTag === 'string') {
					tagName = postTag.trim().toLowerCase();
				} else if (typeof postTag === 'object' && postTag !== null) {
					tagName = (postTag.name || postTag.title || postTag.label || '').trim().toLowerCase();
				}

				const selectedTagLower = selectedTag.trim().toLowerCase();
				const matches = tagName === selectedTagLower;

				if (matches) {
					console.log(`🏷️ Post ${post.id} matches tag "${selectedTag}" (postTag: "${tagName}")`);
				}

				return matches;
			});

			return tagMatch;
		});

		console.log(`🏷️ Post ${post.id} hasMatchingTag: ${hasMatchingTag}`);
		return hasMatchingTag;
	});

	console.log('🏷️ Filtered posts result:', {
		originalCount: $postStore.posts.length,
		filteredCount: filtered.length,
		filteredPostIds: filtered.map((p) => p.id)
	});

	return filtered;
});

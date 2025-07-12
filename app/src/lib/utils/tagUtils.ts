// src/lib/utils/tagUtils.ts

/**
 * Generate different colors for different tag types
 */
export function getTagTypeColor(tagType: 'post' | 'attachment' | 'image' | 'text'): string {
	const colors = {
		post: 'var(--color-primary)',
		attachment: 'var(--color-secondary)',
		image: 'var(--color-accent)',
		text: 'var(--color-success)'
	};

	return colors[tagType] || colors.post;
}

/**
 * Get icon for tag type
 */
export function getTagTypeIcon(tagType: 'post' | 'attachment' | 'image' | 'text'): string {
	const icons = {
		post: 'FileText',
		attachment: 'Paperclip',
		image: 'Image',
		text: 'Type'
	};

	return icons[tagType] || icons.post;
}

/**
 * Format tag for display
 */
export function formatTagForDisplay(tag: string, tagType: 'post' | 'attachment'): string {
	// Post tags get # prefix, attachment tags don't
	return tagType === 'post' ? `#${tag}` : tag;
}

/**
 * Generate search URL for different tag types
 */
export function getTagSearchUrl(
	tag: string,
	tagType: 'post' | 'attachment',
	attachmentId?: string
): string {
	const params = new URLSearchParams();

	if (tagType === 'post') {
		params.set('tag', tag);
	} else {
		params.set('attachment_tag', tag);
		if (attachmentId) {
			params.set('attachment_id', attachmentId);
		}
	}

	return `/search?${params.toString()}`;
}

/**
 * Determine tag type based on source
 */
export function determineTagType(
	source?: 'text' | 'image' | 'mixed'
): 'image' | 'text' | 'attachment' {
	if (source === 'image') return 'image';
	if (source === 'text') return 'text';
	return 'attachment'; // fallback for mixed or undefined
}

/**
 * Get CSS class for tag styling
 */
export function getTagCSSClass(tagType: 'post' | 'attachment' | 'image' | 'text'): string {
	return `tag-chip tag-${tagType}`;
}

/**
 * Group attachment tags by type
 */
export interface GroupedAttachmentTags {
	attachmentId: string;
	fileName: string;
	analysis?: string;
	imageTags: string[];
	textTags: string[];
	mixedTags: string[];
}

export function groupAttachmentTagsByType(
	attachmentTags: Array<{
		attachmentId: string;
		tags: Array<{ name: string; source: 'text' | 'image' | 'mixed' }>;
		fileName: string;
		analysis?: string;
	}>
): GroupedAttachmentTags[] {
	return attachmentTags.map((attachment) => {
		const grouped: GroupedAttachmentTags = {
			attachmentId: attachment.attachmentId,
			fileName: attachment.fileName,
			analysis: attachment.analysis,
			imageTags: [],
			textTags: [],
			mixedTags: []
		};

		attachment.tags.forEach((tag) => {
			switch (tag.source) {
				case 'image':
					grouped.imageTags.push(tag.name);
					break;
				case 'text':
					grouped.textTags.push(tag.name);
					break;
				case 'mixed':
				default:
					grouped.mixedTags.push(tag.name);
					break;
			}
		});

		return grouped;
	});
}

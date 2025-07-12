// src/lib/features/posts/utils/postTagging.ts - Clean simplified version

import { ensureAuthenticated } from '$lib/pocketbase';
import { clientTryCatch } from '$lib/utils/errorUtils';
import { extractTextFromFiles } from '$lib/utils/textExtraction';

export interface GeneratedTag {
	name: string;
	relevanceScore: number;
}

export interface PostTaggingResult {
	tags: GeneratedTag[];
	postId: string;
	success: boolean;
	tagIds: string[];
}

export interface LocalTaggingOptions {
	model?: string;
	maxTags?: number;
	temperature?: number;
	includeAttachments?: boolean;
	ocrLanguage?: string;
	ocrEngine?: 'tesseract' | 'easyocr';
}

/**
 * Check if content meets minimum requirements for AI tagging
 */
export function shouldGenerateTags(content: string): boolean {
	if (!content || typeof content !== 'string') {
		console.log('No content provided for tagging');
		return false;
	}

	const cleanContent = content.trim();

	if (cleanContent.length < 12) {
		console.log('Content too short for tagging:', cleanContent.length, 'characters');
		return false;
	}

	const wordCount = cleanContent.split(/\s+/).filter((word) => word.length > 0).length;
	if (wordCount < 2) {
		console.log('Content has insufficient words for tagging:', wordCount, 'words');
		return false;
	}

	return true;
}

export async function generatePostTagsLocalNEW(
	content: string,
	attachments: File[] = [],
	options: LocalTaggingOptions = {}
): Promise<GeneratedTag[]> {
	console.log('🏷️ *** NEW CLEAN VERSION CALLED ***');

	try {
		const {
			model = 'qwen2.5:0.5b',
			maxTags = 5,
			temperature = 0.3,
			includeAttachments = true,
			ocrLanguage = 'eng+fin+rus',
			ocrEngine = 'tesseract'
		} = options;

		let attachmentTexts: string[] = [];

		if (includeAttachments && attachments.length > 0) {
			try {
				attachmentTexts = await extractTextFromFiles(attachments, {
					language: ocrLanguage,
					maxLength: 1000,
					ocrEngine
				});
			} catch (extractionError) {
				console.error('🏷️ Failed to extract text from attachments:', extractionError);
			}
		}

		console.log('🏷️ About to call tagging API...');
		const response = await clientTryCatch(
			fetch('/api/ai/local/tagging', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content,
					attachmentTexts,
					model,
					maxTags,
					temperature
				})
			}).then((r) => r.json()),
			'Failed to generate tags with local AI'
		);

		console.log('🏷️ Got response from tagging API:', response);

		// Fix: Handle the double nesting from apiTryCatch
		if (!response.success || !response.data?.data?.tags) {
			console.error('🏷️ Invalid response structure:', response);
			return [];
		}

		// Access the tags from the nested structure
		const tagsData = response.data.data; // Get the inner data object
		console.log('🏷️ Tags data:', tagsData);

		const tags = tagsData.tags.map((tagName: string, index: number) => ({
			name: tagName.trim(),
			relevanceScore: 1.0 - index * 0.1
		}));

		console.log('🏷️ Returning processed tags:', tags);
		return tags;
	} catch (error) {
		console.error('🏷️ Error generating tags:', error);
		return [];
	}
}

/**
 * Simple post tagging - no Tag collection, just post.tags array
 */
export async function handlePostTagging(
	content: string,
	postId: string,
	userId: string,
	attachments: File[] = [],
	options: LocalTaggingOptions = {}
): Promise<PostTaggingResult> {
	try {
		console.log('🏷️ Starting simple post tagging...');
		ensureAuthenticated();

		if (!shouldGenerateTags(content)) {
			return { tags: [], postId, success: false, tagIds: [] };
		}

		const generatedTags = await generatePostTagsLocalNEW(content, attachments, options);

		if (generatedTags.length === 0) {
			return { tags: [], postId, success: false, tagIds: [] };
		}

		const tagNames = generatedTags.map((tag) => tag.name);

		const updateResult = await clientTryCatch(
			fetch(`/api/posts/${postId}/tags`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tags: tagNames, tagCount: tagNames.length })
			}).then((r) => r.json()),
			'Failed to update post tags'
		);

		if (!updateResult.success) {
			return { tags: generatedTags, postId, success: false, tagIds: [] };
		}

		return { tags: generatedTags, postId, success: true, tagIds: tagNames };
	} catch (error) {
		console.error('❌ Error in post tagging:', error);
		return { tags: [], postId, success: false, tagIds: [] };
	}
}

/**
 * Background tagging
 */
export async function processPostTaggingAsync(
	content: string,
	postId: string,
	userId: string,
	attachments: File[] = [],
	options: LocalTaggingOptions = {}
): Promise<void> {
	setTimeout(async () => {
		try {
			const result = await handlePostTagging(content, postId, userId, attachments, options);
			console.log(result.success ? '✅ Tagging completed' : '❌ Tagging failed');
		} catch (error) {
			console.error('❌ Background tagging error:', error);
		}
	}, 1000);
}

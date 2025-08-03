import { ensureAuthenticated } from '$lib/pocketbase';
import { clientTryCatch } from '$lib/utils/errorUtils';
import { extractTextFromFiles } from '$lib/utils/textExtraction';
import { pocketbaseUrl } from '$lib/stores/pocketbase';
import { get } from 'svelte/store';

export interface AttachmentGeneratedTag {
	name: string;
	relevanceScore: number;
	source: 'text' | 'image' | 'mixed' | 'pdf';
}
export interface PocketBaseAttachment {
	id: string;
	file_path: string;
	original_name?: string;
	mime_type?: string;
	size?: number;
	[key: string]: unknown;
}
export interface AttachmentTaggingResult {
	tags: AttachmentGeneratedTag[];
	attachmentId: string;
	success: boolean;
	tagIds: string[];
	analysis?: string;
}
type AttachmentInput = File | PocketBaseAttachment;

export interface AttachmentTaggingOptions {
	model?: string;
	maxTags?: number;
	temperature?: number;
	ocrLanguage?: string;
	ocrEngine?: 'tesseract' | 'easyocr';
	imageDescriptionModel?: string;
	includeImageAnalysis?: boolean;
}

function cleanTagName(tagName: string): string {
	return (
		tagName
			.trim()
			.toLowerCase()
			// Remove any prefixes
			.replace(/^(tag|tags?):\s*/i, '')
			.replace(/^(label|labels?):\s*/i, '')
			// Remove leading punctuation and numbers
			.replace(/^[-•·\-—–\d+.)\]\s]+/, '')
			// Remove quotes and brackets
			.replace(/['""[\]{}]/g, '')
			// Take only the first word if multiple words with separators
			.split(/[,:;]+/)[0]
			// Take only first word if space-separated and it's clearly multiple concepts
			.split(/\s+/)[0]
			// Normalize spaces
			.replace(/\s+/g, ' ')
			.trim()
			// Hard limit
			.substring(0, 15)
			// Remove common stop words that might appear
			.replace(/^(the|and|or|of|in|on|at)$/i, '')
	);
}

/**
 * Get image URL for attachment using PocketBase file API
 */
export function getAttachmentImageUrl(attachment: PocketBaseAttachment): string {
	const baseUrl = get(pocketbaseUrl);

	console.log('🔍 Building attachment URL:', {
		baseUrl,
		attachmentId: attachment?.id,
		filePath: attachment?.file_path,
		attachment
	});

	if (!attachment?.id || !attachment?.file_path) {
		console.error('❌ Missing attachment data:', {
			id: attachment?.id,
			file_path: attachment?.file_path
		});
		throw new Error('Invalid attachment: missing id or file_path');
	}

	const url = `${baseUrl}/api/files/7xg05m7gr933ygt/${attachment.id}/${attachment.file_path}`;
	console.log('🔍 Generated URL:', url);

	return url;
}

/**
 * Check if attachment is a PDF
 */
export function isPdfFile(file: AttachmentInput): boolean {
	if (file instanceof File) {
		return file.type === 'application/pdf';
	}
	return file.mime_type === 'application/pdf';
}

/**
 * Check if attachment is suitable for text extraction
 */
export function supportsTextExtraction(file: AttachmentInput): boolean {
	const type = file instanceof File ? file.type : file.mime_type;
	if (!type) return false;
	return type.startsWith('image/') || type === 'application/pdf' || type.startsWith('text/');
}

/**
 * Check if attachment is an image that can be analyzed
 */
export function supportsImageAnalysis(file: AttachmentInput): boolean {
	const type = file instanceof File ? file.type : file.mime_type;
	if (!type) return false;
	return type.startsWith('image/');
}

/**
 * Extract keywords from PDF using your existing PDF infrastructure
 */
async function extractPdfKeywords(
	pdfFile: File,
	options: AttachmentTaggingOptions = {}
): Promise<{ tags: AttachmentGeneratedTag[]; analysis?: string }> {
	console.log('📄 Extracting PDF keywords for:', pdfFile.name);

	try {
		// Import the updated PDF keyword extractor
		const { extractPdfKeywords: extractKeywords } = await import('$lib/utils/pdfKeywordExtractor');

		// Use the improved PDF keyword extraction
		const result = await extractKeywords(pdfFile, {
			maxKeywords: options.maxTags || 8,
			mode: 'fast'
		});

		if (!result.success || result.keywords.length === 0) {
			console.log('📄 No keywords extracted from PDF:', result.error);
			return { tags: [] };
		}

		const tags: AttachmentGeneratedTag[] = result.keywords
			.map((keyword: string, index: number) => ({
				name: cleanTagName(keyword),
				relevanceScore: 1.0 - index * 0.1,
				source: 'pdf' as const
			}))
			.filter((tag) => tag.name.length >= 2);

		console.log(
			'📄 Extracted PDF tags:',
			tags.map((t) => t.name)
		);

		return {
			tags,
			analysis: result.analysis
		};
	} catch (error) {
		console.error('❌ PDF keyword extraction failed:', error);
		return { tags: [] };
	}
}

/**
 * Get optimized tags prompt for different content types
 */
function getTagsPrompt(
	maxTags: number = 5,
	contentType: 'text' | 'image' | 'mixed' = 'mixed'
): string {
	const basePrompt = `
- Generate ${maxTags} or fewer highly relevant tags
- Each tag should be 1-3 words maximum
- Use lowercase format (e.g., "machine learning", "productivity", "design")
- Focus on main topics, themes, technologies, or categories
- Avoid generic tags like "post" or "content"
- Consider both explicit topics and implicit themes
- Return only the tag names, one per line
- No numbering, bullets, or additional formatting
- No explanations or commentary`;

	if (contentType === 'image') {
		return `${basePrompt}

Focus on:
- Objects, people, animals, or things visible
- Activities or actions happening
- Setting, location, or environment
- Colors, style, or mood if significant
- Concepts or themes represented`;
	}

	if (contentType === 'text') {
		return `${basePrompt}

Focus on:
- Main topics and subjects
- Key concepts or themes
- Technologies, tools, or methods mentioned
- Categories or domains
- Important keywords`;
	}

	return basePrompt; // mixed content
}

/**
 * Generate image description using moondream model
 */
async function generateImageDescription(imageUrl: string): Promise<string> {
	console.log('🖼️ Generating image description with moondream...');

	const descriptionRequest = {
		model: 'moondream:latest',
		prompt:
			'Describe this image in detail, focusing on the main subjects, objects, activities, setting, and any notable features or context.',
		image_url: imageUrl,
		is_image_analysis: true,
		auto_optimize: false,
		temperature: 0.7,
		max_tokens: 300
	};

	const result = await clientTryCatch(
		fetch('/api/ai/local/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(descriptionRequest)
		}).then((r) => r.json()),
		'Failed to generate image description'
	);

	if (!result.success || !result.data?.data?.response) {
		throw new Error('Failed to generate image description');
	}

	return result.data.data.response.trim();
}
/**
 * Generate image description from URL or File object
 */
async function generateImageDescriptionFromUrl(
	imageUrl: string,
	model: string = 'moondream:latest'
): Promise<string> {
	console.log('🖼️ Generating image description with moondream from URL...');

	// Check if this is a blob URL (from File object)
	if (imageUrl.startsWith('blob:')) {
		console.log('🖼️ Blob URL detected, converting to base64 for server...');

		try {
			// Fetch the blob data
			const response = await fetch(imageUrl);
			const blob = await response.blob();

			// Convert to base64
			const base64 = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => {
					const result = reader.result as string;
					// Remove the data URL prefix to get just base64
					const base64Data = result.split(',')[1];
					resolve(base64Data);
				};
				reader.onerror = reject;
				reader.readAsDataURL(blob);
			});

			// Send base64 data with a special flag
			const descriptionRequest = {
				model,
				prompt:
					'Describe this image in detail, focusing on the main subjects, objects, activities, setting, and any notable features or context.',
				image_base64: base64,
				is_image_analysis: true,
				auto_optimize: false,
				temperature: 0.7,
				max_tokens: 300
			};

			const result = await clientTryCatch(
				fetch('/api/ai/local/generate', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(descriptionRequest)
				}).then((r) => r.json()),
				'Failed to generate image description'
			);

			if (!result.success || !result.data?.data?.response) {
				throw new Error('Failed to generate image description');
			}

			return result.data.data.response.trim();
		} catch (error) {
			console.error('🖼️ Failed to process blob URL:', error);
			throw new Error('Failed to process image blob');
		}
	}

	// For regular URLs (PocketBase attachments), use the existing flow
	const descriptionRequest = {
		model,
		prompt:
			'Describe this image in detail, focusing on the main subjects, objects, activities, setting, and any notable features or context.',
		image_url: imageUrl,
		is_image_analysis: true,
		auto_optimize: false,
		temperature: 0.7,
		max_tokens: 300
	};

	const result = await clientTryCatch(
		fetch('/api/ai/local/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(descriptionRequest)
		}).then((r) => r.json()),
		'Failed to generate image description'
	);

	if (!result.success || !result.data?.data?.response) {
		throw new Error('Failed to generate image description');
	}

	return result.data.data.response.trim();
}

/**
 * Generate tags from image description
 */
async function generateTagsFromDescription(
	description: string,
	model: string,
	maxTags: number,
	temperature: number
): Promise<AttachmentGeneratedTag[]> {
	// Use a very strict prompt
	const strictPrompt = `Based on this image description, list ${maxTags} single words only:

Image: "${description}"

Reply with ONLY single words, one per line. No commas, no colons, no "tag:" prefix.
Example:
house
blue
garden
tools`;

	const tagsRequest = {
		model,
		prompt: strictPrompt,
		auto_optimize: false, // Disable auto-optimize to keep strict control
		temperature: 0.1, // Very low temperature for consistency
		max_tokens: 50 // Very short to force brief responses
	};

	const tagsResult = await clientTryCatch(
		fetch('/api/ai/local/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(tagsRequest)
		}).then((r) => r.json()),
		'Failed to generate tags from image description'
	);

	if (!tagsResult.success || !tagsResult.data?.data?.response) {
		throw new Error('Failed to generate tags from image description');
	}

	// Aggressive parsing to extract individual tags
	const response = tagsResult.data.data.response.trim();

	// First try line-by-line parsing
	let tagLines = response
		.split('\n')
		.map((line: string) => line.trim())
		.filter((line: string) => line.length > 0);

	// If we only got one line with commas, split by commas
	if (tagLines.length === 1 && tagLines[0].includes(',')) {
		tagLines = tagLines[0]
			.split(',')
			.map((tag: string) => tag.trim())
			.filter((tag: string) => tag.length > 0);
	}

	// Clean each tag aggressively
	const cleanedTags = tagLines
		.map((line: string) => {
			// Remove prefixes like "tag:", "tags:", etc.
			let cleaned = line.replace(/^(tag|tags?):\s*/i, '');
			// Remove everything after first comma or colon
			cleaned = cleaned.split(/[,:;]/)[0];
			// Clean the tag name
			return cleanTagName(cleaned);
		})
		.filter((tag: string) => tag.length >= 2 && tag.length <= 15)
		.filter((tag: string) => !['tag', 'tags', 'construction', 'activity'].includes(tag)) // Remove meta words
		.slice(0, maxTags);

	console.log('🏷️ AI response:', response);
	console.log('🏷️ Cleaned tags:', cleanedTags);

	return cleanedTags.map((tagName: string, index: number) => ({
		name: tagName,
		relevanceScore: 1.0 - index * 0.1,
		source: 'image'
	}));
}

/**
 * Generate fallback tags for images when AI analysis fails
 */
function generateFallbackImageTags(file: File, maxTags: number): AttachmentGeneratedTag[] {
	const tags: AttachmentGeneratedTag[] = [];

	// Add tag based on image type
	const imageType = file.type.split('/')[1];
	if (imageType) {
		tags.push({
			name: imageType,
			relevanceScore: 0.8,
			source: 'image'
		});
	}

	// Extract tags from filename
	const filename = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
	const filenameParts = filename
		.split(/[-_\s]+/)
		.map((part) => part.trim().toLowerCase())
		.filter((part) => part.length > 2);

	filenameParts.forEach((part, index) => {
		if (tags.length < maxTags) {
			tags.push({
				name: cleanTagName(part),
				relevanceScore: 0.6 - index * 0.1,
				source: 'image'
			});
		}
	});

	// Add general image tag if we don't have enough
	if (tags.length === 0) {
		tags.push({
			name: 'image',
			relevanceScore: 0.5,
			source: 'image'
		});
	}

	return tags.filter((tag) => tag.name.length >= 2).slice(0, maxTags);
}
/**
 * Generate tags for image content using two-step process
 */
async function generateImageTags(
	attachment: AttachmentInput,
	options: AttachmentTaggingOptions = {}
): Promise<{ tags: AttachmentGeneratedTag[]; analysis: string }> {
	const {
		model = 'qwen2.5:0.5b',
		maxTags = 8,
		temperature = 0.3,
		imageDescriptionModel = 'moondream:latest'
	} = options;

	console.log('🖼️ Starting image tagging for attachment:', attachment);

	// Handle File objects (during upload)
	if (attachment instanceof File) {
		console.log('🖼️ Processing File object - creating blob URL for analysis');

		try {
			// Create a blob URL for the file
			const blobUrl = URL.createObjectURL(attachment);

			try {
				// Generate description using the blob URL
				const description = await generateImageDescriptionFromUrl(blobUrl, imageDescriptionModel);
				console.log('🖼️ Generated description from File:', description.substring(0, 100) + '...');

				// Generate tags from description
				const tags = await generateTagsFromDescription(description, model, maxTags, temperature);

				return { tags, analysis: description };
			} finally {
				// Clean up blob URL
				URL.revokeObjectURL(blobUrl);
			}
		} catch (error) {
			console.error('🖼️ Failed to process File object:', error);

			// Fallback: try to extract basic tags from filename and file properties
			const fallbackTags = generateFallbackImageTags(attachment, maxTags);
			return {
				tags: fallbackTags,
				analysis: `Fallback analysis for ${attachment.name} (${attachment.type})`
			};
		}
	}

	// Handle PocketBase attachment records (existing code)
	if (!attachment.id || !attachment.file_path) {
		console.error('❌ Invalid attachment record:', attachment);
		throw new Error('Invalid attachment: missing id or file_path');
	}

	const imageUrl = getAttachmentImageUrl(attachment);
	const description = await generateImageDescriptionFromUrl(imageUrl, imageDescriptionModel);

	console.log(
		'🖼️ Generated description from PocketBase attachment:',
		description.substring(0, 100) + '...'
	);

	const tags = await generateTagsFromDescription(description, model, maxTags, temperature);

	return { tags, analysis: description };
}

/**
 * Generate tags for text content extracted from files
 */
async function generateTextTags(
	textContent: string,
	options: AttachmentTaggingOptions = {}
): Promise<AttachmentGeneratedTag[]> {
	const { model = 'qwen2.5:0.5b', maxTags = 5, temperature = 0.3 } = options;

	console.log('📝 Generating text tags from extracted content...');

	const tagsPrompt = getTagsPrompt(maxTags, 'text');
	const tagsRequest = {
		model,
		prompt: `${tagsPrompt}\n\nText content: "${textContent}"`,
		auto_optimize: true,
		temperature,
		max_tokens: 150
	};

	const result = await clientTryCatch(
		fetch('/api/ai/local/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(tagsRequest)
		}).then((r) => r.json()),
		'Failed to generate tags from text content'
	);

	if (!result.success || !result.data?.data?.response) {
		throw new Error('Failed to generate tags from text content');
	}

	const tagLines = result.data.data.response
		.trim()
		.split('\n')
		.map((line: string) => line.trim())
		.filter((line: string) => line.length > 0)
		.slice(0, maxTags);

	return tagLines.map((tagName: string, index: number) => ({
		name: tagName.toLowerCase(),
		relevanceScore: 1.0 - index * 0.1,
		source: 'text'
	}));
}

/**
 * Generate tags for a single attachment
 */
export async function generateAttachmentTags(
	attachment: AttachmentInput,
	options: AttachmentTaggingOptions = {}
): Promise<{ tags: AttachmentGeneratedTag[]; analysis?: string }> {
	const {
		includeImageAnalysis = true,
		ocrLanguage = 'eng+fin+rus',
		ocrEngine = 'tesseract'
	} = options;

	const allTags: AttachmentGeneratedTag[] = [];
	let analysis: string | undefined;

	// Handle PDF files specifically
	if (isPdfFile(attachment)) {
		try {
			console.log('📄 Processing PDF file for keyword extraction');

			if (attachment instanceof File) {
				// For File objects, use direct extraction
				const pdfResult = await extractPdfKeywords(attachment, options);
				allTags.push(...pdfResult.tags);
				analysis = pdfResult.analysis;
				console.log('📄 Generated PDF tags from File:', pdfResult.tags.length);
			} else {
				// For PocketBase attachment records, use URL-based extraction
				const { extractKeywordsFromPocketBaseAttachment } = await import(
					'$lib/utils/pdfKeywordExtractor'
				);
				const pdfResult = await extractKeywordsFromPocketBaseAttachment(attachment, {
					maxKeywords: options.maxTags || 8,
					mode: 'fast'
				});

				if (pdfResult.success) {
					const pdfTags: AttachmentGeneratedTag[] = pdfResult.keywords
						.map((keyword: string, index: number) => ({
							name: cleanTagName(keyword),
							relevanceScore: 1.0 - index * 0.1,
							source: 'pdf' as const
						}))
						.filter((tag) => tag.name.length >= 2);

					allTags.push(...pdfTags);
					analysis = pdfResult.analysis;
					console.log('📄 Generated PDF tags from PocketBase attachment:', pdfTags.length);
				}
			}
		} catch (error) {
			console.error('📄 PDF tagging failed:', error);
		}
	}

	// Handle image analysis
	if (includeImageAnalysis && supportsImageAnalysis(attachment)) {
		try {
			const imageResult = await generateImageTags(attachment, options);
			allTags.push(...imageResult.tags);
			analysis = imageResult.analysis;
			console.log('🖼️ Generated image tags:', imageResult.tags.length);
		} catch (error) {
			console.error('🖼️ Image tagging failed:', error);
		}
	}

	// Handle text extraction and tagging (for non-PDF files)
	if (supportsTextExtraction(attachment) && !isPdfFile(attachment)) {
		try {
			if (attachment instanceof File) {
				const extractedTexts = await extractTextFromFiles([attachment], {
					language: ocrLanguage,
					maxLength: 1000,
					ocrEngine
				});

				if (extractedTexts.length > 0 && extractedTexts[0].trim()) {
					const textTags = await generateTextTags(extractedTexts[0], options);
					allTags.push(...textTags);
					console.log('📝 Generated text tags:', textTags.length);
				}
			}
		} catch (error) {
			console.error('📝 Text tagging failed:', error);
		}
	}

	// Remove duplicates and merge scores for similar tags
	const uniqueTags = new Map<string, AttachmentGeneratedTag>();

	allTags.forEach((tag) => {
		const cleanedName = cleanTagName(tag.name);

		if (!cleanedName || cleanedName.length < 2) return;

		const key = cleanedName;
		if (uniqueTags.has(key)) {
			const existing = uniqueTags.get(key);
			if (existing) {
				existing.relevanceScore = Math.max(existing.relevanceScore, tag.relevanceScore);
				existing.source = existing.source !== tag.source ? ('mixed' as const) : existing.source;
			}
		} else {
			uniqueTags.set(key, {
				...tag,
				name: cleanedName
			});
		}
	});
	const finalTags = Array.from(uniqueTags.values())
		.filter((tag) => tag.name.length >= 2)
		.sort((a, b) => b.relevanceScore - a.relevanceScore)
		.slice(0, options.maxTags || 8);

	return { tags: finalTags, analysis };
}

/**
 * Update attachment with generated tags
 */
export async function handleAttachmentTagging(
	attachmentId: string,
	postId: string,
	attachment: AttachmentInput,
	options: AttachmentTaggingOptions = {}
): Promise<AttachmentTaggingResult> {
	try {
		console.log('🏷️ Starting attachment tagging for ID:', attachmentId, 'Post:', postId);
		ensureAuthenticated();

		const result = await generateAttachmentTags(attachment, options);

		if (result.tags.length === 0) {
			return { tags: [], attachmentId, success: false, tagIds: [], analysis: result.analysis };
		}

		const tagNames = result.tags.map((tag) => tag.name);

		// Update the attachment with tags using your existing endpoint structure
		const updateResult = await clientTryCatch(
			fetch(`/api/posts/${postId}/attachment?attachmentId=${attachmentId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tags: tagNames,
					tagCount: tagNames.length,
					analysis: result.analysis
				})
			}).then((r) => r.json()),
			'Failed to update attachment tags'
		);

		if (!updateResult.success) {
			return {
				tags: result.tags,
				attachmentId,
				success: false,
				tagIds: [],
				analysis: result.analysis
			};
		}

		return {
			tags: result.tags,
			attachmentId,
			success: true,
			tagIds: tagNames,
			analysis: result.analysis
		};
	} catch (error) {
		console.error('❌ Error in attachment tagging:', error);
		return { tags: [], attachmentId, success: false, tagIds: [] };
	}
}

/**
 * Process attachment tagging asynchronously for multiple attachments
 */
export async function processAttachmentTaggingAsync(
	attachments: Array<{ id: string; postId: string; attachment: AttachmentInput }>,
	options: AttachmentTaggingOptions = {}
): Promise<void> {
	setTimeout(async () => {
		try {
			console.log('🏷️ Processing', attachments.length, 'attachments for tagging...');

			const results = await Promise.allSettled(
				attachments.map(async ({ id, postId, attachment }) => {
					return handleAttachmentTagging(id, postId, attachment, options);
				})
			);

			const successful = results.filter((r) => r.status === 'fulfilled').length;
			const failed = results.filter((r) => r.status === 'rejected').length;

			console.log(`✅ Attachment tagging completed: ${successful} successful, ${failed} failed`);
		} catch (error) {
			console.error('❌ Background attachment tagging error:', error);
		}
	}, 2000);
}

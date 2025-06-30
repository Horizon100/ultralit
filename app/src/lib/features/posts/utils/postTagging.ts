// Updated postTagging.ts to use your AI infrastructure properly

import { ensureAuthenticated } from '$lib/pocketbase';
import type { AIModel, RoleType, Tag, AIMessage, ProviderType } from '$lib/types/types';
import { defaultModel } from '$lib/features/ai/utils/models';
import { postStore } from '$lib/stores/postStore';
import { fetchAIResponse } from '$lib/clients/aiClient';
import { modelStore } from '$lib/stores/modelStore';
import { apiKey } from '$lib/stores/apiKeyStore';
import { get } from 'svelte/store';
import { clientTryCatch, fetchTryCatch } from '$lib/utils/errorUtils';

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

/**
 * Check if content meets minimum requirements for AI tagging
 */
export function shouldGenerateTags(content: string): boolean {
	if (!content || typeof content !== 'string') {
		console.log('No content provided for tagging');
		return false;
	}

	const cleanContent = content.trim();

	// Minimum 12 characters requirement
	if (cleanContent.length < 12) {
		console.log('Content too short for tagging:', cleanContent.length, 'characters');
		return false;
	}

	// Minimum 2 words requirement
	const wordCount = cleanContent.split(/\s+/).filter((word) => word.length > 0).length;
	if (wordCount < 2) {
		console.log('Content has insufficient words for tagging:', wordCount, 'words');
		return false;
	}

	console.log('Content meets tagging requirements:', {
		characters: cleanContent.length,
		words: wordCount
	});
	return true;
}

/**
 * Generate AI-based tags for post content using your AI infrastructure
 */
export async function generatePostTags(
	content: string,
	model: AIModel,
	userId: string,
	maxTags: number = 5
): Promise<GeneratedTag[]> {
	try {
		console.log('🔄 Starting tag generation with AI infrastructure...');

		// Force API keys to load regardless of page
		console.log('🔑 Force loading API keys...');
		await apiKey.loadKeys(true); // Force load with true parameter
		const availableKeys = get(apiKey);
		console.log(
			'🔑 Available API key providers:',
			Object.keys(availableKeys).filter((k) => availableKeys[k])
		);

		const hasApiKeys = Object.values(availableKeys).some((key) => key && key.length > 0);
		if (!hasApiKeys) {
			console.error('❌ No API keys configured for any provider');
			console.log('💡 Configure API keys in user settings or manually set for testing:');
			console.log('apiKey.setKey("openai", "your-key-here")');
			return [];
		}

		// Use the current model or fall back to a working one
		let modelToUse = model;
		if (!model || !availableKeys[model.provider]) {
			console.log('🔄 Current model provider has no API key, finding alternative...');

			// Try to get the user's selected model from modelStore
			const modelState = get(modelStore);
			if (modelState.selectedModel && availableKeys[modelState.selectedModel.provider]) {
				modelToUse = modelState.selectedModel;
				console.log('✅ Using selected model from store:', modelToUse.name);
			} else {
				// Find any provider with an API key
				const availableProvider = Object.keys(availableKeys).find(
					(provider) => availableKeys[provider] && availableKeys[provider].length > 0
				);

				if (availableProvider) {
					// Create a simple model for this provider
					modelToUse = {
						...defaultModel,
						provider: availableProvider as ProviderType,
						api_type:
							availableProvider === 'openai'
								? 'gpt-3.5-turbo'
								: availableProvider === 'anthropic'
									? 'claude-3-haiku-20240307'
									: availableProvider === 'deepseek'
										? 'deepseek-chat'
										: 'gpt-3.5-turbo'
					};
					console.log('✅ Using fallback model for provider:', availableProvider);
				} else {
					console.error('❌ No usable providers found');
					return [];
				}
			}
		}

		console.log('🤖 Using model for tagging:', {
			name: modelToUse.name,
			provider: modelToUse.provider,
			api_type: modelToUse.api_type
		});

		const messages: AIMessage[] = [
			{
				role: 'system' as RoleType,
				content: `You are a content tagging expert. Generate relevant, concise tags for social media posts.

Rules:
- Generate ${maxTags} or fewer highly relevant tags
- Each tag should be 1-3 words maximum
- Use lowercase format (e.g., "machine learning", "productivity", "design")
- Focus on main topics, themes, technologies, or categories
- Avoid generic tags like "post" or "content"
- Consider both explicit topics and implicit themes
- Return only the tag names, one per line
- No numbering, bullets, or additional formatting
- No explanations or commentary

Examples:
For "Just deployed my new React app with TypeScript" → react, typescript, deployment, webdev
For "Beautiful sunset at the beach today" → photography, sunset, beach, nature`,
				provider: modelToUse.provider,
				model: modelToUse.api_type
			},
			{
				role: 'user' as RoleType,
				content: `Generate relevant tags for this post content:

"${content}"

Return only the tag names, one per line.`,
				provider: modelToUse.provider,
				model: modelToUse.api_type
			}
		];

		console.log('🤖 Sending tagging request to AI using fetchAIResponse');

		// Use your existing AI client
		const responseText = await fetchAIResponse(messages, modelToUse, userId);
		console.log('✅ AI response text from fetchAIResponse:', responseText);

		if (!responseText || typeof responseText !== 'string') {
			console.error('❌ No valid response text from AI client');
			return [];
		}

		// Parse AI response into tags
		const tagNames = responseText
			.split('\n')
			.map((line: string) => line.trim().toLowerCase())
			.filter((line: string) => line.length > 0)
			.filter((line: string) => !line.includes('tag') && !line.includes(':'))
			.map((line: string) => line.replace(/^[-*\d.]+\s*/, '')) // Remove any numbering
			.map((line: string) => line.replace(/['"]/g, '')) // Remove quotes
			.slice(0, maxTags);

		console.log('📝 Parsed tag names:', tagNames);

		// Create GeneratedTag objects with relevance scores
		const generatedTags: GeneratedTag[] = tagNames.map((name: string, index: number) => ({
			name: name.trim(),
			relevanceScore: 1.0 - index * 0.1 // Higher score for earlier tags
		}));

		console.log('✅ Generated tags successfully:', generatedTags);
		return generatedTags;
	} catch (error) {
		console.error('❌ Error generating tags with AI client:', error);
		return [];
	}
}

/**
 * Check if tags already exist in the database
 */
export async function checkExistingTags(
	tagNames: string[]
): Promise<{ existing: Tag[]; new: string[] }> {
	try {
		const existing: Tag[] = [];
		const newTags: string[] = [];

		// Load tags created by the current user (use createdBy filter)
		const response = await fetchTryCatch<{ success: boolean; items: Tag[] }>(
			'/api/tags?filter=createdBy',
			{ method: 'GET' }
		);

		if (!response.success) {
			console.error('Failed to fetch tags:', response.error);
			return { existing: [], new: tagNames };
		}

		const allTags = response.data.items || [];
		console.log('Loaded user tags for comparison:', allTags.length);

		// Check each tag name against existing tags (case-insensitive since API stores lowercase)
		tagNames.forEach((tagName) => {
			const normalizedTagName = tagName.toLowerCase().trim();
			const existingTag = allTags.find((tag) => tag.name.toLowerCase() === normalizedTagName);

			if (existingTag) {
				existing.push(existingTag);
				console.log(`Found existing tag: ${tagName} -> ${existingTag.id}`);
			} else {
				newTags.push(tagName);
				console.log(`New tag needed: ${tagName}`);
			}
		});

		return { existing, new: newTags };
	} catch (error) {
		console.error('Error checking existing tags:', error);
		return { existing: [], new: tagNames };
	}
}

/**
 * Create new tags in the database
 */
export async function createNewTags(tagNames: string[], userId: string): Promise<Tag[]> {
	const createdTags: Tag[] = [];

	for (const tagName of tagNames) {
		try {
			console.log(`Creating new tag: ${tagName}`);

			const response = await fetchTryCatch<{ success: boolean; data: Tag }>('/api/tags', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: tagName.trim(),
					color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`,
					tagDescription: '',
					createdBy: userId,
					selected: false,
					taggedPosts: [] // Initialize empty array
				})
			});

			if (response.success && response.data.success && response.data.data) {
				const newTag = response.data.data;
				console.log('✅ Created new tag:', newTag.name, 'with ID:', newTag.id);
				createdTags.push(newTag);
			} else if (response.success && response.data.data && response.data.data.id) {
				// Handle case where tag already exists (API returns existing tag)
				const existingTag = response.data.data;
				console.log(
					'✅ Tag already exists, using existing:',
					existingTag.name,
					'with ID:',
					existingTag.id
				);
				createdTags.push(existingTag);
			} else {
				console.error('❌ Failed to create tag:', tagName, 'Response:', response);
			}
		} catch (error) {
			console.error('❌ Error creating tag:', tagName, error);
		}
	}

	console.log(`Created ${createdTags.length} out of ${tagNames.length} requested tags`);
	return createdTags;
}

/**
 * Main function to handle post tagging workflow using your AI infrastructure
 */
export async function handlePostTagging(
	content: string,
	postId: string,
	model: AIModel,
	userId: string
): Promise<PostTaggingResult> {
	try {
		console.log('🔄 Starting handlePostTagging workflow with AI infrastructure...');
		ensureAuthenticated();

		// Check if content meets requirements
		if (!shouldGenerateTags(content)) {
			console.log('❌ Content does not meet tagging requirements');
			return {
				tags: [],
				postId,
				success: false,
				tagIds: []
			};
		}

		console.log('✅ Content meets tagging requirements, proceeding...');

		// Initialize model store to ensure we have proper model selection
		console.log('🔄 Ensuring model infrastructure is ready...');
		await modelStore.initialize(userId);

		// Generate tags using AI with your infrastructure
		console.log('🤖 Generating AI tags using your AI infrastructure...');
		const generatedTags = await generatePostTags(content, model, userId);
		console.log('🤖 AI generated tags:', generatedTags);

		if (generatedTags.length === 0) {
			console.log('❌ No tags generated by AI');
			return {
				tags: [],
				postId,
				success: false,
				tagIds: []
			};
		}

		// Extract tag names
		const tagNames = generatedTags.map((tag) => tag.name);
		console.log('📝 Tag names to process:', tagNames);

		// Check which tags already exist
		console.log('🔍 Checking for existing tags...');
		const { existing, new: newTagNames } = await checkExistingTags(tagNames);
		console.log('📊 Tag analysis:', {
			existing: existing.map((t) => t.name),
			new: newTagNames
		});

		// Create new tags if needed
		let createdTags: Tag[] = [];
		if (newTagNames.length > 0) {
			console.log('🆕 Creating new tags:', newTagNames);
			createdTags = await createNewTags(newTagNames, userId);
			console.log(
				'✅ Created tags:',
				createdTags.map((t) => t.name)
			);
		}

		// Combine existing and created tags
		const allTags = [...existing, ...createdTags];
		const tagIds = allTags.map((tag) => tag.id).filter(Boolean);
		console.log('🏷️ All tag IDs to associate:', tagIds);

		if (tagIds.length === 0) {
			console.log('❌ No tag IDs to associate');
			return {
				tags: generatedTags,
				postId,
				success: false,
				tagIds: []
			};
		}

		// Use postStore.setPostTags for proper tag association
		console.log('🔗 Using postStore.setPostTags for proper tag association...');
		await postStore.setPostTags(postId, tagIds);

		console.log('✅ Post tagging completed successfully with AI infrastructure:', {
			postId,
			totalTags: allTags.length,
			existingTags: existing.length,
			createdTags: createdTags.length,
			tagIds
		});

		return {
			tags: generatedTags,
			postId,
			success: true,
			tagIds
		};
	} catch (error) {
		console.error('❌ Error in handlePostTagging:', error);
		return {
			tags: [],
			postId,
			success: false,
			tagIds: []
		};
	}
}

/**
 * Process post tagging in the background (non-blocking)
 */
export async function processPostTaggingAsync(
	content: string,
	postId: string,
	model: AIModel,
	userId: string
): Promise<void> {
	console.log('🔄 processPostTaggingAsync called with:', {
		contentLength: content?.length,
		postId,
		modelId: model?.id,
		userId
	});

	// Run tagging in background without blocking the main post creation flow
	setTimeout(async () => {
		console.log('🔄 Starting background tagging process...');

		try {
			const result = await handlePostTagging(content, postId, model, userId);

			if (result.success) {
				console.log('✅ Background post tagging completed successfully:', result);
			} else {
				console.error('❌ Background post tagging failed:', result);
			}
		} catch (error) {
			console.error('❌ Background post tagging error:', error);
		}
	}, 1000); // Increased delay to ensure post is fully created
}

// src/routes/api/ai/local/tagging/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch, pbTryCatch } from '$lib/utils/errorUtils';
import * as pbServer from '$lib/server/pocketbase';
import { dev } from '$app/environment';
import { ContextAnalyzer } from '$lib/features/ai/utils/contextAnalyzer';
import type { LocalModelParams, OllamaGenerateResponse } from '$lib/types/types.localModels';
import { env } from '$env/dynamic/private';

const OLLAMA_BASE_URL = dev ? env.OLLAMA_DEV_URL : env.OLLAMA_PROD_URL;

interface TaggingRequest {
	content: string;
	attachmentTexts?: string[];
	model?: string;
	maxTags?: number;
	temperature?: number;
}

interface TaggingResponse {
	tags: string[];
	model: string;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
	provider: string;
}

export const POST: RequestHandler = async (event) => {
	console.log('🏷️ === TAGGING ENDPOINT CALLED ===');

	return apiTryCatch(async () => {
		const { request, cookies } = event;

		console.log('🏷️ Tagging endpoint - Starting authentication...');

		// Authentication
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) {
			console.error('🏷️ No auth cookie found');
			throw new Error('User not authenticated');
		}

		let authData;
		try {
			authData = JSON.parse(authCookie);
			pbServer.pb.authStore.save(authData.token, authData.model);
		} catch {
			console.error('🏷️ Failed to parse auth cookie');
			throw new Error('Failed to parse auth cookie');
		}

		if (!pbServer.pb.authStore.isValid) {
			console.error('🏷️ Auth store is invalid');
			throw new Error('User not authenticated');
		}

		const user = pbServer.pb.authStore.model;
		if (!user || !user.id) {
			console.error('🏷️ No user in auth store');
			throw new Error('Invalid user session');
		}

		console.log('🏷️ Local AI Tagging - User ID:', user.id);

		// Parse request
		const body: TaggingRequest = await request.json();
		console.log('🏷️ Request body received:', body);

		const {
			content,
			attachmentTexts = [],
			model = 'qwen2.5:0.5b',
			maxTags = 5,
			temperature = 0.3
		} = body;

		if (!content || typeof content !== 'string') {
			console.error('🏷️ Invalid content:', content);
			throw new Error('Invalid or missing content');
		}

		console.log('🏷️ Local AI Tagging - Model:', model, 'Max tags:', maxTags);

		// Build combined content for tagging
		let fullContent = content.trim();

		if (attachmentTexts.length > 0) {
			const attachmentContent = attachmentTexts.join('\n\n').trim();
			if (attachmentContent) {
				fullContent += `\n\nAttachment content:\n${attachmentContent}`;
			}
		}

		// Create tagging prompt
		const systemPrompt = `You are a content tagging expert. Generate relevant, concise tags for social media posts and their attachments.

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
For "Beautiful sunset at the beach today" → photography, sunset, beach, nature`;

		const userPrompt = `Generate relevant tags for this content:

"${fullContent}"

Return only the tag names, one per line.`;

		// Build parameters for local model
		const params: LocalModelParams = {
			model,
			prompt: userPrompt,
			system: systemPrompt,
			stream: false,
			temperature,
			max_tokens: 150
		};

		console.log('🏷️ Local AI Tagging - Generating tags with local model...');

		try {
			// Call Ollama
			const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(params),
				signal: AbortSignal.timeout(30000) // 30 second timeout for tagging
			});

			if (!response.ok) {
				throw new Error(`Ollama server error: ${response.status} ${response.statusText}`);
			}

			const data: OllamaGenerateResponse = await response.json();
			console.log('🏷️ Local AI Tagging - Response received, length:', data.response?.length);

			if (!data.response) {
				throw new Error('No response content from local model');
			}

			// Parse AI response into tags - handle both line-separated and comma-separated
			let tagNames: string[] = [];

			const responseText = data.response.trim();

			// First try splitting by newlines
			const lineBasedTags = responseText
				.split('\n')
				.map((line: string) => line.trim().toLowerCase())
				.filter((line: string) => line.length > 0)
				.filter((line: string) => !line.includes('tag') && !line.includes(':'))
				.map((line: string) => line.replace(/^[-*\d.]+\s*/, '')) // Remove any numbering
				.map((line: string) => line.replace(/['"]/g, '')) // Remove quotes
				.filter((tag: string) => tag.length >= 2);

			// If we got multiple lines, use them
			if (lineBasedTags.length > 1) {
				tagNames = lineBasedTags;
			} else {
				// Otherwise, try comma-separated parsing
				const singleLine = lineBasedTags[0] || responseText;
				tagNames = singleLine
					.split(',')
					.map((tag: string) => tag.trim().toLowerCase())
					.filter((tag: string) => tag.length >= 2)
					.filter((tag: string) => !tag.includes('tag') && !tag.includes(':'))
					.map((tag: string) => tag.replace(/['"]/g, '')) // Remove quotes
					.map((tag: string) => tag.replace(/^[-*\d.]+\s*/, '')); // Remove any numbering
			}

			// Take only the requested number of tags
			tagNames = tagNames.slice(0, maxTags);

			console.log('🏷️ Local AI Tagging - Parsed tags:', tagNames);

			console.log('🏷️ Generated tags successfully:', tagNames);

			// Return response
			const result: TaggingResponse = {
				tags: tagNames,
				model: data.model || model,
				usage: {
					prompt_tokens: data.prompt_eval_count || 0,
					completion_tokens: data.eval_count || 0,
					total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
				},
				provider: 'local'
			};

			console.log('🏷️ Returning result:', result);
			return result;
		} catch (aiError) {
			console.error('🏷️ Local AI Tagging - Error calling Ollama:', aiError);

			throw new Error(
				`Local AI tagging error: ${aiError instanceof Error ? aiError.message : String(aiError)}`
			);
		}
	}, 'Internal local AI tagging error');
};

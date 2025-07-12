// src/lib/features/ai/utils/localPrompts.ts

export interface PromptConfig {
	summary: string;
	sentiment: string;
	tags: string;
	custom: string;
	image_description: string;
	image_tags: string;
}

export interface PDFPromptConfig {
	pdf_tables: string;
	pdf_scientific: string;
	pdf_financial: string;
	pdf_presentation: string;
	pdf_auto: string;
}

/**
 * Generate tags prompt with customizable max tags
 */
export const generateTagsPrompt = (maxTags: number = 5): string => {
	return `You are a content tagging expert. Generate relevant, concise tags for social media posts and their attachments.

Rules:
- Generate ${maxTags} or fewer highly relevant tags
- Each tag should be 1-3 words maximum
- Use lowercase format
- Avoid generic tags like "post" or "content"
- Consider both explicit topics and implicit themes
- Return ONLY a simple comma-separated list of tags
- No JSON, no brackets, no quotes, no numbering
- No explanations or commentary

Example output: person, face, conversation, helmet, ice hockey`;
};

/**
 * Analysis prompt templates
 */
export const prompts: PromptConfig = {
	summary: 'Provide a concise summary of this post in 2-3 sentences:',
	sentiment:
		'Analyze the sentiment and emotional tone of this post. Is it positive, negative, or neutral? Explain why:',
	tags: generateTagsPrompt(5),
	custom: '',
	image_description: 'Describe what you see in this image in detail:',
	image_tags: generateTagsPrompt(8)
};

/**
 * PDF analysis prompt templates
 */
export const pdfPrompts: PDFPromptConfig = {
	pdf_tables: 'Extract and summarize table data and schedules:',
	pdf_scientific: 'Analyze this scientific paper structure and content:',
	pdf_financial: 'Extract financial information and amounts:',
	pdf_presentation: 'Summarize presentation content and structure:',
	pdf_auto: 'Analyze this PDF content:'
};

/**
 * Get a specific prompt by key
 */
export const getPrompt = (key: keyof PromptConfig): string => {
	return prompts[key];
};

/**
 * Get a specific PDF prompt by key
 */
export const getPDFPrompt = (key: keyof PDFPromptConfig): string => {
	return pdfPrompts[key];
};

/**
 * Get tags prompt with custom max tags
 */
export const getTagsPrompt = (maxTags: number = 5): string => {
	return generateTagsPrompt(maxTags);
};

/**
 * Get all available prompt keys
 */
export const getPromptKeys = (): (keyof PromptConfig)[] => {
	return Object.keys(prompts) as (keyof PromptConfig)[];
};

/**
 * Get all available PDF prompt keys
 */
export const getPDFPromptKeys = (): (keyof PDFPromptConfig)[] => {
	return Object.keys(pdfPrompts) as (keyof PDFPromptConfig)[];
};

// src/routes/api/email/analyze/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { GmailService } from '$lib/features/email/utils/gmailService';
import { pb } from '$lib/server/pocketbase';
import type {
	EmailAccount,
	EmailMessage,
	EmailApiResponse,
	EmailAIAnalysis,
	EmailAccountSetup
} from '$lib/types/types.email';
interface PocketBaseEmailMessage {
	id: string;
	subject?: string;
	from?: { email: string };
	bodyText?: string;
	snippet?: string;
	created: string;
	updated: string;
	[key: string]: unknown;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { messageId } = await request.json();

		if (!messageId) {
			return json(
				{
					success: false,
					error: 'Message ID is required'
				} satisfies EmailApiResponse,
				{ status: 400 }
			);
		}

		const message = await pb.collection('email_messages').getOne(messageId);

		if (!message) {
			return json(
				{
					success: false,
					error: 'Message not found'
				} satisfies EmailApiResponse,
				{ status: 404 }
			);
		}

		const analysis = await analyzeEmailWithAI(message);

		const analysisData = {
			messageId,
			sentiment: analysis.sentiment,
			priority: analysis.priority,
			category: analysis.category,
			tags: JSON.stringify(analysis.tags),
			summary: analysis.summary,
			actionItems: JSON.stringify(analysis.actionItems),
			suggestedResponse: analysis.suggestedResponse,
			confidenceScore: analysis.confidenceScore,
			processedAt: new Date()
		};

		const savedAnalysis = await pb.collection('email_ai_analysis').create(analysisData);

		await pb.collection('email_messages').update(messageId, {
			aiAnalysis: savedAnalysis.id
		});

		const analysisResponse: EmailAIAnalysis = {
			id: savedAnalysis.id,
			messageId: savedAnalysis.messageId,
			sentiment: savedAnalysis.sentiment,
			priority: savedAnalysis.priority,
			category: savedAnalysis.category,
			tags: JSON.parse(savedAnalysis.tags || '[]'),
			topics: JSON.parse(savedAnalysis.topics || '[]'),
			summary: savedAnalysis.summary,
			actionItems: JSON.parse(savedAnalysis.actionItems || '[]'),
			suggestedResponse: savedAnalysis.suggestedResponse,
			confidenceScore: savedAnalysis.confidenceScore,
			processedAt: new Date(savedAnalysis.processedAt)
		};

		return json({
			success: true,
			data: analysisResponse
		} satisfies EmailApiResponse<EmailAIAnalysis>);
	} catch (error) {
		console.error('Failed to analyze email:', error);
		return json(
			{
				success: false,
				error: 'Failed to analyze email'
			} satisfies EmailApiResponse,
			{ status: 500 }
		);
	}
};

async function analyzeEmailWithAI(message: PocketBaseEmailMessage): Promise<EmailAIAnalysis> {
	const emailContent = `
    Subject: ${message.subject || 'No subject'}
    From: ${message.from?.email || 'Unknown sender'}
    Body: ${message.bodyText || message.snippet || 'No content'}
  `;

	// Mock analysis - replace with actual AI service call
	const mockAnalysis: EmailAIAnalysis = {
		id: '',
		messageId: message.id,
		sentiment: Math.random() > 0.5 ? 'positive' : Math.random() > 0.5 ? 'neutral' : 'negative',
		priority: Math.random() > 0.7 ? 'high' : Math.random() > 0.5 ? 'medium' : 'low',
		category: 'business',
		tags: ['email', 'business'],
		topics: ['business', 'communication'],
		summary: `This email is about ${(message.subject || 'an email').toLowerCase()}`,
		actionItems: message.bodyText?.includes('meeting') ? ['Schedule meeting'] : [],
		suggestedResponse: `Thank you for your email regarding ${message.subject || 'your message'}`,
		confidenceScore: 0.85,
		processedAt: new Date()
	};

	return mockAnalysis;
}

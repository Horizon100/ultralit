// src/routes/api/pdf/+server.ts
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import type { RequestHandler } from './$types';

// Server-side PDF.js initialization - NO worker configuration needed
async function initPdfJs() {
	try {
		// Don't set GlobalWorkerOptions on server side
		// PDF.js will use the default settings for Node.js environment
		console.log('PDF.js initialized for server-side processing');
	} catch (error) {
		console.error('Failed to initialize PDF.js:', error);
		throw new Error('PDF.js initialization failed');
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		await initPdfJs();
		
		const { text, filename } = await request.json();
		
		if (!text || typeof text !== 'string') {
			return new Response(JSON.stringify({ error: 'Invalid text content' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Your AI analysis logic here
		const analysis = await analyzeTextContent(text, filename);
		
		return new Response(JSON.stringify({ analysis }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('PDF analysis error:', error);
		return new Response(JSON.stringify({ error: 'Failed to analyze PDF' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

async function analyzeTextContent(text: string, filename?: string): Promise<string> {
	// Implement your AI analysis logic here
	// This is where you'd call your AI service
	
	// Placeholder implementation
	const wordCount = text.split(/\s+/).length;
	const paragraphs = text.split(/\n\s*\n/).length;
	
	return `Document Analysis for ${filename || 'PDF'}:
	
• **Word Count**: ${wordCount} words
• **Paragraphs**: ${paragraphs}
• **Length**: ${text.length} characters

**Summary**: This document contains ${wordCount} words across ${paragraphs} sections. The content appears to be ${getContentType(text)}.

**Key Topics**: ${extractKeyTopics(text).join(', ')}`;
}

function getContentType(text: string): string {
	const lowerText = text.toLowerCase();
	if (lowerText.includes('research') || lowerText.includes('study')) return 'research or academic content';
	if (lowerText.includes('contract') || lowerText.includes('agreement')) return 'legal or contractual content';
	if (lowerText.includes('report') || lowerText.includes('analysis')) return 'a report or analysis';
	return 'general document content';
}

function extractKeyTopics(text: string): string[] {
	// Simple keyword extraction - replace with more sophisticated analysis
	const words = text.toLowerCase().split(/\s+/);
	const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
	
	const wordCounts = new Map<string, number>();
	words.forEach(word => {
		const cleaned = word.replace(/[^\w]/g, '');
		if (cleaned.length > 3 && !commonWords.has(cleaned)) {
			wordCounts.set(cleaned, (wordCounts.get(cleaned) || 0) + 1);
		}
	});
	
	return Array.from(wordCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([word]) => word);
}
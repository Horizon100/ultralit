// src/routes/api/pdf/scientific/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const contentType = request.headers.get('content-type');
		let tempPath: string;
		const tempId = crypto.randomUUID();
		tempPath = join('/tmp', `${tempId}.pdf`);

		if (contentType?.includes('multipart/form-data')) {
			const formData = await request.formData();
			const file = formData.get('pdf') as File;
			if (!file) return json({ error: 'No PDF file provided' }, { status: 400 });
			const buffer = Buffer.from(await file.arrayBuffer());
			await writeFile(tempPath, buffer);
		} else {
			const { pdfUrl } = await request.json();
			if (!pdfUrl) return json({ error: 'PDF URL is required' }, { status: 400 });
			const pdfResponse = await fetch(pdfUrl);
			if (!pdfResponse.ok) return json({ error: 'Failed to fetch PDF file' }, { status: 500 });
			const buffer = Buffer.from(await pdfResponse.arrayBuffer());
			await writeFile(tempPath, buffer);
		}

		try {
			const analysis = await analyzeScientificPaper(tempPath);
			return json(analysis);
		} finally {
			await unlink(tempPath).catch(() => {});
		}
	} catch (error) {
		console.error('Scientific paper analysis error:', error);
		return json({ error: 'Scientific paper analysis failed' }, { status: 500 });
	}
};

async function analyzeScientificPaper(filePath: string): Promise<any> {
	const fullText = await extractFullText(filePath);
	const sections = extractSections(fullText);
	const references = extractReferences(fullText);
	const metadata = extractPaperMetadata(fullText);

	return {
		metadata,
		sections,
		references,
		wordCount: fullText.split(/\s+/).length,
		extractedAt: new Date().toISOString()
	};
}

function extractSections(text: string): any {
	const sections = {};
	const commonSections = [
		'abstract',
		'introduction',
		'methodology',
		'methods',
		'results',
		'discussion',
		'conclusion',
		'acknowledgments'
	];

	const lines = text.split('\n');
	let currentSection = null;
	let currentContent = [];

	for (const line of lines) {
		const lineLower = line.toLowerCase().trim();

		const matchedSection = commonSections.find(
			(section) =>
				lineLower === section ||
				lineLower.startsWith(section + ' ') ||
				(lineLower.includes(section) && line.length < 50)
		);

		if (matchedSection) {
			if (currentSection && currentContent.length > 0) {
				sections[currentSection] = currentContent.join('\n').trim();
			}
			currentSection = matchedSection;
			currentContent = [];
		} else if (currentSection && line.trim()) {
			currentContent.push(line);
		}
	}

	if (currentSection && currentContent.length > 0) {
		sections[currentSection] = currentContent.join('\n').trim();
	}

	return sections;
}

function extractReferences(text: string): string[] {
	const lines = text.split('\n');
	const references = [];
	let inReferences = false;

	for (const line of lines) {
		const lineLower = line.toLowerCase().trim();

		if (lineLower.includes('references') || lineLower.includes('bibliography')) {
			inReferences = true;
			continue;
		}

		if (inReferences && line.trim()) {
			if (line.match(/^\d+\./) || line.match(/^[A-Z][a-z]+,/)) {
				references.push(line.trim());
			}
		}
	}

	return references;
}

function extractPaperMetadata(text: string): any {
	const firstPage = text.split('\n').slice(0, 50).join('\n');
	const doiMatch = text.match(/doi:\s*(10\.\d+\/[^\s]+)/i);
	const arxivMatch = text.match(/arxiv:\s*([0-9]{4}\.[0-9]{4})/i);
	const lines = firstPage.split('\n').filter((line) => line.trim().length > 10);
	const title = lines[0]?.trim();
	const authorPattern = /([A-Z][a-z]+ [A-Z][a-z]+)/g;
	const authors = firstPage.match(authorPattern) || [];

	return {
		title,
		authors: [...new Set(authors)].slice(0, 10),
		doi: doiMatch?.[1],
		arxivId: arxivMatch?.[1]
	};
}

async function extractFullText(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const pdftotext = spawn('pdftotext', [filePath, '-']);
		let output = '';

		pdftotext.stdout.on('data', (data) => {
			output += data.toString();
		});

		pdftotext.on('close', (code) => {
			if (code === 0) {
				resolve(output);
			} else {
				reject(new Error('Full text extraction failed'));
			}
		});
	});
}

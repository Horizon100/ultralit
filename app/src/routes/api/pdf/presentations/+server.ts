// src/routes/api/pdf/presentations/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const contentType = request.headers.get('content-type');
		const tempId = crypto.randomUUID();
		const tempPath = join('/tmp', `${tempId}.pdf`);

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
			const analysis = await analyzePresentationPDF(tempPath);
			return json(analysis);
		} finally {
			await unlink(tempPath).catch(() => {});
		}
	} catch (error) {
		console.error('Presentation analysis error:', error);
		return json({ error: 'Presentation analysis failed' }, { status: 500 });
	}
};

async function analyzePresentationPDF(filePath: string): Promise<any> {
	const metadata = await getPDFInfo(filePath);
	const slides = await extractSlides(filePath, parseInt(metadata.Pages) || 1);
	const structure = analyzeSlideStructure(slides);

	return {
		metadata,
		slideCount: slides.length,
		slides,
		structure,
		extractedAt: new Date().toISOString()
	};
}

async function extractSlides(filePath: string, pageCount: number): Promise<any[]> {
	const slides = [];

	for (let i = 1; i <= pageCount; i++) {
		try {
			const slideText = await extractPageText(filePath, i);

			slides.push({
				slideNumber: i,
				text: slideText,
				wordCount: slideText.split(/\s+/).filter((word) => word.length > 0).length,
				hasTitle: detectSlideTitle(slideText),
				bulletPoints: extractBulletPoints(slideText)
			});
		} catch (error) {
			slides.push({
				slideNumber: i,
				text: '',
				wordCount: 0,
				hasTitle: false,
				bulletPoints: [],
				error: 'Extraction failed'
			});
		}
	}

	return slides;
}

async function extractPageText(filePath: string, pageNumber: number): Promise<string> {
	return new Promise((resolve, reject) => {
		const pdftotext = spawn('pdftotext', [
			'-f',
			pageNumber.toString(),
			'-l',
			pageNumber.toString(),
			filePath,
			'-'
		]);
		let output = '';

		pdftotext.stdout.on('data', (data) => {
			output += data.toString();
		});

		pdftotext.on('close', (code) => {
			if (code === 0) {
				resolve(output.trim());
			} else {
				reject(new Error(`pdftotext failed for page ${pageNumber}`));
			}
		});
	});
}

function detectSlideTitle(text: string): boolean {
	const lines = text.split('\n').filter((line) => line.trim());
	if (lines.length === 0) return false;

	const firstLine = lines[0].trim();

	return (
		(firstLine.length > 5 &&
			firstLine.length < 100 &&
			firstLine === firstLine.toUpperCase() &&
			firstLine.includes(' ')) ||
		firstLine.split(' ').every((word) => word[0] === word[0].toUpperCase())
	);
}

function extractBulletPoints(text: string): string[] {
	const lines = text.split('\n');
	const bulletPoints = [];

	const bulletPatterns = [
		/^[\s]*[•·▪▫◦‣⁃]\s+(.+)/,
		/^[\s]*[-*+]\s+(.+)/,
		/^[\s]*\d+[.)]\s+(.+)/,
		/^[\s]*[a-zA-Z][.)]\s+(.+)/
	];

	for (const line of lines) {
		for (const pattern of bulletPatterns) {
			const match = line.match(pattern);
			if (match) {
				bulletPoints.push(match[1].trim());
				break;
			}
		}
	}

	return bulletPoints;
}

function analyzeSlideStructure(slides: any[]): any {
	const structure = {
		titleSlides: [],
		contentSlides: [],
		summarySlides: [],
		averageWordsPerSlide: 0,
		totalBulletPoints: 0
	};

	let totalWords = 0;

	slides.forEach((slide) => {
		totalWords += slide.wordCount;
		structure.totalBulletPoints += slide.bulletPoints.length;

		const textLower = slide.text.toLowerCase();

		if (slide.hasTitle && slide.wordCount < 50) {
			structure.titleSlides.push(slide.slideNumber);
		} else if (
			textLower.includes('summary') ||
			textLower.includes('conclusion') ||
			textLower.includes('thank you') ||
			textLower.includes('questions')
		) {
			structure.summarySlides.push(slide.slideNumber);
		} else {
			structure.contentSlides.push(slide.slideNumber);
		}
	});

	structure.averageWordsPerSlide = Math.round(totalWords / slides.length);

	return structure;
}

async function getPDFInfo(filePath: string): Promise<any> {
	return new Promise((resolve, reject) => {
		const pdfinfo = spawn('pdfinfo', [filePath]);
		let output = '';

		pdfinfo.stdout.on('data', (data) => {
			output += data.toString();
		});

		pdfinfo.on('close', (code) => {
			if (code === 0) {
				const metadata = parsePDFInfo(output);
				resolve(metadata);
			} else {
				reject(new Error('pdfinfo failed'));
			}
		});
	});
}

function parsePDFInfo(output: string): any {
	const lines = output.split('\n');
	const metadata: any = {};

	lines.forEach((line) => {
		const [key, ...valueParts] = line.split(':');
		if (key && valueParts.length > 0) {
			const value = valueParts.join(':').trim();
			metadata[key.trim()] = value;
		}
	});

	return metadata;
}

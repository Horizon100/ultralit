// src/lib/utils/pdfKeywordExtractor.ts
import { get } from 'svelte/store';
import { pocketbaseUrl } from '$lib/stores/pocketbase';

export interface PdfKeywordResult {
	keywords: string[];
	analysis?: string;
	success: boolean;
	error?: string;
}

/**
 * Extract keywords from PDF using your existing PDF analysis infrastructure
 */
export async function extractPdfKeywords(
	pdfFile: File,
	options: {
		maxKeywords?: number;
		mode?: 'fast' | 'ai';
	} = {}
): Promise<PdfKeywordResult> {
	const { maxKeywords = 8, mode = 'fast' } = options;

	try {
		console.log(
			'📄 Starting PDF keyword extraction using existing PDF infrastructure:',
			pdfFile.name
		);

		// Use your existing PDF analysis endpoint
		const formData = new FormData();
		formData.append('pdf', pdfFile);

		// First, get PDF analysis using your /api/pdf endpoint
		const pdfAnalysisResponse = await fetch('/api/pdf', {
			method: 'POST',
			body: formData
		});

		if (!pdfAnalysisResponse.ok) {
			throw new Error(`PDF analysis failed: ${pdfAnalysisResponse.status}`);
		}

		const pdfAnalysisResult = await pdfAnalysisResponse.json();
		console.log('📄 PDF analysis result:', pdfAnalysisResult);

		// Extract text using pdf.js (through your existing infrastructure)
		const textExtractionResult = await extractTextUsingPdfJs(pdfFile);

		if (!textExtractionResult.success || !textExtractionResult.text) {
			return {
				keywords: [],
				success: false,
				error: 'Failed to extract text from PDF'
			};
		}

		// Use your analyze-pdf server for keyword extraction
		const analyzeResponse = await fetch('/api/ai/analyze-pdf', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				text: textExtractionResult.text,
				filename: pdfFile.name,
				mode: mode
			})
		});

		if (!analyzeResponse.ok) {
			throw new Error(`PDF keyword analysis failed: ${analyzeResponse.status}`);
		}

		const analyzeResult = await analyzeResponse.json();

		if (!analyzeResult.analysis) {
			throw new Error('No analysis returned from PDF analyzer');
		}

		// Extract keywords from the analysis
		const keywords = extractKeywordsFromAnalysis(
			analyzeResult.analysis,
			textExtractionResult.text,
			maxKeywords
		);

		console.log('📄 Extracted keywords:', keywords);

		return {
			keywords,
			analysis: analyzeResult.analysis,
			success: true
		};
	} catch (error) {
		console.error('❌ PDF keyword extraction failed:', error);
		return {
			keywords: [],
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Extract text from PDF using pdf.js (similar to your existing approach)
 */
async function extractTextUsingPdfJs(pdfFile: File): Promise<{ text: string; success: boolean }> {
	try {
		// Import pdf.js with the same configuration as your existing code
		const pdfjsLib = await import('pdfjs-dist');

		// Configure worker using your existing setup
		if (typeof window !== 'undefined') {
			pdfjsLib.GlobalWorkerOptions.workerSrc =
				'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
		}

		const arrayBuffer = await pdfFile.arrayBuffer();
		const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

		let fullText = '';

		// Extract text from all pages (limit to first 10 pages for performance)
		const maxPages = Math.min(pdf.numPages, 10);

		for (let i = 1; i <= maxPages; i++) {
			const page = await pdf.getPage(i);
			const textContent = await page.getTextContent();
			const pageText = textContent.items.map((item: any) => item.str).join(' ');
			fullText += pageText + '\n';
		}

		console.log('📄 Extracted text length:', fullText.length);

		return {
			text: fullText.trim(),
			success: true
		};
	} catch (error) {
		console.error('❌ PDF.js text extraction failed:', error);
		return {
			text: '',
			success: false
		};
	}
}

/**
 * Extract keywords for PDF attachments that are already stored in PocketBase
 */
export async function extractKeywordsFromPocketBaseAttachment(
	attachment: any,
	options: {
		maxKeywords?: number;
		mode?: 'fast' | 'ai';
	} = {}
): Promise<PdfKeywordResult> {
	try {
		console.log('📄 Extracting keywords from PocketBase attachment:', attachment);

		if (!attachment.id || !attachment.file_path) {
			throw new Error('Invalid attachment: missing id or file_path');
		}

		// Get the PDF URL using your existing URL structure
		const baseUrl = get(pocketbaseUrl);
		const pdfUrl = `${baseUrl}/api/files/7xg05m7gr933ygt/${attachment.id}/${attachment.file_path}`;

		console.log('📄 PDF URL:', pdfUrl);

		// Use your existing PDF analysis endpoint with the URL
		const analysisResponse = await fetch('/api/pdf', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				attachmentId: attachment.id,
				pdfUrl: pdfUrl,
				fileName: attachment.original_name || attachment.file_path
			})
		});

		if (!analysisResponse.ok) {
			throw new Error(`PDF analysis failed: ${analysisResponse.status}`);
		}

		// Extract text using the PDF URL
		const textResult = await extractTextFromPdfUrl(pdfUrl);

		if (!textResult.success) {
			throw new Error('Failed to extract text from PDF URL');
		}

		// Use analyze-pdf for keyword extraction
		const keywordResponse = await fetch('/api/ai/analyze-pdf', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				text: textResult.text,
				filename: attachment.original_name || attachment.file_path,
				mode: options.mode || 'fast'
			})
		});

		if (!keywordResponse.ok) {
			throw new Error(`Keyword extraction failed: ${keywordResponse.status}`);
		}

		const keywordResult = await keywordResponse.json();
		const keywords = extractKeywordsFromAnalysis(
			keywordResult.analysis,
			textResult.text,
			options.maxKeywords || 8
		);

		return {
			keywords,
			analysis: keywordResult.analysis,
			success: true
		};
	} catch (error) {
		console.error('❌ PocketBase PDF keyword extraction failed:', error);
		return {
			keywords: [],
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Extract text from PDF URL using pdf.js
 */
async function extractTextFromPdfUrl(pdfUrl: string): Promise<{ text: string; success: boolean }> {
	try {
		const pdfjsLib = await import('pdfjs-dist');

		if (typeof window !== 'undefined') {
			pdfjsLib.GlobalWorkerOptions.workerSrc =
				'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
		}

		const pdf = await pdfjsLib.getDocument({
			url: pdfUrl,
			cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
			cMapPacked: true
		}).promise;

		let fullText = '';
		const maxPages = Math.min(pdf.numPages, 10);

		for (let i = 1; i <= maxPages; i++) {
			const page = await pdf.getPage(i);
			const textContent = await page.getTextContent();
			const pageText = textContent.items.map((item: any) => item.str).join(' ');
			fullText += pageText + '\n';
		}

		return {
			text: fullText.trim(),
			success: true
		};
	} catch (error) {
		console.error('❌ PDF URL text extraction failed:', error);
		return {
			text: '',
			success: false
		};
	}
}

/**
 * Extract keywords from analysis text, with fallback to basic keyword extraction
 */
function extractKeywordsFromAnalysis(
	analysis: string,
	originalText: string,
	maxKeywords: number
): string[] {
	// First, try to extract from the formatted analysis
	const keywordMatch = analysis.match(/🏷️\s*\*\*Key Terms:\*\*\s*(.+?)(?:\n|$)/);

	let keywords: string[] = [];

	if (keywordMatch) {
		keywords = keywordMatch[1]
			.split('•')
			.map((term) => term.trim())
			.filter((term) => term.length > 0)
			.slice(0, maxKeywords);

		console.log('📄 Found keywords in analysis format:', keywords);
	}

	// If no keywords found in expected format, use fallback extraction
	if (keywords.length === 0) {
		console.log('📄 No keywords found in analysis, using fallback extraction');
		keywords = extractKeywordsFromText(originalText, maxKeywords);
	}

	// Clean and validate keywords
	return keywords
		.map((keyword) => cleanKeyword(keyword))
		.filter((keyword) => keyword.length >= 2)
		.slice(0, maxKeywords);
}

/**
 * Fallback keyword extraction using word frequency
 */
function extractKeywordsFromText(text: string, maxKeywords: number): string[] {
	const stopWords = new Set([
		'the',
		'and',
		'or',
		'but',
		'in',
		'on',
		'at',
		'to',
		'for',
		'of',
		'with',
		'by',
		'from',
		'up',
		'about',
		'into',
		'through',
		'during',
		'before',
		'after',
		'above',
		'below',
		'between',
		'among',
		'this',
		'that',
		'these',
		'those',
		'is',
		'are',
		'was',
		'were',
		'been',
		'being',
		'have',
		'has',
		'had',
		'will',
		'would',
		'could',
		'should',
		'may',
		'might',
		'must',
		'can',
		'do',
		'does',
		'did',
		'get',
		'got',
		'said',
		'say',
		'one',
		'two',
		'three',
		'also',
		'more',
		'very',
		'well',
		'first',
		'other',
		'than',
		'only',
		'its',
		'which',
		'their',
		'them',
		'each',
		'make',
		'most',
		'over',
		'such',
		'take',
		'any',
		'way',
		'even',
		'new',
		'want',
		'because'
	]);

	const words = text
		.toLowerCase()
		.replace(/[^\w\s]/g, ' ')
		.split(/\s+/)
		.filter((word) => word.length > 3 && !stopWords.has(word));

	const wordCounts: { [key: string]: number } = {};
	words.forEach((word) => {
		wordCounts[word] = (wordCounts[word] || 0) + 1;
	});

	return Object.entries(wordCounts)
		.filter(([, count]) => count > 1)
		.sort(([, a], [, b]) => b - a)
		.slice(0, maxKeywords)
		.map(([word]) => word);
}

/**
 * Clean keyword text
 */
function cleanKeyword(keyword: string): string {
	return keyword
		.trim()
		.replace(/^[-•·\-—–\d+\.\)\]\s]+/, '')
		.replace(/['""\[\]{}]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

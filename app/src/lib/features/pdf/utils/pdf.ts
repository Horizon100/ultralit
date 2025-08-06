// src/lib/features/pdf/utils/pdf.ts
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Configure worker - simple and direct approach
if (typeof window !== 'undefined') {
	pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
}

export interface PDFThumbnail {
	dataUrl: string;
	width: number;
	height: number;
}

export interface PDFDocument {
	pdf: PDFDocumentProxy;
	numPages: number;
	title?: string;
}

interface TextItem {
	str: string;
	dir: string;
	width: number;
	height: number;
	transform: number[];
	fontName: string;
	hasEOL: boolean;
}

function isTextItem(item: unknown): item is TextItem {
	return (
		item !== null &&
		typeof item === 'object' &&
		'str' in item &&
		typeof (item as TextItem).str === 'string'
	);
}

/**
 * Generate thumbnail for PDF first page
 */
export async function generatePDFThumbnail(
	pdfUrl: string,
	maxWidth: number = 200,
	maxHeight: number = 280
): Promise<PDFThumbnail> {
	try {
		// Validate URL
		if (!pdfUrl || typeof pdfUrl !== 'string') {
			throw new Error('Invalid PDF URL provided');
		}

		console.log('Loading PDF from URL:', pdfUrl);

		const pdf = await pdfjsLib.getDocument({
			url: pdfUrl,
			cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
			cMapPacked: true
		}).promise;
		const page = await pdf.getPage(1);

		const viewport = page.getViewport({ scale: 1 });
		const scale = Math.min(maxWidth / viewport.width, maxHeight / viewport.height);
		const scaledViewport = page.getViewport({ scale });

		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');

		if (!context) {
			throw new Error('Could not get canvas 2D context');
		}

		canvas.width = scaledViewport.width;
		canvas.height = scaledViewport.height;

		await page.render({
			canvasContext: context,
			viewport: scaledViewport
		}).promise;

		return {
			dataUrl: canvas.toDataURL('image/png'),
			width: canvas.width,
			height: canvas.height
		};
	} catch (error) {
		console.error('Error generating PDF thumbnail:', error);
		throw error;
	}
}

/**
 * Load PDF document
 */
/**
 * Load PDF document
 */
export async function loadPDFDocument(pdfUrl: string): Promise<PDFDocument> {
	try {
		// Add detailed debugging
		console.log('loadPDFDocument called with:', {
			pdfUrl,
			type: typeof pdfUrl,
			length: pdfUrl?.length,
			isEmpty: !pdfUrl,
			isString: typeof pdfUrl === 'string'
		});

		if (!pdfUrl || typeof pdfUrl !== 'string') {
			console.log('Validation failed at loadPDFDocument');
			throw new Error('Invalid PDF URL provided');
		}

		console.log('Loading PDF document from URL:', pdfUrl);

		const pdf = await pdfjsLib.getDocument({
			url: pdfUrl,
			cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
			cMapPacked: true,
			useWorkerFetch: false,
			isEvalSupported: false,
			useSystemFonts: true
		}).promise;
		
		const metadata = await pdf.getMetadata();

		let title = 'PDF Document';
		if (metadata.info && typeof metadata.info === 'object' && 'Title' in metadata.info) {
			const titleValue = (metadata.info as Record<string, unknown>).Title;
			if (typeof titleValue === 'string' && titleValue.trim()) {
				title = titleValue;
			}
		}

		return {
			pdf,
			numPages: pdf.numPages,
			title
		};
	} catch (error) {
		console.error('Error loading PDF document:', error);
		throw error;
	}
}
/**
 * Extract text from PDF page
 */
export async function extractTextFromPage(pdf: PDFDocumentProxy, pageNum: number): Promise<string> {
	try {
		const page = await pdf.getPage(pageNum);
		const textContent = await page.getTextContent();

		return textContent.items
			.filter(isTextItem)
			.map((item) => item.str)
			.join(' ');
	} catch (error) {
		console.error('Error extracting text from page:', error);
		throw error;
	}
}

/**
 * Extract text from entire PDF
 */
export async function extractTextFromPDF(pdf: PDFDocumentProxy): Promise<string[]> {
	const pages: string[] = [];

	for (let i = 1; i <= pdf.numPages; i++) {
		const text = await extractTextFromPage(pdf, i);
		pages.push(text);
	}

	return pages;
}

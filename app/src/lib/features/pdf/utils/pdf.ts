// src/lib/features/pdf/utils/pdf.ts
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Configure worker - simple and direct approach
if (typeof window !== 'undefined') {
	pdfjsLib.GlobalWorkerOptions.workerSrc =
		'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
			// Add CORS handling if needed
			cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
			cMapPacked: true
		}).promise;
		const page = await pdf.getPage(1);

		const viewport = page.getViewport({ scale: 1 });
		const scale = Math.min(maxWidth / viewport.width, maxHeight / viewport.height);
		const scaledViewport = page.getViewport({ scale });

		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d')!;

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
export async function loadPDFDocument(pdfUrl: string): Promise<PDFDocument> {
	try {
		// Validate URL
		if (!pdfUrl || typeof pdfUrl !== 'string') {
			throw new Error('Invalid PDF URL provided');
		}

		console.log('Loading PDF document from URL:', pdfUrl);

		const pdf = await pdfjsLib.getDocument({
			url: pdfUrl,
			cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
			cMapPacked: true
		}).promise;
		const metadata = await pdf.getMetadata();

		return {
			pdf,
			numPages: pdf.numPages,
			title: metadata.info?.Title || 'PDF Document'
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
		return textContent.items.map((item: any) => item.str).join(' ');
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

// src/lib/types/pdf.ts - TypeScript types for PDF analysis
export interface PDFMetadata {
	Title?: string;
	Author?: string;
	Subject?: string;
	Creator?: string;
	Producer?: string;
	CreationDate?: string;
	ModDate?: string;
	Pages: string;
	'Page size'?: string;
	'File size'?: string;
}

export interface DocumentTypeResult {
	type: 'table' | 'scientific' | 'presentation' | 'financial' | 'unknown';
	confidence: number;
}

export interface PDFAnalysisResult {
	documentType: DocumentTypeResult['type'];
	confidence: number;
	metadata: PDFMetadata;
	extractedData?: any;
}

// Table-specific types
export interface TableData {
	headers: string[];
	rows: string[][];
	rowCount: number;
}

export interface ScheduleItem {
	text: string;
	times: string[];
	dates: string[];
	days: string[];
}

export interface TableAnalysisResult {
	tables: TableData[];
	schedules: ScheduleItem[];
	extractedAt: string;
}

// Scientific paper types
export interface PaperMetadata {
	title?: string;
	authors: string[];
	doi?: string;
	arxivId?: string;
}

export interface ScientificAnalysisResult {
	metadata: PaperMetadata;
	sections: Record<string, string>;
	references: string[];
	wordCount: number;
	extractedAt: string;
}

// Financial document types
export interface Amount {
	value: number;
	formatted: string;
	position: number;
}

export interface FinancialAnalysisResult {
	documentType: string;
	amounts: Amount[];
	dates: string[];
	entities: string[];
	totalAmount: number | null;
	extractedAt: string;
}

// Presentation types
export interface SlideData {
	slideNumber: number;
	text: string;
	images: string[];
	wordCount: number;
	hasTitle: boolean;
	bulletPoints: string[];
	error?: string;
}

export interface SlideStructure {
	titleSlides: number[];
	contentSlides: number[];
	summarySlides: number[];
	averageWordsPerSlide: number;
	totalBulletPoints: number;
}

export interface PresentationAnalysisResult {
	metadata: PDFMetadata;
	slideCount: number;
	slides: SlideData[];
	structure: SlideStructure;
	extractedAt: string;
}

// OCR types
export interface OCRResult {
	success: boolean;
	originalSize: number;
	processedSize: number;
	extractedText: string;
	language: string;
	enhanced: boolean;
	downloadUrl: string;
	processedAt: string;
}

// Batch processing types
export interface BatchResult {
	filename: string;
	size: number;
	analysis?: any;
	error?: string;
	success: boolean;
}

export interface BatchProcessingResult {
	totalFiles: number;
	successful: number;
	failed: number;
	results: BatchResult[];
	processedAt: string;
}

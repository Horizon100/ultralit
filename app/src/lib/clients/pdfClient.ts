import type {
	PDFAnalysisResult,
	TableAnalysisResult,
	ScientificAnalysisResult,
	FinancialAnalysisResult,
	PresentationAnalysisResult,
	OCRResult,
	BatchProcessingResult
} from '$lib/types/types.pdf';

export class PDFAnalysisClient {
	private baseUrl: string;

	constructor(baseUrl: string = '/api/pdf') {
		this.baseUrl = baseUrl;
	}

	async analyzePDF(file: File): Promise<PDFAnalysisResult> {
		const formData = new FormData();
		formData.append('pdf', file);

		const response = await fetch(this.baseUrl, {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			throw new Error(`Analysis failed: ${response.statusText}`);
		}

		return response.json();
	}

	async extractTables(file: File): Promise<TableAnalysisResult> {
		const formData = new FormData();
		formData.append('pdf', file);

		const response = await fetch(`${this.baseUrl}/tables`, {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			throw new Error(`Table extraction failed: ${response.statusText}`);
		}

		return response.json();
	}

	async analyzeScientificPaper(file: File): Promise<ScientificAnalysisResult> {
		const formData = new FormData();
		formData.append('pdf', file);

		const response = await fetch(`${this.baseUrl}/scientific`, {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			throw new Error(`Scientific analysis failed: ${response.statusText}`);
		}

		return response.json();
	}

	async analyzeFinancialDocument(file: File): Promise<FinancialAnalysisResult> {
		const formData = new FormData();
		formData.append('pdf', file);

		const response = await fetch(`${this.baseUrl}/financial`, {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			throw new Error(`Financial analysis failed: ${response.statusText}`);
		}

		return response.json();
	}

	async analyzePresentation(file: File): Promise<PresentationAnalysisResult> {
		const formData = new FormData();
		formData.append('pdf', file);

		const response = await fetch(`${this.baseUrl}/presentations`, {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			throw new Error(`Presentation analysis failed: ${response.statusText}`);
		}

		return response.json();
	}

	async performOCR(
		file: File,
		language: string = 'eng',
		enhance: boolean = false
	): Promise<OCRResult> {
		const formData = new FormData();
		formData.append('pdf', file);
		formData.append('language', language);
		formData.append('enhance', enhance.toString());

		const response = await fetch(`${this.baseUrl}/ocr`, {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			throw new Error(`OCR failed: ${response.statusText}`);
		}

		return response.json();
	}

	async batchProcess(files: File[], analysisType: string = 'auto'): Promise<BatchProcessingResult> {
		const formData = new FormData();

		files.forEach((file) => {
			formData.append('pdfs', file);
		});
		formData.append('analysisType', analysisType);

		const response = await fetch(`${this.baseUrl}/batch`, {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			throw new Error(`Batch processing failed: ${response.statusText}`);
		}

		return response.json();
	}
}

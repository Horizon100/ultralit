// src/routes/api/pdf/tables/+server.ts - Table extraction endpoint
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import type { TableAnalysisResult } from '$lib/types/types.pdf';

// Dynamic import of pdfjs to avoid build-time issues
let pdfjs: any = null;

async function initPdfJs() {
	if (!pdfjs) {
		// Use dynamic import to avoid build-time issues
		pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
		
		// Configure worker only if GlobalWorkerOptions exists
		if (pdfjs.GlobalWorkerOptions) {
			try {
				pdfjs.GlobalWorkerOptions.workerSrc = new URL(
					'pdfjs-dist/legacy/build/pdf.worker.js',
					import.meta.url
				).href;
			} catch (error) {
				console.warn('Failed to set PDF worker src:', error);
				// Fallback - disable worker
				pdfjs.GlobalWorkerOptions.workerSrc = null;
			}
		}
	}
	return pdfjs;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Initialize PDF.js
		await initPdfJs();
		
		const contentType = request.headers.get('content-type');

		const tempId = crypto.randomUUID();
		const tempPath = join('/tmp', `${tempId}.pdf`);

		if (contentType?.includes('multipart/form-data')) {
			const formData = await request.formData();
			const file = formData.get('pdf') as File;

			if (!file) {
				return json({ error: 'No PDF file provided' }, { status: 400 });
			}

			const buffer = Buffer.from(await file.arrayBuffer());
			await writeFile(tempPath, buffer);
		} else {
			const { pdfUrl } = await request.json();

			if (!pdfUrl) {
				return json({ error: 'PDF URL is required' }, { status: 400 });
			}

			console.log('📄 Fetching PDF for table extraction:', { pdfUrl });

			const pdfResponse = await fetch(pdfUrl);
			if (!pdfResponse.ok) {
				return json({ error: 'Failed to fetch PDF file' }, { status: 500 });
			}

			const buffer = Buffer.from(await pdfResponse.arrayBuffer());
			await writeFile(tempPath, buffer);
		}

		try {
			const tables = await extractTables(tempPath);
			const schedules = await extractSchedules(tempPath);

			const result: TableAnalysisResult = {
				tables,
				schedules,
				extractedAt: new Date().toISOString()
			};

			return json(result);
		} finally {
			await unlink(tempPath).catch(() => {});
		}
	} catch (error) {
		console.error('Table extraction error:', error);
		return json({ error: 'Table extraction failed' }, { status: 500 });
	}
};

async function extractTables(filePath: string): Promise<any[]> {
	// Use pdftotext with layout preservation
	const text = await extractWithLayout(filePath);

	// Parse table-like structures
	const lines = text.split('\n').filter((line) => line.trim());
	const tables = [];
	let currentTable = [];

	for (const line of lines) {
		// Detect table rows (multiple spaces or tabs between columns)
		if (line.match(/\s{3,}|\t{2,}/)) {
			const columns = line.split(/\s{3,}|\t{2,}/).map((col) => col.trim());
			if (columns.length > 1) {
				currentTable.push(columns);
			}
		} else if (currentTable.length > 0) {
			// End of table
			if (currentTable.length > 1) {
				tables.push({
					headers: currentTable[0],
					rows: currentTable.slice(1),
					rowCount: currentTable.length - 1
				});
			}
			currentTable = [];
		}
	}

	return tables;
}

async function extractSchedules(filePath: string): Promise<any[]> {
	const text = await extractWithLayout(filePath);
	const lines = text.split('\n');

	const timePattern = /(\d{1,2}:\d{2}|\d{1,2}\.\d{2})/g;
	const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g;
	const dayPattern =
		/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/gi;

	const scheduleItems = [];

	for (const line of lines) {
		const times = line.match(timePattern);
		const dates = line.match(datePattern);
		const days = line.match(dayPattern);

		if (times || dates || days) {
			scheduleItems.push({
				text: line.trim(),
				times: times || [],
				dates: dates || [],
				days: days || []
			});
		}
	}

	return scheduleItems;
}

async function extractWithLayout(filePath: string): Promise<string> {
	try {
		// Ensure pdfjs is initialized
		const pdf = await initPdfJs();
		
		const fs = await import('fs');
		const data = fs.readFileSync(filePath);
		const loadingTask = pdf.getDocument({ data });
		const pdfDoc = await loadingTask.promise;

		let text = '';

		for (let i = 1; i <= pdfDoc.numPages; i++) {
			const page = await pdfDoc.getPage(i);
			const textContent = await page.getTextContent();

			// Group text items by their vertical position to preserve layout
			const lines: { [key: number]: string[] } = {};

			textContent.items.forEach((item: any) => {
				const y = Math.round(item.transform[5]);
				if (!lines[y]) lines[y] = [];
				lines[y].push(item.str);
			});

			// Sort by Y position and join text
			const sortedLines = Object.keys(lines)
				.sort((a, b) => parseInt(b) - parseInt(a))
				.map((y) => lines[parseInt(y)].join(' '))
				.join('\n');

			text += sortedLines + '\n';
		}

		return text;
	} catch (error) {
		console.error('PDF layout extraction failed:', error);
		throw new Error('Failed to extract PDF text with layout');
	}
}
// src/routes/api/ai/local/extract-text/pdf/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';
import * as pbServer from '$lib/server/pocketbase';
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

interface PDFExtractionResult {
	text: string;
	confidence?: number;
	method: string;
	pageCount?: number;
}

/**
 * Extract text directly from PDF using PyMuPDF
 */
async function extractDirectPDFText(
	pdfPath: string,
	maxLength: number
): Promise<PDFExtractionResult> {
	return new Promise((resolve, reject) => {
		const pythonScript = `
import fitz  # PyMuPDF
import sys
import json

try:
    # Open PDF
    doc = fitz.open('${pdfPath}')
    
    full_text = ''
    page_count = len(doc)
    
    # Extract text from all pages
    for page_num in range(page_count):
        page = doc[page_num]
        text = page.get_text()
        full_text += text + '\\n'
    
    doc.close()
    
    # Clean up text
    full_text = full_text.strip()
    
    # Truncate if needed
    if len(full_text) > ${maxLength}:
        full_text = full_text[:${maxLength}]
    
    result = {
        'text': full_text,
        'pageCount': page_count,
        'method': 'pymupdf_direct'
    }
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

		const python = spawn('python3', ['-c', pythonScript]);
		let stdout = '';
		let stderr = '';

		python.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		python.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		python.on('close', (code) => {
			if (code === 0) {
				try {
					const result = JSON.parse(stdout.trim());
					if (result.error) {
						reject(new Error(`PyMuPDF error: ${result.error}`));
					} else {
						resolve({
							text: result.text || '',
							method: result.method,
							pageCount: result.pageCount
						});
					}
				} catch (parseError) {
					reject(new Error(`Failed to parse PyMuPDF output: ${parseError}`));
				}
			} else {
				console.error('📄 PyMuPDF error:', stderr);
				reject(new Error(`PyMuPDF failed with code ${code}: ${stderr}`));
			}
		});

		python.on('error', (error) => {
			console.error('📄 PyMuPDF spawn error:', error);
			reject(new Error(`Failed to start PyMuPDF: ${error.message}`));
		});
	});
}

/**
 * Extract text from PDF using OCR (for scanned PDFs)
 */
async function extractPDFTextWithOCR(
	pdfPath: string,
	language: string,
	engine: string,
	maxLength: number,
	tempDir: string
): Promise<PDFExtractionResult> {
	return new Promise((resolve, reject) => {
		// First convert PDF to images, then OCR
		const pythonScript = `
import fitz  # PyMuPDF
from PIL import Image
import sys
import json
import os
${engine === 'easyocr' ? 'import easyocr' : ''}
${engine === 'tesseract' ? 'import pytesseract' : ''}

try:
    # Open PDF
    doc = fitz.open('${pdfPath}')
    page_count = len(doc)
    
    all_text = []
    
    ${
			engine === 'easyocr'
				? `
    # Initialize EasyOCR reader
    easyocr_langs = '${language}'.replace('eng', 'en').replace('fin', 'fi').replace('rus', 'ru').split('+')
    reader = easyocr.Reader(easyocr_langs)
    `
				: ''
		}
    
    # Process each page
    for page_num in range(min(page_count, 10)):  # Limit to first 10 pages for performance
        page = doc[page_num]
        
        # Convert page to image
        mat = fitz.Matrix(2, 2)  # 2x zoom for better OCR
        pix = page.get_pixmap(matrix=mat)
        img_path = os.path.join('${tempDir}', f'page_{page_num}.png')
        pix.save(img_path)
        
        # Perform OCR
        ${
					engine === 'easyocr'
						? `
        # EasyOCR
        results = reader.readtext(img_path)
        page_text = ' '.join([text for (bbox, text, confidence) in results])
        `
						: `
        # Tesseract OCR
        image = Image.open(img_path)
        page_text = pytesseract.image_to_string(image, lang='${language}'.replace('+', '+'))
        `
				}
        
        all_text.append(page_text)
        
        # Clean up image file
        try:
            os.remove(img_path)
        except:
            pass
    
    doc.close()
    
    # Combine all text
    full_text = '\\n'.join(all_text).strip()
    
    # Truncate if needed
    if len(full_text) > ${maxLength}:
        full_text = full_text[:${maxLength}]
    
    result = {
        'text': full_text,
        'pageCount': page_count,
        'method': 'pdf_ocr_${engine}'
    }
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

		const python = spawn('python3', ['-c', pythonScript]);
		let stdout = '';
		let stderr = '';

		python.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		python.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		python.on('close', (code) => {
			if (code === 0) {
				try {
					const result = JSON.parse(stdout.trim());
					if (result.error) {
						reject(new Error(`PDF OCR error: ${result.error}`));
					} else {
						resolve({
							text: result.text || '',
							method: result.method,
							pageCount: result.pageCount
						});
					}
				} catch (parseError) {
					reject(new Error(`Failed to parse PDF OCR output: ${parseError}`));
				}
			} else {
				console.error('📄 PDF OCR error:', stderr);
				reject(new Error(`PDF OCR failed with code ${code}: ${stderr}`));
			}
		});

		python.on('error', (error) => {
			console.error('📄 PDF OCR spawn error:', error);
			reject(new Error(`Failed to start PDF OCR: ${error.message}`));
		});
	});
}

export const POST: RequestHandler = async (event) =>
	apiTryCatch(async () => {
		const { request, cookies } = event;

		// Authentication
		const authCookie = cookies.get('pb_auth');
		if (!authCookie) throw new Error('User not authenticated');

		let authData;
		try {
			authData = JSON.parse(authCookie);
			pbServer.pb.authStore.save(authData.token, authData.model);
		} catch {
			throw new Error('Failed to parse auth cookie');
		}

		if (!pbServer.pb.authStore.isValid) throw new Error('User not authenticated');

		const user = pbServer.pb.authStore.model;
		if (!user || !user.id) throw new Error('Invalid user session');

		console.log('📄 PDF Extract - User ID:', user.id);

		// Parse form data
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const language = (formData.get('language') as string) || 'eng+fin+rus';
		const engine = (formData.get('engine') as string) || 'tesseract';
		const maxLength = parseInt((formData.get('maxLength') as string) || '2000');

		if (!file) {
			throw new Error('No file provided');
		}

		if (file.type !== 'application/pdf') {
			throw new Error('File must be a PDF');
		}

		console.log(
			'📄 PDF Extract - Processing:',
			file.name,
			'Engine:',
			engine,
			'Language:',
			language
		);

		// Create temp directory
		const tempDir = join(tmpdir(), 'pdf-extract-' + randomUUID());
		await mkdir(tempDir, { recursive: true });

		// Save uploaded file
		const inputPath = join(tempDir, 'input.pdf');
		const fileBuffer = Buffer.from(await file.arrayBuffer());
		await writeFile(inputPath, fileBuffer);

		let result: PDFExtractionResult;

		try {
			// Try direct text extraction first (faster)
			result = await extractDirectPDFText(inputPath, maxLength);

			// If direct extraction fails or returns minimal text, try OCR
			if (!result.text || result.text.trim().length < 50) {
				console.log('📄 PDF Extract - Direct extraction insufficient, trying OCR...');
				result = await extractPDFTextWithOCR(inputPath, language, engine, maxLength, tempDir);
			}

			console.log('📄 PDF Extract - Success:', {
				textLength: result.text.length,
				method: result.method,
				pageCount: result.pageCount
			});

			return {
				text: result.text,
				confidence: result.confidence,
				method: result.method,
				pageCount: result.pageCount
			};
		} finally {
			// Cleanup temp files
			try {
				await unlink(inputPath);
				// Note: Other temp files in tempDir will be cleaned up by system
			} catch (cleanupError) {
				console.warn('📄 PDF Extract - Cleanup warning:', cleanupError);
			}
		}
	}, 'Internal PDF extraction error');

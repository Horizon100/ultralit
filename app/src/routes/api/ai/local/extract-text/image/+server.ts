// src/routes/api/ai/local/extract-text/image/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiTryCatch } from '$lib/utils/errorUtils';
import * as pbServer from '$lib/server/pocketbase';
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

interface OCRResult {
  text: string;
  confidence?: number;
  method: string;
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

    console.log('📄 OCR Image - User ID:', user.id);

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const language = (formData.get('language') as string) || 'eng+fin+rus';
    const engine = (formData.get('engine') as string) || 'tesseract';
    const maxLength = parseInt((formData.get('maxLength') as string) || '2000');

    if (!file) {
      throw new Error('No file provided');
    }

    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    console.log('📄 OCR Image - Processing:', file.name, 'Engine:', engine, 'Language:', language);

    // Create temp directory
    const tempDir = join(tmpdir(), 'ocr-' + randomUUID());
    await mkdir(tempDir, { recursive: true });

    // Save uploaded file
    const inputPath = join(tempDir, 'input' + getFileExtension(file.name));
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, fileBuffer);

    let result: OCRResult;

    try {
      if (engine === 'easyocr') {
        result = await performEasyOCR(inputPath, language, maxLength);
      } else {
        result = await performTesseractOCR(inputPath, language, maxLength);
      }

      console.log('📄 OCR Image - Success:', {
        textLength: result.text.length,
        confidence: result.confidence,
        method: result.method
      });

      return {
        text: result.text,
        confidence: result.confidence,
        method: result.method
      };

    } finally {
      // Cleanup temp files
      try {
        await unlink(inputPath);
        // Note: rmdir might fail if directory not empty, but that's OK
      } catch (cleanupError) {
        console.warn('📄 OCR Image - Cleanup warning:', cleanupError);
      }
    }
  }, 'Internal OCR image error');

/**
 * Perform OCR using Tesseract
 */
async function performTesseractOCR(
  imagePath: string,
  language: string,
  maxLength: number
): Promise<OCRResult> {
  return new Promise((resolve, reject) => {
    const tesseractArgs = [
      imagePath,
      'stdout',
      '-l', language,
      '--psm', '6', // Uniform block of text
      '--oem', '3', // Default OCR Engine Mode
      '-c', 'tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?;:()-[]{}/"\'@#$%^&*+=<>|\\`~_'
    ];

    console.log('📄 Running tesseract with args:', tesseractArgs);

    const tesseract = spawn('tesseract', tesseractArgs);
    let stdout = '';
    let stderr = '';

    tesseract.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    tesseract.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    tesseract.on('close', (code) => {
      if (code === 0) {
        const text = stdout.trim();
        const truncatedText = maxLength ? text.slice(0, maxLength) : text;
        
        resolve({
          text: truncatedText,
          confidence: undefined, // Tesseract doesn't provide confidence easily
          method: 'tesseract'
        });
      } else {
        console.error('📄 Tesseract error:', stderr);
        reject(new Error(`Tesseract failed with code ${code}: ${stderr}`));
      }
    });

    tesseract.on('error', (error) => {
      console.error('📄 Tesseract spawn error:', error);
      reject(new Error(`Failed to start tesseract: ${error.message}`));
    });
  });
}

/**
 * Perform OCR using EasyOCR (Python)
 */
async function performEasyOCR(
  imagePath: string,
  language: string,
  maxLength: number
): Promise<OCRResult> {
  return new Promise((resolve, reject) => {
    // Map language codes for EasyOCR
    const easyOCRLanguages = language
      .split('+')
      .map(lang => {
        switch (lang) {
          case 'eng': return 'en';
          case 'fin': return 'fi';
          case 'rus': return 'ru';
          default: return lang;
        }
      })
      .join(',');

    const pythonScript = `
import easyocr
import sys
import json

try:
    reader = easyocr.Reader(['${easyOCRLanguages}'])
    results = reader.readtext('${imagePath}')
    
    # Extract text and confidence
    texts = []
    confidences = []
    
    for (bbox, text, confidence) in results:
        texts.append(text)
        confidences.append(confidence)
    
    full_text = ' '.join(texts)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0
    
    # Truncate if needed
    if len(full_text) > ${maxLength}:
        full_text = full_text[:${maxLength}]
    
    result = {
        'text': full_text,
        'confidence': avg_confidence
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
            reject(new Error(`EasyOCR error: ${result.error}`));
          } else {
            resolve({
              text: result.text || '',
              confidence: result.confidence,
              method: 'easyocr'
            });
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse EasyOCR output: ${parseError}`));
        }
      } else {
        console.error('📄 EasyOCR error:', stderr);
        reject(new Error(`EasyOCR failed with code ${code}: ${stderr}`));
      }
    });

    python.on('error', (error) => {
      console.error('📄 EasyOCR spawn error:', error);
      reject(new Error(`Failed to start EasyOCR: ${error.message}`));
    });
  });
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop();
  return ext ? '.' + ext : '';
}
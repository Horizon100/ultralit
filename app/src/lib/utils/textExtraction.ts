// src/lib/utils/textExtraction.ts
import { clientTryCatch } from '$lib/utils/errorUtils';

export interface TextExtractionResult {
  text: string;
  confidence?: number;
  source: 'image' | 'pdf' | 'document';
  method: string;
}

export interface ExtractTextOptions {
  language?: string;
  maxLength?: number;
  ocrEngine?: 'tesseract' | 'easyocr';
}

/**
 * Extract text from various file types for tagging purposes
 */
export async function extractTextFromFile(
  file: File, 
  options: ExtractTextOptions = {}
): Promise<TextExtractionResult | null> {
  const { language = 'eng+fin+rus', maxLength = 2000, ocrEngine = 'tesseract' } = options;

  console.log('📄 Extracting text from file:', file.name, 'Type:', file.type);

  try {
    // Handle different file types
    if (file.type.startsWith('image/')) {
      return await extractTextFromImage(file, { language, maxLength, ocrEngine });
    } else if (file.type === 'application/pdf') {
      return await extractTextFromPDF(file, { language, maxLength, ocrEngine });
    } else if (file.type.includes('text/') || file.name.endsWith('.txt')) {
      return await extractTextFromTextFile(file, { maxLength });
    }

    console.log('📄 Unsupported file type for text extraction:', file.type);
    return null;
  } catch (error) {
    console.error('📄 Text extraction failed:', error);
    return null;
  }
}

/**
 * Extract text from image using OCR
 */
async function extractTextFromImage(
  file: File, 
  options: ExtractTextOptions
): Promise<TextExtractionResult | null> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('language', options.language || 'eng+fin+rus');
  formData.append('engine', options.ocrEngine || 'tesseract');
  formData.append('maxLength', String(options.maxLength || 2000));

  const result = await clientTryCatch(
    fetch('/api/ai/local/extract-text/image', {
      method: 'POST',
      body: formData
    }).then(r => r.json()),
    'Failed to extract text from image'
  );

  if (result.success && result.data?.text) {
    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence,
      source: 'image',
      method: options.ocrEngine || 'tesseract'
    };
  }

  return null;
}

/**
 * Extract text from PDF
 */
async function extractTextFromPDF(
  file: File, 
  options: ExtractTextOptions
): Promise<TextExtractionResult | null> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('language', options.language || 'eng+fin+rus');
  formData.append('engine', options.ocrEngine || 'tesseract');
  formData.append('maxLength', String(options.maxLength || 2000));

  const result = await clientTryCatch(
    fetch('/api/ai/local/extract-text/pdf', {
      method: 'POST',
      body: formData
    }).then(r => r.json()),
    'Failed to extract text from PDF'
  );

  if (result.success && result.data?.text) {
    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence,
      source: 'pdf',
      method: result.data.method || 'pymupdf'
    };
  }

  return null;
}

/**
 * Extract text from text file
 */
async function extractTextFromTextFile(
  file: File, 
  options: ExtractTextOptions
): Promise<TextExtractionResult | null> {
  try {
    const text = await file.text();
    const truncatedText = options.maxLength 
      ? text.slice(0, options.maxLength)
      : text;

    return {
      text: truncatedText.trim(),
      confidence: 1.0,
      source: 'document',
      method: 'direct'
    };
  } catch (error) {
    console.error('📄 Failed to read text file:', error);
    return null;
  }
}

/**
 * Extract text from multiple files
 */
export async function extractTextFromFiles(
  files: File[], 
  options: ExtractTextOptions = {}
): Promise<string[]> {
  console.log('📄 Extracting text from', files.length, 'files');

  const extractionPromises = files.map(file => extractTextFromFile(file, options));
  const results = await Promise.all(extractionPromises);

  const extractedTexts = results
    .filter((result): result is TextExtractionResult => result !== null)
    .map(result => result.text)
    .filter(text => text.length > 0);

  console.log('📄 Extracted text from', extractedTexts.length, 'files');
  return extractedTexts;
}
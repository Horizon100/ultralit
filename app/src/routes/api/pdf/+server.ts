// src/routes/api/pdf/+server.ts - Main PDF analysis endpoint
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import * as pdfjs from 'pdfjs-dist';
import type { PDFAnalysisResult, PDFMetadata } from '$lib/types/types.pdf';

// Configure worker path for pdf.js
if (typeof window === 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).href;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type');
    
    const tempId = crypto.randomUUID();
    const tempPath = join('/tmp', `${tempId}.pdf`);

    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData (file upload)
      const formData = await request.formData();
      const file = formData.get('pdf') as File;
      
      if (!file || file.type !== 'application/pdf') {
        return json({ error: 'Invalid PDF file' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(tempPath, buffer);
    } else {
      // Handle JSON (attachment ID)
      const { attachmentId, pdfUrl, fileName } = await request.json();
      
      if (!pdfUrl) {
        return json({ error: 'PDF URL or file is required' }, { status: 400 });
      }

      console.log('📄 Fetching PDF from URL:', { attachmentId, fileName });

      // Fetch PDF from the provided URL
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        return json({ error: 'Failed to fetch PDF file' }, { status: 500 });
      }

      const buffer = Buffer.from(await pdfResponse.arrayBuffer());
      await writeFile(tempPath, buffer);
    }

    try {
      // Get basic PDF info using pdf.js
      const metadata = await getPDFInfo(tempPath);
      
      // Detect document type
      const documentType = await detectDocumentType(tempPath, metadata);
      
      const result: PDFAnalysisResult = {
        documentType: documentType.type as PDFAnalysisResult['documentType'],
        confidence: documentType.confidence,
        metadata
      };

      return json(result);
    } finally {
      // Clean up temp file
      await unlink(tempPath).catch(() => {});
    }
  } catch (error) {
    console.error('PDF analysis error:', error);
    return json({ error: 'PDF analysis failed' }, { status: 500 });
  }
};

// Utility functions
async function getPDFInfo(filePath: string): Promise<PDFMetadata> {
  try {
    const fs = await import('fs');
    const data = fs.readFileSync(filePath);
    const loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;
    
    const metadata: PDFMetadata = {
      Pages: pdf.numPages.toString(),
      'File size': `${data.length} bytes`
    };
    
    // Try to get document info
    try {
      const info = await pdf.getMetadata();
      if (info.info) {
        metadata.Title = info.info.Title || undefined;
        metadata.Author = info.info.Author || undefined;
        metadata.Subject = info.info.Subject || undefined;
        metadata.Creator = info.info.Creator || undefined;
        metadata.Producer = info.info.Producer || undefined;
        metadata.CreationDate = info.info.CreationDate || undefined;
        metadata.ModDate = info.info.ModDate || undefined;
      }
    } catch (infoError) {
      console.warn('Could not extract PDF metadata:', infoError);
    }
    
    return metadata;
  } catch (error) {
    console.error('PDF info extraction failed:', error);
    throw new Error('Failed to extract PDF information');
  }
}

async function detectDocumentType(filePath: string, metadata: PDFMetadata): Promise<{type: string, confidence: number}> {
  // Extract first page text for analysis
  const text = await extractPDFText(filePath, 1);
  
  // Simple heuristics for document type detection
  const textLower = text.toLowerCase();
  
  // Financial documents indicators
  const financialKeywords = ['invoice', 'receipt', 'total', 'amount', 'payment', 'balance', 'tax', '$', '€', '£'];
  const financialScore = financialKeywords.filter(keyword => textLower.includes(keyword)).length;
  
  // Scientific paper indicators
  const scientificKeywords = ['abstract', 'introduction', 'methodology', 'results', 'conclusion', 'references', 'doi:', 'arxiv'];
  const scientificScore = scientificKeywords.filter(keyword => textLower.includes(keyword)).length;
  
  // Presentation indicators
  const presentationKeywords = ['slide', 'agenda', 'overview', 'outline'];
  const presentationScore = presentationKeywords.filter(keyword => textLower.includes(keyword)).length;
  
  // Table/schedule indicators
  const tableKeywords = ['schedule', 'timetable', 'monday', 'tuesday', 'time:', 'date:', 'calendar'];
  const tableScore = tableKeywords.filter(keyword => textLower.includes(keyword)).length;
  
  // Determine type based on scores
  const scores = {
    financial: financialScore,
    scientific: scientificScore,
    presentation: presentationScore,
    table: tableScore
  };
  
  const maxScore = Math.max(...Object.values(scores));
  const totalKeywords = financialKeywords.length + scientificKeywords.length + presentationKeywords.length + tableKeywords.length;
  
  if (maxScore === 0) {
    return { type: 'unknown', confidence: 0 };
  }
  
  const type = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || 'unknown';
  const confidence = maxScore / totalKeywords;
  
  return { type, confidence };
}

async function extractPDFText(filePath: string, pageCount: number = 1): Promise<string> {
  try {
    const fs = await import('fs');
    const data = fs.readFileSync(filePath);
    const loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;
    
    let text = '';
    const numPages = Math.min(pageCount, pdf.numPages);
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      text += pageText + '\n';
    }
    
    return text;
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    throw new Error('Failed to extract text from PDF');
  }
}
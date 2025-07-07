// src/routes/api/pdf/financial/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type');
    let tempPath: string;
    const tempId = crypto.randomUUID();
    tempPath = join('/tmp', `${tempId}.pdf`);

    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('pdf') as File;
      if (!file) return json({ error: 'No PDF file provided' }, { status: 400 });
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(tempPath, buffer);
    } else {
      const { pdfUrl } = await request.json();
      if (!pdfUrl) return json({ error: 'PDF URL is required' }, { status: 400 });
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) return json({ error: 'Failed to fetch PDF file' }, { status: 500 });
      const buffer = Buffer.from(await pdfResponse.arrayBuffer());
      await writeFile(tempPath, buffer);
    }

    try {
      const analysis = await analyzeFinancialDocument(tempPath);
      return json(analysis);
    } finally {
      await unlink(tempPath).catch(() => {});
    }
  } catch (error) {
    console.error('Financial document analysis error:', error);
    return json({ error: 'Financial document analysis failed' }, { status: 500 });
  }
};

async function analyzeFinancialDocument(filePath: string): Promise<any> {
  const text = await extractFullText(filePath);
  const amounts = extractAmounts(text);
  const dates = extractDates(text);
  const entities = extractBusinessEntities(text);
  const documentType = classifyFinancialDocument(text);
  
  return {
    documentType,
    amounts,
    dates,
    entities,
    totalAmount: findTotalAmount(amounts, text),
    extractedAt: new Date().toISOString()
  };
}

function extractAmounts(text: string): any[] {
  const patterns = [
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
    /€\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
    /£\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*USD/g,
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*EUR/g
  ];
  
  const amounts = [];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      amounts.push({
        value: amount,
        formatted: match[0],
        position: match.index
      });
    }
  });
  
  return amounts.sort((a, b) => b.value - a.value);
}

function extractDates(text: string): string[] {
  const datePatterns = [
    /\d{1,2}\/\d{1,2}\/\d{2,4}/g,
    /\d{1,2}-\d{1,2}-\d{2,4}/g,
    /\d{1,2}\.\d{1,2}\.\d{2,4}/g,
    /\d{4}-\d{1,2}-\d{1,2}/g
  ];
  
  const dates = new Set();
  
  datePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(date => dates.add(date));
    }
  });
  
  return Array.from(dates);
}

function extractBusinessEntities(text: string): string[] {
  const businessKeywords = ['LLC', 'Inc', 'Corp', 'Ltd', 'Company', 'Services', 'Solutions'];
  const lines = text.split('\n');
  const entities = new Set();
  
  lines.forEach(line => {
    if (businessKeywords.some(keyword => line.includes(keyword))) {
      const trimmed = line.trim();
      if (trimmed.length > 5 && trimmed.length < 100) {
        entities.add(trimmed);
      }
    }
  });
  
  return Array.from(entities);
}

function classifyFinancialDocument(text: string): string {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('invoice') || textLower.includes('bill to')) return 'invoice';
  if (textLower.includes('receipt') || textLower.includes('thank you for your purchase')) return 'receipt';
  if (textLower.includes('statement') || textLower.includes('account summary')) return 'statement';
  if (textLower.includes('quote') || textLower.includes('estimate')) return 'quote';
  
  return 'financial_document';
}

function findTotalAmount(amounts: any[], text: string): number | null {
  const totalKeywords = ['total', 'amount due', 'balance', 'sum'];
  const textLower = text.toLowerCase();
  
  for (const keyword of totalKeywords) {
    const keywordIndex = textLower.indexOf(keyword);
    if (keywordIndex !== -1) {
      const nearbyAmounts = amounts.filter(amount => 
        Math.abs(amount.position - keywordIndex) < 100
      );
      
      if (nearbyAmounts.length > 0) {
        return nearbyAmounts[0].value;
      }
    }
  }
  
  return amounts.length > 0 ? amounts[0].value : null;
}
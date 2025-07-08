// src/routes/api/ai/analyze-pdf/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const { text, filename, mode = 'fast' } = await request.json();

    if (!text || typeof text !== 'string') {
      return json({ error: 'Invalid text content' }, { status: 400 });
    }

    // Always return fast basic analysis first
    const basicAnalysis = generateBasicAnalysis(text, filename);

    if (mode === 'fast') {
      // Return immediate basic analysis
      return json({ analysis: basicAnalysis });
    }

    // For AI mode, try AI analysis with fallback
    try {
      const aiAnalysis = await analyzeWithLocalAI(text, filename, request);
      return json({ 
        analysis: aiAnalysis,
        hasAI: true 
      });
    } catch (aiError) {
      console.error('AI analysis failed, returning basic:', aiError);
      return json({ 
        analysis: basicAnalysis + '\n\n⚠️ **AI Analysis Unavailable:** ' + (aiError instanceof Error ? aiError.message : String(aiError)),
        hasAI: false 
      });
    }

  } catch (error) {
    console.error('PDF analysis error:', error);
    return json({ error: 'Failed to analyze PDF' }, { status: 500 });
  }
};

function generateBasicAnalysis(text: string, filename: string): string {
  const wordCount = text.split(/\s+/).filter(word => word.trim().length > 0).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10).length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  const keywords = extractKeywords(text);
  const docType = getDocumentType(text);
  const readingTime = Math.ceil(wordCount / 200); // Average reading speed
  
  return `📄 **${filename}**

📊 **Quick Stats:**
• **Words:** ${wordCount.toLocaleString()}
• **Sentences:** ${sentences}
• **Paragraphs:** ${paragraphs}
• **Reading Time:** ~${readingTime} min

📝 **Document Type:** ${docType}

🏷️ **Key Terms:** ${keywords.slice(0, 8).join(' • ')}

📋 **Summary:**
${generateSmartSummary(text)}

${getDocumentInsights(text)}`;
}

async function analyzeWithLocalAI(text: string, filename: string, originalRequest: Request): Promise<string> {
  // For document analysis, use a better model if available
  const model = 'qwen2.5:7b'; // Better for document analysis than 0.5b
  
  const aiRequest = new Request(new URL('/api/ai/local/generate', originalRequest.url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': originalRequest.headers.get('Cookie') || '',
    },
    body: JSON.stringify({
      prompt: `Analyze this PDF document and provide professional insights:

DOCUMENT: "${filename}"

CONTENT:
${text.slice(0, 8000)} ${text.length > 8000 ? '...' : ''}

Provide a comprehensive analysis including:
1. Document purpose and main objectives
2. Key findings and important information
3. Structure and organization
4. Notable data, figures, or conclusions
5. Practical implications or takeaways

Format your response with clear sections and bullet points for readability.`,
      model,
      system: 'You are a document analysis expert. Provide clear, structured, and actionable insights from documents. Focus on extracting valuable information and practical takeaways.',
      temperature: 0.2,
      max_tokens: 1000,
      auto_optimize: false
    })
  });

  const response = await fetch(aiRequest);

  if (!response.ok) {
    throw new Error(`AI service error: ${response.status}`);
  }

  const result = await response.json();
  
  if (!result.response) {
    throw new Error('No response from AI service');
  }

  return `🤖 **AI Analysis:**

${result.response}

---
*Analysis powered by ${result.model || model}*`;
}

function getDocumentType(text: string): string {
  const lowerText = text.toLowerCase();
  const patterns = [
    { keywords: ['abstract', 'introduction', 'methodology', 'results', 'conclusion'], type: 'Academic Research Paper' },
    { keywords: ['contract', 'agreement', 'terms', 'parties', 'whereas'], type: 'Legal Contract' },
    { keywords: ['invoice', 'receipt', 'payment', 'amount', 'total'], type: 'Financial Document' },
    { keywords: ['manual', 'instructions', 'step', 'procedure', 'guide'], type: 'Manual/Guide' },
    { keywords: ['report', 'analysis', 'findings', 'summary', 'recommendations'], type: 'Business Report' },
    { keywords: ['specification', 'requirements', 'technical', 'design', 'implementation'], type: 'Technical Specification' },
    { keywords: ['policy', 'guidelines', 'procedures', 'rules', 'compliance'], type: 'Policy Document' },
    { keywords: ['proposal', 'project', 'timeline', 'budget', 'deliverables'], type: 'Project Proposal' }
  ];

  for (const pattern of patterns) {
    const matches = pattern.keywords.filter(keyword => lowerText.includes(keyword)).length;
    if (matches >= 2) {
      return pattern.type;
    }
  }

  return 'General Document';
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'among', 'this', 'that', 'these', 'those', 'is', 'are',
    'was', 'were', 'been', 'being', 'have', 'has', 'had', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'do', 'does', 'did', 'get', 'got',
    'said', 'say', 'one', 'two', 'three', 'also', 'more', 'very', 'well', 'first',
    'other', 'than', 'only', 'its', 'which', 'their', 'them', 'each', 'make',
    'most', 'over', 'such', 'take', 'any', 'way', 'even', 'new', 'want', 'because'
  ]);

  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  const wordCounts: { [key: string]: number } = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  return Object.entries(wordCounts)
    .filter(([, count]) => count > 1) // Only words that appear more than once
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([word]) => word);
}

function generateSmartSummary(text: string): string {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  if (sentences.length === 0) return 'No readable content found.';
  
  // Get sentences from different parts of the document
  const firstSentence = sentences[0]?.trim();
  const middleSentence = sentences[Math.floor(sentences.length * 0.3)]?.trim();
  const lastSentence = sentences[sentences.length - 1]?.trim();
  
  if (sentences.length < 3) {
    return `This document discusses: ${firstSentence?.slice(0, 150)}...`;
  }
  
  return `The document begins by addressing ${firstSentence?.slice(0, 60).toLowerCase()}... It covers important aspects including ${middleSentence?.slice(0, 60).toLowerCase()}... The content concludes with ${lastSentence?.slice(0, 60).toLowerCase()}...`;
}

function getDocumentInsights(text: string): string {
  const insights = [];
  
  // Check for numbers/data
  const numbers = text.match(/\d+([.,]\d+)?/g);
  if (numbers && numbers.length > 5) {
    insights.push('📈 Contains significant numerical data');
  }
  
  // Check for dates
  const dates = text.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/g);
  if (dates && dates.length > 0) {
    insights.push('📅 Contains date references');
  }
  
  // Check for structured content
  if (text.includes('•') || text.includes('-') || text.includes('1.') || text.includes('a)')) {
    insights.push('📝 Well-structured with lists/points');
  }
  
  // Check for technical content
  const techTerms = ['algorithm', 'system', 'process', 'method', 'technology', 'software', 'hardware'];
  if (techTerms.some(term => text.toLowerCase().includes(term))) {
    insights.push('⚙️ Contains technical content');
  }
  
  return insights.length > 0 ? `\n🔍 **Insights:** ${insights.join(' • ')}` : '';
}
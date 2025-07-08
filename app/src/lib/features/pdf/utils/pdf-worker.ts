// src/lib/features/pdf/utils/pdf-worker.ts
import * as pdfjsLib from 'pdfjs-dist';

// Use version 3.11.174 worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export { pdfjsLib };
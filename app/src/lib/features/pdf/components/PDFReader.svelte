<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { PDFDocumentProxy } from 'pdfjs-dist';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { loadPDFDocument, extractTextFromPDF, type PDFDocument } from '$lib/features/pdf/utils/pdf';

  export let pdfUrl: string;
  export let onClose: () => void;
  export let enableAI: boolean = false;

  let pdfDocument: PDFDocument | null = null;
  let currentPage = 1;
  let loading = true;
  let error = false;
  let canvas: HTMLCanvasElement;
  let scale = 1.0;
  let extractedText: string[] = [];
  let showAIPanel = false;
  let aiLoading = false;
  let aiResponse = '';
  let pageInput: string = '1';
  let isZooming = false;
  $: {
    // Keep page input in sync with current page
    pageInput = currentPage.toString();
  }

  onMount(async () => {
    try {
      pdfDocument = await loadPDFDocument(pdfUrl);
      loading = false;
      // Wait for the canvas to be available in the DOM
      await new Promise(resolve => setTimeout(resolve, 100));
      await renderPage(currentPage);
    } catch (err) {
      console.error('Failed to load PDF:', err);
      error = true;
      loading = false;
    }
  });

  async function renderPage(pageNum: number) {
    if (!pdfDocument || !canvas) return;

    try {
      const page = await pdfDocument.pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const context = canvas.getContext('2d');
      if (!context) {
        console.error('Could not get canvas context');
        return;
      }
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
    } catch (err) {
      console.error('Error rendering page:', err);
    }
  }

  async function goToPage(pageNum: number) {
    if (!pdfDocument || pageNum < 1 || pageNum > pdfDocument.numPages || !canvas) return;
    currentPage = pageNum;
    await renderPage(currentPage);
  }

  function handlePageInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    
    if (value === '') {
      pageInput = '';
      return;
    }
    
    const pageNum = parseInt(value);
    if (!isNaN(pageNum) && pdfDocument) {
      const clampedPage = Math.max(1, Math.min(pageNum, pdfDocument.numPages));
      pageInput = clampedPage.toString();
      
      if (pageNum >= 1 && pageNum <= pdfDocument.numPages) {
        goToPage(pageNum);
      }
    }
  }

  function handlePageInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const pageNum = parseInt(pageInput);
      if (!isNaN(pageNum) && pdfDocument && pageNum >= 1 && pageNum <= pdfDocument.numPages) {
        goToPage(pageNum);
      } else {
        // Reset to current page if invalid
        pageInput = currentPage.toString();
      }
    }
  }

async function zoomIn() {
    if (!canvas || isZooming) return;
    
    isZooming = true;
    const newScale = Math.min(scale * 1.1, 3.0);
    
    // Add transition class
    canvas.style.transition = 'transform 0.3s ease';
    
    // Apply zoom transition
    const scaleRatio = newScale / scale;
    canvas.style.transform = `scale(${scaleRatio})`;
    
    // Wait for transition, then re-render at new scale
    setTimeout(async () => {
      scale = newScale;
      canvas.style.transition = '';
      canvas.style.transform = '';
      await renderPage(currentPage);
      isZooming = false;
    }, 300);
  }

  async function zoomOut() {
    if (!canvas || isZooming) return;
    
    isZooming = true;
    const newScale = Math.max(scale / 1.2, 0.5);
    
    // Add transition class
    canvas.style.transition = 'transform 0.3s';
    
    // Apply zoom transition
    const scaleRatio = newScale / scale;
    canvas.style.transform = `scale(${scaleRatio})`;
    
    // Wait for transition, then re-render at new scale
    setTimeout(async () => {
      scale = newScale;
      canvas.style.transition = '';
      canvas.style.transform = '';
      await renderPage(currentPage);
      isZooming = false;
    }, 300);
  }


  async function extractText() {
    if (!pdfDocument || extractedText.length > 0) return;
    
    try {
      extractedText = await extractTextFromPDF(pdfDocument.pdf);
    } catch (err) {
      console.error('Error extracting text:', err);
    }
  }

  async function analyzeWithAI() {
    if (!enableAI || !pdfDocument) return;
    
    aiLoading = true;
    showAIPanel = true;
    
    try {
      await extractText();
      const textContent = extractedText.join('\n\n');
      
      const response = await fetch('/api/ai/local/analyze-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textContent,
          filename: pdfDocument.title
        })
      });
      
      const data = await response.json();
      aiResponse = data.analysis || 'No analysis available';
    } catch (err) {
      console.error('Error analyzing PDF:', err);
      aiResponse = 'Error analyzing PDF content';
    } finally {
      aiLoading = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    // Don't handle shortcuts if user is typing in the page input
    if (event.target instanceof HTMLInputElement) return;
    
    // Prevent default behavior to stop parent page scrolling
    event.preventDefault();
    
    switch (event.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        goToPage(currentPage - 1);
        break;
      case 'ArrowRight':
        goToPage(currentPage + 1);
        break;
      case 'ArrowUp':
        goToPage(currentPage - 1);
        break;
      case 'ArrowDown':
        goToPage(currentPage + 1);
        break;
      case '+':
      case '=':
        zoomIn();
        break;
      case '-':
        zoomOut();
        break;
      case 'PageUp':
        goToPage(currentPage - 1);
        break;
      case 'PageDown':
        goToPage(currentPage + 1);
        break;
      case 'Home':
        goToPage(1);
        break;
      case 'End':
        if (pdfDocument) goToPage(pdfDocument.numPages);
        break;
    }
  }

  onDestroy(() => {
    if (pdfDocument) {
      pdfDocument.pdf.destroy();
    }
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="pdf-reader-overlay" on:click={onClose} on:wheel|preventDefault>
  <div class="pdf-reader" on:click|stopPropagation on:wheel|stopPropagation>
    <div class="pdf-header">
      <div class="pdf-title">
        <Icon name="FileText" size={20} />
        <span>{pdfDocument?.title || 'PDF Document'}</span>
      </div>
      <div class="pdf-controls">
        {#if enableAI}
          <button class="control-btn" on:click={analyzeWithAI} disabled={aiLoading}>
            <Icon name="Brain" size={16} />
            {aiLoading ? 'Analyzing...' : 'AI Analysis'}
          </button>
        {/if}
        <button class="control-btn" on:click={() => showAIPanel = !showAIPanel}>
          <Icon name="MessageSquare" size={16} />
        </button>
        <button class="control-btn" on:click={onClose}>
          <Icon name="X" size={16} />
        </button>
      </div>
    </div>

    <div class="pdf-content">
      <div class="pdf-viewer">
        {#if loading}
          <div class="loading">
            <Icon name="Loader" size={24} />
            <span>Loading PDF...</span>
          </div>
        {:else if error}
          <div class="error">
            <Icon name="AlertCircle" size={24} />
            <span>Error loading PDF</span>
          </div>
        {:else if pdfDocument}
          <div class="pdf-toolbar">
            <div class="page-controls">
              <button class="control-btn" on:click={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
                <Icon name="ChevronLeft" size={16} />
              </button>
              
              <div class="page-input-container">
                <input 
                  type="text" 
                  class="page-input"
                  bind:value={pageInput}
                  on:input={handlePageInput}
                  on:keydown={handlePageInputKeydown}
                  placeholder={currentPage.toString()}
                />
                <span class="page-total">of {pdfDocument.numPages}</span>
              </div>
              
              <button class="control-btn" on:click={() => goToPage(currentPage + 1)} disabled={currentPage >= pdfDocument.numPages}>
                <Icon name="ChevronRight" size={16} />
              </button>
            </div>
            <div class="zoom-controls">
              <button class="control-btn" on:click={zoomOut}>
                -
              </button>
              <span>{Math.round(scale * 100)}%</span>
              <button class="control-btn" on:click={zoomIn}>
                +
              </button>
            </div>
          </div>
          <div class="pdf-canvas-container">
            <div class="pdf-canvas-wrapper">
              <canvas bind:this={canvas}></canvas>
            </div>
          </div>
        {/if}
      </div>

{#if showAIPanel && enableAI}
        <div class="ai-panel">
          <div class="ai-header">
            <h3>AI Analysis</h3>
            <button class="control-btn" on:click={() => showAIPanel = false}>
              <Icon name="X" size={16} />
            </button>
          </div>
          <div class="ai-content">
            {#if aiLoading}
              <div class="ai-loading">
                <Icon name="Loader" size={20} />
                <span>Getting quick analysis...</span>
              </div>
            {:else if aiResponse}
              <div class="ai-response">
                {@html aiResponse.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}
              </div>
            {:else}
              <div class="ai-placeholder">
                <Icon name="Brain" size={24} />
                <span>Click "Quick Analysis" for document insights</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}


  .pdf-reader-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 1rem;
    border: 1px solid var(--line-color);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 1000;
  }

  .pdf-reader {
    display: flex;
    background: var(--primary-color);
    border-radius: 1rem;

    width: 90vw;
    height: 100%;
    min-height: 80vh;
    max-width: 1200px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .pdf-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--line-color);

  }

  .pdf-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--text-color);
  }

  .pdf-controls {
    display: flex;
    gap: 8px;
  }

  .control-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border: 1px solid var(--secondary-color);
    background: var(--primary-color);
    color: var(--text-color);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s;
    font-size: 14px;
  }

  .control-btn:hover:not(:disabled) {
    background: var(--bg-color);
  }

  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pdf-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .pdf-viewer {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .pdf-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line-color);
    background: var(--bg-gradient);
  }

  .page-controls, .zoom-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pdf-canvas-container {
    flex: 1;
    overflow: auto;
    padding: 20px;
    background: var(--bg-gradient-r);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    overflow-y: auto;
    		scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: scroll;
		height: 100%;
		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 1rem;
		}
  }

  .pdf-canvas-wrapper {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    min-height: 100%;
    width: 100%;
  }

  .page-input-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .page-input {
    width: auto;
    max-width: 40px;
    padding: 0.25rem;
    border: 1px solid var(--line-color);
    color: var(--text-color);
    border-radius: 0.5rem;
    text-align: center;
    font-size: 14px;
    background: var(--secondary-color);
  }

  .page-input:focus {
    outline: none;
    border-color: var(--tertiary-color);
    box-shadow: 0 0 0 1px var(--tertiary-color);
  }

  .page-total {
    color: var(--placeholder-color);
    font-size: 14px;
    white-space: nowrap;
  }

  .ai-panel {
    width: 400px;
    border-left: 1px solid var(--line-color);

    display: flex;
    flex-direction: column;
    transition: all 0.2s ease;
  }

  .ai-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--line-color);
  }

  .ai-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--tertiary-color);
  }

  .ai-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    	scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: scroll;
		height: 100%;
		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 1rem;
		}
  }

  .ai-loading, .ai-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--text-color);
    gap: 12px;
    min-height: 200px;
  }

  .ai-response {
    line-height: 1.6;
    color: var(--text-color);
    white-space: pre-wrap;
    font-size: 0.85rem;
  }

  .loading, .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 12px;
    color: #6b7280;
  }

  .error {
    color: #dc2626;
  }

  canvas {
    max-width: 100%;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
</style>
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { PDFDocumentProxy } from 'pdfjs-dist';
	import Icon from '$lib/components/ui/Icon.svelte';
	import {
		loadPDFDocument,
		extractTextFromPDF,
		type PDFDocument
	} from '$lib/features/pdf/utils/pdf';
	import DOMPurify from 'dompurify';
	import { t } from '$lib/stores/translationStore'
	import { fly } from 'svelte/transition'

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
	let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let translateX = 0;
let translateY = 0;
let initialTranslateX = 0;
let initialTranslateY = 0;
let viewMode: 'single' | 'all' = 'single';
let allPagesContainer: HTMLDivElement;
let initialDistance = 0;
let initialScale = 1;
let isTouching = false;
	$: {
		pageInput = currentPage.toString();
	}

	onMount(async () => {
		try {
			pdfDocument = await loadPDFDocument(pdfUrl);
			loading = false;
			await new Promise((resolve) => setTimeout(resolve, 100));
			await renderPage(currentPage);
		} catch (err) {
			console.error('Failed to load PDF:', err);
			error = true;
			loading = false;
		}
	});
let intersectionObserver: IntersectionObserver | null = null;

function setupPageVisibilityDetection() {
	if (!allPagesContainer || typeof window === 'undefined') return;
	
	// Clean up existing observer
	if (intersectionObserver) {
		intersectionObserver.disconnect();
	}
	
	// Create intersection observer to detect visible pages
	intersectionObserver = new IntersectionObserver(
		(entries) => {
			// Find the page that's most visible
			let mostVisiblePage = null;
			let maxVisibility = 0;
			
			entries.forEach((entry) => {
				if (entry.isIntersecting && entry.intersectionRatio > maxVisibility) {
					maxVisibility = entry.intersectionRatio;
					const pageWrapper = entry.target as HTMLElement;
					const pageNumber = Array.from(allPagesContainer.children).indexOf(pageWrapper) + 1;
					mostVisiblePage = pageNumber;
				}
			});
			
			// Update current page if we found a visible page
			if (mostVisiblePage && mostVisiblePage !== currentPage) {
				currentPage = mostVisiblePage;
				pageInput = currentPage.toString();
			}
		},
		{
			root: allPagesContainer,
			rootMargin: '-20% 0px -20% 0px', // Only trigger when page is 20% visible
			threshold: [0.1, 0.5, 0.9] // Multiple thresholds for better detection
		}
	);
	
	// Observe all page wrappers
	const pageWrappers = allPagesContainer.querySelectorAll('.page-wrapper');
	pageWrappers.forEach(wrapper => {
		intersectionObserver?.observe(wrapper);
	});
}
async function toggleViewMode() {
	console.log('Toggling view mode from:', viewMode);
	viewMode = viewMode === 'single' ? 'all' : 'single';
	console.log('New view mode:', viewMode);
	
	if (viewMode === 'all') {
		await renderAllPages();
	} else {
		// Clean up intersection observer
		if (intersectionObserver) {
			intersectionObserver.disconnect();
			intersectionObserver = null;
		}
		
		// Clear all pages
		if (allPagesContainer) {
			allPagesContainer.innerHTML = '';
		}
		
		// Wait for Svelte to re-render the single view template
		await new Promise(resolve => setTimeout(resolve, 100));
		
		// Check if canvas is available
		console.log('Canvas available after DOM update?', !!canvas);
		
		if (!canvas) {
			// Wait a bit more for canvas binding
			await new Promise(resolve => setTimeout(resolve, 200));
			console.log('Canvas available after longer wait?', !!canvas);
		}
		
		if (canvas) {
			console.log('Re-rendering current page:', currentPage);
			await renderPage(currentPage);
		} else {
			console.error('Canvas still not available - forcing component update');
			// Force a tick to ensure Svelte updates
			await new Promise(resolve => requestAnimationFrame(resolve));
			if (canvas) {
				await renderPage(currentPage);
			}
		}
	}
}
async function renderAllPages() {
	if (!pdfDocument) {
		console.log('No PDF document available');
		return;
	}
	
	// Wait for DOM to update and allPagesContainer to be available
	await new Promise(resolve => setTimeout(resolve, 100));
	
	if (!allPagesContainer) {
		console.log('allPagesContainer not available yet, waiting...');
		await new Promise(resolve => setTimeout(resolve, 200));
	}
	
	if (!allPagesContainer) {
		console.error('allPagesContainer still not available');
		return;
	}
	
	console.log('Rendering all pages with scale:', scale);
	
	// Clear container
	allPagesContainer.innerHTML = '';
	
	for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
		try {
			const page = await pdfDocument.pdf.getPage(pageNum);
			const viewport = page.getViewport({ scale });

			// Create page wrapper
			const pageWrapper = document.createElement('div');
			pageWrapper.className = 'page-wrapper';
			pageWrapper.dataset.pageNumber = pageNum.toString();
			
			// Add page number
			const pageNumber = document.createElement('div');
			pageNumber.className = 'page-number';
			pageNumber.textContent = `${$t('document.page')} ${pageNum}`;
			pageWrapper.appendChild(pageNumber);

			// Create canvas
			const canvas = document.createElement('canvas');
			canvas.width = viewport.width;
			canvas.height = viewport.height;
			canvas.className = 'pdf-page-canvas';

			const context = canvas.getContext('2d');
			if (!context) continue;

			await page.render({
				canvasContext: context,
				viewport: viewport
			}).promise;

			pageWrapper.appendChild(canvas);
			allPagesContainer.appendChild(pageWrapper);
			
		} catch (err) {
			console.error(`Error rendering page ${pageNum}:`, err);
		}
	}
	
	console.log('All pages rendered, setting up visibility detection...');
	
	// Setup page visibility detection
	await new Promise(resolve => setTimeout(resolve, 100));
	setupPageVisibilityDetection();
}

function handleMouseDown(event: MouseEvent) {
	if (scale <= 1.0) return; 
	
	event.preventDefault();
	isDragging = true;
	dragStartX = event.clientX;
	dragStartY = event.clientY;
	initialTranslateX = translateX;
	initialTranslateY = translateY;
	
	if (canvas) {
		canvas.style.cursor = 'grabbing';
	}
}

function handleMouseMove(event: MouseEvent) {
	if (!isDragging || scale <= 1.0) return;
	
	event.preventDefault();
	
	const deltaX = event.clientX - dragStartX;
	const deltaY = event.clientY - dragStartY;
	
	translateX = initialTranslateX + deltaX;
	translateY = initialTranslateY + deltaY;
	
	updateCanvasTransform();
}

function handleMouseUp(event: MouseEvent) {
	if (!isDragging) return;
	
	isDragging = false;
	
	if (canvas) {
		canvas.style.cursor = scale > 1.0 ? 'grab' : 'zoom-in';
	}
}
function handleTouchStart(event: TouchEvent) {
	if (event.touches.length === 2) {
		event.preventDefault();
		isTouching = true;
		initialScale = scale;
		
		const touch1 = event.touches[0];
		const touch2 = event.touches[1];
		initialDistance = Math.hypot(
			touch2.clientX - touch1.clientX,
			touch2.clientY - touch1.clientY
		);
	}
}
function handleTouchStartDrag(event: TouchEvent) {
	if (event.touches.length === 1 && scale > 1.0) {
		event.preventDefault();
		isDragging = true;
		
		const touch = event.touches[0];
		dragStartX = touch.clientX;
		dragStartY = touch.clientY;
		initialTranslateX = translateX;
		initialTranslateY = translateY;
	}
}

function handleTouchMoveDrag(event: TouchEvent) {
	if (event.touches.length === 1 && isDragging && scale > 1.0) {
		event.preventDefault();
		
		const touch = event.touches[0];
		const deltaX = touch.clientX - dragStartX;
		const deltaY = touch.clientY - dragStartY;
		
		translateX = initialTranslateX + deltaX;
		translateY = initialTranslateY + deltaY;
		
		updateCanvasTransform();
	}
}

function handleTouchEndDrag(event: TouchEvent) {
	if (isDragging && event.touches.length === 0) {
		isDragging = false;
	}
}


function handleTouchStartCombined(event: TouchEvent) {
	if (event.touches.length === 2) {
		
		handleTouchStart(event);
	} else if (event.touches.length === 1) {
		
		handleTouchStartDrag(event);
	}
}

function handleTouchMoveCombined(event: TouchEvent) {
	if (event.touches.length === 2) {
		
		handleTouchMove(event);
	} else if (event.touches.length === 1) {
		
		handleTouchMoveDrag(event);
	}
}

function handleTouchEndCombined(event: TouchEvent) {
	
	handleTouchEnd(event);
	handleTouchEndDrag(event);
}


function updateCanvasTransform() {
	if (canvas) {
		canvas.style.transform = `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`;
	}
}
function handleTouchMove(event: TouchEvent) {
	if (event.touches.length === 2 && isTouching && !isZooming) {
		event.preventDefault();
		
		const touch1 = event.touches[0];
		const touch2 = event.touches[1];
		const currentDistance = Math.hypot(
			touch2.clientX - touch1.clientX,
			touch2.clientY - touch1.clientY
		);
		
		const scaleChange = currentDistance / initialDistance;
		const newScale = Math.max(1.0, Math.min(initialScale * scaleChange, 3.0));
		
		if (canvas) {
			canvas.style.transform = `scale(${newScale / scale})`;
		}
	}
}

function handleTouchEnd(event: TouchEvent) {
	if (isTouching) {
		event.preventDefault();
		isTouching = false;
		
		if (canvas) {
			
			const transform = canvas.style.transform;
			const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
			
			if (scaleMatch) {
				const finalScale = scale * parseFloat(scaleMatch[1]);
				const clampedScale = Math.max(1.0, Math.min(finalScale, 3.0));
				
				
				scale = clampedScale;
				canvas.style.transform = '';
				renderPage(currentPage);
			}
		}
	}
}
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
	if (!pdfDocument || pageNum < 1 || pageNum > pdfDocument.numPages) return;
	
	currentPage = pageNum;
	
	if (viewMode === 'single') {
		if (!canvas) return;
		await renderPage(currentPage);
	} else {
		// In all view, just scroll to the page (don't re-render)
		scrollToPageInAllView(pageNum);
	}
}
function scrollToPageInAllView(pageNum: number) {
	if (!allPagesContainer) return;
	
	// Find the page wrapper for the target page (0-indexed in DOM)
	const pageWrappers = allPagesContainer.querySelectorAll('.page-wrapper');
	const targetPage = pageWrappers[pageNum - 1];
	
	if (targetPage) {
		// Scroll to the page
		allPagesContainer.scrollTo({
			top: (targetPage as HTMLElement).offsetTop - 50,
			behavior: 'smooth'
		});
	}
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
				
				pageInput = currentPage.toString();
			}
		}
	}

async function zoomIn() {
	if (isZooming) return;
	
	// For single view, need canvas
	if (viewMode === 'single' && !canvas) return;

	isZooming = true;
	const newScale = Math.min(scale * 2, 3.0);

	if (viewMode === 'single' && canvas) {
		canvas.style.transition = 'transform 0.3s ease';
		const scaleRatio = newScale / scale;
		canvas.style.transform = `scale(${scaleRatio}) translate(${translateX / scale}px, ${translateY / scale}px)`;
	}

	setTimeout(async () => {
		scale = newScale;
		
		if (viewMode === 'single' && canvas) {
			canvas.style.transition = '';
			canvas.style.cursor = scale > 1.0 ? 'grab' : 'zoom-in';
			await renderPage(currentPage);
			updateCanvasTransform();
		} else if (viewMode === 'all') {
			// For all view, just re-render all pages without transitions
			await renderAllPages();
		}
		
		isZooming = false;
	}, viewMode === 'single' ? 300 : 0); // No delay for all view
}

async function zoomOut() {
	if (isZooming) return;
	
	// For single view, need canvas
	if (viewMode === 'single' && !canvas) return;

	isZooming = true;
	const newScale = Math.max(scale / 2, 1.0);

	if (newScale === 1.0) {
		translateX = 0;
		translateY = 0;
	}

	if (viewMode === 'single' && canvas) {
		canvas.style.transition = 'transform 0.3s';
		const scaleRatio = newScale / scale;
		canvas.style.transform = `scale(${scaleRatio}) translate(${translateX / scale}px, ${translateY / scale}px)`;
	}

	setTimeout(async () => {
		scale = newScale;
		
		if (viewMode === 'single' && canvas) {
			canvas.style.transition = '';
			canvas.style.cursor = scale > 1.0 ? 'grab' : 'zoom-in';
			await renderPage(currentPage);
			updateCanvasTransform();
		} else if (viewMode === 'all') {
			// For all view, just re-render all pages
			await renderAllPages();
		}
		
		isZooming = false;
	}, viewMode === 'single' ? 300 : 0);
}

	function handleCanvasWheel(event: WheelEvent) {
	if (!event.shiftKey || isZooming) return;
	
	event.preventDefault();
	event.stopPropagation();
	
	console.log('Wheel event:', { 
		deltaY: event.deltaY, 
		deltaX: event.deltaX,
		deltaZ: event.deltaZ,
		currentScale: scale 
	});
	
	
	const delta = event.deltaY || event.deltaX || event.deltaZ || 0;
	
	
	if (delta === 0 || delta === -0) {
		
		const wheelEvent = event as any;
		const fallbackDelta = wheelEvent.wheelDelta || wheelEvent.detail || 0;
		
		if (fallbackDelta > 0) {
			console.log('Zooming in (fallback)');
			zoomIn();
		} else if (fallbackDelta < 0) {
			console.log('Zooming out (fallback)');
			zoomOut();
		}
		return;
	}
	
	if (delta > 0) {
		console.log('Zooming out');
		zoomOut();
	} else if (delta < 0) {
		console.log('Zooming in');
		zoomIn();
	}
}

function handleCanvasMouseEnter(event: MouseEvent) {
	if (canvas) {
		canvas.style.cursor = event.shiftKey ? 'zoom-in' : 'grab';
	}
}

function handleCanvasKeyChange(event: KeyboardEvent) {
	if (canvas) {
		canvas.style.cursor = event.shiftKey ? 'zoom-in' : 'grab';
	}
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
					'Content-Type': 'application/json'
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
	if (event.target instanceof HTMLInputElement) return;

	event.preventDefault();

	switch (event.key) {
		case 'Escape':
			onClose();
			break;
		case 'ArrowLeft':
		case 'ArrowUp':
		case 'PageUp':
			goToPage(currentPage - 1);
			break;
		case 'ArrowRight':
		case 'ArrowDown':
		case 'PageDown':
			goToPage(currentPage + 1);
			break;
		case '+':
		case '=':
			zoomIn();
			break;
		case '-':
			zoomOut();
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
	
	if (intersectionObserver) {
		intersectionObserver.disconnect();
	}
});
</script>

<svelte:window on:keydown={handleKeydown} on:keyup={handleCanvasKeyChange} on:keydown={handleCanvasKeyChange} />

<div
	class="pdf-reader-overlay"
	on:click={onClose}
	on:wheel|preventDefault
	on:keydown={(e) => e.key === 'Escape' && onClose()}
	role="button"
	aria-label="Close PDF reader"
	tabindex="0"
>
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->

	<div
		class="pdf-reader"
		on:click|stopPropagation
		on:wheel|stopPropagation
		on:keydown|stopPropagation
		role="dialog"
		aria-modal="true"
		aria-labelledby="pdf-title"
		tabindex="-1"
	>
		<div class="pdf-header">
			<div class="pdf-title">
				<Icon name="FileText" size={20} />
				<span>{pdfDocument?.title || 'PDF Document'}</span>
			</div>

			{#if pdfDocument}
					<div class="pdf-toolbar">
									<div class="pdf-controls">
				{#if enableAI}
					<button 
						class="control-btn" 
						on:click={analyzeWithAI} 
						disabled={aiLoading}
						title="Analyze PDF"
					>
						<Icon name="Brain" size={16} />
						{aiLoading ? 'Analyzing...' : ''}
					</button>
				{/if}
				<button class="control-btn" 
					on:click={() => (showAIPanel = !showAIPanel)}
					title={showAIPanel ? "Hide AI Panel" : "Show AI Panel"}

				>
					<Icon name="MessageSquare" size={16} />
				</button>
				<!-- <button class="control-btn" on:click={onClose}>
					<Icon name="X" size={16} />
				</button> -->
			</div>
				<button 
		class="control-btn view-toggle" 
		on:click={toggleViewMode}
		title={viewMode === 'single' ? 'Show all pages' : 'Show single page'}
	>
		<Icon name={viewMode === 'single' ? 'Layers' : 'Square'} size={16} />
	</button>
						<div class="page-controls" class:hidden={viewMode === 'all'}>
		<button
			class="control-btn"
			on:click={() => goToPage(currentPage - 1)}
			disabled={currentPage <= 1}
		>
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
			|
			<span class="page-total">{pdfDocument.numPages}</span>
		</div>

		<button
			class="control-btn"
			on:click={() => goToPage(currentPage + 1)}
			disabled={currentPage >= pdfDocument.numPages}
		>
			<Icon name="ChevronRight" size={16} />
		</button>
	</div>

						<div class="zoom-controls">
							<button class="control-btn" on:click={zoomOut}> - </button>
							<span>{Math.round(scale * 100)}%</span>
							<button class="control-btn" on:click={zoomIn}> + </button>
						</div>
					</div>

				{/if}
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
<div class="pdf-canvas-container">
	{#if viewMode === 'single'}
		<div class="pdf-canvas-wrapper">
			<canvas 
				bind:this={canvas}
				on:wheel={handleCanvasWheel}
				on:mousedown={handleMouseDown}
				on:mousemove={handleMouseMove}
				on:mouseup={handleMouseUp}
				on:mouseleave={handleMouseUp}
				on:touchstart={handleTouchStartCombined}
				on:touchmove={handleTouchMoveCombined}
				on:touchend={handleTouchEndCombined}
				style="cursor: {scale > 1.0 ? 'grab' : 'zoom-in'}; touch-action: none;"
				tabindex="0"
			></canvas>
		</div>
	{:else}
		<div class="all-pages-container" bind:this={allPagesContainer}>

		</div>
	{/if}
</div>
				{/if}
			</div>

			{#if showAIPanel && enableAI}
				<div 
					class="ai-panel"
					transition:fly={{ x: 200, duration: 150 }}

				>
					<div class="ai-header">
						<h3>AI Analysis</h3>
						<button class="control-btn" on:click={() => (showAIPanel = false)}>
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
	<div class="analysis-container">
		{#if aiResponse.type === 'basic'}
			<div class="basic-analysis">
				<h2 class="filename">📄 {aiResponse.filename}</h2>
				
				<div class="stats-section">
					<h3>📊 Quick Stats:</h3>
					<ul class="stats-list">
						<li><strong>Words:</strong> {aiResponse.stats.words.toLocaleString()}</li>
						<li><strong>Sentences:</strong> {aiResponse.stats.sentences}</li>
						<li><strong>Paragraphs:</strong> {aiResponse.stats.paragraphs}</li>
						<li><strong>Reading Time:</strong> ~{aiResponse.stats.readingTime} min</li>
					</ul>
				</div>

				<div class="doc-type">
					<h3>📝 Document Type:</h3>
					<p>{aiResponse.docType}</p>
				</div>

				<div class="keywords">
					<h3>🏷️ Key Terms:</h3>
					<div class="keyword-tags">
						{#each aiResponse.keywords as keyword}
							<span class="keyword-tag">{keyword}</span>
						{/each}
					</div>
				</div>

				<div class="summary">
					<h3>📋 Summary:</h3>
					<p>{aiResponse.summary}</p>
				</div>

				{#if aiResponse.insights}
					<div class="insights">
						{@html aiResponse.insights}
					</div>
				{/if}
			</div>
		{:else if aiResponse.type === 'ai'}
			<div class="ai-analysis">
				<h2 class="ai-title">🤖 AI Analysis:</h2>
				<div class="ai-content">{aiResponse.content}</div>
				<p class="model-info">Analysis powered by {aiResponse.model}</p>
			</div>
		{/if}
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
	
	* {
		font-family: var(--font-family);
	}
	:root {
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
	}

	.pdf-reader {
		display: flex;
		// background: var(--primary-color);
		border-radius: 1rem;

		width: 100%;
		height: calc(98vh - 6rem);
		max-width: 1600px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.pdf-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		background: var(--bg-gradient);

	}
	.pdf-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;

		
	}

	.page-controls,
	.zoom-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;

	}
// 	.page-controls.hidden {
// 	opacity: 0.5;
// 	pointer-events: none;
// }
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

	.control-btn, .control-button.view-toggle, .page-input-container, {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25 0.75rem;
		border: 1px solid var(--secondary-color);
		background: var(--secondary-color);
		color: var(--placeholder-color);
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background-color 0.2s;
		font-size: 1rem;
	}
	.page-input-container {
		border: 1px solid transparent;
		color: var(--placeholder-color);

	}

	.control-btn:hover:not(:disabled) {
		background: var(--bg-color);
		color: var(--text-color);
	}

	.control-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pdf-content {
		flex: 1;
		display: flex;
		overflow: hidden;
		padding: 0 0.5rem;
		background: var(--bg-gradient-r);
				transition: all 0.2s ease;

	}

	.pdf-viewer {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}



	.pdf-canvas-container {
		flex: 1;
		overflow: auto;
		padding: 1rem;
		display: flex;
		justify-content: center;
		align-items: center;
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
		align-items: center;
		min-height: 100%;
		width: 100%;
		background: transparent;
	}

	.all-pages-container {
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
			background: var(--placeholder-color);
			border-radius: 1rem;
		}
	}

	span.page-total {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		color: var(--placeholder-color);

	}

	.page-input, span.page-total {
		width: 40px;
		height: 100%;
		border-radius: 0.5rem;
		text-align: center;
		text-justify: center;
		font-size: 1rem;
		background: transparent;
		border: 1px solid transparent;
		padding: 0 !important;
		margin: 0;
	}

	.page-input {
		color: var(--tertiary-color);
		font-weight: 800;
		text-justify: center;
		text-align: center;
	}

	.page-input:focus {
		outline: none;
		border: 1px solid var(--tertiary-color);
		box-shadow: 0 0 0 1px var(--tertiary-color);
				background: var(--secondary-color);

	}



	.ai-panel {
		width: 400px;
		background: var(--bg-gradient-left);
		display: flex;
		flex-direction: column;
		transition: all 0.2s ease;
		margin: 0.5rem 0;
		border-radius: 1rem;
		box-shadow: var(--primary-color) 0 0 10px 1px;
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

	.ai-loading,
	.ai-placeholder {
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

	.loading,
	.error {
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
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}
	.page-wrapper {
		display: flex;
		flex-direction: column;

		align-items: flex-end;
	}
:global(.page-number) {
		color: var(--secondary-color);
		padding: 0.25rem 0.5rem;
		justify-content: center;
		font-size: 0.9rem;
		font-style: italic;
		width: auto;
		margin-top: 1rem;
		border-radius: 0.5rem 0.5rem 0 0;
		display: flex;
		background: rgba(from var(--placeholder-color) r g b / 0.9);
		
	}
	analysis-container {
		max-width: 800px;
		margin: 0 auto;
		padding: 1rem;
	}

	.basic-analysis {


		padding: 1.5rem;
	}

	.filename {
		color: var(--tertiary-color);
		margin-bottom: 1rem;
		font-size: 1.25rem;
	}

	.stats-section, .doc-type, .keywords, .summary, .insights {
		margin-bottom: 1.5rem;
	}

	.stats-section h3, .doc-type h3, .keywords h3, .summary h3 {
		color: var(--text-color);
		margin-bottom: 0.5rem;
		font-size: 1rem;
	}
	.doc-type p {
		color: var(--text-color);
		font-size: 0.9rem;
		text-align: right;
	}
	.stats-list {
		list-style: none;
		padding: 0;
	}

	.stats-list li {
		padding: 0.25rem 0;
		text-align: right;
		border-bottom: 1px solid var(--line-color);
	}

	.keyword-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.keyword-tag {
		background: var(--secondary-color);
		color: var(--text-color);
		padding: 0.25rem 0.75rem;
		border-radius: 1rem;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.ai-analysis {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border-radius: 8px;
		padding: 1.5rem;
	}

	.ai-title {
		margin-bottom: 1rem;
		font-size: 1.25rem;
	}

	.ai-content {
		line-height: 1.6;
		margin-bottom: 1rem;
	}

	.model-info {
		font-style: italic;
		opacity: 0.8;
		font-size: 0.875rem;
		border-top: 1px solid rgba(255,255,255,0.2);
		padding-top: 0.5rem;
	}
</style>

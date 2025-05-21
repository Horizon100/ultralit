<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import {
		FileText,
		Image,
		FileSpreadsheet,
		Headphones,
		Video,
		Maximize2,
		Minimize2,
		Link,
		Code,
		Presentation
	} from 'lucide-svelte';
	import PrismJS from 'prismjs';
	import 'prismjs/components/prism-javascript';
	import 'prismjs/components/prism-json';
	import 'prismjs/components/prism-csv';
	import mammoth from 'mammoth';

	// export let file: File | { type: string; name: string; content: string | ArrayBuffer };
	export let file: File;
	export let x: number;
	export let y: number;
	export let transform: { scale: number; offsetX: number; offsetY: number };

	const dispatch = createEventDispatcher();

	let containerElement: HTMLDivElement;
	let isDragging = false;
	let startX: number;
	let startY: number;
	let lastX: number;
	let lastY: number;
	let moveThreshold = 5; // pixels

	let isExpanded = false;
	let fileContent: string | ArrayBuffer | null = null;
	let fileType: string;
	let fileName: string;
	let isClient = false;
	let htmlContent: string = '';
	let hasMoved = false;

	let linkCount = 0;
	let charCount = 0;
	let wordCount = 0;
	let containerWidth: number;
	let containerHeight: number;

	$: {
		if (file instanceof File) {
			fileType = file.type;
			fileName = file.name;
		} else {
			fileType = file.type;
			fileName = file.name;
			fileContent = file.content;
		}
	}

	$: {
		if (containerElement) {
			containerElement.style.setProperty('--x', `${x}px`);
			containerElement.style.setProperty('--y', `${y}px`);
			containerElement.style.setProperty('--scale', transform.scale.toString());
			containerElement.style.setProperty('--offset-x', `${transform.offsetX}px`);
			containerElement.style.setProperty('--offset-y', `${transform.offsetY}px`);
		}
	}
	// //////////////////////////////////////////////////

	// / File type definitions

	function getFileIcon(fileType: string) {
		if (fileType.startsWith('image/')) return Image;
		if (fileType === 'application/pdf') return FileText;
		if (fileType.includes('word')) return FileText;
		if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('csv'))
			return FileSpreadsheet;
		if (fileType.startsWith('audio/')) return Headphones;
		if (fileType.startsWith('video/')) return Video;
		if (
			fileType === 'text/plain' ||
			fileType === 'application/json' ||
			fileType === 'text/javascript' ||
			fileType === 'text/csv'
		)
			return Code;
		if (fileType.includes('presentation') || fileType.includes('powerpoint')) return Presentation;
		return FileText;
	}

	function getGradientBorder(fileType: string) {
		if (fileType.startsWith('image/')) return 'linear-gradient(to right, #4CAF50, #8BC34A)';
		if (fileType === 'application/pdf') return 'linear-gradient(to right, #FF5722, #FF9800)';
		if (fileType.includes('word')) return 'linear-gradient(to right, #2196F3, #03A9F4)';
		if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('csv'))
			return 'linear-gradient(to right, #FFC107, #FFEB3B)';
		if (fileType.startsWith('audio/')) return 'linear-gradient(to right, #9C27B0, #E91E63)';
		if (fileType.startsWith('video/')) return 'linear-gradient(to right, #F44336, #E91E63)';
		if (fileType.startsWith('text/')) return 'linear-gradient(to right, #607D8B, #90A4AE)';
		if (fileType.includes('presentation') || fileType.includes('powerpoint'))
			return 'linear-gradient(to right, #FF9800, #FFC107)';
		return 'linear-gradient(to right, #9E9E9E, #BDBDBD)';
	}

	// //////////////////////////////////////////////////

	// / Mouse events

	function handleMouseDown(event: MouseEvent) {
		isDragging = true;
		startX = event.clientX;
		startY = event.clientY;
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
		event.stopPropagation();
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging) return;
		const dx = (event.clientX - startX) / transform.scale;
		const dy = (event.clientY - startY) / transform.scale;
		x += dx;
		y += dy;
		startX = event.clientX;
		startY = event.clientY;
		dispatch('move', { id: file.name, x, y });
	}

	function handleMouseUp() {
		isDragging = false;
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	}

	function toggleExpand() {
		isExpanded = !isExpanded;
		if (isExpanded && !fileContent) {
			loadFileContent();
		}
	}

	// //////////////////////////////////////////////////

	// / Loading events

	async function loadFileContent() {
		if (file instanceof File) {
			if (
				fileType.startsWith('image/') ||
				fileType.startsWith('video/') ||
				fileType.startsWith('audio/')
			) {
				// Create an object URL for binary files like images, videos, and audio files
				fileContent = URL.createObjectURL(file);
			} else if (fileType === 'application/pdf') {
				fileContent =
					'PDF preview is not available. Please download the file to view its contents.';
			} else if (fileType.includes('word')) {
				const arrayBuffer = await file.arrayBuffer();
				const result = await mammoth.convertToHtml({ arrayBuffer });
				htmlContent = result.value;
			} else if (fileType === 'text/csv') {
				fileContent = await file.text();
				htmlContent = convertCSVToTable(fileContent);
			} else {
				// For text files
				fileContent = await file.text();
			}
		}
	}
	function isValidUrl(str: string) {
		try {
			new URL(str);
			return true;
		} catch {
			return false;
		}
	}

	function getYouTubeEmbedUrl(url: string) {
		const videoId = url.match(
			/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{10,12})\b/
		);
		return videoId ? `https://www.youtube.com/embed/${videoId[1]}` : null;
	}

	function convertCSVToTable(csv: string) {
		const rows = csv.split('\n');
		let table = '<table>';
		rows.forEach((row, index) => {
			table += '<tr>';
			const cells = row.split(',');
			cells.forEach((cell) => {
				table += index === 0 ? `<th>${cell}</th>` : `<td>${cell}</td>`;
			});
			table += '</tr>';
		});
		table += '</table>';
		return table;
	}

	// //////////////////////////////////////////////////

	// / Formatting events

	function highlightCode(code: string | ArrayBuffer | null, language: string): string {
		if (typeof code === 'string' && PrismJS.languages[language]) {
			return PrismJS.highlight(code, PrismJS.languages[language], language);
		}
		return typeof code === 'string' ? code : '';
	}

	onMount(() => {
		isClient = true;
		if (isExpanded && !fileContent) {
			loadFileContent();
		}
	});

	$: FileIcon = getFileIcon(fileType);
	$: gradientBorder = getGradientBorder(fileType);
	$: isWideScreen = containerWidth > 1600;
</script>

<div
	bind:this={containerElement}
	class="file-container"
	class:expanded={isExpanded}
	style="left: {x * transform.scale + transform.offsetX}px; top: {y * transform.scale +
		transform.offsetY}px; transform: scale({transform.scale});"
	on:mousedown={handleMouseDown}
	on:mousemove={handleMouseMove}
	on:mouseup={handleMouseUp}
	on:mouseleave={handleMouseUp}
	transition:fade
	role="button"
	tabindex="0"
	aria-label="File container"
>
	<div class="file-header">
		<div class="file-icon">
			<svelte:component this={FileIcon} size={24} color="gray" />
		</div>
		<span class="file-name">{fileName}</span>
		<button
			class="expand-button"
			on:click={() => {
				isExpanded = !isExpanded;
				loadFileContent();
			}}
		>
			<svelte:component this={isExpanded ? Minimize2 : Maximize2} size={18} color="gray" />
		</button>
	</div>

	{#if isExpanded && isClient}
		<div class="file-content" transition:scale>
			{#if fileType.startsWith('image/') && typeof fileContent === 'string'}
				<img src={fileContent} alt={fileName} />
			{:else if fileType.startsWith('audio/') && typeof fileContent === 'string'}
				<audio controls>
					<source src={fileContent} type={fileType} />
					Your browser does not support the audio element.
				</audio>
			{:else if fileType.startsWith('video/') && typeof fileContent === 'string'}
				<video controls>
					<source src={fileContent} type={fileType} />
					Your browser does not support the video element.
					<track kind="captions" src="path/to/captions.vtt" srclang="en" label="English" />
				</video>
			{:else if fileType === 'application/pdf'}
				<p>{fileContent}</p>
			{:else if fileType.includes('word')}
				<div>{@html htmlContent}</div>
			{:else if fileType === 'text/csv'}
				<div>{@html htmlContent}</div>
			{:else if fileType === 'text/plain' || fileType === 'application/json' || fileType === 'text/javascript'}
				<pre><code
						>{@html highlightCode(
							fileContent,
							fileType === 'application/json' ? 'json' : 'javascript'
						)}</code
					></pre>
			{:else if fileType === 'image/svg+xml' && typeof fileContent === 'string'}
				{@html fileContent}
			{:else if typeof fileContent === 'string'}
				<pre>{fileContent}</pre>
			{/if}
		</div>
	{/if}
</div>

<style>
	.file-container {
		position: absolute;
		top: 0;
		left: 0;
		will-change: transform;

		display: flex;
		flex-direction: column;
		padding: 10px;
		cursor: pointer;
		user-select: none;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		color: black;
		background-color: rgba(58, 48, 48, 0.1);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		/* max-width: 300px; */
		/* max-height: 300px; */
		overflow: hidden;
		transition: all 0.3s ease-in-out;
	}

	.file-container.expanded {
		max-width: 50vw;
		/* height: 80vh; */
		max-width: none;
		user-select: text;
		max-height: none;
		cursor: default;
	}

	.file-header {
		display: flex;
		align-items: center;
	}

	.file-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		margin-right: 8px;
	}

	.file-name {
		font-size: 14px;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex-grow: 1;
	}

	.expand-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		margin-left: 8px;
		transition: all 0.3s ease-in-out;
	}

	.file-content {
		margin-top: 10px;
		overflow: auto;
		max-height: calc(100% - 40px);
		width: 100%;
	}

	img,
	video {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	pre {
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	:global(.file-content table) {
		border-collapse: collapse;
		width: 100%;
	}

	:global(.file-content th),
	:global(.file-content td) {
		border: 1px solid #ddd;
		padding: 8px;
		text-align: left;
	}

	:global(.file-content th) {
		background-color: #f2f2f2;
	}
</style>

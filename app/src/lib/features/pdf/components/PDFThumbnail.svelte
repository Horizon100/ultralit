<!-- src/lib/components/PDFThumbnail.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { generatePDFThumbnail, type PDFThumbnail } from '$lib/features/pdf/utils/pdf';
	import Icon from '$lib/components/ui/Icon.svelte';

	export let pdfUrl: string;
	export let maxWidth: number = 200;
	export let maxHeight: number = 280;
	export let onClick: (() => void) | undefined = undefined;

	let thumbnailData: PDFThumbnail | null = null;
	let loading = true;
	let error = false;

	onMount(async () => {
		try {
			thumbnailData = await generatePDFThumbnail(pdfUrl, maxWidth, maxHeight);
			loading = false;
		} catch (err) {
			console.error('Failed to generate PDF thumbnail:', err);
			error = true;
			loading = false;
		}
	});

	function handleClick() {
		if (onClick) {
			onClick();
		}
	}
</script>

<div
	class="pdf-thumbnail"
	class:clickable={onClick}
	on:click={handleClick}
	on:keydown={(e) => e.key === 'Enter' && handleClick()}
>
	{#if loading}
		<div class="thumbnail-placeholder loading">
			<Icon name="FileText" size={24} />
			<span>Loading...</span>
		</div>
	{:else if error}
		<div class="thumbnail-placeholder error">
			<Icon name="FileText" size={24} />
			<span>PDF Preview</span>
		</div>
	{:else if thumbnailData}
		<div class="thumbnail-container">
			<img
				src={thumbnailData.dataUrl}
				alt="PDF Preview"
				width={thumbnailData.width}
				height={thumbnailData.height}
			/>
			<div class="thumbnail-overlay">
				<Icon name="FileText" size={16} />
			</div>
		</div>
	{/if}
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

	.pdf-thumbnail {
		position: relative;
		display: inline-block;
		border-radius: 1rem;
		overflow: hidden;
		width: 100%;
		height: 100%;
		border: 1px solid var(--line-color);
		transition: all 0.3s ease;
		box-shadow: 0 10px 40px 10px rgba(255, 255, 255, 0.22);
	}

	.pdf-thumbnail.clickable {
		cursor: pointer;
	}

	.pdf-thumbnail.clickable:hover {
		transform: translateY(-2px) scale(1.05);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.thumbnail-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 20px;
		min-height: 120px;
		color: #6b7280;
	}

	.thumbnail-placeholder.loading {
		background: #f3f4f6;
	}

	.thumbnail-placeholder.error {
		background: #fef2f2;
		color: #dc2626;
	}

	.thumbnail-container {
		position: relative;
		display: flex;
	}

	.thumbnail-overlay {
		position: absolute;
		top: 8px;
		right: 8px;
		background: var(--primary-color);
		border-radius: 0.5rem;
		color: var(--tertiary-color);
		padding: 4px;

		display: flex;
		align-items: center;
		justify-content: center;
	}

	.thumbnail-placeholder span {
		margin-top: 8px;
		font-size: 12px;
	}
</style>

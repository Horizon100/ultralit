<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { clientTryCatch } from '$lib/utils/errorUtils';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { pocketbaseUrl } from '$lib/stores/pocketbase';
	import { currentUser } from '$lib/pocketbase';
	import { toast } from '$lib/utils/toastUtils';
	import Toast from '$lib/components/modals/Toast.svelte';
	import type { PostWithInteractions, CommentWithInteractions } from '$lib/types/types.posts';
	import { sidenavStore, showRightSidenav, showSettings } from '$lib/stores/sidenavStore';
	import LocalModelSelector from '$lib/features/ai/components/models/LocalModelSelector.svelte';
	import { prompts, pdfPrompts, getTagsPrompt } from '$lib/features/ai/utils/localPrompts.ts';
	import { t } from '$lib/stores/translationStore';
	// Props
	export let isOpen: boolean = false;
	export let post: PostWithInteractions | CommentWithInteractions;
	export let selectedModel: string = 'qwen2.5:0.5b';

	// Component state
	let loading: boolean = false;
	let analysis: string = '';
	let error: string | null = null;

	type AnalysisType =
		| 'summary'
		| 'sentiment'
		| 'tags'
		| 'custom'
		| 'image_description'
		| 'image_tags'
		| 'image_llava'
		| 'image_generation'
		| 'pdf_auto'
		| 'pdf_tables'
		| 'pdf_scientific'
		| 'pdf_financial'
		| 'pdf_presentation';
	type PDFAnalysisType = 'pdf_tables' | 'pdf_scientific' | 'pdf_financial' | 'pdf_presentation';

	let analysisType: AnalysisType = 'summary';

	let customPrompt: string = '';
	let loadingProgress: string = 'Starting analysis...';
	let selectedImageAttachment: any = null;
	let transcriptionLoading: boolean = false;
	let transcription: string = '';
	let transcriptionError: string | null = null;
	let selectedAudioAttachment: any = null;
	let selectedPdfAttachment: any = null;
	let pdfAnalysisLoading: boolean = false;
	let pdfAnalysisResult: any = null;
	let pdfAnalysisError: string | null = null;
	let detectedPdfType: string | null = null;
	let autoAnalyzingPdf: boolean = false;
	let selectedLocalModel: string = 'qwen2.5:0.5b';

	let progressInterval: number;

	// Loading progress messages
	const progressMessages = [
		'Starting analysis...',
		'Generating image description...',
		'Processing description...',
		'Generating tags...'
	];

	const dispatch = createEventDispatcher<{
		close: void;
    analyzed: { postId: string; analysis: string; type: string; model: string }; 
		modelSelect: { model: string };
	}>();

	$: pdfAttachments =
		post.attachments?.filter(
			(att: any) => att.file_type === 'pdf' || att.mime_type === 'application/pdf'
		) || [];
	$: hasPdfs = pdfAttachments.length > 0;
	$: if (hasPdfs && !selectedPdfAttachment) {
		selectedPdfAttachment = pdfAttachments[0];
	}
	$: imageAttachments = post.attachments?.filter((att: any) => att.file_type === 'image') || [];
	$: hasImages = imageAttachments.length > 0;

	$: if (hasImages && !selectedImageAttachment) {
		selectedImageAttachment = imageAttachments[0];
	}
	$: audioAttachments = post.attachments?.filter((att: any) => att.file_type === 'audio') || [];
	$: hasAudio = audioAttachments.length > 0;

	$: if (hasAudio && !selectedAudioAttachment) {
		selectedAudioAttachment = audioAttachments[0];
	}
	function closeModal() {
		isOpen = false;
		dispatch('close');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeModal();
		}
	}

	function getPrompt(): string {
		if (analysisType.startsWith('pdf_')) {
			const pdfPromptKey = analysisType as keyof typeof pdfPrompts;
			const basePrompt = pdfPrompts[pdfPromptKey] || 'Analyze this PDF content:';
			return `${basePrompt}\n\nPost content: "${post.content}"`;
		}

		let basePrompt: string;

		if (analysisType === 'custom') {
			basePrompt = customPrompt.trim();
		} else if (analysisType === 'tags') {
			basePrompt = getTagsPrompt(5);
		} else {
			const promptKey = analysisType as keyof typeof prompts;
			basePrompt = promptKey in prompts ? prompts[promptKey] : '';
		}

		if (!basePrompt || basePrompt.trim() === '') {
			console.error('Empty prompt for analysis type:', analysisType);
			throw new Error(`No prompt available for analysis type: ${analysisType}`);
		}

		return `${basePrompt}\n\nPost content: "${post.content}"`;
	}

	function debugPrompt() {
		try {
			const prompt = getPrompt();
			console.log('🐛 Debug prompt for', analysisType, ':', prompt);
			return prompt;
		} catch (err) {
			console.error('🐛 Debug prompt error:', err);
			return null;
		}
	}
	let isPlayingTTS: boolean = false;
	let currentAudio: HTMLAudioElement | null = null;

	async function playTTS() {
		if (!post.content.trim()) {
			error = 'No post content to convert to speech';
			return;
		}

		if (isPlayingTTS) {
			// Stop current playback
			if (currentAudio) {
				currentAudio.pause();
				currentAudio = null;
			}
			isPlayingTTS = false;
			return;
		}

		isPlayingTTS = true;
		error = null;

		try {
			const response = await fetch('/api/tts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ text: post.content })
			});

			const result = await response.json();

			if (result.success && result.audio) {
				currentAudio = new Audio(result.audio);

				currentAudio.onended = () => {
					isPlayingTTS = false;
					currentAudio = null;
				};

				currentAudio.onerror = () => {
					isPlayingTTS = false;
					currentAudio = null;
					error = 'Failed to play audio';
				};

				await currentAudio.play();
			} else {
				error = result.error || 'Failed to generate speech';
				isPlayingTTS = false;
			}
		} catch (err) {
			console.error('TTS failed:', err);
			error = 'Failed to generate speech';
			isPlayingTTS = false;
		}
	}

	// Get image URL for attachment
	function getImageUrl(attachment: any): string {
		return `${$pocketbaseUrl}/api/files/7xg05m7gr933ygt/${attachment.id}/${attachment.file_path}`;
	}

	async function analyzeImageTags() {
		if (!selectedImageAttachment) {
			error = 'Please select an image to analyze';
			return;
		}

		loading = true;
		error = null;
		analysis = '';
		loadingProgress = 'Generating image description...';

		console.log('🤖 Starting two-step image tags analysis:', {
			step1: 'moondream:latest (description)',
			step2: selectedModel + ' (tags)',
			postId: post.id
		});

		try {
			// Step 1: Generate description using moondream
			const descriptionRequest = {
				model: 'moondream:latest',
				prompt: prompts.image_description,
				image_url: getImageUrl(selectedImageAttachment),
				is_image_analysis: true,
				auto_optimize: false,
				temperature: 0.7,
				max_tokens: 300
			};

			const descriptionResult = await clientTryCatch(
				fetch('/api/ai/local/generate', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(descriptionRequest)
				}).then((r) => r.json()),
				'Failed to generate image description'
			);

			if (!descriptionResult.success) {
				error = descriptionResult.error;
				loading = false;
				return;
			}

			const description = descriptionResult.data?.data?.response?.trim();
			if (!description) {
				error = 'Failed to generate image description';
				loading = false;
				return;
			}

			console.log('🤖 Description generated, now generating tags...');
			loadingProgress = 'Generating tags from description...';

			// Step 2: Generate tags using the improved prompt from utils
			const tagsPrompt = getTagsPrompt(8);
			const tagsRequest = {
				model: selectedModel,
				prompt: `${tagsPrompt} Image description: "${description}"`,
				auto_optimize: true,
				temperature: 0.3,
				max_tokens: 150
			};

			const tagsResult = await clientTryCatch(
				fetch('/api/ai/local/generate', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(tagsRequest)
				}).then((r) => r.json()),
				'Failed to generate tags from description'
			);

			if (tagsResult.success && tagsResult.data?.data?.response) {
				const responseText = tagsResult.data.data.response.trim();
				console.log('🤖 Raw tags response:', responseText);

				let tagArray: string[];

				try {
					const parsed = JSON.parse(responseText);

					if (Array.isArray(parsed)) {
						tagArray = parsed;
					} else if (parsed.tags && Array.isArray(parsed.tags)) {
						tagArray = parsed.tags;
					} else if (typeof parsed === 'object') {
						// Handle nested structure like {"social media": ["tag1", "tag2"], "category": ["tag3"]}
						tagArray = Object.values(parsed)
							.flat()
							.filter((item) => typeof item === 'string');
					} else {
						throw new Error('Not a valid tag structure');
					}
				} catch {
					if (responseText.includes('\n')) {
						tagArray = responseText
							.split('\n')
							.map((line: string) => line.trim().replace(/^[-•\d+.]\s*/, ''))
							.filter(
								(line: string) => line.length > 0 && !line.includes('{') && !line.includes('"')
							);
					} else if (responseText.includes(',')) {
						tagArray = responseText
							.split(',')
							.map((tag: string) => tag.trim().replace(/['"]/g, ''))
							.filter((tag: string) => tag.length > 0);
					} else {
						tagArray = [responseText.replace(/['"]/g, '')];
					}
				}

				const cleanedTags: string[] = tagArray
					.map((tag: string) => tag.toLowerCase().trim())
					.filter((tag: string) => tag.length > 0 && tag !== 'tags')
					.slice(0, 8);

				analysis = cleanedTags.join(', ');

				console.log('🤖 Final parsed tags:', cleanedTags);
			}
		} catch (err) {
			error = 'Failed to analyze image tags';
			console.error('🤖 Image tags analysis failed:', err);
		}

		loading = false;
	}

async function analyzePost() {
    // Handle PDF analysis first
    if (isPdfAnalysis()) {
        await analyzePdf();
        return;
    }

    // Handle the special case for image_tags
    if (analysisType === 'image_tags') {
        await analyzeImageTags();
        return;
    }

    // Validate inputs
    if (!post.content.trim() && !isImageAnalysis()) {
        error = 'No content to analyze';
        return;
    }

    if (analysisType === 'custom' && !customPrompt.trim()) {
        error = 'Please enter a custom prompt';
        return;
    }

    if (isImageAnalysis() && !selectedImageAttachment) {
        error = 'Please select an image to analyze';
        return;
    }

    loading = true;
    error = null;
    analysis = '';

    // Get the appropriate prompt
    const prompt = getPrompt();
    
    console.log('🤖 Starting local AI analysis:', {
        model: isImageAnalysis() ? 'moondream:latest' : selectedModel,
        type: analysisType,
        postId: post.id,
        hasImage: isImageAnalysis(),
        prompt: prompt.substring(0, 50) + '...' // Log first 50 chars of prompt
    });

    const requestBody: any = {
        model: isImageAnalysis() ? 'moondream:latest' : selectedLocalModel,
        prompt: prompt, // Add the prompt here
        auto_optimize: !isImageAnalysis(),
        temperature: analysisType === 'tags' ? 0.3 : 0.7,
        max_tokens: analysisType === 'summary' ? 150 : 300
    };

    if (isImageAnalysis()) {
        requestBody.image_url = getImageUrl(selectedImageAttachment);
        requestBody.is_image_analysis = true;
    }

    try {
        const analysisResult = await clientTryCatch(
            fetch('/api/ai/local/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            }).then((r) => r.json()),
            'Failed to analyze post with local AI'
        );

        if (analysisResult.success) {
            const result = analysisResult.data;

            if (result.success && result.data?.response) {
                analysis = result.data.response.trim();
                console.log('🤖 Analysis complete:', {
                    model: result.data.model,
                    tokens: result.data.usage?.total_tokens
                });

                dispatch('analyzed', {
                    postId: post.id,
                    analysis,
                    type: analysisType,
					model: isImageAnalysis() ? 'moondream:latest' : selectedLocalModel 

                });
            } else {
                error = result.error || 'No response from AI model';
            }
        } else {
            error = analysisResult.error;
            console.error('🤖 Analysis failed:', analysisResult.error);
        }
    } catch (err) {
        error = 'Failed to complete analysis';
        console.error('🤖 Analysis error:', err);
    } finally {
        loading = false;
    }
}

	function isImageAnalysis(): boolean {
		return (
			analysisType === 'image_description' ||
			analysisType === 'image_tags' ||
			analysisType === 'image_llava'
		);
	}

	// Reset when modal opens
	$: if (isOpen) {
		analysis = '';
		error = null;
		loading = false;
		selectedImageAttachment = hasImages ? imageAttachments[0] : null;
	}
	function getAudioUrl(attachment: any): string {
		return `${$pocketbaseUrl}/api/files/7xg05m7gr933ygt/${attachment.id}/${attachment.file_path}`;
	}

	// Transcribe audio function
	async function transcribeAudio() {
		if (!selectedAudioAttachment) {
			transcriptionError = 'Please select an audio file to transcribe';
			return;
		}

		transcriptionLoading = true;
		transcriptionError = null;
		transcription = '';

		console.log('🎵 Starting audio transcription:', {
			attachment: selectedAudioAttachment.id,
			fileName: selectedAudioAttachment.original_name
		});

		try {
			const audioUrl = getAudioUrl(selectedAudioAttachment);

			const response = await fetch('/api/transcribe', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					audioUrl,
					attachmentId: selectedAudioAttachment.id
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();

			if (result.success && result.transcription) {
				transcription = result.transcription;
				console.log('🎵 Transcription completed successfully');

				// Dispatch transcription event
				dispatch('analyzed', {
					postId: post.id,
					analysis: transcription,
					type: 'transcription'
				});
			} else {
				transcriptionError = result.error || 'Failed to transcribe audio';
			}
		} catch (err) {
			console.error('🎵 Transcription failed:', err);
			transcriptionError = 'Failed to transcribe audio';
		}

		transcriptionLoading = false;
	}

	async function analyzePdf() {
		if (!selectedPdfAttachment) {
			pdfAnalysisError = 'Please select a PDF file to analyze';
			return;
		}

		pdfAnalysisLoading = true;
		pdfAnalysisError = null;
		pdfAnalysisResult = null;
		detectedPdfType = null;

		console.log('📄 Starting PDF analysis:', {
			attachment: selectedPdfAttachment.id,
			fileName: selectedPdfAttachment.original_name,
			analysisType
		});

		try {
			// Use attachment ID method to avoid CORS issues
			const pdfUrl = getPdfUrl(selectedPdfAttachment);

			let apiEndpoint = '/api/pdf';

			// Determine the appropriate API endpoint
			switch (analysisType) {
				case 'pdf_auto':
					apiEndpoint = '/api/pdf';
					break;
				case 'pdf_tables':
					apiEndpoint = '/api/pdf/tables';
					break;
				case 'pdf_scientific':
					apiEndpoint = '/api/pdf/scientific';
					break;
				case 'pdf_financial':
					apiEndpoint = '/api/pdf/financial';
					break;
				case 'pdf_presentation':
					apiEndpoint = '/api/pdf/presentations';
					break;
			}

			// Send attachment info as JSON instead of trying to fetch the file
			const response = await fetch(apiEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					attachmentId: selectedPdfAttachment.id,
					pdfUrl: pdfUrl,
					fileName: selectedPdfAttachment.original_name,
					analysisType: analysisType
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
			}

			const result = await response.json();

			if (result.error) {
				throw new Error(result.error);
			}

			pdfAnalysisResult = result;

			// If auto-detection, store the detected type
			if (analysisType === 'pdf_auto' && result.documentType) {
				detectedPdfType = result.documentType;
			}

			console.log('📄 PDF analysis completed successfully:', result);

			// Format the result for display
			const formattedAnalysis = formatPdfAnalysis(result, analysisType);

			// Dispatch the analysis event
			dispatch('analyzed', {
				postId: post.id,
				analysis: formattedAnalysis,
				type: `pdf_${analysisType}`
			});
		} catch (err) {
			console.error('📄 PDF analysis failed:', err);
			pdfAnalysisError = err instanceof Error ? err.message : 'Failed to analyze PDF';
		}

		pdfAnalysisLoading = false;
	}
	const typeMapping: Record<string, PDFAnalysisType> = {
		table: 'pdf_tables',
		scientific: 'pdf_scientific',
		financial: 'pdf_financial',
		presentation: 'pdf_presentation'
	};

	async function autoAnalyzePdf() {
		if (!selectedPdfAttachment) return;

		autoAnalyzingPdf = true;

		// First, detect document type
		const originalType = analysisType;
		analysisType = 'pdf_auto';
		await analyzePdf();

		// If we detected a specific type, analyze with that type
		if (detectedPdfType && detectedPdfType !== 'unknown') {
			const typeMapping: Record<string, PDFAnalysisType> = {
				table: 'pdf_tables',
				scientific: 'pdf_scientific',
				financial: 'pdf_financial',
				presentation: 'pdf_presentation'
			};

			const specificType = typeMapping[detectedPdfType];
			if (specificType) {
				analysisType = specificType;
				await analyzePdf();
			}
		}

		autoAnalyzingPdf = false;
	}

	// Get PDF URL
	function getPdfUrl(attachment: any): string {
		return `${$pocketbaseUrl}/api/files/7xg05m7gr933ygt/${attachment.id}/${attachment.file_path}`;
	}
	function isPdfAnalysis(): boolean {
		return analysisType.startsWith('pdf_');
	}
	async function analyzePdfByAttachmentId() {
		if (!selectedPdfAttachment) {
			pdfAnalysisError = 'Please select a PDF file to analyze';
			return;
		}

		pdfAnalysisLoading = true;
		pdfAnalysisError = null;
		pdfAnalysisResult = null;
		detectedPdfType = null;

		console.log('📄 Starting PDF analysis by attachment ID:', {
			attachment: selectedPdfAttachment.id,
			fileName: selectedPdfAttachment.original_name,
			analysisType
		});

		try {
			let apiEndpoint = '/api/pdf';

			// Determine the appropriate API endpoint
			switch (analysisType) {
				case 'pdf_auto':
					apiEndpoint = '/api/pdf';
					break;
				case 'pdf_tables':
					apiEndpoint = '/api/pdf/tables';
					break;
				case 'pdf_scientific':
					apiEndpoint = '/api/pdf/scientific';
					break;
				case 'pdf_financial':
					apiEndpoint = '/api/pdf/financial';
					break;
				case 'pdf_presentation':
					apiEndpoint = '/api/pdf/presentations';
					break;
			}

			// Send attachment info instead of file
			const response = await fetch(apiEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					attachmentId: selectedPdfAttachment.id,
					pdfUrl: getPdfUrl(selectedPdfAttachment),
					fileName: selectedPdfAttachment.original_name,
					analysisType: analysisType
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
			}

			const result = await response.json();

			if (result.error) {
				throw new Error(result.error);
			}

			pdfAnalysisResult = result;

			// If auto-detection, store the detected type
			if (analysisType === 'pdf_auto' && result.documentType) {
				detectedPdfType = result.documentType;
			}

			console.log('📄 PDF analysis completed successfully:', result);

			// Format the result for display
			const formattedAnalysis = formatPdfAnalysis(result, analysisType);

			// Dispatch the analysis event
			dispatch('analyzed', {
				postId: post.id,
				analysis: formattedAnalysis,
				type: `pdf_${analysisType}`
			});
		} catch (err) {
			console.error('📄 PDF analysis failed:', err);
			pdfAnalysisError = err instanceof Error ? err.message : 'Failed to analyze PDF';
		}

		pdfAnalysisLoading = false;
	}

	function handleAnalyze() {
		if (!$currentUser) {
			toast.warning('Please sign in to analyze posts');
			return;
		}

		if (analysisType.startsWith('pdf_')) {
			analyzePdf();
		} else {
			analyzePost();
		}
	}

	function isAnyAnalysisLoading(): boolean {
		return loading || pdfAnalysisLoading || autoAnalyzingPdf || transcriptionLoading;
	}

	// Updated formatPdfAnalysis function with better error handling
	function formatPdfAnalysis(result: any, type: string): string {
		if (!result) {
			return 'No analysis result available';
		}

		try {
			switch (type) {
				case 'pdf_auto':
					return `Document Type: ${result.documentType || 'Unknown'} (${Math.round((result.confidence || 0) * 100)}% confidence)\n\nPages: ${result.metadata?.Pages || 'Unknown'}\nTitle: ${result.metadata?.Title || 'No title'}\nAuthor: ${result.metadata?.Author || 'Unknown'}`;

				case 'pdf_tables': {
					const tables = result.tables || [];
					const schedules = result.schedules || [];
					return `Found ${tables.length} table(s) and ${schedules.length} schedule item(s)\n\n${tables.length > 0 ? `First table has ${tables[0]?.rowCount || 0} rows` : 'No tables found'}`;
				}
				case 'pdf_scientific': {
					const sections = Object.keys(result.sections || {});
					return `Scientific Paper Analysis:\nTitle: ${result.metadata?.title || 'Unknown'}\nAuthors: ${result.metadata?.authors?.join(', ') || 'Unknown'}\nSections found: ${sections.join(', ')}\nWord count: ${result.wordCount || 0}\nReferences: ${result.references?.length || 0}`;
				}
				case 'pdf_financial':
					return `Financial Document: ${result.documentType || 'Unknown'}\nTotal Amount: ${result.totalAmount ? '$' + result.totalAmount : 'Not found'}\nAmounts found: ${result.amounts?.length || 0}\nDates found: ${result.dates?.length || 0}\nEntities: ${result.entities?.length || 0}`;

				case 'pdf_presentation':
					return `Presentation Analysis:\nSlides: ${result.slideCount || 0}\nAverage words per slide: ${result.structure?.averageWordsPerSlide || 0}\nTotal bullet points: ${result.structure?.totalBulletPoints || 0}\nTitle slides: ${result.structure?.titleSlides?.length || 0}`;

				default:
					return JSON.stringify(result, null, 2);
			}
		} catch (error) {
			console.error('Error formatting PDF analysis:', error);
			return `Analysis completed but formatting failed. Raw result: ${JSON.stringify(result, null, 2)}`;
		}
	}
	function handlePromptSelect(event: CustomEvent) {
		console.log('Prompt selected:', event.detail);
		dispatch('promptSelect', { prompt: event.detail });
	}
function handleLocalModelSelect(event: CustomEvent) {
	console.log('Local model selected:', event.detail);
	selectedLocalModel = event.detail.model;
	dispatch('modelSelect', { 
		model: event.detail.model,
	});
}
	const slideTransition = (p0: HTMLDivElement, { duration = 180, delay = 0, direction = 1 }) => {
		return {
			delay,
			duration,
			css: (t: number) => {
				const eased = cubicOut(t);
				return `
          		transform: translateX(${(1 - eased) * 360 * direction}%) rotateX(${(1 - eased) * 360 * direction}deg);
          		opacity: ${eased};
        `;
			}
		};
	};

	// Update the reset logic when modal opens
	$: if (isOpen) {
		analysis = '';
		error = null;
		loading = false;
		transcription = '';
		transcriptionError = null;
		transcriptionLoading = false;
		pdfAnalysisResult = null;
		pdfAnalysisError = null;
		pdfAnalysisLoading = false;
		detectedPdfType = null;
		autoAnalyzingPdf = false;
		selectedImageAttachment = hasImages ? imageAttachments[0] : null;
		selectedAudioAttachment = hasAudio ? audioAttachments[0] : null;
		selectedPdfAttachment = hasPdfs ? pdfAttachments[0] : null;
	}
</script>

<!-- <h2 id="modal-title" class="sr-only">AI Analysis Modal</h2> -->

<!-- Modal backdrop -->
{#if isOpen}
	<!-- Modal content -->
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->

	<div
		class="modal-content"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="-1"
		on:click|stopPropagation
		on:keydown={(e) => {
			if (e.key === 'Escape') closeModal();
		}}
		transition:fly={{ y: 50, duration: 300, easing: cubicOut }}
	>
		<!-- Results section -->
		<div class="results-section">
			{#if error}
				<div class="error-message" transition:fly={{ y: -10, duration: 200 }}>
					<Icon name="AlertCircle" size={14} />
					{error}
				</div>
			{/if}

			<!-- Custom prompt input -->
			{#if analysisType === 'custom'}
				<div class="custom-prompt" transition:fly={{ y: -20, duration: 200 }}>
					<label for="custom-prompt-input" class="control-label">Custom Prompt:</label>
					<textarea
						id="custom-prompt-input"
						bind:value={customPrompt}
						placeholder="Enter your analysis prompt..."
						rows="3"
						class="prompt-input"
					></textarea>
				</div>
			{/if}

			<!-- Add debugging information (remove this after testing) -->
			{#if hasPdfs}
				<div
					class="debug-info"
					style="font-size: 0.75rem; color: #666; margin-top: 1rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px;"
				>
					<strong>Debug Info:</strong><br />
					Selected PDF: {selectedPdfAttachment?.original_name}<br />
					Analysis Type: {analysisType}<br />
					Is PDF Analysis: {isPdfAnalysis()}<br />
					PDF URL: {selectedPdfAttachment ? getPdfUrl(selectedPdfAttachment) : 'None'}<br />
				</div>
			{/if}
			{#if pdfAnalysisError}
				<div class="error-message" transition:fly={{ y: -10, duration: 200 }}>
					<Icon name="AlertCircle" size={14} />
					{pdfAnalysisError}
				</div>
			{/if}
			{#if pdfAnalysisResult}
				<div class="analysis-result pdf-result" transition:fly={{ y: 20, duration: 300 }}>
					<div class="result-label">
						<Icon name="FileText" size={14} />
						PDF Analysis:
						{#if detectedPdfType}
							<span class="detected-type">({detectedPdfType})</span>
						{/if}
					</div>

					<div class="analysis-text">
						{formatPdfAnalysis(pdfAnalysisResult, analysisType)}
					</div>

					<!-- Copy button -->
					<button
						class="copy-btn"
						on:click={() =>
							navigator.clipboard.writeText(formatPdfAnalysis(pdfAnalysisResult, analysisType))}
						title="Copy PDF analysis to clipboard"
					>
						<Icon name="Copy" size={14} />
					</button>

					<!-- Show raw data toggle -->
					<details class="raw-data-toggle">
						<summary>View Raw Data</summary>
						<pre class="raw-data">{JSON.stringify(pdfAnalysisResult, null, 2)}</pre>
					</details>
				</div>
			{/if}
			{#if transcriptionError}
				<div class="error-message" transition:fly={{ y: -10, duration: 200 }}>
					<Icon name="AlertCircle" size={14} />
					{transcriptionError}
				</div>
			{/if}

			{#if transcription}
				<div class="analysis-result" transition:fly={{ y: 20, duration: 300 }}>
					<div class="result-label">
						<Icon name="FileText" size={14} />
						Audio Transcription:
					</div>
					<div class="analysis-text">{transcription}</div>

					<!-- Copy button -->
					<button
						class="copy-btn"
						on:click={() => navigator.clipboard.writeText(transcription)}
						title="Copy transcription to clipboard"
					>
						<Icon name="Copy" size={14} />
					</button>
				</div>
			{/if}
			{#if analysis}
				<div class="analysis-result" transition:fly={{ y: 20, duration: 300 }}>
					<div class="result-label">
						<Icon name="Brain" size={14} />
						AI Analysis:
					</div>
					<div class="analysis-text">{analysis}</div>

					<!-- Copy button -->
					<button
						class="copy-btn"
						on:click={() => navigator.clipboard.writeText(analysis)}
						title="Copy to clipboard"
					>
						<Icon name="Copy" size={14} />
					</button>
				</div>
			{/if}
		</div>

		<!-- Analysis type selector -->
		<div class="analysis-controls">
			<div class="analysis-types">
				<!-- Text analysis buttons -->
				<button
					class="type-btn"
					class:active={analysisType === 'summary'}
					on:click={() => (analysisType = 'summary')}
				>
					<Icon name="InfoIcon" size={14} />
					Summary
				</button>
				<button
					class="type-btn"
					class:active={analysisType === 'sentiment'}
					on:click={() => (analysisType = 'sentiment')}
				>
					<Icon name="Heart" size={14} />
					Sentiment
				</button>
				<button
					class="type-btn"
					class:active={analysisType === 'tags'}
					on:click={() => (analysisType = 'tags')}
				>
					<Icon name="Tag" size={14} />
					Tags
				</button>
				<button
					class="type-btn tts-btn"
					class:active={isPlayingTTS}
					on:click={playTTS}
					disabled={!post.content.trim()}
					title={isPlayingTTS ? 'Stop Speech' : 'Read Post Aloud'}
				>
					<Icon name={isPlayingTTS ? 'Square' : 'Volume2'} size={14} />
					{isPlayingTTS ? 'Stop' : 'TTS'}
				</button>
				{#if hasPdfs}
					<button
						class="type-btn pdf-btn"
						class:active={analysisType === 'pdf_auto'}
						on:click={() => (analysisType = 'pdf_auto')}
						disabled={!selectedPdfAttachment}
						title="Auto-detect PDF type and analyze"
					>
						<Icon name="FileSearch" size={14} />
						PDF Auto
					</button>

					<button
						class="type-btn pdf-btn"
						class:active={analysisType === 'pdf_tables'}
						on:click={() => (analysisType = 'pdf_tables')}
						disabled={!selectedPdfAttachment}
						title="Extract tables and schedules"
					>
						<Icon name="Table" size={14} />
						PDF Tables
					</button>

					<button
						class="type-btn pdf-btn"
						class:active={analysisType === 'pdf_scientific'}
						on:click={() => (analysisType = 'pdf_scientific')}
						disabled={!selectedPdfAttachment}
						title="Analyze scientific papers"
					>
						<Icon name="GraduationCap" size={14} />
						PDF Science
					</button>

					<button
						class="type-btn pdf-btn"
						class:active={analysisType === 'pdf_financial'}
						on:click={() => (analysisType = 'pdf_financial')}
						disabled={!selectedPdfAttachment}
						title="Extract financial information"
					>
						<Icon name="DollarSign" size={14} />
						PDF Finance
					</button>

					<button
						class="type-btn pdf-btn"
						class:active={analysisType === 'pdf_presentation'}
						on:click={() => (analysisType = 'pdf_presentation')}
						disabled={!selectedPdfAttachment}
						title="Analyze presentation structure"
					>
						<Icon name="Presentation" size={14} />
						PDF Slides
					</button>
				{/if}

				{#if hasAudio}
					<button
						class="type-btn"
						class:active={transcriptionLoading}
						on:click={transcribeAudio}
						disabled={!selectedAudioAttachment || transcriptionLoading}
						title={transcriptionLoading ? 'Transcribing...' : 'Transcribe Audio to Text'}
					>
						<Icon name={transcriptionLoading ? 'Loader2' : 'FileText'} size={14} />
						{transcriptionLoading ? 'Transcribing...' : 'Transcribe'}
					</button>
				{/if}
				{#if hasImages}
					<button
						class="type-btn"
						class:active={analysisType === 'image_description'}
						on:click={() => (analysisType = 'image_description')}
						disabled={!selectedImageAttachment}
					>
						<Icon name="Image" size={14} />
						Describe Image
					</button>
					<button
						class="type-btn"
						class:active={analysisType === 'image_llava'}
						on:click={() => (analysisType = 'image_llava')}
						disabled={!selectedImageAttachment}
					>
						<Icon name="Eye" size={14} />
						Llava Analysis
					</button>
					<button
						class="type-btn"
						class:active={analysisType === 'image_tags'}
						on:click={() => (analysisType = 'image_tags')}
						disabled={!selectedImageAttachment}
					>
						<Icon name="Tags" size={14} />
						Image Tags
					</button>
				{/if}
				<button
					class="type-btn"
					class:active={analysisType === 'custom'}
					on:click={() => (analysisType = 'custom')}
				>
					<Icon name="Target" size={14} />
					Custom
				</button>
			</div>
			<div class="analysis-types footer">
				<div class="post-meta">
					{$t('chat.model')}:
					<button
						class="model-name"
						on:click={(event) => {
							event.preventDefault();
							if (innerWidth <= 450) {
								// Mobile: close others first
								sidenavStore.hideSettings();
								sidenavStore.hideInput();
							}
							sidenavStore.toggleSettings();
						}}
					>
						{#if analysisType === 'image_tags'}
							moondream:latest → {selectedLocalModel}
						{:else}
							{isImageAnalysis() ? 'moondream:latest' : selectedLocalModel}
						{/if}
					</button>
				</div>
				<button
					class="type-btn analyze"
					on:click={handleAnalyze}
					disabled={loading ||
						pdfAnalysisLoading ||
						autoAnalyzingPdf ||
						transcriptionLoading ||
						(analysisType === 'custom' && !customPrompt.trim()) ||
						(isImageAnalysis() && !selectedImageAttachment) ||
						(analysisType.startsWith('pdf_') && !selectedPdfAttachment)}
				>
					{#if loading || pdfAnalysisLoading || autoAnalyzingPdf || transcriptionLoading}
						{#if autoAnalyzingPdf}
							<Icon name="Loader2" size={14} />
							Auto-analyzing PDF...
						{:else if pdfAnalysisLoading}
							<Icon name="Loader2" size={14} />
							Analyzing PDF...
						{:else if transcriptionLoading}
							<Icon name="Loader2" size={14} />
							Transcribing...
						{:else}
							<div class="spinner"></div>
						{/if}
					{:else if analysisType.startsWith('pdf_')}
						Analyze PDF
					{:else}
						<Icon name="RefreshCcw" size={14} />
					{/if}
				</button>
			</div>
			{#if $showSettings}
				<div
					class="model-selector"
					in:slideTransition={{ direction: -1 }}
					out:slideTransition={{ direction: 1 }}
				>
					<LocalModelSelector
						bind:selectedModel={selectedLocalModel}
						on:change={handleLocalModelSelect}
						showDetails={true}
						placeholder="Choose your local AI model..."
					/>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	.modal-content {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		background: var(--bg-gradient-right);
		// background: var(--bg-gradient);
		border-radius: 1rem 0 0 1rem;
		width: 100%;
		margin: 0;
		max-width: auto;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.post-content {
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		align-items: center;
		gap: 0;
		width: 100%;
		background-color: var(--secondary-color);
		border-radius: 1rem;
		border: 1px solid var(--line-color);
		font-style: italic;
		color: var(--placeholder-color);
		margin-bottom: 0.5rem;
		line-height: 1.5;
		& p {
			width: 100%;
			padding: 0.5rem;
			margin: 0.5rem;
		}
	}

	.post-meta {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.25rem;
		// padding: 0.5rem;
		width: auto;
		font-size: 12px;
		color: var(--placeholder-color);
	}
	.model-selector {
		display: flex;
		justify-content: flex-end;
		margin-right: 1rem;
	}
	.model-name {
		font-weight: 600;
		color: var(--tertiary-color);
		background: var(--primary-color);
		border: 1px solid var(--line-color);
		border-radius: 1rem;
	}

	.analysis-controls {
		width: auto;
	}

	.control-label {
		display: block;
		font-weight: 500;
		color: #374151;
		margin-bottom: 8px;
		font-size: 14px;
	}

	.analysis-types {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: flex-end;
		width: auto;
		gap: 0.5rem;
		padding: 0.5rem;
		&.footer {
			flex-wrap: wrap;
			// align-items: spcace-between;
			flex-direction: row;
			align-items: center;
		}
	}

	.spinner {
		width: 0.5rem;
		height: 0.5rem;
	}

	.type-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		height: 2rem;
		border: 1px solid var(--secondary-color);
		background: var(--primary-color);
		color: var(--placeholder-color);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.7rem;
		font-weight: 500;
		opacity: 0.5;
	}
	.type-btn.analyze {
		background: var(--tertiary-color);
		color: var(--primary-color);
		font-weight: 700;
		letter-spacing: 0.1rem;
		opacity: 1;
	}

	.type-btn:hover {
		border-color: var(--line-color);
		color: var(--text-color);
		background: var(--secondary-color);
		opacity: 0.75;
	}

	.type-btn.active {
		border: var(--tertiary-color) 1px solid;
		background: var(--primary-color);
		color: var(--text-color);
		font-weight: 700;
		opacity: 1;
	}

	.custom-prompt {
		padding: 1rem;
	}

	.prompt-input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid var(--line-color);
		border-radius: 1rem;
		font-size: 14px;
		font-family: inherit;
		resize: vertical;
		min-height: 80px;
		background-color: var(--bg-color);
	}

	.prompt-input:focus {
		outline: none;
		border-color: var(--tertiary-color);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.action-buttons {
		padding: 0 24px 20px;
	}

	.analyze-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: auto;
		padding: 0.5rem;
		background: var(--tertiary-color);
		color: white;
		border: none;
		border-radius: 6px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.analyze-btn:hover:not(:disabled) {
		background: #2563eb;
		transform: translateY(-1px);
	}

	.analyze-btn:disabled {
		background: #9ca3af;
		cursor: not-allowed;
		transform: none;
	}

	.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.results-section {
		padding: 0 1rem 1rem;
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 6px;
		color: #dc2626;
		font-size: 14px;
	}

	.analysis-result {
		margin-top: 1rem;
		position: relative;
		padding: 0.5rem;
		border: 1px solid var(--line-color);
		border-radius: 8px;
	}

	.result-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
		color: var(--tertiary-color);
		margin-bottom: 8px;
		font-size: 14px;
	}

	.analysis-text {
		color: var(--text-color);
		font-size: 0.8rem;
		line-height: 1.6;
		white-space: pre-wrap;
	}

	.copy-btn {
		position: absolute;
		top: 12px;
		right: 12px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		padding: 6px;
		cursor: pointer;
		color: #6b7280;
		transition: all 0.2s;
	}

	.copy-btn:hover {
		background: var(--primary-color);
		color: var(--tertiary-color);
	}
	.image-preview-section {
		border-radius: 0.5rem;
	}

	.image-thumbnails {
		display: flex;
		gap: 0.5rem;
	}

	.image-thumbnail {
		position: relative;
		width: 90px;
		height: 90px;
		border-radius: 0.5rem;
		overflow: hidden;
		cursor: pointer;
		border: 1px solid transparent;
		transition: all 0.2s ease;
	}

	.image-thumbnail:hover {
		border-color: var(--accent-color);
	}

	.image-thumbnail.selected {
		border-color: var(--accent-color);
		box-shadow: 0 0 0 1px var(--accent-color);
	}

	.thumbnail-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumbnail-overlay {
		position: absolute;
		top: 0;
		right: 0;
		background: rgba(0, 0, 0, 0.7);
		border-radius: 0 0 0 6px;
		padding: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-color);
	}

	.image-analysis-types {
		border-top: 1px solid var(--border-color);
	}

	.type-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
	}

	.audio-preview-section {
		margin-bottom: 0.5rem;
	}

	.audio-files {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.audio-file {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border: 2px solid var(--line-color);
		border-radius: 2rem;
		cursor: pointer;
		transition: all 0.2s ease;
		background: var(--bg-color);
	}

	.audio-file:hover {
		border-color: var(--accent-color, #3b82f6);
		background: var(--accent-bg-hover, #f8fafc);
	}

	.audio-file.selected {
		border-color: var(--tertiary-color);
		background: var(--primary-color);
		color: var(--text-color);
	}

	.audio-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: var(--secondary-color);
		border-radius: 50%;
		color: var(--text-color);

		flex-shrink: 0;
	}

	.audio-info {
		flex: 1;
		min-width: 0;
	}

	.audio-name {
		font-weight: 500;
		font-size: 0.8rem;
		color: var(--text-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.audio-meta {
		font-size: 0.7rem;
		color: var(--placeholder-color);
		margin-top: 2px;
	}

	.audio-selection {
		display: flex;
		align-items: center;
		color: var(--accent-color, #3b82f6);
		flex-shrink: 0;
	}

	.transcribe-btn {
		background: var(--accent-color, #3b82f6);
		color: white;
	}

	.transcribe-btn:hover {
		background: var(--accent-hover, #2563eb);
	}

	.transcribe-btn:disabled {
		background: var(--gray-400, #9ca3af);
		cursor: not-allowed;
	}

	.transcribe-btn.active {
		background: var(--warning-color, #f59e0b);
	}

	/* Animation for spinning loader */
	.animate-spin {
		animation: spin 1s linear infinite;
	}
	.pdf-preview-section {
		margin-top: 1rem;
		padding: 0.75rem;
		background: var(--bg-secondary);
		border-radius: 8px;
		border: 1px solid var(--border-color);
	}

	.pdf-files {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.pdf-file {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
		width: 100%;
	}

	.pdf-file:hover {
		background: var(--bg-hover);
		border-color: var(--accent-color);
	}

	.pdf-file.selected {
		background: var(--accent-bg);
		border-color: var(--accent-color);
	}

	.pdf-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: var(--accent-bg);
		border-radius: 4px;
		color: var(--accent-color);
	}

	.pdf-info {
		flex: 1;
		min-width: 0;
	}

	.pdf-name {
		font-weight: 500;
		font-size: 0.875rem;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pdf-meta {
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-bottom: 0.125rem;
	}

	.pdf-size {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.pdf-selection {
		display: flex;
		align-items: center;
		color: var(--accent-color);
	}

	.pdf-auto-analyze {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-color);
	}

	.auto-analyze-btn {
		width: 100%;
		padding: 0.75rem 1rem;
		background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
		color: white;
		border: none;
		border-radius: 6px;
		font-weight: 500;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.auto-analyze-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, var(--accent-hover), var(--accent-color));
		transform: translateY(-1px);
	}

	.auto-analyze-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.type-btn.pdf-btn {
		background: var(--pdf-btn-bg, var(--bg-secondary));
		border-color: var(--pdf-btn-border, var(--border-color));
	}

	.type-btn.pdf-btn:hover:not(:disabled) {
		background: var(--pdf-btn-hover, var(--accent-bg));
		border-color: var(--accent-color);
	}

	.type-btn.pdf-btn.active {
		background: var(--accent-color);
		color: white;
	}

	.analysis-result.pdf-result {
		border-left: 3px solid var(--accent-color);
	}

	.detected-type {
		font-size: 0.75rem;
		color: var(--accent-color);
		font-weight: normal;
		text-transform: capitalize;
	}

	.raw-data-toggle {
		margin-top: 0.75rem;
	}

	.raw-data-toggle summary {
		cursor: pointer;
		font-size: 0.75rem;
		color: var(--text-secondary);
		padding: 0.25rem 0;
	}

	.raw-data {
		background: var(--bg-secondary);
		padding: 0.75rem;
		border-radius: 4px;
		font-size: 0.75rem;
		margin-top: 0.5rem;
		max-height: 200px;
		overflow-y: auto;
		border: 1px solid var(--border-color);
	}

	/* Animation for spinning loader */
	:global(.animate-spin) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* Dark mode support */
	:global(.dark) .pdf-preview-section {
		--bg-secondary: #1f2937;
		--border-color: #374151;
	}

	:global(.dark) .pdf-file {
		--bg-primary: #111827;
		--bg-hover: #1f2937;
	}

	:global(.dark) .auto-analyze-btn {
		background: linear-gradient(135deg, #3b82f6, #2563eb);
	}

	:global(.dark) .raw-data {
		--bg-secondary: #111827;
		--border-color: #374151;
	}
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
	/* Responsive */
	@media (max-width: 640px) {
		.modal-content {
			margin: 10px;
			max-height: 95vh;
		}

		.analysis-types {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>

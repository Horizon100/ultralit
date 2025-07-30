<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import { currentUser } from '$lib/pocketbase';
	import { t } from '$lib/stores/translationStore';
	import { processVideoAttachments } from '$lib/utils/videoHandlers';
	import { getAvatarUrl } from '$lib/features/users/utils/avatarHandling';
	import RecordButton from '$lib/components/buttons/RecordButton.svelte';
	import {
		processPostTaggingAsync,
		shouldGenerateTags,
		type LocalTaggingOptions
	} from '$lib/features/posts/utils/postTagging';
	import { defaultModel } from '$lib/features/ai/utils/models';
	import type { AIModel } from '$lib/types/types';
	import { clientTryCatch, isFailure } from '$lib/utils/errorUtils';
	import { postStore } from '$lib/stores/postStore';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import type { PostWithInteractions } from '$lib/types/types.posts';
	import {
		processAttachmentTaggingAsync,
		supportsTextExtraction,
		supportsImageAnalysis,
		isPdfFile,
		type AttachmentTaggingOptions
	} from '$lib/features/posts/utils/attachmentTagging';
	import { extractPdfKeywords } from '$lib/utils/pdfKeywordExtractor';
	import Avatar from '$lib/features/users/components/Avatar.svelte';

	export let placeholder: string = $t('posts.textareaPlaceholder') as string;
	export let buttonText: string = $t('posts.postButton') as string;
	export let initialContent: string = '';
	export let disabled: boolean = false;
	export let parentId: string | undefined = undefined;
	export let showAttachments: boolean = true;
	export let enableAutoTagging: boolean = true;
	export let taggingModel: string = 'qwen2.5:0.5b';
	export let includeAttachmentText: boolean = true;
	export let ocrLanguage: string = 'eng+fin+rus';
	export let ocrEngine: 'tesseract' | 'easyocr' = 'tesseract';
	export let maxTags: number = 5;
	export let taggingTemperature: number = 0.3;

	export let enableAttachmentTagging: boolean = true;
	export let attachmentTaggingModel: string = 'qwen2.5:0.5b';
	export let attachmentImageDescriptionModel: string = 'moondream:latest';
	export let attachmentMaxTags: number = 8;
	export let attachmentTaggingTemperature: number = 0.3;

	let content = initialContent;
	let attachments: File[] = [];
	let fileInput: HTMLInputElement;
	let isSubmitting = false;
	let isGeneratingTags = false;
	let willGenerateTags = false;

	let isGeneratingAttachmentTags = false;
	let attachmentsWithTaggingSupport: Array<{
		file: File;
		supportsText: boolean;
		supportsImage: boolean;
	}> = [];

	const dispatch = createEventDispatcher<{
		submit: { content: string; attachments: File[]; parentId?: string };
		postCreated: { postId: string; post: PostWithInteractions };
		taggingComplete: { postId: string; success: boolean };
	}>();
	let textareaElement: HTMLTextAreaElement;

	// Reactive check for tag generation eligibility
	$: {
		if (enableAutoTagging && content) {
			willGenerateTags = shouldGenerateTags(content);
		} else {
			willGenerateTags = false;
		}
	}

	function autoResize(element: HTMLTextAreaElement) {
		element.style.height = 'auto';

		const newHeight = Math.min(element.scrollHeight, window.innerHeight * 0.5);
		element.style.height = newHeight + 'px';

		if (element.scrollHeight > window.innerHeight * 0.5) {
			element.classList.add('scrollable');
		} else {
			element.classList.remove('scrollable');
		}
	}
	function handleRecordingComplete(event: CustomEvent<{ audioFile: File }>) {
		attachments = [...attachments, event.detail.audioFile];
	}
	function handleInput(event: Event) {
		const target = event.target as HTMLTextAreaElement;
		autoResize(target);
	}

	$: if (textareaElement && content !== undefined) {
		autoResize(textareaElement);
	}
	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files) {
			attachments = Array.from(target.files);
		}
	}

	function removeAttachment(index: number) {
		attachments = attachments.filter((_, i) => i !== index);
	}

	async function handleSubmit() {
		console.log('🎮🎮🎮 POST COMPOSER SUBMIT - START');
		console.log('📝 Content:', content);
		console.log('📎 Attachments:', attachments);
		console.log('🔗 Parent ID:', parentId);
		console.log('👤 Current user:', $currentUser?.id);

		if (!content.trim() || isSubmitting) {
			console.log('❌ Cannot submit: no content or already submitting');
			return;
		}

		if (!$currentUser?.id) {
			console.error('❌ No authenticated user found');
			alert('You must be logged in to create a post');
			return;
		}

		// Check if this is a comment (has parentId) - if so, dispatch event instead of direct API call
		if (parentId) {
			console.log('📤 This is a comment - dispatching submit event to parent');

			let processedAttachments = attachments;

			// Show conversion progress for videos
			if (attachments.some((f) => f.type.startsWith('video/'))) {
				console.log('Converting videos...');
				processedAttachments = await processVideoAttachments(attachments);
				console.log('Video conversion complete');
			}

			const submitData = {
				content: content.trim(),
				attachments: processedAttachments,
				parentId
			};

			console.log('📤 Dispatching submit event with data:', submitData);

			try {
				dispatch('submit', submitData);
				console.log('✅ POST COMPOSER: Submit event dispatched successfully');

				// Reset form after dispatching
				content = '';
				attachments = [];
				willGenerateTags = false;
				attachmentsWithTaggingSupport = [];
				if (fileInput) fileInput.value = '';

				// Reset textarea height
				if (textareaElement) {
					textareaElement.style.height = 'auto';
				}
			} catch (error) {
				console.error('❌ POST COMPOSER: Error dispatching submit event:', error);
			}

			console.log('🎮🎮🎮 POST COMPOSER SUBMIT - END (Comment dispatched)');
			return;
		}

		// Original logic for top-level posts (no parentId)
		console.log('📝 This is a top-level post - using direct API call');

		isSubmitting = true;
		const shouldTag = enableAutoTagging && willGenerateTags;
		const shouldTagAttachments =
			enableAttachmentTagging &&
			attachmentsWithTaggingSupport.some((a) => a.supportsText || a.supportsImage);

		// Check if we have PDF files for tagging
		const hasPdfFiles = attachments.some((file) => file.type === 'application/pdf');
		const shouldTagPdf = hasPdfFiles && enableAttachmentTagging;

		console.log('📄 PDF tagging check:', { hasPdfFiles, shouldTagPdf });

		const contentToTag = content.trim(); // Store content before reset

		try {
			let processedAttachments = attachments;

			// Show conversion progress for videos
			if (attachments.some((f) => f.type.startsWith('video/'))) {
				console.log('Converting videos...');
				processedAttachments = await processVideoAttachments(attachments);
				console.log('Video conversion complete');
			}

			// FIXED: Create FormData and make direct fetch with explicit cookie handling
			console.log('🔧 Creating FormData for direct API call...');

			const formData = new FormData();
			formData.append('content', contentToTag);
			formData.append('user', $currentUser.id);

			// Add parent ID if this is a comment
			if (parentId) {
				formData.append('parent', parentId);
			}

			// Add attachments if any
			if (processedAttachments.length > 0) {
				processedAttachments.forEach((file, index) => {
					formData.append(`attachment_${index}`, file);
				});
			}

			console.log('📡 Making direct fetch request to /api/posts...');

			// Make the request with explicit cookie handling
			const response = await fetch('/api/posts', {
				method: 'POST',
				body: formData,
				credentials: 'include', // Ensure cookies are sent
				headers: {
					// Don't set Content-Type - let browser set it for FormData
					// 'Accept': 'application/json'
				}
			});

			console.log('📡 Response status:', response.status);
			console.log('📡 Response ok:', response.ok);

			if (!response.ok) {
				const errorText = await response.text();
				console.error('❌ API Error Response:', errorText);
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			const result = await response.json();
			console.log('📡 API Response:', result);

			// Handle the response - check if it's wrapped in apiTryCatch structure
			let newPost;
			if (result.success && result.data) {
				// Response is wrapped in apiTryCatch structure
				newPost = result.data;
			} else if (result.id) {
				// Direct post object
				newPost = result;
			} else {
				throw new Error('Invalid response format from server');
			}

			const postId = newPost.id;
			console.log('✅ Post created successfully with ID:', postId);

			// Update the post store manually since we bypassed it
			postStore.update((state) => ({
				...state,
				posts: [newPost, ...state.posts]
			}));

			// Dispatch post creation event
			dispatch('postCreated', { postId, post: newPost });

			// Handle post content tagging
			if (shouldTag && postId && $currentUser?.id) {
				console.log('🏷️ Starting local auto-tagging for post:', postId);

				try {
					// Build tagging options for local AI
					const taggingOptions: LocalTaggingOptions = {
						model: taggingModel,
						maxTags: maxTags,
						temperature: taggingTemperature,
						includeAttachments: includeAttachmentText,
						ocrLanguage: ocrLanguage,
						ocrEngine: ocrEngine
					};

					console.log('🏷️ Tagging options:', taggingOptions);

					// Store attachments for tagging before they get reset
					const attachmentsToTag = [...attachments];

					// Call the local async tagging function with attachments
					processPostTaggingAsync(
						contentToTag,
						postId,
						$currentUser.id,
						attachmentsToTag,
						taggingOptions
					);

					// Dispatch tagging started event
					dispatch('taggingComplete', { postId, success: true });
					console.log('🏷️ Local auto-tagging initiated successfully for post:', postId);
				} catch (taggingError) {
					console.error('❌ Error starting local auto-tagging:', taggingError);
					dispatch('taggingComplete', { postId, success: false });
				}
			} else if (shouldTag && !postId) {
				console.error('❌ Cannot start auto-tagging: no post ID received');
			}

			// Handle attachment tagging (including PDF files)
			if (
				(shouldTagAttachments || shouldTagPdf) &&
				newPost.attachments &&
				newPost.attachments.length > 0
			) {
				console.log(
					'🏷️ Starting attachment tagging for',
					newPost.attachments.length,
					'attachments'
				);

				try {
					// Build attachment tagging options
					const attachmentTaggingOptions: AttachmentTaggingOptions = {
						model: attachmentTaggingModel,
						maxTags: attachmentMaxTags,
						temperature: attachmentTaggingTemperature,
						imageDescriptionModel: attachmentImageDescriptionModel,
						includeImageAnalysis: true,
						ocrLanguage: ocrLanguage,
						ocrEngine: ocrEngine
					};

					console.log('🏷️ Attachment tagging options:', attachmentTaggingOptions);

					// Prepare attachment data for tagging
					const attachmentsForTagging = newPost.attachments.map(
						(attachment: any, index: number) => ({
							id: attachment.id,
							postId: postId,
							attachment: attachments[index] // Use the original File object for PDF processing
						})
					);

					// Log PDF files being processed
					const pdfAttachments = attachmentsForTagging.filter(
						({ attachment }) => attachment instanceof File && attachment.type === 'application/pdf'
					);
					if (pdfAttachments.length > 0) {
						console.log(
							'📄 Found',
							pdfAttachments.length,
							'PDF files for tagging:',
							pdfAttachments.map((a) => a.attachment.name)
						);
					}

					// Start async attachment tagging
					processAttachmentTaggingAsync(attachmentsForTagging, attachmentTaggingOptions);

					console.log(
						'🏷️ Attachment tagging initiated for',
						attachmentsForTagging.length,
						'attachments'
					);
				} catch (attachmentTaggingError) {
					console.error('❌ Error starting attachment tagging:', attachmentTaggingError);
				}
			}

			// Reset form
			content = '';
			attachments = [];
			willGenerateTags = false;
			attachmentsWithTaggingSupport = [];
			if (fileInput) fileInput.value = '';

			// Reset textarea height
			if (textareaElement) {
				textareaElement.style.height = 'auto';
			}
		} catch (err) {
			console.error('❌ Error submitting post:', err);
			alert('Failed to create post: ' + (err instanceof Error ? err.message : 'Unknown error'));
		} finally {
			isSubmitting = false;
		}

		console.log('🎮🎮🎮 POST COMPOSER SUBMIT - END (Top-level post)');
	}

	$: taggableAttachments = attachmentsWithTaggingSupport.filter(
		(a) => a.supportsText || a.supportsImage
	).length;

	function getFilePreview(file: File): string {
		if (file.type.startsWith('image/')) {
			return URL.createObjectURL(file);
		}
		return '';
	}

	$: if (initialContent && !content) {
		content = initialContent;
	}

	$: extractableFiles = attachments.filter(supportsTextExtraction).length;

	$: {
		if (enableAttachmentTagging && attachments.length > 0) {
			attachmentsWithTaggingSupport = attachments.map((file) => ({
				file,
				supportsText: supportsTextExtraction(file),
				supportsImage: supportsImageAnalysis(file)
			}));
		} else {
			attachmentsWithTaggingSupport = [];
		}
	}
</script>

<div class="post-composer">
	<div class="composer-header">
		<Avatar user={$currentUser} size={30} className="user-avatar" />
		<textarea
			bind:this={textareaElement}
			class="composer-textarea"
			placeholder="What's happening?"
			bind:value={content}
			on:input={handleInput}
			on:paste={() => {
				setTimeout(() => {
					if (textareaElement) autoResize(textareaElement);
				}, 10);
			}}
		></textarea>
	</div>

	{#if attachments.length > 0}
		<div class="attachments-preview">
			{#each attachments as file, index}
				<div class="attachment-item">
					{#if file.type.startsWith('image/')}
						<div class="attachment-image-preview">
							<img src={getFilePreview(file)} alt={file.name} class="preview-image" />
							<button
								class="remove-attachment-image"
								on:click={() => removeAttachment(index)}
								type="button"
								title="Remove image"
							>
								<Icon name="X" size={16} />
							</button>
						</div>
					{:else if file.type.startsWith('application/pdf')}
						<div class="attachment-file-preview">
							<!-- <Icon name="Paperclip" size={16} /> -->
							<button
								class="remove-attachment"
								on:click={() => removeAttachment(index)}
								type="button"
								title="Remove file"
							>
								<Icon name="X" size={16} />
							</button>
							<span class="attachment-badge"> PDF </span>

							<span class="attachment-name">{file.name}</span>
						</div>
					{:else}
						<div class="attachment-file-preview">
							<button
								class="remove-attachment"
								on:click={() => removeAttachment(index)}
								type="button"
								title="Remove file"
							>
								<Icon name="X" size={16} />
							</button>
							<Icon name="Paperclip" size={16} />
							<span class="attachment-name">{file.name}</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Auto-tagging indicator -->
	{#if enableAutoTagging && (willGenerateTags || isGeneratingTags)}
		<div class="tagging-status">
			<div class="tagging-indicator">
				<Icon name="Tag" size={14} />
				{#if isGeneratingTags}
					<span class="tagging-text generating">Generating tags...</span>
				{:else if willGenerateTags}
					<span class="tagging-text ready">
						Auto-tags will be generated
						{#if includeAttachmentText && extractableFiles > 0}
							(including {extractableFiles} attachment{extractableFiles > 1 ? 's' : ''})
						{/if}
					</span>
				{/if}
			</div>
		</div>
	{/if}

	<div class="composer-actions">
		{#if showAttachments}
			<div class="composer-options">
				<input
					type="file"
					multiple
					accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
					on:change={handleFileSelect}
					class="file-input"
					bind:this={fileInput}
				/>
				<button
					class="composer-option-button"
					on:click={() => fileInput?.click()}
					type="button"
					title="Add attachments"
					disabled={disabled || isSubmitting}
				>
					<Icon name="Paperclip" size={16} />
					{#if attachments.length > 0}
						<span class="attachment-count">{attachments.length}</span>
					{/if}
				</button>
				<RecordButton
					disabled={disabled || isSubmitting}
					on:recordingComplete={handleRecordingComplete}
					on:recordingStart={() => console.log('Recording started')}
					on:recordingStop={() => console.log('Recording stopped')}
					on:recordingCancel={() => console.log('Recording cancelled')}
				/>
			</div>
		{/if}
		<button
			class="post-button"
			class:active={content.trim() && !isSubmitting}
			on:click={handleSubmit}
			disabled={!content.trim() || isSubmitting || disabled}
		>
			<Icon name="Send" size={16} />
			{isSubmitting ? $t('posts.posting') : ''}
		</button>
	</div>
</div>

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.post-composer {
		// background: var(--primary-color);
		background: transparent !important;
		border-radius: 2rem !important;
		padding: 1rem;
		height: auto;
	}

	.composer-header {
		display: flex;
		gap: 12px;
		margin-bottom: 12px;
	}

	.composer-avatar {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--line-color);
		flex-shrink: 0;
	}

	.composer-textarea {
		background: transparent;
		border: none;
		resize: none;
		font-size: 16px;
		color: var(--text-color);
		font-family: var(--font-family);
		line-height: 1.5;
		outline: none;
		overflow: hidden; /* Hide scrollbar initially */
		min-height: 2.5rem; /* Start with smaller min-height */
		max-height: 50vh;
		width: 100%;
		box-sizing: border-box;
		display: flex;
		scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: scroll;
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

	.composer-textarea::placeholder {
		color: var(--placeholder-color);
	}

	/* Only show scrollbar when content exceeds max-height */
	.composer-textarea.scrollable {
		overflow-y: auto;
	}

	.composer-textarea::-webkit-scrollbar {
		width: 0.5rem;
		background-color: transparent;
	}

	.composer-textarea::-webkit-scrollbar-track {
		background: transparent;
	}

	.composer-textarea::-webkit-scrollbar-thumb {
		background: var(--secondary-color);
		border-radius: 1rem;
	}

	.attachments-preview {
		padding: 0.5rem;
		background: var(--bg-gradient);
		border-radius: 1rem;
	}

	.attachment-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.attachment-item:last-child {
		border-bottom: none;
	}

	.attachment-name {
		font-size: 14px;
		color: var(--text-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 200px;
	}

	.remove-attachment {
		background: none;
		border: none;
		color: var(--text-color);
		cursor: pointer;
		font-size: 18px;
		padding: 4px;
		border-radius: 4px;
		transition: background-color 0.15s ease;
	}

	.remove-attachment:hover {
		background-color: rgba(255, 0, 0, 0.1);
		color: #ff4444;
	}

	.composer-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.composer-options {
		display: flex;
		gap: 8px;
	}

	.file-input {
		display: none;
	}

	.composer-option-button {
		background: none;
		border: none;
		padding: 8px;
		border-radius: 6px;
		color: var(--text-color);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.composer-option-button:hover:not(:disabled) {
		background-color: var(--bg-gradient);
	}

	.composer-option-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.post-button {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: var(--primary-color);
		color: var(--placeholder-color);
		border: none;
		padding: 0.75rem;
		border-radius: 20px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
		opacity: 0.5;
	}

	.post-button.active {
		opacity: 1;
	}

	.post-button:hover:not(:disabled).active {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		color: var(--text-color);
	}

	.post-button:disabled {
		cursor: not-allowed;
	}
	.attachment-item {
		margin-bottom: 0.5rem;
	}

	.attachment-image-preview {
		position: relative;
		display: inline-block;
		margin-right: 0.5rem;
	}

	.preview-image {
		width: 80px;
		height: 80px;
		object-fit: cover;
		border-radius: 8px;
		border: 1px solid var(--line-color);
	}

	.tagging-status {
		font-size: 0.7rem;
		user-select: none;
		color: var(--tertiary-color);
		margin-left: auto;
		padding: 0.25rem;
		margin-right: 0.5rem;
		display: flex;
		justify-content: flex-end;
		align-items: center;
		font-style: italic;
	}

	.remove-attachment-image {
		position: absolute;
		top: -8px;
		right: -8px;
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 50%;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 14px;
	}

	.attachment-file-preview {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem;
		background: var(--secondary-color);
		border-radius: 1rem;
		border: 1px solid var(--line-color);
		max-width: 200px;
		transition: all 0.2s ease;
		&:hover {
			max-width: 600px;
			& .attachment-name {
				color: var(--text-color);
				overflow: hidden;
				text-overflow: none;
				white-space: nowrap;
				max-width: 100%;
			}
		}
	}
	.attachment-badge {
		position: relative;
		display: flex;
		background: var(--bg-gradient-right);
		color: var(--tertiary-color);
		padding: 0.25rem 0.5rem;
		border-radius: 0.5rem;
		border: 1px solid var(--line-color);
		font-size: 0.7rem;
	}

	.attachment-name {
		flex: 1;
		font-size: 0.8rem;
		color: var(--text-color);
	}

	.remove-attachment {
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 4px;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.composer-option-button {
		position: relative;
	}

	.attachment-count {
		position: absolute;
		top: -8px;
		right: -8px;
		background: var(--tertiary-color);
		color: var(--primary-color);
		border-radius: 50%;
		width: 18px;
		height: 18px;
		font-size: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	@media (max-width: 1000px) {
		.post-composer {
			border-radius: 2rem;
			margin-bottom: 0rem;
			height: auto;
		}
	}
	@media (max-width: 450px) {
		.composer-header {
			display: flex;
			gap: 0.5rem;
			margin-bottom: 0;
		}
		.post-composer {
			border-radius: 1rem 1rem 0 0 !important;
			margin-bottom: 2rem;

			height: auto;
		}
		.composer-avatar {
			width: 2rem;
			height: 2rem;
			border-radius: 50%;
			object-fit: cover;
			border: 1px solid var(--line-color);
			flex-shrink: 0;
			display: none;
		}
		.composer-textarea {
			background: transparent;
			border: none;
			resize: none;
			font-size: 0.8rem;
			color: var(--text-color);
			font-family: var(--font-family);
			line-height: 1.5;
			outline: none;
			min-height: 2.5rem; /* Start with smaller min-height */
			max-height: 50vh;
			width: 100%;
			margin-right: 0;
			margin-left: 1rem;
			box-sizing: border-box;
			display: flex;
			scroll-behavior: smooth;
		}
		.post-button {
			display: flex;
			flex-direction: row;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			background: var(--primary-color);
			color: var(--placeholder-color);
			border: none;
			padding: 0.75rem;
			margin-right: 2rem;
			border-radius: 20px;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.15s ease;
			opacity: 0.5;
		}
	}
</style>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentUser } from '$lib/pocketbase';
	import { Paperclip, X } from 'lucide-svelte';
	import { t } from '$lib/stores/translationStore';
	import { getAvatarUrl } from '$lib/features/users/utils/avatarHandling';

	// Props
	export let placeholder: string = $t('posts.textareaPlaceholder') as string;
	export let buttonText: string = $t('posts.postButton') as string;
	export let initialContent: string = '';
	export let disabled: boolean = false;
	export let parentId: string | undefined = undefined;
	export let showAttachments: boolean = true;

	// State
	let content = initialContent;
	let attachments: File[] = [];
	let fileInput: HTMLInputElement;
	let isSubmitting = false;

	const dispatch = createEventDispatcher<{
		submit: { content: string; attachments: File[]; parentId?: string };
		postCreated: { postId: string; post: any };
	}>();

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
		if (!content.trim() || isSubmitting) return;

		isSubmitting = true;

		try {
			// If this is a comment (has parentId), use the existing flow
			if (parentId) {
				dispatch('submit', {
					content: content.trim(),
					attachments: attachments.length > 0 ? attachments : [],
					parentId
				});

				// Reset form
				content = '';
				attachments = [];
				if (fileInput) fileInput.value = '';
				return;
			}

			// For new posts, create the post first, then add attachments
			const postFormData = new FormData();
			postFormData.append('content', content.trim());
			postFormData.append('user', $currentUser!.id);

			// Create the post without attachments first
			const postResponse = await fetch('/api/posts', {
				method: 'POST',
				body: postFormData,
				credentials: 'include'
			});

			if (!postResponse.ok) {
				const errorData = await postResponse.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to create post');
			}

			const postResult = await postResponse.json();
			const newPost = postResult;

			console.log('Post created:', newPost.id);

			// If there are attachments, upload them separately
			if (attachments.length > 0) {
				const attachmentFormData = new FormData();
				
				attachments.forEach((file, index) => {
					attachmentFormData.append(`attachment_${index}`, file);
				});

				const attachmentResponse = await fetch(`/api/posts/${newPost.id}/attachment`, {
					method: 'POST',
					body: attachmentFormData,
					credentials: 'include'
				});

				if (!attachmentResponse.ok) {
					console.error('Failed to upload attachments, but post was created');
					// Don't throw error - post was created successfully
				} else {
					const attachmentResult = await attachmentResponse.json();
					console.log(`${attachmentResult.count} attachments uploaded`);
					
					// Add attachments to the post object
					newPost.attachments = attachmentResult.attachments;
				}
			}

			// Dispatch success event
			dispatch('postCreated', { postId: newPost.id, post: newPost });

			// Reset form
			content = '';
			attachments = [];
			if (fileInput) fileInput.value = '';

			console.log('Post creation completed successfully');

		} catch (err) {
			console.error('Error submitting post:', err);
			alert('Failed to create post: ' + (err instanceof Error ? err.message : 'Unknown error'));
		} finally {
			isSubmitting = false;
		}
	}

	// Reset content when initialContent changes
	$: if (initialContent && !content) {
		content = initialContent;
	}

	// File preview helper
	function getFilePreview(file: File): string {
		if (file.type.startsWith('image/')) {
			return URL.createObjectURL(file);
		}
		return '';
	}
</script>

<div class="post-composer">
	<div class="composer-header">
		<img
			src={$currentUser ? getAvatarUrl($currentUser) : '/api/placeholder/40/40'}
			alt="Your avatar"
			class="composer-avatar"
		/>
		<textarea
			bind:value={content}
			{placeholder}
			class="composer-textarea"
			rows="3"
			disabled={disabled || isSubmitting}
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
								<X size={16} />
							</button>
						</div>
					{:else}
						<div class="attachment-file-preview">
							<Paperclip size={16} />
							<span class="attachment-name">{file.name}</span>
							<button 
								class="remove-attachment" 
								on:click={() => removeAttachment(index)} 
								type="button"
								title="Remove file"
							>
								<X size={16} />
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<div class="composer-actions">
		{#if showAttachments}
			<div class="composer-options">
				<input
					type="file"
					multiple
					accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar"
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
					<Paperclip size={16} />
					{#if attachments.length > 0}
						<span class="attachment-count">{attachments.length}</span>
					{/if}
				</button>
			</div>
		{/if}
		<button
			class="post-button"
			class:active={content.trim() && !isSubmitting}
			on:click={handleSubmit}
			disabled={!content.trim() || isSubmitting || disabled}
		>
			{isSubmitting ? $t('posts.posting') : buttonText}
		</button>
	</div>
</div>

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	@use "src/lib/styles/themes.scss" as *;	* {
		font-family: var(--font-family);
	}
	.post-composer {
		background: var(--primary-color);
		border-radius: 2rem;
		padding: 1rem;

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
		flex: 1;
		background: transparent;
		border: none;
		resize: none;
		font-size: 16px;
		color: var(--text-color);
		font-family: var(--font-family);
		line-height: 1.5;
		outline: none;
		
	}

	.composer-textarea::placeholder {
		color: var(--placeholder-color);
	}

	.attachments-preview {
		padding: 12px 16px;
		background: var(--bg-gradient);
		border-radius: 8px;
		margin-bottom: 12px;
	}

	.attachment-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 0;
		border-bottom: 1px solid var(--line-color);
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
		background: var(--primary-color);
		color: var(--placeholder-color);
		border: none;
		padding: 8px 24px;
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
		border: 1px solid #e5e7eb;
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
		padding: 0.5rem;
		background: #f3f4f6;
		border-radius: 6px;
		border: 1px solid #e5e7eb;
	}

	.attachment-name {
		flex: 1;
		font-size: 0.875rem;
		color: #374151;
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
		background: #3b82f6;
		color: white;
		border-radius: 50%;
		width: 18px;
		height: 18px;
		font-size: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>

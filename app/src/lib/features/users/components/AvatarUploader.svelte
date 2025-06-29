<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import { uploadAvatar } from '$lib/pocketbase';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	/*
	 * Let's not use the translation store directly since it's causing errors
	 * We'll use fallback texts instead
	 */

	export let userId: string;
	export let onSuccess: () => void = () => {};
	export let onError: (error: string) => void = () => {};

	let fileInput: HTMLInputElement;
	let isUploading = false;
	let previewUrl: string | null = null;
	let selectedFile: File | null = null;
	let error: string | null = null;

	const dispatch = createEventDispatcher();

	// Fallback texts in case translations aren't available
	const texts = {
		upload_avatar: 'Upload avatar',
		uploading: 'Uploading...',
		save: 'Save',
		cancel: 'Cancel',
		avatar_image_only: 'Please select an image file',
		avatar_too_large: 'Image must be less than 5MB',
		avatar_upload_failed: 'Upload failed. Please try again.'
	};

	function handleFileSelect(event: Event): void {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) {
			previewUrl = null;
			selectedFile = null;
			return;
		}

		const file = input.files[0];
		// Check file type
		if (!file.type.startsWith('image/')) {
			error = texts.avatar_image_only;
			previewUrl = null;
			selectedFile = null;
			return;
		}

		// Check file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			error = texts.avatar_too_large;
			previewUrl = null;
			selectedFile = null;
			return;
		}

		// Create preview
		previewUrl = URL.createObjectURL(file);
		selectedFile = file;
		error = null;
	}

	async function uploadSelectedFile(): Promise<void> {
		if (!selectedFile || !userId) return;

		try {
			isUploading = true;
			error = null;

			const result = await uploadAvatar(userId, selectedFile);

			if (result) {
				dispatch('avatarUploaded', { user: result });
				if (onSuccess) onSuccess();

				// Clean up
				previewUrl = null;
				selectedFile = null;
				if (fileInput) fileInput.value = '';
			} else {
				error = texts.avatar_upload_failed;
				if (onError) onError(error);
			}
		} catch (err) {
			console.error('Error uploading avatar:', err);
			error = texts.avatar_upload_failed;
			if (onError) onError(error);
		} finally {
			isUploading = false;
		}
	}

	function cancelUpload(): void {
		previewUrl = null;
		selectedFile = null;
		error = null;
		if (fileInput) fileInput.value = '';
	}

	function triggerFileInput(): void {
		if (fileInput) fileInput.click();
	}

	$: canUpload = !!selectedFile && !isUploading;
</script>

<div class="avatar-uploader">
	<input
		type="file"
		accept="image/*"
		bind:this={fileInput}
		on:change={handleFileSelect}
		class="hidden-input"
	/>

	{#if previewUrl}
		<div class="preview-container">
			<img src={previewUrl} alt="Avatar preview" class="avatar-preview" />
			<div class="preview-actions">
				<button class="cancel-button" on:click={cancelUpload} title={texts.cancel}>
					<Icon name="XCircle" size={24} />
				</button>
				<button
					class="upload-button"
					on:click={uploadSelectedFile}
					disabled={!canUpload}
					class:disabled={!canUpload}
				>
					{isUploading ? texts.uploading : texts.save}
				</button>
			</div>
		</div>
	{:else}
		<div class="upload-prompt" on:click={triggerFileInput}>
			<Icon name="Camera" size={24} />
			<span>{texts.upload_avatar}</span>
		</div>
	{/if}

	{#if error}
		<div class="error-message">{error}</div>
	{/if}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.avatar-uploader {
		display: flex;
		justify-content: center;
		align-items: center;
		position: relative;
		width: 100%;
		box-shadow: 0 20px 40px 20px rgba(255, 255, 255, 0.7);
	}

	.hidden-input {
		display: none;
	}

	.upload-prompt {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		gap: 1rem;
		padding: 1rem;
		background-color: var(--secondary-color) !important;
		color: var(--text-color);
		transition: all 0.2s ease;
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		border-radius: 2rem;
		&:hover {
			background: var(--tertiary-color) !important;
		}
	}

	.preview-container {
		position: relative;
		width: 20rem;
		height: 20rem;
	}

	.avatar-preview {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.preview-actions {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: row;
		align-items: flex-end;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.5);
		border-radius: 50%;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.preview-container:hover .preview-actions {
		opacity: 1;
	}

	.cancel-button {
		background: none;
		border: none;
		color: #ff5555;
		cursor: pointer;
		padding: 0.25rem;
	}

	.upload-button {
		background: var(--tertiary-color);
		color: var(--text-color);
		width: 50%;
		border: none;
		border-radius: 1rem;
		padding: 0.5rem 1rem;
		margin-top: 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.upload-button.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-message {
		color: #ff5555;
		font-size: 0.75rem;
		margin-top: 0.5rem;
		text-align: center;
	}
</style>

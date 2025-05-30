<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Attachment } from '$lib/types/types';

	const dispatch = createEventDispatcher<{
		upload: Attachment[];
	}>();

	let files: FileList;
	let uploadedAttachments: Attachment[] = [];
	let isUploading = false;
	let uploadError = '';

	async function handleUpload() {
		if (!files || files.length === 0) return;

		isUploading = true;
		uploadError = '';
		const newAttachments: Attachment[] = [];

		try {
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				
				// Create FormData for the file upload
				const formData = new FormData();
				formData.append('file', file);
				formData.append('fileName', file.name);

				// Upload to your API endpoint
				const response = await fetch('/api/attachments', {
					method: 'POST',
					body: formData
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || `Failed to upload ${file.name}`);
				}

				const uploadedFile = await response.json();
				
				// Create attachment object matching your interface
				const attachment: Attachment = {
					id: uploadedFile.id,
					file: uploadedFile.file,
					fileName: uploadedFile.fileName,
					url: uploadedFile.url,
					note: uploadedFile.note || '',
					createdBy: '', // This will be set by the server
					created: new Date().toISOString(),
					updated: new Date().toISOString()
				};

				newAttachments.push(attachment);
			}

			uploadedAttachments = [...uploadedAttachments, ...newAttachments];
			dispatch('upload', uploadedAttachments);

			// Clear the file input
			files = undefined as any;

		} catch (error) {
			console.error('Upload error:', error);
			uploadError = error instanceof Error ? error.message : 'Upload failed';
		} finally {
			isUploading = false;
		}
	}

	async function deleteAttachment(attachmentId: string) {
		try {
			const response = await fetch(`/api/attachments/${attachmentId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to delete attachment');
			}

			// Remove from local array
			uploadedAttachments = uploadedAttachments.filter(att => att.id !== attachmentId);
			dispatch('upload', uploadedAttachments);

		} catch (error) {
			console.error('Delete error:', error);
			uploadError = error instanceof Error ? error.message : 'Delete failed';
		}
	}
</script>

<div class="attachment-uploader">
	<h2>Upload Attachments</h2>
	
	<div class="upload-section">
		<input 
			type="file" 
			bind:files 
			multiple 
			accept="image/*,application/pdf,.doc,.docx,.txt" 
			disabled={isUploading}
		/>
		<button 
			on:click={handleUpload} 
			disabled={!files || files.length === 0 || isUploading}
		>
			{isUploading ? 'Uploading...' : 'Upload'}
		</button>
	</div>

	{#if uploadError}
		<div class="error-message">
			{uploadError}
		</div>
	{/if}

	{#if uploadedAttachments.length > 0}
		<div class="uploaded-files">
			<h3>Uploaded Files:</h3>
			<ul>
				{#each uploadedAttachments as attachment (attachment.id)}
					<li class="file-item">
						<span class="file-name">
							{#if attachment.url}
								<a href={attachment.url} target="_blank" rel="noopener noreferrer">
									{attachment.fileName}
								</a>
							{:else}
								{attachment.fileName}
							{/if}
						</span>
						<button 
							class="delete-btn" 
							on:click={() => deleteAttachment(attachment.id)}
							title="Delete attachment"
						>
							×
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.attachment-uploader {
		padding: 1rem;
		border: 1px solid #ddd;
		border-radius: 8px;
		margin: 1rem 0;
	}

	.upload-section {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 1rem;
	}

	.error-message {
		color: #d32f2f;
		background-color: #ffebee;
		padding: 0.5rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.uploaded-files ul {
		list-style: none;
		padding: 0;
	}

	.file-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		border: 1px solid #eee;
		border-radius: 4px;
		margin-bottom: 0.25rem;
	}

	.file-name a {
		color: #1976d2;
		text-decoration: none;
	}

	.file-name a:hover {
		text-decoration: underline;
	}

	.delete-btn {
		background: #ff4444;
		color: white;
		border: none;
		border-radius: 50%;
		width: 24px;
		height: 24px;
		cursor: pointer;
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.delete-btn:hover {
		background: #cc0000;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
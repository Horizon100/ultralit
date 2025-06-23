<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';

	export let x: number;
	export let y: number;

	/*
	 * const dispatch = createEventDispatcher<{
	 *   complete: File[];
	 *   error: string;
	 * }>();
	 */

	const dispatch = createEventDispatcher<{
		complete: { files: File[]; x: number; y: number };
		cancel: void;
	}>();

	const allowedTypes = [
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.google-apps.document',
		'image/png',
		'image/jpeg',
		'image/gif',
		'image/webp',
		'image/avif',
		'image/svg+xml',
		'application/vnd.ms-excel',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/vnd.google-apps.spreadsheet',
		'audio/*',
		'video/*',
		'text/plain',
		'text/csv',
		'application/json',
		'text/javascript',
		'application/vnd.ms-powerpoint',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation'
	];

	function handleFileInput(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files) {
			const validFiles = Array.from(input.files).filter((file) =>
				allowedTypes.some(
					(type) =>
						file.type.match(type) || (type.endsWith('*') && file.type.startsWith(type.slice(0, -1)))
				)
			);
			if (validFiles.length > 0) {
				// dispatch('complete', validFiles);
				dispatch('complete', { files: validFiles, x, y });
			} else {
				// dispatch('error', 'No valid files selected.');
				alert('No valid files selected.');
			}
		}
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<div class="import-docs" style="left: {x}px; top: {y}px; ">
	<input type="file" accept={allowedTypes.join(',')} multiple on:change={handleFileInput} />
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	/* .import-docs {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  } */

	.import-docs {
		position: absolute;
		background-color: white;
		padding: 20px;
		border-radius: 5px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	}

	input[type='file'] {
		margin-bottom: 10px;
	}

	button {
		padding: 5px 10px;
		background-color: #f0f0f0;
		border: none;
		border-radius: 3px;
		cursor: pointer;
	}
</style>

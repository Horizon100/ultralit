<!-- RecordButton.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Mic, Square, Play, Pause, X, VolumeX, Volume1, Volume2 } from 'lucide-svelte';
	import { clientTryCatch, tryCatchSync, isFailure } from '$lib/utils/errorUtils';

	// Props
	export let disabled = false;
	export let size = 16;

	// State
	let isRecording = false;
	let mediaRecorder: MediaRecorder | null = null;
	let audioChunks: Blob[] = [];
	let recordedAudio: Blob | null = null;
	let recordingTime = 0;
	let recordingInterval: ReturnType<typeof setInterval> | null = null;
	let audioUrl = '';
	let isPlayingRecording = false;
	let recordingAudioElement: HTMLAudioElement | null = null;

	const dispatch = createEventDispatcher<{
		recordingComplete: { audioFile: File };
		recordingStart: void;
		recordingStop: void;
		recordingCancel: void;
	}>();

	async function startRecording() {
		const result = await clientTryCatch((async () => {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					sampleRate: 44100
				}
			});

			// Try different formats based on browser support
			const mimeTypeResult = tryCatchSync(() => {
				let mimeType = 'audio/webm;codecs=opus';
				if (!MediaRecorder.isTypeSupported(mimeType)) {
					mimeType = 'audio/webm';
				}
				if (!MediaRecorder.isTypeSupported(mimeType)) {
					mimeType = 'audio/mp4';
				}
				if (!MediaRecorder.isTypeSupported(mimeType)) {
					mimeType = 'audio/ogg;codecs=opus';
				}
				if (!MediaRecorder.isTypeSupported(mimeType)) {
					mimeType = ''; // Let browser choose
				}
				return mimeType;
			});

			const mimeType = isFailure(mimeTypeResult) ? '' : mimeTypeResult.data;

			// Create MediaRecorder with the supported format
			mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

			audioChunks = [];
			recordingTime = 0;

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunks.push(event.data);
				}
			};

			mediaRecorder.onstop = () => {
				const blobResult = tryCatchSync(() => {
					// Use the actual mimeType that was selected, not hardcoded
					const blob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
					const url = URL.createObjectURL(blob);
					return { blob, url };
				});

				if (isFailure(blobResult)) {
					console.error('Error creating audio blob:', blobResult.error);
					return;
				}

				recordedAudio = blobResult.data.blob;
				audioUrl = blobResult.data.url;

				// Stop all tracks to release microphone
				stream.getTracks().forEach((track) => track.stop());
			};

			mediaRecorder.start();
			isRecording = true;

			// Start recording timer
			recordingInterval = setInterval(() => {
				recordingTime++;
			}, 1000);

			dispatch('recordingStart');
			return true;
		})(), 'Starting audio recording');

		if (isFailure(result)) {
			console.error('Error accessing microphone:', result.error);
			alert('Could not access microphone. Please check permissions.');
		}
	}

	function stopRecording() {
		if (mediaRecorder && isRecording) {
			mediaRecorder.stop();
			isRecording = false;

			if (recordingInterval) {
				clearInterval(recordingInterval);
				recordingInterval = null;
			}

			dispatch('recordingStop');
		}
	}

	function cancelRecording() {
		if (isRecording && mediaRecorder) {
			mediaRecorder.stop();
			isRecording = false;

			if (recordingInterval) {
				clearInterval(recordingInterval);
				recordingInterval = null;
			}
		}

		// Clear recorded audio
		recordedAudio = null;
		audioUrl = '';
		recordingTime = 0;
		audioChunks = [];
		isPlayingRecording = false;

		if (recordingAudioElement) {
			recordingAudioElement.pause();
			recordingAudioElement = null;
		}

		dispatch('recordingCancel');
	}

	function togglePlayRecording() {
		if (!audioUrl) return;

		if (!recordingAudioElement) {
			recordingAudioElement = new Audio(audioUrl);
			recordingAudioElement.onended = () => {
				isPlayingRecording = false;
			};
		}

		if (isPlayingRecording) {
			recordingAudioElement.pause();
			isPlayingRecording = false;
		} else {
			recordingAudioElement.play();
			isPlayingRecording = true;
		}
	}

	function confirmRecording() {
		if (!recordedAudio) return;

		// Create a File object from the blob
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

		// Determine file extension based on the actual blob type
		let extension = 'webm';
		if (recordedAudio.type.includes('mp4')) extension = 'mp4';
		else if (recordedAudio.type.includes('ogg')) extension = 'ogg';
		else if (recordedAudio.type.includes('wav')) extension = 'wav';

		const filename = `voice-message-${timestamp}.${extension}`;
		const audioFile = new File([recordedAudio], filename, {
			type: recordedAudio.type
		});

		dispatch('recordingComplete', { audioFile });

		// Reset state
		recordedAudio = null;
		audioUrl = '';
		recordingTime = 0;
		isPlayingRecording = false;
		if (recordingAudioElement) {
			recordingAudioElement.pause();
			recordingAudioElement = null;
		}
	}

	function formatRecordingTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Cleanup on component destroy
	import { onDestroy } from 'svelte';

	onDestroy(() => {
		if (recordingInterval) {
			clearInterval(recordingInterval);
		}
		if (recordingAudioElement) {
			recordingAudioElement.pause();
		}
		if (audioUrl) {
			URL.revokeObjectURL(audioUrl);
		}
	});
</script>

{#if isRecording}
	<div class="recording-controls">
		<button
			class="record-button recording"
			on:click={stopRecording}
			type="button"
			title="Stop recording"
			{disabled}
		>
			<Square {size} />
		</button>
		<span class="recording-time">{formatRecordingTime(recordingTime)}</span>
		<button
			class="record-button cancel"
			on:click={cancelRecording}
			type="button"
			title="Cancel recording"
		>
			<X {size} />
		</button>
	</div>
{:else if recordedAudio}
	<div class="recording-preview">
		<button
			class="record-button play"
			on:click={togglePlayRecording}
			type="button"
			title={isPlayingRecording ? 'Pause' : 'Play recording'}
		>
			{#if isPlayingRecording}
				<Pause {size} />
			{:else}
				<Play {size} />
			{/if}
		</button>
		<span class="recording-duration">{formatRecordingTime(recordingTime)}</span>
		<button
			class="record-button confirm"
			on:click={confirmRecording}
			type="button"
			title="Add voice message"
		>
			✓
		</button>
		<button
			class="record-button cancel"
			on:click={cancelRecording}
			type="button"
			title="Delete recording"
		>
			<X {size} />
		</button>
	</div>
{:else}
	<button
		class="record-button"
		on:click={startRecording}
		type="button"
		title="Record voice message"
		{disabled}
	>
		<Mic {size} />
	</button>
{/if}

<style lang="scss">
	.record-button {
		background: none;
		border: none;
		padding: 8px;
		border-radius: 6px;
		color: var(--text-color);
		cursor: pointer;
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.record-button:hover:not(:disabled) {
		background-color: var(--bg-gradient);
	}

	.record-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.recording-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--bg-gradient);
		padding: 0.5rem;
		border-radius: 20px;
		border: 2px solid #ef4444;
		animation: breathe 2s ease-in-out infinite;
	}

	.recording-preview {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--bg-gradient);
		padding: 0.5rem;
		border-radius: 20px;
		border: 2px solid var(--primary-color);
	}

	.recording-time {
		color: #ef4444;
		font-weight: 600;
		font-size: 0.875rem;
		min-width: 40px;
		text-align: center;
	}

	.recording-duration {
		color: var(--text-color);
		font-weight: 500;
		font-size: 0.875rem;
		min-width: 40px;
		text-align: center;
	}

	.record-button.recording {
		background: #ef4444;
		color: white;
		animation: pulse 1.5s infinite;
	}

	.record-button.confirm {
		background: var(--primary-color);
		color: white;
		font-weight: bold;
		font-size: 1rem;
	}

	.record-button.cancel {
		background: #6b7280;
		color: white;
	}

	.record-button.play {
		background: var(--primary-color);
		color: white;
	}

	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
		}
		70% {
			box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
		}
	}

	@keyframes breathe {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.02);
		}
	}

	.recording-controls::before {
		content: '🔴';
		font-size: 0.75rem;
		animation: blink 1s infinite;
	}

	@keyframes blink {
		0%,
		50% {
			opacity: 1;
		}
		51%,
		100% {
			opacity: 0.3;
		}
	}
</style>

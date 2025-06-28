import { tryCatch, type Result } from '$lib/utils/errorUtils';

export interface ConvertedVideo {
	original: File;
	mp4?: File;
	webm?: File;
	formats: Array<{ file: File; mimeType: string }>;
}

export async function convertVideoToMultipleFormats(
	videoFile: File
): Promise<Result<ConvertedVideo, Error>> {
	return tryCatch(
		(async () => {
			console.log(`Converting video: ${videoFile.name}`);

			const result: ConvertedVideo = {
				original: videoFile,
				formats: []
			};

			result.formats.push({ file: videoFile, mimeType: videoFile.type });

			if (!videoFile.type.startsWith('video/')) {
				return result;
			}

			if (videoFile.type !== 'video/mp4') {
				const mp4File = await convertVideoToFormat(videoFile, 'video/mp4');
				if (mp4File) {
					result.mp4 = mp4File;
					result.formats.push({ file: mp4File, mimeType: 'video/mp4' });
				}
			}

			if (videoFile.type !== 'video/webm') {
				const webmFile = await convertVideoToFormat(videoFile, 'video/webm');
				if (webmFile) {
					result.webm = webmFile;
					result.formats.push({ file: webmFile, mimeType: 'video/webm' });
				}
			}

			console.log(`Video conversion complete. Generated ${result.formats.length} formats`);
			return result;
		})()
	);
}

export function canConvertVideo(): boolean {
	try {
		const canvas = document.createElement('canvas');
		const stream = canvas.captureStream();

		const mp4Support = MediaRecorder.isTypeSupported('video/mp4');
		const webmSupport = MediaRecorder.isTypeSupported('video/webm');

		return mp4Support || webmSupport;
	} catch {
		return false;
	}
}

export function detectVideoIssues(videoFile: File): string[] {
	const issues: string[] = [];

	// Check for problematic combinations
	if (videoFile.type === 'video/quicktime' && videoFile.size > 20 * 1024 * 1024) {
		issues.push('Large MOV files may not play in all browsers');
	}

	if (
		videoFile.name.toLowerCase().includes('hevc') ||
		videoFile.name.toLowerCase().includes('h265')
	) {
		issues.push('H.265/HEVC videos may not play in all browsers');
	}

	return issues;
}

// Better conversion function that actually re-encodes
async function convertVideoToFormat(videoFile: File, targetMimeType: string): Promise<File | null> {
	return new Promise((resolve) => {
		const video = document.createElement('video');
		video.crossOrigin = 'anonymous';
		video.muted = true;

		video.onloadeddata = () => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				resolve(null);
				return;
			}

			// Set reasonable dimensions for compatibility
			const maxWidth = 1280;
			const maxHeight = 720;
			const aspectRatio = video.videoWidth / video.videoHeight;

			if (video.videoWidth > maxWidth) {
				canvas.width = maxWidth;
				canvas.height = maxWidth / aspectRatio;
			} else if (video.videoHeight > maxHeight) {
				canvas.height = maxHeight;
				canvas.width = maxHeight * aspectRatio;
			} else {
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
			}

			const stream = canvas.captureStream(24); // 24fps for better compatibility

			// Choose the most compatible codec
			let mimeType = '';
			if (targetMimeType.includes('mp4')) {
				// Try different MP4 options in order of compatibility
				const mp4Options = [
					'video/mp4;codecs=avc1.42E01E', // H.264 baseline (most compatible)
					'video/mp4;codecs=avc1.4D401E', // H.264 main
					'video/mp4'
				];

				for (const option of mp4Options) {
					if (MediaRecorder.isTypeSupported(option)) {
						mimeType = option;
						break;
					}
				}
			} else if (targetMimeType.includes('webm')) {
				const webmOptions = [
					'video/webm;codecs=vp8', // More compatible than VP9
					'video/webm;codecs=vp9',
					'video/webm'
				];

				for (const option of webmOptions) {
					if (MediaRecorder.isTypeSupported(option)) {
						mimeType = option;
						break;
					}
				}
			}

			if (!mimeType) {
				console.log('No supported codec found for', targetMimeType);
				resolve(null);
				return;
			}

			console.log('Using codec:', mimeType);

			const mediaRecorder = new MediaRecorder(stream, {
				mimeType,
				videoBitsPerSecond: 800000 // 800kbps for good quality/compatibility balance
			});

			const chunks: Blob[] = [];
			const startTime = 0;

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					chunks.push(event.data);
				}
			};

			mediaRecorder.onstop = () => {
				const blob = new Blob(chunks, { type: targetMimeType });
				const extension = targetMimeType.includes('webm') ? 'webm' : 'mp4';
				const fileName = videoFile.name.replace(/\.[^/.]+$/, `.converted.${extension}`);
				const convertedFile = new File([blob], fileName, { type: targetMimeType });

				console.log(`Conversion complete: ${videoFile.name} -> ${convertedFile.name}`);
				console.log(
					`Original: ${(videoFile.size / 1024 / 1024).toFixed(2)}MB -> Converted: ${(convertedFile.size / 1024 / 1024).toFixed(2)}MB`
				);

				resolve(convertedFile);
			};

			mediaRecorder.onerror = (e) => {
				console.error('MediaRecorder error:', e);
				resolve(null);
			};

			// Start recording
			mediaRecorder.start(1000); // 1-second chunks
			video.currentTime = 0;
			video.play();

			const renderFrame = () => {
				if (!video.paused && !video.ended && mediaRecorder.state === 'recording') {
					// Draw current frame to canvas
					ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
					requestAnimationFrame(renderFrame);
				} else if (video.ended || video.currentTime >= Math.min(video.duration, 60)) {
					// Stop recording when video ends or after 60 seconds max
					if (mediaRecorder.state === 'recording') {
						mediaRecorder.stop();
					}
				}
			};

			// Start rendering frames
			renderFrame();

			// Safety timeout - stop after 2 minutes regardless
			setTimeout(() => {
				if (mediaRecorder.state === 'recording') {
					console.log('Conversion timeout, stopping...');
					mediaRecorder.stop();
				}
			}, 120000);
		};

		video.onerror = (e) => {
			console.error('Video loading error for conversion:', e);
			resolve(null);
		};

		// Load the video
		video.src = URL.createObjectURL(videoFile);
		video.load();
	});
}
export async function convertVideoToUniversalFormat(videoFile: File): Promise<Result<File, Error>> {
	return tryCatch(
		(async () => {
			console.log(`Converting ${videoFile.name} to universal format...`);

			const mp4File = await convertVideoToFormat(videoFile, 'video/mp4');
			if (mp4File && mp4File.size > 0) {
				console.log('Conversion successful!');
				return mp4File;
			} else {
				console.log('Conversion failed or produced empty file, using original');
				return videoFile;
			}
		})()
	);
}

// Updated process function
export async function processVideoAttachments(files: File[]): Promise<File[]> {
	const processedFiles: File[] = [];

	for (const file of files) {
		if (file.type.startsWith('video/')) {
			console.log(`Processing video: ${file.name}`);

			const result = await convertVideoToUniversalFormat(file);
			if (result.success) {
				processedFiles.push(result.data);
			} else {
				console.error('Video conversion failed:', result.error);
				processedFiles.push(file); // fallback original file
			}
		} else {
			processedFiles.push(file);
		}
	}

	return processedFiles;
}

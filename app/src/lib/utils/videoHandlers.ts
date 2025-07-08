// src/lib/utils/videoHandlers.ts
import { tryCatch, type Result } from '$lib/utils/errorUtils';

export interface ConvertedVideo {
	original: File;
	converted?: File;
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

			// Always include original
			result.formats.push({ file: videoFile, mimeType: videoFile.type });

			// Only convert if it's a video file and not already MP4
			if (videoFile.type.startsWith('video/') && videoFile.type !== 'video/mp4') {
				const convertedFile = await convertVideoToUniversalFormat(videoFile);
				if (convertedFile.success) {
					result.converted = convertedFile.data;
					result.formats.push({ file: convertedFile.data, mimeType: 'video/mp4' });
				}
			}

			console.log(`Video conversion complete. Generated ${result.formats.length} formats`);
			return result;
		})()
	);
}

export function canConvertVideo(): boolean {
	// Since we're using server-side conversion, we can always convert
	return true;
}

export function detectVideoIssues(videoFile: File): string[] {
	const issues: string[] = [];

	// Check for problematic formats that our server will handle
	if (videoFile.type === 'video/quicktime' && videoFile.size > 50 * 1024 * 1024) {
		issues.push('Large MOV files will be converted to MP4 for better compatibility');
	}

	if (
		videoFile.name.toLowerCase().includes('hevc') ||
		videoFile.name.toLowerCase().includes('h265')
	) {
		issues.push('H.265/HEVC videos will be converted to H.264 for better compatibility');
	}

	if (videoFile.size > 100 * 1024 * 1024) {
		issues.push('Files larger than 100MB may take longer to process');
	}

	return issues;
}

// Server-side conversion function
export async function convertVideoToUniversalFormat(videoFile: File): Promise<Result<File, Error>> {
	return tryCatch(
		(async () => {
			console.log(`Converting ${videoFile.name} to universal format...`);

			// Create FormData for the API request
			const formData = new FormData();
			formData.append('video', videoFile);

			// Call our SvelteKit API route
			const response = await fetch('/api/video/convert', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Video conversion failed');
			}

			// Get the converted video blob
			const convertedBlob = await response.blob();
			
			// Get original and converted names from headers
			const originalName = response.headers.get('X-Original-Name') || videoFile.name;
			const convertedName = response.headers.get('X-Converted-Name') || 
				videoFile.name.replace(/\.[^/.]+$/, '.mp4');

			// Create File object from blob
			const convertedFile = new File([convertedBlob], convertedName, { 
				type: 'video/mp4',
				lastModified: Date.now()
			});

			console.log('Server-side conversion successful!');
			console.log(`Original: ${(videoFile.size / 1024 / 1024).toFixed(2)}MB -> Converted: ${(convertedFile.size / 1024 / 1024).toFixed(2)}MB`);
			
			return convertedFile;
		})()
	);
}

// Updated process function with better error handling
export async function processVideoAttachments(files: File[]): Promise<File[]> {
	const processedFiles: File[] = [];

	for (const file of files) {
		if (file.type.startsWith('video/')) {
			console.log(`Processing video: ${file.name}`);

			// Check if conversion is needed
			if (file.type === 'video/mp4') {
				// MP4 files don't need conversion
				processedFiles.push(file);
				console.log(`Skipping conversion for MP4 file: ${file.name}`);
				continue;
			}

			// Try server-side conversion
			const result = await convertVideoToUniversalFormat(file);
			if (result.success) {
				processedFiles.push(result.data);
				console.log(`Successfully converted: ${file.name} -> ${result.data.name}`);
			} else {
				console.error('Video conversion failed:', result.error);
				// Fallback to original file
				processedFiles.push(file);
				console.log(`Using original file as fallback: ${file.name}`);
			}
		} else {
			processedFiles.push(file);
		}
	}

	return processedFiles;
}

// Utility function to check if server-side conversion is available
export async function checkVideoConversionService(): Promise<boolean> {
	try {
		const response = await fetch('/api/video/convert', {
			method: 'OPTIONS'
		});
		return response.ok;
	} catch {
		return false;
	}
}
import type { Detection, BoundingBox } from '$lib/types/types.ml';

/**
 * Convert video frame to base64 for ML processing
 */
export function videoFrameToBase64(video: HTMLVideoElement, quality: number = 0.8): string {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		throw new Error('Could not get canvas context');
	}

	// Set canvas size to video size
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;

	// Draw current video frame to canvas
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

	// Convert to base64
	return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Scale bounding box coordinates to video element size
 */
export function scaleBoundingBox(bbox: BoundingBox, videoElement: HTMLVideoElement): BoundingBox {
	const videoRect = videoElement.getBoundingClientRect();
	const scaleX = videoRect.width / videoElement.videoWidth;
	const scaleY = videoRect.height / videoElement.videoHeight;

	return {
		x1: bbox.x1 * scaleX,
		y1: bbox.y1 * scaleY,
		x2: bbox.x2 * scaleX,
		y2: bbox.y2 * scaleY
	};
}

/**
 * Get random color for detection boxes
 */
export function getDetectionColor(classId: number): string {
	const colors = [
		'#FF6B6B',
		'#4ECDC4',
		'#45B7D1',
		'#96CEB4',
		'#FFEAA7',
		'#DDA0DD',
		'#98D8C8',
		'#F7DC6F',
		'#BB8FCE',
		'#85C1E9',
		'#F8C471',
		'#82E0AA',
		'#F1948A',
		'#85C1E9',
		'#D2B4DE'
	];

	return colors[classId % colors.length];
}

/**
 * Filter detections by confidence threshold
 */
export function filterDetections(detections: Detection[], threshold: number): Detection[] {
	return detections.filter((detection) => detection.confidence >= threshold);
}

/**
 * Calculate detection box area
 */
export function getDetectionArea(bbox: BoundingBox): number {
	return (bbox.x2 - bbox.x1) * (bbox.y2 - bbox.y1);
}

/**
 * Check if two bounding boxes overlap significantly
 */
export function doBoxesOverlap(
	box1: BoundingBox,
	box2: BoundingBox,
	threshold: number = 0.5
): boolean {
	const area1 = getDetectionArea(box1);
	const area2 = getDetectionArea(box2);

	// Calculate intersection
	const x1 = Math.max(box1.x1, box2.x1);
	const y1 = Math.max(box1.y1, box2.y1);
	const x2 = Math.min(box1.x2, box2.x2);
	const y2 = Math.min(box1.y2, box2.y2);

	if (x2 <= x1 || y2 <= y1) return false;

	const intersectionArea = (x2 - x1) * (y2 - y1);
	const unionArea = area1 + area2 - intersectionArea;

	return intersectionArea / unionArea > threshold;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: number | undefined;

	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait) as unknown as number;
	};
}

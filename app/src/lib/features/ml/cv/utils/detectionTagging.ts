// lib/features/ml/cv/utils/detectionTagging.ts
import { ensureAuthenticated } from '$lib/pocketbase';
import { clientTryCatch } from '$lib/utils/errorUtils';
import type { Detection, DetectionResult } from '$lib/types/types.ml';
import type { AttachmentGeneratedTag } from '$lib/features/posts/utils/attachmentTagging';

export interface VideoDetectionTag extends AttachmentGeneratedTag {
	confidence: number;
	class_id: number;
	detectionCount: number;
	firstDetectedAt?: number;
	lastDetectedAt?: number;
}

export interface DetectionTaggingOptions {
	minConfidence?: number;
	minDetectionCount?: number;
	maxTags?: number;
	includeConfidence?: boolean;
	aggregationWindow?: number; // ms
}

export interface DetectionTaggingResult {
	tags: VideoDetectionTag[];
	attachmentId: string;
	success: boolean;
	tagIds: string[];
	totalDetections: number;
	uniqueClasses: number;
}

/**
 * Aggregates detections over time and converts them to tags
 */
export class DetectionAggregator {
	private detectionHistory: Map<
		string,
		{
			detections: Detection[];
			firstSeen: number;
			lastSeen: number;
			count: number;
		}
	> = new Map();

	private options: Required<DetectionTaggingOptions>;

	constructor(options: DetectionTaggingOptions = {}) {
		this.options = {
			minConfidence: options.minConfidence ?? 0.6,
			minDetectionCount: options.minDetectionCount ?? 3,
			maxTags: options.maxTags ?? 10,
			includeConfidence: options.includeConfidence ?? true,
			aggregationWindow: options.aggregationWindow ?? 5000 // 5 seconds
		};
	}

	/**
	 * Add new detections to the aggregator
	 */
	addDetections(detections: Detection[]): void {
		const now = Date.now();

		detections.forEach((detection) => {
			const key = detection.class_name;

			if (detection.confidence < this.options.minConfidence) {
				return;
			}

			if (this.detectionHistory.has(key)) {
				const existing = this.detectionHistory.get(key);
				if (existing) {
					existing.detections.push(detection);
					existing.lastSeen = now;
					existing.count++;
				}
			} else {
				this.detectionHistory.set(key, {
					detections: [detection],
					firstSeen: now,
					lastSeen: now,
					count: 1
				});
			}
		});

		this.cleanupOldDetections(now);
	}
	/**
	 * Remove detections older than aggregation window
	 */
	private cleanupOldDetections(now: number): void {
		const cutoff = now - this.options.aggregationWindow;

		for (const [key, data] of this.detectionHistory.entries()) {
			if (data.lastSeen < cutoff) {
				this.detectionHistory.delete(key);
			}
		}
	}

	/**
	 * Generate tags from aggregated detections
	 */
	generateTags(): VideoDetectionTag[] {
		const tags: VideoDetectionTag[] = [];

		for (const [className, data] of this.detectionHistory.entries()) {
			// Only include classes with minimum detection count
			if (data.count < this.options.minDetectionCount) {
				continue;
			}

			// Calculate average confidence
			const avgConfidence =
				data.detections.reduce((sum, d) => sum + d.confidence, 0) / data.detections.length;

			// Get the most common class_id (in case of variations)
			const classId = data.detections[0].class_id;

			// Calculate relevance score based on confidence and detection frequency
			const relevanceScore = Math.min(1.0, (avgConfidence + data.count / 10) / 2);

			tags.push({
				name: className.toLowerCase().replace(/[_-]/g, ' '),
				relevanceScore,
				source: 'image',
				confidence: avgConfidence,
				class_id: classId,
				detectionCount: data.count,
				firstDetectedAt: data.firstSeen,
				lastDetectedAt: data.lastSeen
			});
		}

		// Sort by relevance score and limit
		return tags.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, this.options.maxTags);
	}

	/**
	 * Get current detection statistics
	 */
	getStats(): { totalDetections: number; uniqueClasses: number; activeClasses: string[] } {
		const totalDetections = Array.from(this.detectionHistory.values()).reduce(
			(sum, data) => sum + data.count,
			0
		);

		const uniqueClasses = this.detectionHistory.size;
		const activeClasses = Array.from(this.detectionHistory.keys());

		return { totalDetections, uniqueClasses, activeClasses };
	}

	/**
	 * Clear all detection history
	 */
	clear(): void {
		this.detectionHistory.clear();
	}
}

/**
 * Convert detection results to attachment tags
 */
export function detectionsToTags(
	detections: Detection[],
	options: DetectionTaggingOptions = {}
): AttachmentGeneratedTag[] {
	const { minConfidence = 0.6, maxTags = 10 } = options;

	const classGroups = new Map<string, Detection[]>();

	detections.forEach((detection) => {
		if (detection.confidence >= minConfidence) {
			const className = detection.class_name;
			if (!classGroups.has(className)) {
				classGroups.set(className, []);
			}
			const group = classGroups.get(className);
			if (group) {
				group.push(detection);
			}
		}
	});

	const tags: AttachmentGeneratedTag[] = [];

	for (const [className, detectionGroup] of classGroups.entries()) {
		const avgConfidence =
			detectionGroup.reduce((sum, d) => sum + d.confidence, 0) / detectionGroup.length;

		tags.push({
			name: className.toLowerCase().replace(/[_-]/g, ' '),
			relevanceScore: avgConfidence,
			source: 'image'
		});
	}

	return tags.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, maxTags);
}
/**
 * Update video attachment with detection-based tags
 */
export async function updateVideoAttachmentTags(
	attachmentId: string,
	postId: string,
	tags: VideoDetectionTag[],
	options: {
		append?: boolean;
		includeMetadata?: boolean;
	} = {}
): Promise<DetectionTaggingResult> {
	try {
		console.log('🎥 Updating video attachment tags:', attachmentId, 'with', tags.length, 'tags');
		ensureAuthenticated();

		const { append = false, includeMetadata = true } = options;

		// Prepare tag data
		const tagNames = tags.map((tag) => tag.name);
		const metadata = includeMetadata
			? {
					detectionMetadata: tags.map((tag) => ({
						name: tag.name,
						confidence: tag.confidence,
						class_id: tag.class_id,
						detectionCount: tag.detectionCount,
						firstDetectedAt: tag.firstDetectedAt,
						lastDetectedAt: tag.lastDetectedAt
					}))
				}
			: {};

		// Update the attachment
		const updateResult = await clientTryCatch(
			fetch(`/api/posts/${postId}/attachment?attachmentId=${attachmentId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tags: tagNames,
					tagCount: tagNames.length
				})
			}).then((r) => r.json()),
			'Failed to update video attachment tags'
		);

		if (!updateResult.success) {
			return {
				tags,
				attachmentId,
				success: false,
				tagIds: [],
				totalDetections: tags.reduce((sum, tag) => sum + tag.detectionCount, 0),
				uniqueClasses: tags.length
			};
		}

		return {
			tags,
			attachmentId,
			success: true,
			tagIds: tagNames,
			totalDetections: tags.reduce((sum, tag) => sum + tag.detectionCount, 0),
			uniqueClasses: tags.length
		};
	} catch (error) {
		console.error('❌ Error updating video attachment tags:', error);
		return {
			tags,
			attachmentId,
			success: false,
			tagIds: [],
			totalDetections: 0,
			uniqueClasses: 0
		};
	}
}

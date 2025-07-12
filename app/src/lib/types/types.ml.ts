export interface BoundingBox {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface Detection {
	bbox: BoundingBox;
	confidence: number;
	class_id: number;
	class_name: string;
}

export interface DetectionResult {
	detections: Detection[];
	count: number;
	timestamp?: number;
	model_used?: string;
	confidence_threshold?: number;
}

export interface MLModel {
	path: string;
	size: string;
	description: string;
}

export interface AvailableModels {
	[key: string]: MLModel;
}

export interface MLServiceHealth {
	status: 'healthy' | 'unhealthy';
	current_model?: string;
	available_models?: string[];
}

export interface DetectionSettings {
	enabled: boolean;
	confidence: number;
	model: string;
	frameSkip: number; // Process every N frames
	showLabels: boolean;
	showConfidence: boolean;
}

export interface DetectionFrame {
	frame: string; // base64 encoded
	confidence?: number;
	timestamp?: number;
}

// src/lib/features/ml/cv/utils/websocketDetection.ts
import type { Detection, DetectionResult } from '$lib/types/types.ml';

export class WebSocketDetectionClient {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private isConnecting = false;

	constructor(
		private url: string = 'ws://localhost:8000/ws/detect',
		private onDetection: (result: DetectionResult) => void,
		private onError: (error: string) => void = console.error,
		private onStatusChange: (
			status: 'connecting' | 'connected' | 'disconnected' | 'error'
		) => void = () => {}
	) {}

	async connect(): Promise<void> {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			return;
		}

		if (this.isConnecting) {
			return;
		}

		this.isConnecting = true;
		this.onStatusChange('connecting');

		try {
			this.ws = new WebSocket(this.url);

			this.ws.onopen = () => {
				console.log('WebSocket connected for real-time detection');
				this.reconnectAttempts = 0;
				this.isConnecting = false;
				this.onStatusChange('connected');
			};

			this.ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);

					if (data.error) {
						this.onError(data.error);
						return;
					}

					this.onDetection(data);
				} catch (error) {
					this.onError(`Failed to parse detection result: ${error}`);
				}
			};

			this.ws.onclose = () => {
				console.log('WebSocket disconnected');
				this.isConnecting = false;
				this.onStatusChange('disconnected');
				this.attemptReconnect();
			};

			this.ws.onerror = (error) => {
				console.error('WebSocket error:', error);
				this.isConnecting = false;
				this.onStatusChange('error');
				this.onError('WebSocket connection error');
			};
		} catch (error) {
			this.isConnecting = false;
			this.onStatusChange('error');
			this.onError(`Failed to create WebSocket connection: ${error}`);
		}
	}

	private attemptReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.onError('Max reconnection attempts reached');
			return;
		}

		this.reconnectAttempts++;
		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

		console.log(
			`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`
		);

		setTimeout(() => {
			this.connect();
		}, delay);
	}

	sendFrame(frameBase64: string, confidence: number = 0.5): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			this.onError('WebSocket not connected');
			return;
		}

		const data = {
			frame: frameBase64,
			confidence,
			timestamp: Date.now()
		};

		try {
			this.ws.send(JSON.stringify(data));
		} catch (error) {
			this.onError(`Failed to send frame: ${error}`);
		}
	}

	disconnect(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.reconnectAttempts = 0;
		this.isConnecting = false;
	}

	isConnected(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
	}

	getStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
		if (!this.ws) return 'disconnected';

		switch (this.ws.readyState) {
			case WebSocket.CONNECTING:
				return 'connecting';
			case WebSocket.OPEN:
				return 'connected';
			case WebSocket.CLOSING:
			case WebSocket.CLOSED:
				return 'disconnected';
			default:
				return 'error';
		}
	}
}

// Enhanced detection utilities for WebSocket usage
export class DetectionManager {
	private frameQueue: string[] = [];
	private isProcessing = false;
	private maxQueueSize = 3; // Prevent memory buildup

	constructor(
		private client: WebSocketDetectionClient,
		private confidence: number = 0.5
	) {}

	// Add frame to processing queue
	queueFrame(frameBase64: string): void {
		// Remove data URL prefix if present
		const frame = frameBase64.includes(',') ? frameBase64.split(',')[1] : frameBase64;

		// Prevent queue overflow
		if (this.frameQueue.length >= this.maxQueueSize) {
			this.frameQueue.shift(); // Remove oldest frame
		}

		this.frameQueue.push(frame);
		this.processQueue();
	}

	private async processQueue(): Promise<void> {
		if (this.isProcessing || this.frameQueue.length === 0) {
			return;
		}

		this.isProcessing = true;

		while (this.frameQueue.length > 0) {
			const frame = this.frameQueue.shift();
			if (frame && this.client.isConnected()) {
				this.client.sendFrame(frame, this.confidence);

				// Small delay to prevent overwhelming the server
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
		}

		this.isProcessing = false;
	}

	updateConfidence(confidence: number): void {
		this.confidence = confidence;
	}

	clearQueue(): void {
		this.frameQueue = [];
	}

	getQueueSize(): number {
		return this.frameQueue.length;
	}
}

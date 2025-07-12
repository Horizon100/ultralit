import type {
	DetectionResult,
	DetectionFrame,
	AvailableModels,
	MLServiceHealth
} from '$lib/types/types.ml';

class MLApiClient {
	private baseUrl = '/api/ml/cv';

	async detectObjects(frameData: DetectionFrame): Promise<DetectionResult> {
		console.log('=== cvApi.detectObjects DEBUG ===');
		console.log('Calling endpoint:', `${this.baseUrl}/detect`);
		console.log('Frame data length:', frameData.frame?.length || 'undefined');

		const response = await fetch(`${this.baseUrl}/detect`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(frameData)
		});

		console.log('Response status:', response.status);
		console.log('Response ok:', response.ok);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('API Error Response:', errorText);
			throw new Error(`Detection failed: ${response.statusText}`);
		}

		const result = await response.json();
		console.log('API Success:', result);
		return result;
	}
	async getAvailableModels(): Promise<AvailableModels> {
		const response = await fetch(`${this.baseUrl}/models`);

		if (!response.ok) {
			throw new Error(`Failed to fetch models: ${response.statusText}`);
		}

		return await response.json();
	}

	async switchModel(modelName: string): Promise<{ message: string; model_info: any }> {
		const response = await fetch(`${this.baseUrl}/models`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ model_name: modelName })
		});

		if (!response.ok) {
			throw new Error(`Failed to switch model: ${response.statusText}`);
		}

		return await response.json();
	}

	async checkHealth(): Promise<MLServiceHealth> {
		const response = await fetch(`${this.baseUrl}/detect`);

		if (!response.ok) {
			return { status: 'unhealthy' };
		}

		const data = await response.json();
		return data.status === 'available'
			? { status: 'healthy', ...data.service }
			: { status: 'unhealthy' };
	}
}

export const cvApi = new MLApiClient();

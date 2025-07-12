import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { CV_DETECTION_URL } from '$env/static/private';

const CV_DETECTION_URL = process.env.CV_DETECTION_URL || 'http://100.77.36.61:8000';

export const GET: RequestHandler = async () => {
	try {
		const response = await fetch(`${CV_DETECTION_URL}/models`);

		if (!response.ok) {
			return json({ error: 'Models service unavailable' }, { status: 503 });
		}

		const models = await response.json();
		return json(models);
	} catch (error) {
		console.error('Models API error:', error);
		return json({ error: 'Failed to fetch models' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { model_name } = await request.json();

		if (!model_name) {
			return json({ error: 'Model name required' }, { status: 400 });
		}

		// Switch model on CV service
		const response = await fetch(`${CV_DETECTION_URL}/models/${model_name}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			return json({ error: 'Failed to switch model' }, { status: 400 });
		}

		const result = await response.json();
		return json(result);
	} catch (error) {
		console.error('Model switch error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

// src/routes/api/ml/cv/detect/+server.ts - CORRECTED VERSION

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CV_DETECTION_URL = process.env.CV_DETECTION_URL || 'http://100.77.36.61:8000';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		console.log('=== SVELTEKIT API DEBUG ===');
		console.log('Received body keys:', Object.keys(body));
		console.log('Frame exists:', !!body.frame);
		console.log('Frame length:', body.frame?.length || 'undefined');
		console.log('Confidence:', body.confidence);

		const { frame, confidence = 0.5, timestamp } = body;

		if (!frame) {
			console.log('ERROR: No frame in request body');
			return json({ error: 'No frame data provided' }, { status: 400 });
		}

		// The key fix: FastAPI /detect-frame expects this EXACT structure
		const fastApiPayload = {
			frame_data: {
				frame: frame,
				confidence: confidence,
				timestamp: timestamp || Date.now()
			}
		};

		console.log('Sending to FastAPI /detect-frame:', {
			endpoint: `${CV_DETECTION_URL}/detect-frame`,
			hasFrameData: !!fastApiPayload.frame_data,
			frameLength: fastApiPayload.frame_data?.frame?.length || 'undefined',
			confidence: fastApiPayload.frame_data?.confidence
		});

		// Send to FastAPI /detect-frame endpoint (not /detect)
		const response = await fetch(`${CV_DETECTION_URL}/detect-frame`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(fastApiPayload)
		});

		console.log('FastAPI response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('FastAPI error response:', errorText);
			return json(
				{ error: 'Detection service error', details: errorText },
				{ status: response.status }
			);
		}

		const result = await response.json();
		console.log('FastAPI success, detections:', result.count || 0);
		return json(result);
	} catch (error) {
		console.error('SvelteKit API error:', error);
		return json({ error: 'Internal server error', details: error.message }, { status: 500 });
	}
};

export const GET: RequestHandler = async () => {
	try {
		const response = await fetch(`${CV_DETECTION_URL}/health`);

		if (!response.ok) {
			return json({ status: 'unavailable', error: 'CV service down' }, { status: 503 });
		}

		const health = await response.json();
		return json({ status: 'available', service: health });
	} catch (error) {
		console.error('CV service health check failed:', error);
		return json({ status: 'unavailable', error: error.message }, { status: 503 });
	}
};

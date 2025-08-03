// src/routes/api/ml/cv/detect/+server.ts - CORRECTED VERSION

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

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
			endpoint: `${env.CV_DETECTION_URL}/detect-frame`,
			hasFrameData: !!fastApiPayload.frame_data,
			frameLength: fastApiPayload.frame_data?.frame?.length || 'undefined',
			confidence: fastApiPayload.frame_data?.confidence
		});

		// Send to FastAPI /detect-frame endpoint (not /detect)
		const response = await fetch(`${env.CV_DETECTION_URL}/detect-frame`, {
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
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		return json({ error: 'Internal server error', details: errorMessage }, { status: 500 });
	}
};

export const GET: RequestHandler = async () => {
	try {
		const response = await fetch(`${env.CV_DETECTION_URL}/health`);

		if (!response.ok) {
			return json({ status: 'unavailable', error: 'CV service down' }, { status: 503 });
		}

		const health = await response.json();
		return json({ status: 'available', service: health });
	} catch (error) {
		console.error('CV service health check failed:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		return json({ status: 'unavailable', error: errorMessage }, { status: 503 });
	}
};

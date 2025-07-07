import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { text } = await request.json();

		if (!text || text.trim().length === 0) {
			return json({ error: 'Text is required' }, { status: 400 });
		}

		// Make request to your Linux TTS server
		const response = await fetch('http://192.168.100.103:5555/tts', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ text })
		});

		const result = await response.json();

		if (response.ok && result.success) {
			return json({
				success: true,
				audio: result.audio
			});
		} else {
			return json({ 
				error: result.error || 'TTS server error'
			}, { status: 500 });
		}

	} catch (error) {
		console.error('TTS Error:', error);
		return json({ 
			error: 'Failed to connect to TTS server'
		}, { status: 500 });
	}
};
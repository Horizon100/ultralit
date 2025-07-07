import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const WHISPER_DAEMON_URL = 'http://100.77.36.61:3001'; 

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const { audioUrl, attachmentId } = data;

		if (!audioUrl || !attachmentId) {
			throw error(400, 'Missing audioUrl or attachmentId');
		}

		const response = await fetch(`${WHISPER_DAEMON_URL}/transcribe`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				audio_url: audioUrl,
				attachment_id: attachmentId
			})
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw error(500, `Transcription failed: ${errorData.error}`);
		}

		const result = await response.json();
		return json(result);

	} catch (err) {
		console.error('Transcription API error:', err);
		throw error(500, 'Internal server error');
	}
};
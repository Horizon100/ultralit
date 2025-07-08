// src/routes/api/video/convert/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const VIDEO_CONVERTER_URL = env.VIDEO_CONVERTER_URL || 'http://localhost:3002';

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const formData = await request.formData();
		const videoFile = formData.get('video') as File;
		
		if (!videoFile) {
			return json({ error: 'No video file provided' }, { status: 400 });
		}

		// Check if file is a video
		if (!videoFile.type.startsWith('video/')) {
			return json({ error: 'File is not a video' }, { status: 400 });
		}

		// Forward the file to the video converter service
		const converterFormData = new FormData();
		converterFormData.append('video', videoFile);
		converterFormData.append('outputFormat', 'mp4');
		converterFormData.append('codec', 'h264');
		converterFormData.append('quality', 'medium');

		const response = await fetch(`${VIDEO_CONVERTER_URL}/convert`, {
			method: 'POST',
			body: converterFormData
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Video conversion service error:', errorText);
			return json({ error: 'Video conversion failed' }, { status: 500 });
		}

		// Get the converted video as a blob
		const convertedVideoBlob = await response.blob();
		
		// Create a new File object with the converted video
		const originalName = videoFile.name;
		const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
		const convertedFileName = `${nameWithoutExt}.mp4`;

		// Return the converted video as a response
		return new Response(convertedVideoBlob, {
			status: 200,
			headers: {
				'Content-Type': 'video/mp4',
				'Content-Disposition': `attachment; filename="${convertedFileName}"`,
				'X-Original-Name': originalName,
				'X-Converted-Name': convertedFileName
			}
		});

	} catch (error) {
		console.error('Video conversion API error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
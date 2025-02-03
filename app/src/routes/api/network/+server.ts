import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai/index.mjs';

const openai = new OpenAI({
	apiKey: import.meta.env.VITE_OPENAI_API_KEY
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { summary, aiModel, userId } = await request.json();

		// Use the OpenAI API to generate network based on the summary
		const response = await openai.chat.completions.create({
			model: aiModel,
			messages: [
				{ role: 'system', content: 'Generate a network structure based on the following summary:' },
				{ role: 'user', content: summary }
			]
		});

		// Ensure we have a valid response
		if (!response.choices[0].message.content) {
			throw new Error('No valid response from OpenAI');
		}

		// Parse the response and create a network structure
		const networkData = JSON.parse(response.choices[0].message.content);

		return json(networkData);
	} catch (error) {
		console.error('Error in Network Generation API:', error);
		return json(
			{ error: (error as Error).message || 'An unknown error occurred' },
			{ status: 500 }
		);
	}
};

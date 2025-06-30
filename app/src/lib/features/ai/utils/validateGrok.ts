import { apiKey } from '$lib/stores/apiKeyStore';

export async function grok(key: string): Promise<{ isValid: boolean; errorMessage?: string }> {
	try {
		const response = await fetch('https://api.x.ai/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${key}` // Pass the API key here as a Bearer token
			},
			body: JSON.stringify({
				messages: [
					{
						role: 'system',
						content: "You are Grok, a chatbot inspired by the Hitchhiker's Guide to the Galaxy."
					},
					{
						role: 'user',
						content: 'What is the answer to life and universe?'
					}
				],
				model: 'grok-beta',
				stream: false,
				temperature: 0
			})
		});

		if (!response.ok) {
			const errorData = await response.json();
			return {
				isValid: false,
				errorMessage: errorData.error?.message || 'Failed to validate API key'
			};
		}

		const responseData = await response.json();
		if (responseData && responseData.id) {
			// Check if the response includes an expected field to confirm successful validation
			return { isValid: true };
		} else {
			return { isValid: false, errorMessage: 'Unexpected response structure' };
		}
	} catch (err: unknown) {
		console.error('Grok validation error:', err);
		return { isValid: false, errorMessage: `Failed to fetch: ${(err as Error).message}` };
	}
}

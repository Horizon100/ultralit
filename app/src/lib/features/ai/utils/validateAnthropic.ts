import { Anthropic } from '@anthropic-ai/sdk';

export async function anthropic(key: string): Promise<{ isValid: boolean; errorMessage?: string }> {
	try {
		const anthropic = new Anthropic({
			apiKey: key,
			dangerouslyAllowBrowser: true // Allow browser environment for testing
		});

		// Attempt to create a message with the API
		const msg = await anthropic.messages.create({
			model: 'claude-3-5-sonnet-20241022',
			max_tokens: 1024,
			messages: [{ role: 'user', content: 'Hello, Claude' }]
		});

		return { isValid: msg !== undefined }; // Return true if message creation is successful
	} catch (err: unknown) {
		console.error('Anthropic validation error:', err);

		// Type guard to check if err is an Error object
		const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';

		// Check if it's the low credit balance error and display a relevant message
		if (errorMessage.includes('Your credit balance is too low')) {
			return {
				isValid: false,
				errorMessage:
					'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'
			};
		}

		// Handle any other errors generically
		return { isValid: false, errorMessage: `An error occurred: ${errorMessage}` };
	}
}

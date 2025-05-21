export async function openAI(key: string): Promise<boolean> {
	try {
		const response = await fetch('https://api.openai.com/v1/models', {
			headers: { Authorization: `Bearer ${key}` }
		});

		if (response.status === 401) {
			console.error('OpenAI API Key is unauthorized or invalid.');
			return false;
		}

		if (!response.ok) {
			console.error(`OpenAI API returned an error: ${response.statusText}`);
			return false;
		}

		return true; // Validation successful
	} catch (err) {
		console.error('Error validating OpenAI API Key:', err);
		return false;
	}
}

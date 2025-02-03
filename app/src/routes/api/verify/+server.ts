import { json } from '@sveltejs/kit';

export async function POST({ request }) {
	const { key, provider } = await request.json();

	try {
		let valid = false;

		switch (provider) {
			case 'openai':
				valid = await validateOpenAI(key);
				break;
			case 'anthropic':
				valid = await validateAnthropic(key);
				break;
			case 'google':
				valid = await validateGoogle(key);
				break;
			case 'grok':
				valid = await validateGrok(key);
				break;
			default:
				throw new Error('Unsupported provider');
		}

		return json({ valid });
	} catch (error) {
		return json({ valid: false, error: error.message }, { status: 500 });
	}
}

async function validateOpenAI(key: string) {
	const response = await fetch('https://api.openai.com/v1/models', {
		headers: { Authorization: `Bearer ${key}` }
	});
	return response.ok;
}

async function validateAnthropic(key: string) {
	const response = await fetch('https://api.anthropic.com/v1/models', {
		method: 'GET',
		headers: {
			'x-api-key': key,
			'content-type': 'application/json'
		}
	});
	return response.ok;
}

async function validateGoogle(key: string) {
	const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${key}`);
	const json = await response.json();
	return response.ok && json.aud !== undefined;
}

async function validateGrok(key: string) {
	const response = await fetch('https://api.grok.com/v1/validate', {
		headers: { Authorization: `Bearer ${key}` }
	});
	return response.ok;
}

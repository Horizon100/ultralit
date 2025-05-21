export async function google(key: string): Promise<boolean> {
	try {
		const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${key}`);
		const json = await response.json();
		return response.ok && json.aud !== undefined; // Valid if audience exists
	} catch (err) {
		console.error('Google validation error:', err);
		return false;
	}
}

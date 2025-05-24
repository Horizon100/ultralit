interface AIResponse {
	success: boolean;
	content?: string;
	error?: string;
}

export async function getCodeSuggestion(
	code: string,
	prompt: string,
	language: string
): Promise<AIResponse> {
	try {
		const response = await fetch('/api/ai/code/suggestion', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				code,
				prompt,
				language
			})
		});

		if (!response.ok) {
			throw new Error(`API error: ${response.status}`);
		}

		const data = await response.json();
		return {
			success: true,
			content: data.suggestion
		};
	} catch (error) {
		console.error('AI suggestion error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

export async function explainCode(code: string, language: string): Promise<AIResponse> {
	try {
		const response = await fetch('/api/ai/code/explain', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				code,
				language
			})
		});

		if (!response.ok) {
			throw new Error(`API error: ${response.status}`);
		}

		const data = await response.json();
		return {
			success: true,
			content: data.explanation
		};
	} catch (error) {
		console.error('AI explanation error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

export async function generateCode(prompt: string, language: string): Promise<AIResponse> {
	try {
		const response = await fetch('/api/ai/code/generate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				prompt,
				language
			})
		});

		if (!response.ok) {
			throw new Error(`API error: ${response.status}`);
		}

		const data = await response.json();
		return {
			success: true,
			content: data.code
		};
	} catch (error) {
		console.error('AI code generation error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

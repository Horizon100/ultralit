import { clientTryCatch } from '$lib/utils/errorUtils';

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
	const result = await clientTryCatch(
		fetch('/api/ai/code/suggestion', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ code, prompt, language })
		}).then((res) => {
			if (!res.ok) throw new Error(`API error: ${res.status}`);
			return res.json();
		}),
		'AI suggestion error'
	);

	if (result.success) {
		return { success: true, content: result.data.suggestion };
	}
	return { success: false, error: result.error };
}

export async function explainCode(code: string, language: string): Promise<AIResponse> {
	const result = await clientTryCatch(
		fetch('/api/ai/code/explain', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ code, language })
		}).then((res) => {
			if (!res.ok) throw new Error(`API error: ${res.status}`);
			return res.json();
		}),
		'AI explanation error'
	);

	if (result.success) {
		return { success: true, content: result.data.explanation };
	}
	return { success: false, error: result.error };
}

export async function generateCode(prompt: string, language: string): Promise<AIResponse> {
	const result = await clientTryCatch(
		fetch('/api/ai/code/generate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ prompt, language })
		}).then((res) => {
			if (!res.ok) throw new Error(`API error: ${res.status}`);
			return res.json();
		}),
		'AI code generation error'
	);

	if (result.success) {
		return { success: true, content: result.data.code };
	}
	return { success: false, error: result.error };
}

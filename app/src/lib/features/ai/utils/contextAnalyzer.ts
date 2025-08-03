// src/lib/ai/contextAnalyzer.ts
import type { LocalModelParams, MessageContext } from '$lib/types/types.localModels';

export class ContextAnalyzer {
	// Keywords for different content types
	private static readonly PATTERNS = {
		code: {
			keywords: [
				'function',
				'class',
				'variable',
				'array',
				'object',
				'method',
				'algorithm',
				'debug',
				'fix',
				'implement',
				'code',
				'typescript',
				'javascript',
				'python',
				'api',
				'database'
			],
			phrases: ['write a', 'create a', 'how to', 'implement', 'fix this', 'debug', 'optimize'],
			codeBlocks: /```|`[^`]+`|<code>/i
		},

		creative: {
			keywords: [
				'story',
				'poem',
				'creative',
				'imagine',
				'write',
				'describe',
				'narrative',
				'character',
				'plot',
				'fiction'
			],
			phrases: ['write a story', 'create a poem', 'imagine if', 'tell me about', 'describe a scene']
		},

		factual: {
			keywords: [
				'what is',
				'define',
				'explain',
				'how does',
				'why',
				'when',
				'where',
				'facts',
				'information'
			],
			phrases: ['what is', 'how does', 'explain the', 'define', 'tell me the facts']
		},

		json: {
			keywords: ['json', 'data', 'structure', 'format', 'schema', 'api response', 'config'],
			phrases: ['return json', 'format as json', 'json structure', 'api format']
		}
	};

	static analyzeMessage(message: string): MessageContext {
		const lowerMsg = message.toLowerCase();
		const scores = {
			code: 0,
			creative: 0,
			factual: 0,
			json: 0,
			chat: 1 // baseline
		};

		// Check for code patterns
		if (this.PATTERNS.code.codeBlocks.test(message)) {
			scores.code += 3;
		}

		scores.code += this.countMatches(lowerMsg, this.PATTERNS.code.keywords) * 2;
		scores.code += this.countMatches(lowerMsg, this.PATTERNS.code.phrases) * 3;

		// Check for creative patterns
		scores.creative += this.countMatches(lowerMsg, this.PATTERNS.creative.keywords) * 2;
		scores.creative += this.countMatches(lowerMsg, this.PATTERNS.creative.phrases) * 3;

		// Check for factual patterns
		scores.factual += this.countMatches(lowerMsg, this.PATTERNS.factual.keywords) * 2;
		scores.factual += this.countMatches(lowerMsg, this.PATTERNS.factual.phrases) * 3;

		// Check for JSON patterns
		scores.json += this.countMatches(lowerMsg, this.PATTERNS.json.keywords) * 2;
		scores.json += this.countMatches(lowerMsg, this.PATTERNS.json.phrases) * 4;

		// Find highest scoring type
		const maxType = Object.keys(scores).reduce((a, b) =>
			scores[a as keyof typeof scores] > scores[b as keyof typeof scores] ? a : b
		) as keyof typeof scores;

		const maxScore = scores[maxType];
		const confidence = Math.min(maxScore / 5, 1); // Normalize to 0-1

		// Determine complexity
		const complexity = this.analyzeComplexity(message);

		// Detect programming language
		const language = this.detectLanguage(message);

		return {
			type: maxType,
			confidence,
			complexity,
			language
		};
	}

	private static countMatches(text: string, patterns: string[]): number {
		return patterns.reduce((count, pattern) => {
			return count + (text.includes(pattern) ? 1 : 0);
		}, 0);
	}

	private static analyzeComplexity(message: string): 'simple' | 'medium' | 'complex' {
		const wordCount = message.split(' ').length;
		const hasMultipleQuestions = (message.match(/\?/g) || []).length > 1;
		const hasCodeBlocks = /```/.test(message);

		if (wordCount > 50 || hasMultipleQuestions || hasCodeBlocks) {
			return 'complex';
		} else if (wordCount > 15) {
			return 'medium';
		} else {
			return 'simple';
		}
	}

	private static detectLanguage(message: string): string | undefined {
		const languages = {
			typescript: /typescript|\.ts\b|interface|type\s/i,
			javascript: /javascript|\.js\b|const\s|let\s|var\s/i,
			python: /python|\.py\b|def\s|import\s/i,
			css: /css|\.css\b|selector|style/i,
			html: /html|\.html\b|<[^>]+>/i,
			sql: /sql|select|insert|update|delete/i
		};

		for (const [lang, pattern] of Object.entries(languages)) {
			if (pattern.test(message)) {
				return lang;
			}
		}
		return undefined;
	}

	// Get optimal parameters based on context
static getOptimalParams(context: MessageContext, currentModel?: string): Partial<LocalModelParams> {
    const baseParams = {
        model: currentModel || 'qwen2.5:0.5b',
        stream: false
    };

		switch (context.type) {
			case 'code':
				return {
					...baseParams,
					temperature: 0.2,
					top_p: 0.5,
					top_k: 20,
					max_tokens: context.complexity === 'complex' ? 600 : 300,
					stop: ['```', '</code>', '\n\n\n'],
					system: `You are a expert ${context.language || 'programming'} developer. Provide clean, well-commented code with brief explanations.`,
					keep_alive: '30m',
					repeat_penalty: 1.1
				};

			case 'creative':
				return {
					...baseParams,
					temperature: 0.8,
					top_p: 0.95,
					top_k: 50,
					max_tokens: context.complexity === 'complex' ? 800 : 400,
					system: 'You are a creative writer. Write engaging, imaginative content.',
					keep_alive: '15m',
					repeat_penalty: 1.05
				};

			case 'factual':
				return {
					...baseParams,
					temperature: 0.1,
					top_p: 0.3,
					top_k: 10,
					max_tokens: context.complexity === 'simple' ? 150 : 300,
					system: 'You are a knowledgeable assistant. Provide accurate, concise information.',
					keep_alive: '10m',
					repeat_penalty: 1.15
				};

			case 'json':
				return {
					...baseParams,
					temperature: 0.2,
					top_p: 0.4,
					format: 'json' as const,
					max_tokens: 300,
					system: 'Return valid JSON only. No explanation text.',
					keep_alive: '5m'
				};

			default: // chat
				return {
					...baseParams,
					temperature: 0.7,
					top_p: 0.9,
					top_k: 40,
					max_tokens: context.complexity === 'simple' ? 200 : 400,
					system: 'You are a helpful assistant. Be conversational and friendly.',
					keep_alive: '15m'
				};
		}
	}
}

// Usage example:
export function getSmartParams(userMessage: string): LocalModelParams {
	const context = ContextAnalyzer.analyzeMessage(userMessage);
	const params = ContextAnalyzer.getOptimalParams(context);

	console.log(`Detected: ${context.type} (${Math.round(context.confidence * 100)}% confidence)`);

	return {
		prompt: userMessage,
		...params
	} as LocalModelParams;
}

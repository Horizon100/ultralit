import type { AIModel, AIMessage, Scenario, Task, AIAgent, Guidance } from '$lib/types/types';
import type { ModelState } from '$lib/stores/modelStore';
import { defaultModel } from '$lib/constants/models';
import { getPrompt } from '$lib/constants/prompts';
import { pb } from '$lib/pocketbase';
import { get } from 'svelte/store';
import { apiKey } from '$lib/stores/apiKeyStore';

export async function fetchAIResponse(
	messages: AIMessage[],
	model: AIModel | null,
	userId: string,
	attachment: File | null = null
): Promise<string> {
	try {
		const supportedMessages = messages
			.filter((msg) => ['system', 'assistant', 'user', 'function', 'tool'].includes(msg.role))
			.map((msg) => ({
				role: msg.role,
				content: msg.prompt_type
					? `${getPrompt(msg.prompt_type, '')}\n${msg.content}`
					: msg.content,
				model: msg.model
			}));

		console.log('Original model:', model);
		
		// Ensure we always have a valid model
		if (!model || (typeof model === 'string')) {
			console.log('Using default model due to invalid model data');
			model = { ...defaultModel };
		}
		
		// Make sure provider is set
		if (!model.provider) {
			console.log('Setting default provider for model');
			model.provider = 'deepseek';
		}
		
		// Make sure api_type is set
		if (!model.api_type) {
			console.log('Setting default api_type for model');
			model.api_type = 'deepseek-chat'; // Set a valid model name for deepseek
		}
		
		console.log('Using model:', model);

		// Prepare request body
		const body = attachment
			? new FormData()
			: {
					messages: supportedMessages,
					model: {
						id: model.id || 'default-model',
						provider: model.provider,
						api_type: model.api_type || model.name,
						name: model.name || 'Default Model'
					},
					userId
				};

		if (attachment) {
			(body as FormData).append('messages', JSON.stringify(supportedMessages));
			(body as FormData).append('model', JSON.stringify({
				id: model.id || 'default-model',
				provider: model.provider,
				api_type: model.api_type || model.name,
				name: model.name || 'Default Model'
			}));
			(body as FormData).append('userId', userId);
			(body as FormData).append('attachment', attachment);
		}

		// Determine provider and get API key
		const provider = model.provider || 'openai';
		console.log('Provider:', provider);
		
		const userApiKey = get(apiKey)[provider] || '';

		// If no user API key is found, check for additional fallback mechanisms
		if (!userApiKey) {
			console.log(`No API key found for provider: ${provider}, checking alternatives...`);
			
			// Try loading keys again (in case they weren't loaded properly)
			await apiKey.loadKeys();
			const refreshedKeys = get(apiKey);
			
			// Check if we have the key after refreshing
			if (refreshedKeys[provider]) {
				console.log(`Found key for ${provider} after refresh`);
			} else {
				// If still no key for the requested provider, check if we have keys for any provider
				const availableProviders = Object.entries(refreshedKeys)
					.filter(([_, key]) => !!key)
					.map(([provider]) => provider);
				
				if (availableProviders.length > 0) {
					// Use the first available provider as fallback
					const fallbackProvider = availableProviders[0];
					console.log(`Falling back to provider: ${fallbackProvider}`);
					
					// Update the model to use the available provider
					model.provider = fallbackProvider;
					
					// Update the model.api_type based on the fallback provider
					if (fallbackProvider === 'openai') {
						model.api_type = 'gpt-3.5-turbo';
					} else if (fallbackProvider === 'anthropic') {
						model.api_type = 'claude-3-sonnet-20240229';
					} else if (fallbackProvider === 'deepseek') {
						model.api_type = 'deepseek-chat';
					}
				} else {
					throw new Error(`No API keys available for any provider`);
				}
			}
		}

		// Get the API key again after potential provider change
		const finalApiKey = get(apiKey)[model.provider] || '';
		if (!finalApiKey) {
			throw new Error(`No API key found for provider: ${model.provider}`);
		}

		// Make API request
		const response = await fetch('/api/ai', {
			method: 'POST',
			headers: {
				...(!attachment && { 'Content-Type': 'application/json' }),
				Authorization: `Bearer ${finalApiKey}`
			},
			body: attachment ? body : JSON.stringify(body)
		});

		// Handle errors
		if (!response.ok) {
			const errorText = await response.text();
			console.error('API error:', response.status, errorText);
			throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
		}

		// Return response
		const responseData = await response.json();
		return responseData.response;
	} catch (error) {
		console.error('Error in fetchAIResponse:', error);
		throw error;
	}
}

export async function fetchNamingResponse(
	userMessage: string,
	aiResponse: string,
	model: AIModel,
	userId: string
): Promise<string> {
	try {
		const messages: AIMessage[] = [
			{
				role: 'assistant',
				content:
					'Create a concise, descriptive title (max 5 words) for this conversation based on the user message and AI response. Focus on the main topic or question being discussed.',
				model: typeof model === 'string' ? model : model.api_type
				},
			{
				role: 'user',
				content: `User message: "${userMessage}"\nAI response: "${aiResponse}"\nGenerate title:`,
				model: typeof model === 'string' ? model : model.api_type
			}
		];
		const response = await fetchAIResponse(messages, model, userId);

		const threadName = response
			.trim()
			.replace(/^["']|["']$/g, '')
			.slice(0, 50);

		return threadName;
	} catch (error) {
		console.error('Error in fetchNamingResponse:', error);
		throw error;
	}
}

export async function generateGuidance(
	context: { type: string; description: string },
	model: AIModel,
	userId: string
): Promise<Guidance> {
	const messages: AIMessage[] = [
		{
			role: 'assistant',
			content: getPrompt('BRAINSTORM', ''),
			model: model.api_type
		},
		{
			role: 'user',
			content: JSON.stringify(context),
			model: model.api_type
		}
	];

	// Pass the full model object, not just model.api_type
	const response = await fetchAIResponse(messages, model, userId);

	return {
		type: context.type,
		content: response
	};
}

export async function generateScenarios(
	seedPrompt: string,
	model: AIModel,
	userId: string
): Promise<Scenario[]> {
	const messages: AIMessage[] = [
		{
			role: 'assistant',
			content: getPrompt('FLOW', ''),
			model: model.api_type
		},
		{
			role: 'user',
			content: seedPrompt,
			model: model.api_type
		}
	];

	// Pass the full model object, not just model.api_type
	const response = await fetchAIResponse(messages, model, userId);

	// Parse the response into three scenarios
	const scenarios: Scenario[] = response
		.split('\n')
		.filter(Boolean)
		.map((desc, index) => ({
			id: `scenario-${index + 1}`,
			description: desc.trim(),
			collectionId: '',
			collectionName: '',
			created: '',
			updated: ''
		}));

	return scenarios;
}

export async function generateTasks(
	scenario: Scenario,
	model: AIModel,
	userId: string
): Promise<Task[]> {
	const messages: AIMessage[] = [
		{
			role: 'assistant',
			content: getPrompt('PLANNER', ''),
			model: model.api_type
		},
		{ role: 'user', content: scenario.description, model: model.api_type }
	];

	const response = await fetchAIResponse(messages, model, userId);

	const tasks: Task[] = response
		.split('\n')
		.filter(Boolean)
		.map((desc, index) => ({
			id: `task-${index + 1}`,
			title: `Task ${index + 1}`,
			description: desc.trim(),
			status: 'todo',
			priority: 'medium',
			due_date: new Date(),
			created_by: userId,
			assigned_to: '',
			ai_agents: '',
			tags: [],
			attachments: '',
			eisenhower: '',
			rice_score: 0,
			parent_task_id: '',
			subtasks: [],
			prompt: '',
			context: '',
			base_priority: 0,
			adaptive_priority: 0,
			altruism_weight: 0,
			survival_weight: 0,
			exploration_weight: 0,
			aspiration_weight: 0,
			surrogate_weight: 0,
			selfdev_weight: 0,
			collectionId: '',
			collectionName: '',
			created: '',
			updated: '',
			task_outcome: '',
			parent_agent: '',
			dependencies: [],
			messages: []
		}));

	return tasks;
}

export async function createAIAgent(
	scenario: Scenario,
	tasks: Task[],
	model: AIModel,
	userId: string
): Promise<AIAgent> {
	const context = `Scenario: ${scenario.description}\nTasks: ${tasks.map((t) => t.description).join(', ')}`;
	const messages: AIMessage[] = [
		{
			role: 'assistant',
			content: getPrompt('CODER', context),
			model: model.api_type
		}
	];

	const response = await fetchAIResponse(messages, model, userId);
	
	return {
		id: 'ai-agent-' + Date.now(),
		name: `Agent for ${scenario.description.slice(0, 20)}...`,
		description: response,
		role: 'assistant', 
		model: model.api_type,
		user: userId,
		child_agents: [],
		position: { x: 0, y: 0 },
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: '',
		collectionName: ''
	};
}

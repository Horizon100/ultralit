import type {
	AIModel,
	AIMessage,
	Scenario,
	Task,
	AIAgent,
	RoleType,
	ProviderType
} from '$lib/types/types';
import { getPrompt, prepareMessagesWithCustomPrompts } from '$lib/features/ai/utils/prompts';
import { get } from 'svelte/store';
import { apiKey } from '$lib/stores/apiKeyStore';
import {
	fetchTryCatch,
	clientTryCatch,
	validationTryCatch,
	thirdPartyApiTryCatch
} from '$lib/utils/errorUtils';
import { defaultModel, getDefaultModel, checkLocalServerAvailability, defaultLocalModel } from '$lib/features/ai/utils/models';


export async function fetchAIResponse(
	messages: AIMessage[],
	model: AIModel | null,
	userId: string,
	attachment: File | null = null
): Promise<string> {
	const prepareResult = await clientTryCatch(
		prepareMessagesWithCustomPrompts(messages),
		'Failed to prepare messages with custom prompts'
	);

	if (!prepareResult.success) {
		throw new Error(prepareResult.error);
	}

	const messagesWithCustomPrompts = prepareResult.data;

	const supportedMessages = messagesWithCustomPrompts
		.filter((msg) => ['system', 'assistant', 'user', 'function', 'tool'].includes(msg.role))
		.filter((msg) => msg.content && msg.content.trim())
		.map((msg) => ({
			role: msg.role,
			content: msg.content,
			model: msg.model
		}));
	console.log('Sending messages to AI:', supportedMessages);

	console.log('Original model:', model);

let modelToUse: AIModel;
	if (!model || typeof model === 'string') {
		console.log('Using default model due to invalid model data');
		// Use dynamic default model selection
		modelToUse = await getDefaultModel();
	} else {
		modelToUse = {
			...model,
			provider: model.provider || defaultModel.provider,
			api_type: model.api_type || defaultModel.api_type,
			base_url: model.base_url || defaultModel.base_url,
			api_version: model.api_version || defaultModel.api_version,
			api_key: model.api_key || defaultModel.api_key
		};
	}

	console.log('Initial model to use:', modelToUse);

// Handle local models - don't proceed with API logic
	if (modelToUse.provider === 'local') {
		console.log('🤖 Local model detected, redirecting to local handler');
		throw new Error('LOCAL_MODEL_REDIRECT');
	}
	let requestBody: FormData | string;

	const modelData = {
		id: modelToUse.id || 'default-model',
		provider: modelToUse.provider,
		api_type: modelToUse.api_type || modelToUse.name,
		name: modelToUse.name || 'Default Model'
	};

	if (attachment) {
		const formData = new FormData();
		formData.append('messages', JSON.stringify(supportedMessages));
		formData.append('model', JSON.stringify(modelData));
		formData.append('userId', userId);
		formData.append('attachment', attachment);
		requestBody = formData;
	} else {
		requestBody = JSON.stringify({
			messages: supportedMessages,
			model: modelData,
			userId
		});
	}

	const provider = modelToUse.provider || 'deepseek';
	console.log('Provider:', provider);

	console.log('Ensuring API keys are loaded...');
	await apiKey.ensureLoaded();

	console.log('Ensuring API keys are loaded...');
	await apiKey.ensureLoaded();

	// Check if we have an API key for the current provider
	let userApiKey = apiKey.getKey(modelToUse.provider);

	if (!userApiKey) {
		console.log(`No API key found for provider: ${modelToUse.provider}, checking alternatives...`);

		// Define provider fallback with their default models
		const providerDefaults: Record<ProviderType, string> = {
			openai: 'gpt-3.5-turbo',
			anthropic: 'claude-3-haiku-20240307',
			google: 'gemini-pro',
			grok: 'grok-beta',
			deepseek: 'deepseek-chat',
			local: 'qwen2.5:0.5b'

		};


		// Check which providers have keys or are available
		const availableProviders: ProviderType[] = [];
		
		// Check API providers
		Object.keys(providerDefaults).forEach((p) => {
			if (p !== 'local' && apiKey.hasKey(p as ProviderType)) {
				availableProviders.push(p as ProviderType);
			}
		});

		// Check local availability
		const localAvailable = await checkLocalServerAvailability();
		if (localAvailable) {
			availableProviders.unshift('local' as ProviderType); // Add local at the beginning for priority
		}

		console.log('Available providers:', availableProviders);

		if (availableProviders.length > 0) {
			const fallbackProvider = availableProviders[0]; // This will prioritize local if available
			console.log(`Falling back to provider: ${fallbackProvider}`);

			if (fallbackProvider === 'local') {
				// Create local model and redirect
				modelToUse = {
					...defaultLocalModel,
					api_type: providerDefaults[fallbackProvider],
					name: providerDefaults[fallbackProvider]
				};
				throw new Error('LOCAL_MODEL_REDIRECT');
			} else {
				// Update model to use API fallback provider
				modelToUse = {
					...modelToUse,
					provider: fallbackProvider,
					api_type: providerDefaults[fallbackProvider],
					name: providerDefaults[fallbackProvider]
				};
				userApiKey = apiKey.getKey(fallbackProvider);
			}
		} else {
			throw new Error('No API keys available for any provider and local server is not available. Please add API keys in settings or ensure local AI server is running.');
		}
	}

	// Final validation for non-local providers
	const finalApiKey = apiKey.getKey(modelToUse.provider);
	if (!finalApiKey && modelToUse.provider !== 'local') {
		throw new Error(
			`No API key found for provider: ${modelToUse.provider}. Please add an API key for this provider.`
		);
	}

// Replace your current error handling section in aiClient.ts with this:

console.log('Final model to use:', modelToUse);

try {
	const response = await fetch('/api/ai', {
		method: 'POST',
		headers: {
			...(attachment ? {} : { 'Content-Type': 'application/json' })
		},
		body: requestBody
	});

	console.log('🤖 Raw fetch response status:', response.status);
	console.log('🤖 Raw fetch response ok:', response.ok);

	if (!response.ok) {
		const errorText = await response.text();
		console.error('API error:', response.status, errorText);
		
		// Check for specific error types that might indicate model issues
		const isModelError = errorText.includes('Model Not Exist') || 
							errorText.includes('model not found') ||
							errorText.includes('invalid model') ||
							errorText.includes('model does not exist') ||
							errorText.includes('Model not found');
							
		const isBillingError = errorText.includes('credit balance') || 
							 errorText.includes('billing') ||
							 errorText.includes('quota') ||
							 errorText.includes('rate limit') ||
							 errorText.includes('insufficient credits');

		if (isModelError) {
			console.log('🤖 Model error detected, attempting fallback...');
			throw new Error(`MODEL_NOT_EXIST: ${errorText}`);
		} else if (isBillingError) {
			console.log('🤖 Billing error detected, attempting fallback...');
			throw new Error(`BILLING_ERROR: ${errorText}`);
		} else {
			throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
		}
	}

	const responseData = await response.json();
	console.log('🤖 Full AI response data:', responseData);

	// Debug lines
	console.log('🔍 CLIENT DEBUG - Full response structure:', JSON.stringify(responseData, null, 2));
	console.log('🔍 CLIENT DEBUG - Response keys:', Object.keys(responseData || {}));
	console.log('🔍 CLIENT DEBUG - Response type:', typeof responseData);
	console.log('🔍 CLIENT DEBUG - responseData.response exists:', !!responseData.response);
	console.log('🔍 CLIENT DEBUG - responseData.response type:', typeof responseData.response);

	// Handle different possible response structures
	let finalResponse: string = '';

	if (responseData.success && responseData.data && typeof responseData.data === 'object') {
		const wrappedData = responseData.data;
		if (wrappedData.response && typeof wrappedData.response === 'string') {
			finalResponse = wrappedData.response;
			console.log('✅ Found response in responseData.data.response');
		} else if (wrappedData.content && typeof wrappedData.content === 'string') {
			finalResponse = wrappedData.content;
			console.log('✅ Found response in responseData.data.content');
		} else if (wrappedData.message && typeof wrappedData.message === 'string') {
			finalResponse = wrappedData.message;
			console.log('✅ Found response in responseData.data.message');
		} else if (wrappedData.text && typeof wrappedData.text === 'string') {
			finalResponse = wrappedData.text;
			console.log('✅ Found response in responseData.data.text');
		}
	} else if (responseData.response && typeof responseData.response === 'string') {
		finalResponse = responseData.response;
		console.log('✅ Found response in responseData.response');
	} else if (responseData.content && typeof responseData.content === 'string') {
		finalResponse = responseData.content;
		console.log('✅ Found response in responseData.content');
	} else if (responseData.message && typeof responseData.message === 'string') {
		finalResponse = responseData.message;
		console.log('✅ Found response in responseData.message');
	} else if (responseData.text && typeof responseData.text === 'string') {
		finalResponse = responseData.text;
		console.log('✅ Found response in responseData.text');
	} else if (responseData.data && typeof responseData.data === 'string') {
		finalResponse = responseData.data;
		console.log('✅ Found response in responseData.data');
	} else if (typeof responseData === 'string') {
		finalResponse = responseData;
		console.log('✅ Response data is direct string');
	}

	// Add validation at the end
	if (!finalResponse) {
		console.error('❌ Could not find response text in any expected field');
		console.error('❌ Available fields:', Object.keys(responseData || {}));
		console.error('❌ Full response structure:', JSON.stringify(responseData, null, 2));
		throw new Error('Could not extract response text from AI API response');
	}
	
	console.log('🎯 Final extracted response:', finalResponse);
	return finalResponse;

} catch (error) {
	const errorMessage = error instanceof Error ? error.message : String(error);
	
	// Check if this is a model error that we should handle with fallback
	if (errorMessage.includes('MODEL_NOT_EXIST') || 
		errorMessage.includes('BILLING_ERROR') || 
		errorMessage.includes('LOCAL_MODEL_REDIRECT')) {
		console.log('🤖 Detected recoverable error, will be handled by MessageService:', errorMessage);
		throw error; // Re-throw for MessageService to handle
	}
	
	// For other errors, throw as is
	console.error('🤖 Non-recoverable error in aiClient:', errorMessage);
	throw error;
}

}
export async function debugApiKeys() {
	console.log('=== API KEY DEBUG ===');

	try {
		await apiKey.ensureLoaded();

		const providers = ['openai', 'anthropic', 'google', 'grok', 'deepseek'];

		console.log('Testing each provider:');
		providers.forEach((provider) => {
			const hasKey = apiKey.hasKey(provider);
			const keyValue = apiKey.getKey(provider);
			console.log(
				`${provider}: hasKey=${hasKey}, key=${keyValue ? `${keyValue.substring(0, 10)}...` : 'none'}`
			);
		});

		// Test the raw API endpoint
		console.log('Testing raw API endpoint...');
		const response = await fetch('/api/keys', {
			method: 'GET',
			credentials: 'include'
		});

		console.log('API response status:', response.status);
		const data = await response.json();
		console.log('API response data:', data);
	} catch (error) {
		console.error('Error in API key debug:', error);
	}
}
export async function handleStartPromptClick(
	promptText: string,
	threadId: string | null,
	aiModel: AIModel,
	userId: string
): Promise<{
	response: string;
	threadId: string | null;
	userMessageId: string;
	assistantMessageId: string;
}> {
	let currentThreadId = threadId;
	if (!currentThreadId) {
		const response = await fetchTryCatch<{ id: string }>('/api/threads', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: promptText.substring(0, 50) + (promptText.length > 50 ? '...' : ''),
				userId
			})
		});

		if (!response.success) {
			throw new Error(response.error);
		}

		currentThreadId = response.data.id;
	}

	const userMessageResponse = await fetchTryCatch<{ id: string }>('/api/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			text: promptText,
			type: 'human',
			thread: currentThreadId,
			parent_msg: null
		})
	});

	if (!userMessageResponse.success) {
		throw new Error(userMessageResponse.error);
	}

	const userMessage = userMessageResponse.data;

	const messages: AIMessage[] = [
		{
			role: 'user',
			content: promptText,
			provider: aiModel.provider,
			model: aiModel.api_type
		}
	];

	const aiResponseText = await fetchAIResponse(messages, aiModel, userId);

	const assistantMessageResponse = await fetchTryCatch<{ id: string }>('/api/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			text: aiResponseText,
			type: 'robot',
			thread: currentThreadId,
			parent_msg: userMessage.id,
			model: aiModel.api_type
		})
	});

	if (!assistantMessageResponse.success) {
		throw new Error(assistantMessageResponse.error);
	}

	const assistantMessage = assistantMessageResponse.data;

	if (!threadId) {
		const updateResult = await fetchTryCatch<unknown>(`/api/threads/${currentThreadId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: promptText.substring(0, 50) + (promptText.length > 50 ? '...' : '')
			})
		});

		if (!updateResult.success) {
			console.warn('Failed to update thread title:', updateResult.error);
		}
	}

	return {
		response: aiResponseText,
		threadId: currentThreadId,
		userMessageId: userMessage.id,
		assistantMessageId: assistantMessage.id
	};
}

export async function generateAISuggestions(
	projectDescription: string,
	model: AIModel,
	userId: string
): Promise<string[]> {
	const messages: AIMessage[] = [
		{
			role: 'system',
			content:
				'You are an AI assistant helping generate useful prompts based on a project description. Generate exactly 10 relevant prompt suggestions that would help the user explore or develop their project further. Each suggestion should be concise (under 15 words), actionable, and directly usable as a prompt. Do not include any introduction, numbering, or formatting characters like asterisks. Return just a plain list of prompts, one per line.',
			provider: model.provider,
			model: model.api_type
		},
		{
			role: 'user',
			content: `Project Description: "${projectDescription}"\n\nGenerate a list of 10 helpful prompts related to this project that I could ask an AI assistant.`,
			provider: model.provider,
			model: model.api_type
		}
	];

	const responseResult = await clientTryCatch(
		fetchAIResponse(messages, model, userId),
		'Failed to generate AI suggestions'
	);

	if (!responseResult.success) {
		console.error('Error generating AI suggestions:', responseResult.error);
		throw new Error(responseResult.error);
	}

	const response = responseResult.data;

	const suggestions = response
		.split(/\n+/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => line.replace(/^[-*\d.]+\s*/, ''))
		.map((line) => line.replace(/[*"`']/g, ''))
		.filter(
			(line) =>
				!line.toLowerCase().includes('here are') &&
				!line.toLowerCase().includes('suggestions') &&
				!line.toLowerCase().includes('prompts to')
		)
		.filter((line) => line.length > 5 && line.length < 100)
		.slice(0, 10);

	if (suggestions.length === 0) {
		return [
			'How to optimize the project architecture?',
			'Ways to improve user experience in this application',
			'Suggest performance optimizations for this project',
			'Best practices for securing this application',
			'Ideas for new features to add to this project'
		];
	}

	return suggestions;
}

export async function generateTasks(
	scenario: Scenario,
	model: AIModel,
	userId: string
): Promise<Task[]> {
	const messages: AIMessage[] = [
		{
			role: 'assistant' as RoleType,
			content: getPrompt('CONCISE', ''),
			provider: model.provider,
			model: model.api_type
		},
		{
			role: 'user' as RoleType,
			content: scenario.description,
			provider: model.provider,
			model: model.api_type
		}
	];

	const response = await fetchAIResponse(messages, model, userId);

	const tasks: Task[] = response
		.split('\n')
		.filter(Boolean)
		.map((desc, index) => ({
			id: `task-${index + 1}`,
			title: `Task ${index + 1}`,
			taskDescription: desc.trim(),
			status: 'todo' as const,
			priority: 'medium' as const,
			due_date: new Date(),
			start_date: new Date(),
			parent_task: '',
			taskTags: [],
			assignedTo: '',
			createdBy: userId,
			assigned_to: '',
			ai_agents: '',
			tags: [],
			attachments: '',
			project_id: '',
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
			allocatedAgents: [],
			dependencies: [],
			agentMessages: []
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
			content: getPrompt('NORMAL', context),
			provider: model.provider,
			model: model.api_type
		}
	];

	const response = await fetchAIResponse(messages, model, userId);

	return {
		id: 'ai-agent-' + Date.now(),
		name: `Agent for ${scenario.description.slice(0, 20)}...`,
		description: response,
		role: 'assistant' as RoleType,
		model: [model.api_type],
		user: userId,
		owner: userId,
		editors: [],
		activityLog: [],
		currentUsers: [],
		currentProjects: [],
		currentThreads: [],
		currentMessages: [],
		currentPosts: [],
		currentTasks: [],
		max_attempts: 3,
		user_input: 'end' as const,
		prompt: '',
		actions: [],
		avatar: '',
		capabilities: [],
		tasks: [],
		status: 'active' as const,
		messages: [],
		tags: [],
		performance: 0,
		version: '1.0.0',
		last_activity: new Date(),
		parent_agent: undefined,
		child_agents: [],
		base_priority: 0,
		adaptive_priority: 0,
		weight_altruism: 0,
		weight_survival: 0,
		weight_exploration: 0,
		weight_aspiration: 0,
		weight_surrogate: 0,
		weight_selfdev: 0,
		label: undefined,
		position: { x: 0, y: 0 },
		expanded: false,
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: '',
		collectionName: ''
	};
}

export async function generateTaskDescription(
	content: string,
	model: AIModel,
	userId: string
): Promise<string> {
	const systemPrompt: AIMessage = {
		role: 'system' as RoleType,
		content: `Create a focused, action-oriented task description from the provided content.
- Write in imperative style (e.g., "Develop API documentation" not "Here's a task to develop API documentation")
- Be specific about requirements and acceptance criteria
- Omit any phrases like "here is" or meta-commentary
- Focus only on actionable items and deliverables
- Format as direct instructions
- Be concise but complete
- Include only text that would be useful in a task tracking system`,
		provider: model.provider,
		model: model.api_type
	};

	const userPrompt: AIMessage = {
		role: 'user' as RoleType,
		content: `Transform this into a focused task description:
${content}`,
		provider: model.provider,
		model: model.api_type
	};

	const taskDescriptionResult = await clientTryCatch(
		fetchAIResponse([systemPrompt, userPrompt], model, userId),
		'Failed to generate task description'
	);

	if (!taskDescriptionResult.success) {
		console.error('Error generating task description:', taskDescriptionResult.error);
		return content;
	}

	return taskDescriptionResult.data.trim();
}

function extractTaskTitle(taskDescription: string, maxLength: number = 50): string {
	let title = '';

	const firstSentence = taskDescription.split('.')[0];
	if (firstSentence && firstSentence.length > 5) {
		title = firstSentence.trim();
	} else {
		title = taskDescription.split('\n')[0].trim();
	}

	if (title.length > maxLength) {
		title = title.substring(0, maxLength - 3) + '...';
	}

	return title;
}

export async function generateTaskFromMessage(taskDetails: {
	content: string;
	messageId?: string;
	model: AIModel;
	userId: string;
	threadId?: string;
	isParentTask?: boolean;
}): Promise<{
	title: string;
	description: string;
}> {
	const systemPrompt: AIMessage = {
		role: 'system',
		content: taskDetails.isParentTask
			? `Create a concise title and short summary for a task based on the provided content.
		 The title should be clear, specific, and under 50 characters.
		 The summary should be 2-3 sentences explaining the overall goal and purpose.
		 Format your response with just the title on the first line (no 'Title:' prefix),
		 followed by the summary description.
		DO NOT include "Title:" or any other labels or markdown formatting.
		 DO NOT include numbered steps, bullet points, or detailed subtasks - those will be handled separately.`
			: `Create a focused, action-oriented task description from the provided content.
		 - Write in imperative style
		 - Be specific about requirements and acceptance criteria
		 - Omit any phrases like "here is" or meta-commentary
		 - Focus only on actionable items and deliverables
		 - Format as direct instructions
		 - Be concise but complete`,
		provider: taskDetails.model.provider,
		model: taskDetails.model.api_type
	};

	const userPrompt: AIMessage = {
		role: 'user' as RoleType,
		content: `Transform this into a ${taskDetails.isParentTask ? 'task title and summary' : 'focused task description'}:
	  ${taskDetails.content}`,
		provider: taskDetails.model.provider,
		model: taskDetails.model.api_type
	};

	const responseResult = await clientTryCatch(
		fetchAIResponse([systemPrompt, userPrompt], taskDetails.model, taskDetails.userId),
		'Failed to generate task from message'
	);

	if (!responseResult.success) {
		console.error('Error in generateTaskFromMessage:', responseResult.error);

		const cleanContent = taskDetails.content.replace(/<\/?[^>]+(>|$)/g, '');
		const fallbackTitle = extractTaskTitle(cleanContent);

		return {
			title: fallbackTitle,
			description: taskDetails.isParentTask ? cleanContent.substring(0, 200) : cleanContent
		};
	}

	const response = responseResult.data;

	if (taskDetails.isParentTask) {
		const lines = response.trim().split('\n');
		let title = '';
		let description = '';

		if (lines[0].toLowerCase().includes('title:')) {
			title = lines[0].replace(/^.*title:\s*/i, '').trim();
			description = lines.slice(1).join(' ').trim();
		} else if (lines[0].length <= 70) {
			title = lines[0].trim();
			description = lines.slice(1).join(' ').trim();
		} else {
			title = extractTaskTitle(lines[0]);
			description = response.trim();
		}

		description = description.replace(/^.*description:\s*/i, '').trim();
		title = title.replace(/\*\*/g, '').trim();

		return {
			title: title || extractTaskTitle(taskDetails.content),
			description: description || taskDetails.content.substring(0, 200)
		};
	} else {
		const taskDescription = response.trim();
		const title = extractTaskTitle(taskDescription);

		return {
			title,
			description: taskDescription
		};
	}
}

export async function fetchDualAIResponses(
	promptText: string,
	model: AIModel,
	userId: string,
	systemPrompts: string[],
	attachment: File | null = null
): Promise<{ responses: string[]; threadId: string | null }> {
	const validationResult = validationTryCatch(() => {
		if (systemPrompts.length !== 2) {
			throw new Error('Exactly two system prompts must be provided');
		}
		return systemPrompts;
	}, 'system prompts validation');

	if (!validationResult.success) {
		throw new Error(validationResult.error);
	}

	const response = await fetchTryCatch<{ id: string }>('/api/threads', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			title: promptText.substring(0, 50) + (promptText.length > 50 ? '...' : ''),
			userId,
			temporary: true
		})
	});

	if (!response.success) {
		throw new Error(response.error);
	}

	const threadId = response.data.id;

	const responsesResult = await clientTryCatch(
		Promise.all(
			systemPrompts.map(async (systemPrompt) => {
				const messages: AIMessage[] = [
					{
						role: 'system',
						content: systemPrompt,
						provider: model.provider,
						model: model.api_type
					},
					{
						role: 'user',
						content: promptText,
						provider: model.provider,
						model: model.api_type
					}
				];

				return await fetchAIResponse(messages, model, userId, attachment);
			})
		),
		'Failed to fetch dual AI responses'
	);

	if (!responsesResult.success) {
		throw new Error(responsesResult.error);
	}

	return {
		responses: responsesResult.data,
		threadId
	};
}

export async function saveSelectedResponse(
	selectedResponse: string,
	promptText: string,
	threadId: string | null,
	model: AIModel,
	userId: string,
	systemPrompt: string
): Promise<{
	threadId: string;
	userMessageId: string;
	assistantMessageId: string;
}> {
	let currentThreadId: string;
	if (!threadId) {
		const response = await fetchTryCatch<{ id: string }>('/api/threads', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: promptText.substring(0, 50) + (promptText.length > 50 ? '...' : ''),
				userId
			})
		});

		if (!response.success) {
			throw new Error(response.error);
		}

		currentThreadId = response.data.id;
	} else {
		currentThreadId = threadId;

		const updateResult = await fetchTryCatch<unknown>(`/api/threads/${threadId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				temporary: false,
				title: promptText.substring(0, 50) + (promptText.length > 50 ? '...' : '')
			})
		});

		if (!updateResult.success) {
			console.warn('Failed to update thread:', updateResult.error);
		}
	}

	const userMessageResponse = await fetchTryCatch<{ id: string }>('/api/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			text: promptText,
			type: 'human',
			thread: currentThreadId,
			parent_msg: null
		})
	});

	if (!userMessageResponse.success) {
		throw new Error(userMessageResponse.error);
	}

	const userMessage = userMessageResponse.data;

	const assistantMessageResponse = await fetchTryCatch<{ id: string }>('/api/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			text: selectedResponse,
			type: 'robot',
			thread: currentThreadId,
			parent_msg: userMessage.id,
			model: model.api_type,
			system_prompt: systemPrompt
		})
	});

	if (!assistantMessageResponse.success) {
		throw new Error(assistantMessageResponse.error);
	}

	const assistantMessage = assistantMessageResponse.data;

	return {
		threadId: currentThreadId,
		userMessageId: userMessage.id,
		assistantMessageId: assistantMessage.id
	};
}

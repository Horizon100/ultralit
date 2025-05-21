import type { AIModel, PromptType, AIMessage, Scenario, Task, AIAgent, Guidance, Projects } from '$lib/types/types';
import { defaultModel } from '$lib/features/ai/utils/models';
import { getPrompt } from '$lib/features/ai/utils/prompts';
import { get } from 'svelte/store';
import { apiKey } from '$lib/stores/apiKeyStore';
import { prepareMessagesWithCustomPrompts } from '$lib/features/ai/utils/promptUtils';
export async function fetchAIResponse(
    messages: AIMessage[],
    model: AIModel | null,
    userId: string,
    attachment: File | null = null
): Promise<string> {
    try {
		        const messagesWithCustomPrompts = await prepareMessagesWithCustomPrompts(messages, userId);

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
            modelToUse = { ...defaultModel };
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
        
        console.log('Using model:', modelToUse);

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

        const provider = modelToUse.provider || 'openai';
		console.log('Provider:', provider);
		
		const userApiKey = get(apiKey)[provider] || '';

		if (!userApiKey) {
			console.log(`No API key found for provider: ${provider}, checking alternatives...`);
			
			await apiKey.loadKeys();
			const refreshedKeys = get(apiKey);
			
			if (refreshedKeys[provider]) {
				console.log(`Found key for ${provider} after refresh`);
			} else {
				const availableProviders = Object.entries(refreshedKeys)
					.filter(([_, keyValue]) => !!keyValue)
					.map(([providerName]) => providerName);
				
				if (availableProviders.length > 0) {
					const fallbackProvider = availableProviders[0];
					console.log(`Falling back to provider: ${fallbackProvider}`);
					
					modelToUse.provider = fallbackProvider;
					
					if (fallbackProvider === 'openai') {
						modelToUse.api_type = 'gpt-3.5-turbo';
					} else if (fallbackProvider === 'anthropic') {
						modelToUse.api_type = 'claude-3-sonnet-20240229';
					} else if (fallbackProvider === 'deepseek') {
						modelToUse.api_type = 'deepseek-chat';
					}
				} else {
					throw new Error(`No API keys available for any provider`);
				}
			}
		}

		const finalApiKey = get(apiKey)[modelToUse.provider] || '';
		if (!finalApiKey) {
			throw new Error(`No API key found for provider: ${modelToUse.provider}`);
		}

		const response = await fetch('/api/ai', {
			method: 'POST',
			headers: {
				...(attachment ? {} : { 'Content-Type': 'application/json' }),
				Authorization: `Bearer ${finalApiKey}`
			},
			body: requestBody
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('API error:', response.status, errorText);
			throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
		}

		const responseData = await response.json();
		return responseData.response;
	} catch (error) {
		console.error('Error in fetchAIResponse:', error);
		throw error;
	}
}

// export async function fetchNamingResponse(
// 	userMessage: string,
// 	aiResponse: string,
// 	model: AIModel,
// 	userId: string
// ): Promise<string> {
// 	try {
// 		const messages: AIMessage[] = [
// 			{
// 				role: 'assistant',
// 				content:
// 					'Create a concise, descriptive title (max 5 words) for this conversation based on the user message and AI response. Focus on the main topic or question being discussed.',
// 				model: typeof model === 'string' ? model : model.api_type
// 				},
// 			{
// 				role: 'user',
// 				content: `User message: "${userMessage}"\nAI response: "${aiResponse}"\nGenerate title:`,
// 				model: typeof model === 'string' ? model : model.api_type
// 			}
// 		];
// 		const response = await fetchAIResponse(messages, model, userId);

// 		const threadName = response
// 			.trim()
// 			.replace(/^["']|["']$/g, '')
// 			.slice(0, 50);

// 		return threadName;
// 	} catch (error) {
// 		console.error('Error in fetchNamingResponse:', error);
// 		throw error;
// 	}
// }

export async function handleStartPromptClick(
	promptText: string,
	threadId: string | null,
	aiModel: AIModel,
	userId: string
  ): Promise<{
	response: string;
	threadId: string;
	userMessageId: string;
	assistantMessageId: string;
  }> {
	try {
	  let currentThreadId = threadId;
	  if (!currentThreadId) {
		const response = await fetch('/api/threads', {
		  method: 'POST',
		  headers: {
			'Content-Type': 'application/json'
		  },
		  body: JSON.stringify({
			title: promptText.substring(0, 50) + (promptText.length > 50 ? '...' : ''),
			userId
		  })
		});
  
		if (!response.ok) {
		  throw new Error('Failed to create a new thread');
		}
  
		const newThread = await response.json();
		currentThreadId = newThread.id;
	  }
  
	  const userMessageResponse = await fetch('/api/messages', {
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
  
	  if (!userMessageResponse.ok) {
		throw new Error('Failed to save user message');
	  }
  
	  const userMessage = await userMessageResponse.json();
  
	  const messages: AIMessage[] = [
		{
		  role: 'user',
		  content: promptText,
		  model: aiModel.api_type
		}
	  ];
  
	  const aiResponseText = await fetchAIResponse(
		messages,
		aiModel,
		userId
	  );
  
	  const assistantMessageResponse = await fetch('/api/messages', {
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
  
	  if (!assistantMessageResponse.ok) {
		throw new Error('Failed to save assistant message');
	  }
	  
	  const assistantMessage = await assistantMessageResponse.json();
  
	  if (!threadId) {
		await fetch(`/api/threads/${currentThreadId}`, {
		  method: 'PATCH',
		  headers: {
			'Content-Type': 'application/json'
		  },
		  body: JSON.stringify({
			title: promptText.substring(0, 50) + (promptText.length > 50 ? '...' : '')
		  })
		});
	  }
  
	  return {
		response: aiResponseText,
		threadId: currentThreadId,
		userMessageId: userMessage.id,
		assistantMessageId: assistantMessage.id
	  };
	} catch (error) {
	  console.error('Error in handlePromptClick:', error);
	  throw error;
	}
  }
  export async function generateAISuggestions(projectDescription: string, model: AIModel, userId: string): Promise<string[]> {
	try {
	  const messages: AIMessage[] = [
		{
		  role: 'system',
		  content: 'You are an AI assistant helping generate useful prompts based on a project description. Generate exactly 10 relevant prompt suggestions that would help the user explore or develop their project further. Each suggestion should be concise (under 15 words), actionable, and directly usable as a prompt. Do not include any introduction, numbering, or formatting characters like asterisks. Return just a plain list of prompts, one per line.',
		  model: model.api_type
		},
		{
		  role: 'user',
		  content: `Project Description: "${projectDescription}"\n\nGenerate a list of 10 helpful prompts related to this project that I could ask an AI assistant.`,
		  model: model.api_type
		}
	  ];
  
	  const response = await fetchAIResponse(messages, model, userId);
	  
	  const suggestions = response
		.split(/\n+/)
		.map(line => line.trim())
		.filter(line => line.length > 0)
		.map(line => line.replace(/^[-*\d.]+\s*/, ''))
		.map(line => line.replace(/[\*\"`']/g, ''))
		.filter(line => !line.toLowerCase().includes("here are") && 
					   !line.toLowerCase().includes("suggestions") &&
					   !line.toLowerCase().includes("prompts to"))
		.filter(line => line.length > 5 && line.length < 100)
		.slice(0, 10);
	  
	  if (suggestions.length === 0) {
		return [
		  "How to optimize the project architecture?",
		  "Ways to improve user experience in this application",
		  "Suggest performance optimizations for this project",
		  "Best practices for securing this application",
		  "Ideas for new features to add to this project"
		];
	  }
	  
	  return suggestions;
	} catch (error) {
	  console.error('Error generating AI suggestions:', error);
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

	const response = await fetchAIResponse(messages, model, userId);

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
			taskDescription: desc.trim(),
			status: 'todo',
			priority: 'medium',
			due_date: new Date(),
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
			allocatedAgents: '',
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
		model: [model.api_type],
		user: userId,
		child_agents: [],
		position: { x: 0, y: 0 },
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: '',
		collectionName: ''
	};
}

/**
 * Generates a focused, action-oriented task description from message content
 * @param content Original message content to transform into a task
 * @param model AI model to use for generation
 * @param userId User ID for authorization
 * @returns Promise with a focused task description
 */
export async function generateTaskDescription(
	content: string, 
	model: AIModel,
	userId: string
  ): Promise<string> {
	try {
	  const systemPrompt = {
		role: 'system',
		content: `Create a focused, action-oriented task description from the provided content.
  - Write in imperative style (e.g., "Develop API documentation" not "Here's a task to develop API documentation")
  - Be specific about requirements and acceptance criteria
  - Omit any phrases like "here is" or meta-commentary
  - Focus only on actionable items and deliverables
  - Format as direct instructions
  - Be concise but complete
  - Include only text that would be useful in a task tracking system`,
		model: model.api_type
	  };
  
	  const userPrompt = {
		role: 'user',
		content: `Transform this into a focused task description:
  ${content}`,
		model: model.api_type
	  };
  
	  const taskDescription = await fetchAIResponse(
		[systemPrompt, userPrompt],
		model,
		userId
	  );
  
	  return taskDescription.trim();
	} catch (error) {
	  console.error('Error generating task description:', error);
	  return content;
	}
  }
  
  /**
   * Extracts a suitable title from a task description
   * @param taskDescription The full task description
   * @param maxLength Maximum length for the title (default: 50)
   * @returns A title for the task
   */
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
  
/**
 * Generates a complete task object from message content
 * @param taskDetails Object containing message details
 * @returns Promise with the task description and title
 */
export async function generateTaskFromMessage(taskDetails: {
	content: string,
	messageId?: string,
	model: AIModel,
	userId: string,
	threadId?: string,
	isParentTask?: boolean 
  }): Promise<{
	title: string,
	description: string
  }> {
	try {
	  const systemPrompt = {
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
		model: taskDetails.model.api_type
	  };
  
	  const userPrompt = {
		role: 'user',
		content: `Transform this into a ${taskDetails.isParentTask ? 'task title and summary' : 'focused task description'}:
		  ${taskDetails.content}`,
		model: taskDetails.model.api_type
	  };
  
	  const response = await fetchAIResponse(
		[systemPrompt, userPrompt],
		taskDetails.model,
		taskDetails.userId
	  );
  
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
	} catch (error) {
	  console.error('Error in generateTaskFromMessage:', error);
	  
	  const cleanContent = taskDetails.content.replace(/<\/?[^>]+(>|$)/g, '');
	  const fallbackTitle = extractTaskTitle(cleanContent);
	  
	  return {
		title: fallbackTitle,
		description: taskDetails.isParentTask ? cleanContent.substring(0, 200) : cleanContent
	  };
	}
  }

  export async function fetchDualAIResponses(
	promptText: string,
	model: AIModel,
	userId: string,
	systemPrompts: string[],
	attachment: File | null = null
  ): Promise<{ responses: string[], threadId: string | null }> {
	try {
	  if (systemPrompts.length !== 2) {
		throw new Error('Exactly two system prompts must be provided');
	  }
  
	  const response = await fetch('/api/threads', {
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
  
	  if (!response.ok) {
		throw new Error('Failed to create a temporary thread');
	  }
  
	  const newThread = await response.json();
	  const threadId = newThread.id;
  
	  const responses = await Promise.all(
		systemPrompts.map(async (systemPrompt, index) => {
		  const messages: AIMessage[] = [
			{
			  role: 'system',
			  content: systemPrompt,
			  model: model.api_type
			},
			{
			  role: 'user',
			  content: promptText,
			  model: model.api_type
			}
		  ];
  
		  return await fetchAIResponse(messages, model, userId, attachment);
		})
	  );
  
	  return {
		responses,
		threadId
	  };
	} catch (error) {
	  console.error('Error in fetchDualAIResponses:', error);
	  throw error;
	}
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
	try {
	  let currentThreadId = threadId;
	  if (!currentThreadId) {
		const response = await fetch('/api/threads', {
		  method: 'POST',
		  headers: {
			'Content-Type': 'application/json'
		  },
		  body: JSON.stringify({
			title: promptText.substring(0, 50) + (promptText.length > 50 ? '...' : ''),
			userId
		  })
		});
  
		if (!response.ok) {
		  throw new Error('Failed to create a new thread');
		}
  
		const newThread = await response.json();
		currentThreadId = newThread.id;
	  } else if (threadId) {
		await fetch(`/api/threads/${threadId}`, {
		  method: 'PATCH',
		  headers: {
			'Content-Type': 'application/json'
		  },
		  body: JSON.stringify({
			temporary: false,
			title: promptText.substring(0, 50) + (promptText.length > 50 ? '...' : '')
		  })
		});
	  }
  
	  const userMessageResponse = await fetch('/api/messages', {
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
  
	  if (!userMessageResponse.ok) {
		throw new Error('Failed to save user message');
	  }
  
	  const userMessage = await userMessageResponse.json();
  
	  const assistantMessageResponse = await fetch('/api/messages', {
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
  
	  if (!assistantMessageResponse.ok) {
		throw new Error('Failed to save assistant message');
	  }
	  
	  const assistantMessage = await assistantMessageResponse.json();
  
	  return {
		threadId: currentThreadId,
		userMessageId: userMessage.id,
		assistantMessageId: assistantMessage.id
	  };
	} catch (error) {
	  console.error('Error in saveSelectedResponse:', error);
	  throw error;
	}
  }
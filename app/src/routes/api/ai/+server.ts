import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { AIMessage, AIModel } from '$lib/types/types';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const openai = new OpenAI({
	apiKey: import.meta.env.VITE_OPENAI_API_KEY
});

const deepseek = new OpenAI({
	apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
	baseURL: 'https://api.deepseek.com/v1'
});

const anthropicApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
const anthropic = anthropicApiKey 
	? new Anthropic({ apiKey: anthropicApiKey })
	: null;

export const POST: RequestHandler = async ({ request }) => {
	try {
		let messages: AIMessage[];
		let attachment: File | null = null;
		let model: AIModel;
		let userId: string;

		const contentType = request.headers.get('content-type');
		console.log('Content type:', contentType);

		if (contentType?.includes('multipart/form-data')) {
			const formData = await request.formData();
			
			const messagesData = formData.get('messages');
			if (typeof messagesData !== 'string') {
				throw new Error('Invalid messages data');
			}
			messages = JSON.parse(messagesData);
			
			const modelData = formData.get('model');
			if (typeof modelData !== 'string') {
				throw new Error('Invalid model data');
			}
			model = JSON.parse(modelData) as AIModel;
			
			const userIdData = formData.get('userId');
			if (typeof userIdData !== 'string') {
				throw new Error('Invalid userId');
			}
			userId = userIdData;
			
			attachment = formData.get('attachment') as File | null;
			if (attachment) {
				messages.push({
					role: 'user',
					content: `[Attachment: ${attachment.name}]`,
					model: model.api_type
				});
			}
		} else {
			const body = await request.json();
			messages = body.messages;
			model = body.model;
			userId = body.userId;
			
			console.log('Received request:', {
				messageCount: messages?.length || 0,
				modelInfo: model?.provider ? `${model.provider}/${model.api_type}` : 'undefined',
				userId: userId || 'undefined'
			});
		}

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			throw new Error('Missing or invalid messages array');
		}
		if (!model || !model.provider) {
			throw new Error('Missing or invalid model information');
		}

		const systemMessage = messages.find((msg) => msg.role === 'system');
		if (!systemMessage && messages[0]?.prompt_type) {
			messages.unshift({
				role: 'system',
				content: `You are an AI assistant using the ${messages[0].prompt_type} prompt. Format your responses accordingly.`,
				model: model.api_type
			});
		}

		console.log('Processing with provider:', model.provider);
		let response;
		
		if (model.provider === 'openai') {
			console.log('Sending request to OpenAI API');
			const aiMessages = messages.map((msg) => ({
				role: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : 'system',
				content: msg.content
			}));
			
			const completion = await openai.chat.completions.create({
				model: model.api_type || 'gpt-3.5-turbo',
				messages: aiMessages as ChatCompletionMessageParam[],
				temperature: 0.7,
				max_tokens: 1500
			});
			
			if (!completion.choices[0]?.message?.content) {
				throw new Error('Invalid response format from OpenAI');
			}
			response = completion.choices[0].message.content;
		} else if (model.provider === 'deepseek') {
			console.log('Sending request to Deepseek API');
			try {
				const aiMessages = messages.map((msg) => ({
					role: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : 'system',
					content: msg.content
				}));
				
				const completion = await deepseek.chat.completions.create({
					model: model.api_type || 'deepseek-chat',
					messages: aiMessages as ChatCompletionMessageParam[],
					temperature: 0.7,
					max_tokens: 1500
				});
				
				if (!completion.choices[0]?.message?.content) {
					throw new Error('Invalid response format from Deepseek');
				}
				response = completion.choices[0].message.content;
			} catch (deepseekError) {
				console.error('Deepseek API error:', deepseekError);
				throw new Error(`Deepseek API error: ${deepseekError instanceof Error ? deepseekError.message : 'Unknown error'}`);
			}
		} else if (model.provider === 'anthropic') {
			console.log('Sending request to Anthropic API');
			
			// Check if Anthropic client is initialized
			if (!anthropic) {
				throw new Error('Anthropic API key is not configured');
			}
			
			try {
				// Extract system message content if available
				const systemMsg = messages.find(msg => msg.role === 'system');
				const systemContent = systemMsg ? systemMsg.content : '';
				
				// Filter messages to only include user and assistant messages
				const anthropicMessages = messages
					.filter(msg => msg.role === 'user' || msg.role === 'assistant')
					.map(msg => ({
						role: msg.role,
						content: msg.content
					}));
				
				// Create request payload with system message if it exists
				const requestPayload: any = {
					model: model.api_type || 'claude-3-sonnet-20240229',
					messages: anthropicMessages,
					max_tokens: 1500,
					temperature: 0.7
				};
				
				// Only add system parameter if there's system content
				if (systemContent) {
					requestPayload.system = systemContent;
				}
				
				const completion = await anthropic.messages.create(requestPayload);
				
				if (!completion.content || completion.content.length === 0 || !completion.content[0].text) {
					throw new Error('Invalid response format from Anthropic');
				}
				response = completion.content[0].text;
			} catch (anthropicError) {
				console.error('Anthropic API error:', anthropicError);
				throw new Error(`Anthropic API error: ${anthropicError instanceof Error ? anthropicError.message : 'Unknown error'}`);
			}
		} else {
			throw new Error(`Unsupported AI provider: ${model.provider}`);
		}

		console.log('API response successfully generated');
		return json({ response });
	} catch (error) {
		console.error('Error in AI API:', error instanceof Error ? error.message : 'Unknown error');
		console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
		
		return json(
			{ message: 'Internal Error', details: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
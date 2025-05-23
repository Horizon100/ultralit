// src/routes/api/ai/+server.ts - UPDATED WITH GROK SUPPORT
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { AIMessage, AIModel } from '$lib/types/types';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import * as pbServer from '$lib/server/pocketbase';
import { CryptoService } from '$lib/utils/crypto';

// Helper function to fetch and decrypt user API keys (using your existing crypto system)
async function getUserKeys(userId: string) {
    try {
        const userData = await pbServer.pb.collection('users').getOne(userId);
        if (!userData.api_keys) {
            return {}; // Return empty object if no keys found
        }

        const decryptedKeys = await CryptoService.decrypt(userData.api_keys, userId);
        return JSON.parse(decryptedKeys);
    } catch (error) {
        console.error('Error fetching API keys:', error);
        throw new Error('Error fetching API keys');
    }
}

// Helper function to restore authentication from cookies
function restoreAuth(cookies: any) {
    const authCookie = cookies.get('pb_auth');
    if (authCookie) {
        try {
            const authData = JSON.parse(authCookie);
            pbServer.pb.authStore.save(authData.token, authData.model);
            return true;
        } catch (e) {
            console.error('Error parsing auth cookie:', e);
            return false;
        }
    }
    return false;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
    try {
        // Restore auth from cookies
        restoreAuth(cookies);

        // Check if user is authenticated
        if (!pbServer.pb.authStore.isValid) {
            throw error(401, 'User not authenticated');
        }

        const user = pbServer.pb.authStore.model;

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
                throw error(400, 'Invalid messages data');
            }
            messages = JSON.parse(messagesData);
            
            const modelData = formData.get('model');
            if (typeof modelData !== 'string') {
                throw error(400, 'Invalid model data');
            }
            model = JSON.parse(modelData) as AIModel;
            
            const userIdData = formData.get('userId');
            if (typeof userIdData !== 'string') {
                throw error(400, 'Invalid userId');
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

        // Verify the user making the request matches the userId
        if (userId !== user.id) {
            throw error(403, 'Unauthorized: User ID mismatch');
        }

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw error(400, 'Missing or invalid messages array');
        }
        if (!model || !model.provider) {
            throw error(400, 'Missing or invalid model information');
        }

        // Get user's API keys using your existing encryption system
        const userKeys = await getUserKeys(user.id);
        const apiKey = userKeys[model.provider];
        
        if (!apiKey) {
            throw error(400, `${model.provider} API key not configured. Please add your API key in settings.`);
        }

        const systemMessage = messages.find((msg) => msg.role === 'system');

        if (!systemMessage && messages.length > 0) {
            const promptType = messages[0]?.prompt_type;
            const promptInput = messages[0]?.prompt_input;
            
            if (promptType || promptInput) {
                const systemParts = [];
                
                if (promptType) {
                    systemParts.push(`You are an AI assistant using the ${promptType} prompt style. Format your responses accordingly.`);
                }
                
                if (promptInput) {
                    systemParts.push(promptInput);
                }
                
                const systemContent = systemParts.join('\n\n');
                
                messages.unshift({
                    role: 'system',
                    content: systemContent,
                    model: model.api_type
                });
            }
        }

        console.log('Processing with provider:', model.provider);
        let response;
        
        if (model.provider === 'openai') {
            console.log('Sending request to OpenAI API');
            
            // Create OpenAI client with user's API key
            const openai = new OpenAI({ apiKey });
            
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
                throw error(500, 'Invalid response format from OpenAI');
            }
            response = completion.choices[0].message.content;
        } else if (model.provider === 'deepseek') {
            console.log('Sending request to Deepseek API');
            
            // Create Deepseek client with user's API key
            const deepseek = new OpenAI({
                apiKey,
                baseURL: 'https://api.deepseek.com/v1'
            });
            
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
                    throw error(500, 'Invalid response format from Deepseek');
                }
                response = completion.choices[0].message.content;
            } catch (deepseekError) {
                console.error('Deepseek API error:', deepseekError);
                throw error(500, `Deepseek API error: ${deepseekError instanceof Error ? deepseekError.message : 'Unknown error'}`);
            }
        } else if (model.provider === 'grok') {
            console.log('Sending request to Grok/X.AI API');
            
            // Create Grok client with user's API key (uses OpenAI SDK since Grok is OpenAI-compatible)
            const grok = new OpenAI({
                apiKey,
                baseURL: 'https://api.x.ai/v1'
            });
            
            try {
                const aiMessages = messages.map((msg) => ({
                    role: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : 'system',
                    content: msg.content
                }));
                
                const completion = await grok.chat.completions.create({
                    model: model.api_type || 'grok-1',
                    messages: aiMessages as ChatCompletionMessageParam[],
                    temperature: 0.7,
                    max_tokens: 1500
                });
                
                if (!completion.choices[0]?.message?.content) {
                    throw error(500, 'Invalid response format from Grok');
                }
                response = completion.choices[0].message.content;
            } catch (grokError) {
                console.error('Grok API error:', grokError);
                throw error(500, `Grok API error: ${grokError instanceof Error ? grokError.message : 'Unknown error'}`);
            }
        } else if (model.provider === 'anthropic') {
            console.log('Sending request to Anthropic API');
            
            // Create Anthropic client with user's API key
            const anthropic = new Anthropic({ apiKey });
            
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
                    throw error(500, 'Invalid response format from Anthropic');
                }
                response = completion.content[0].text;
            } catch (anthropicError) {
                console.error('Anthropic API error:', anthropicError);
                throw error(500, `Anthropic API error: ${anthropicError instanceof Error ? anthropicError.message : 'Unknown error'}`);
            }
        } else {
            throw error(400, `Unsupported AI provider: ${model.provider}`);
        }

        console.log('API response successfully generated');
        return json({ response, success: true });
    } catch (err) {
        if (err.status) {
            // This is already a SvelteKit error, rethrow it
            throw err;
        }
        
        console.error('Error in AI API:', err instanceof Error ? err.message : 'Unknown error');
        console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace available');
        
        throw error(500, {
            message: 'Internal Error',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
};
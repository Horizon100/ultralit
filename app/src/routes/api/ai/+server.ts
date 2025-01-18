// routes/api/ai/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import type { AIMessage, AIModel } from '$lib/types/types';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export const POST: RequestHandler = async ({ request }) => {
    try {
        let messages: AIMessage[];
        let attachment: File | null = null;
        let model: AIModel;

        const contentType = request.headers.get('content-type');

        if (contentType?.includes('multipart/form-data')) {
            const formData = await request.formData();
            messages = JSON.parse(formData.get('messages') as string);
            const modelData = formData.get('model');
            model = modelData ? JSON.parse(String(modelData)) as AIModel : {
                id: 'default',
                name: 'Default Model',
                api_key: '',
                base_url: 'https://api.openai.com/v1',
                api_type: 'gpt-3.5-turbo',
                api_version: 'v1',
                description: 'Default OpenAI Model',
                user: [],
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                provider: 'openai',
                collectionId: '',
                collectionName: ''
            };
            attachment = formData.get('attachment') as File | null;

            if (attachment) {
                messages.push({
                    role: 'user',
                    content: `[Attachment: ${attachment.name}]`,
                    model: model.id
                });
            }
        } else {
            const body = await request.json();
            messages = body.messages;
            model = body.model;
        }

        // Add system message for prompt context
        const systemMessage = messages.find(msg => msg.role === 'system');
        if (!systemMessage && messages[0]?.prompt_type) {
            messages.unshift({
                role: 'system',
                content: `You are an AI assistant using the ${messages[0].prompt_type} prompt. Format your responses accordingly.`,
                model: model.id
            });
        }

        // Convert messages to OpenAI's expected format
        const openAiMessages: ChatCompletionMessageParam[] = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 
                  msg.role === 'assistant' ? 'assistant' : 
                  'system',
            content: msg.content
        }));

        const completion = await openai.chat.completions.create({
            model: model.api_type || "gpt-3.5-turbo",
            messages: openAiMessages,
            temperature: 0.7,
            max_tokens: 1500
        });

        return json({ response: completion.choices[0].message.content });
    } catch (error) {
        console.error('Error in AI API:', error);
        return json(
            { error: error instanceof Error ? error.message : 'An unknown error occurred' }, 
            { status: 500 }
        );
    }
};
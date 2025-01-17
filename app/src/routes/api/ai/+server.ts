// routes/api/ai/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import type { AIMessage } from '$lib/types/types';

const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export const POST: RequestHandler = async ({ request }) => {
    try {
        let messages: AIMessage[];
        let attachment;
        let model;

        const contentType = request.headers.get('content-type');

        if (contentType?.includes('multipart/form-data')) {
            const formData = await request.formData();
            messages = JSON.parse(formData.get('messages') as string);
            model = formData.get('model');
            attachment = formData.get('attachment') as File | null;

            if (attachment) {
                messages.push({
                    role: 'user',
                    content: `[Attachment: ${attachment.name}]`,
                    model: model
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
                model: model
            });
        }

        const completion = await openai.chat.completions.create({
            model: model?.api_type || "gpt-3.5-turbo",
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
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
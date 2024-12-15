import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai/index.mjs';

const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export const POST: RequestHandler = async ({ request }) => {
    try {
        let messages;
        let attachment;

        const contentType = request.headers.get('content-type');

        if (contentType && contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            messages = JSON.parse(formData.get('messages') as string);
            attachment = formData.get('attachment') as File | null;

            // If there's an attachment, add it to the messages
            if (attachment) {
                messages.push({
                    role: 'user',
                    content: `[Attachment: ${attachment.name}]`,
                });
            }
        } else {
            const body = await request.json();
            messages = body.messages;
        }

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages,
        });

        return json({ response: response.choices[0].message.content });
    } catch (error) {
        console.error('Error in AI API:', error);
        return json({ error: (error as Error).message || 'An unknown error occurred' }, { status: 500 });
    }
};
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai/index.mjs';
import { pb } from '$lib/pocketbase';

const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        let messages;
        let attachment;
        let selectedModel: string = "gpt-3.5-turbo"; // Default model
        let selectedPromptType: string | undefined;

        // Fetch messages from the request
        const body = await request.json();
        messages = body.messages;

        // Check if user is authenticated and get selected model/prompt type
        if (locals.user) {
            try {
                // Fetch the full user record to get selected model and prompt type
                const fullUser = await pb.collection('users').getOne(locals.user.id, {
                    fields: 'selected_model,prompt_type'
                });

                // Update model and prompt type if available
                selectedModel = fullUser.selected_model || selectedModel;
                selectedPromptType = fullUser.prompt_type;
            } catch (userFetchError) {
                console.error('Error fetching user:', userFetchError);
            }
        }

        // If a prompt type is selected, prepend it to the system message
        if (selectedPromptType) {
            // Check if there's an existing system message, if not, create one
            const systemMessageIndex = messages.findIndex((msg) => msg.role === 'system');
            
            const promptTypePrefix = `You are operating in ${selectedPromptType} mode. `;
            
            if (systemMessageIndex !== -1) {
                // Modify existing system message
                messages[systemMessageIndex].content = promptTypePrefix + messages[systemMessageIndex].content;
            } else {
                // Add a new system message
                messages.unshift({
                    role: 'system',
                    content: promptTypePrefix
                });
            }
        }

        const response = await openai.chat.completions.create({
            model: selectedModel,
            messages,
        });

        return json({ 
            response: response.choices[0].message.content,
            model: selectedModel,
            promptType: selectedPromptType
        });
    } catch (error) {
        console.error('Error in AI API:', error);
        return json({ error: error instanceof Error ? error.message : 'An unknown error occurred' }, { status: 500 });
    }
};
// src/lib/utils/promptUtils.ts
import type { AIMessage, PromptInput } from '$lib/types/types';
import { currentUser } from '$lib/pocketbase';
import { get } from 'svelte/store';

export async function fetchUserPrompts(userId: string): Promise<PromptInput[]> {
    try {
        const response = await fetch(`/api/prompts?userId=${userId}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Error fetching user prompts:', error);
        return [];
    }
}

export async function fetchSystemPrompt(promptId: string): Promise<string | null> {
    try {
        const response = await fetch(`/api/prompts/${promptId}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.data?.prompt || null;
    } catch (error) {
        console.error('Error fetching system prompt:', error);
        return null;
    }
}

export async function prepareMessagesWithCustomPrompts(
    originalMessages: AIMessage[],
    userId: string
): Promise<AIMessage[]> {
    const user = get(currentUser);
    if (!user) return originalMessages;

    const messages = [...originalMessages];
    let systemMessageIndex = messages.findIndex(msg => msg.role === 'system');
    
    let allPrompts: string[] = [];
    
    // Handle system prompt (built-in or custom)
    if (user.sysprompt_preference) {
        if (['NORMAL', 'CONCISE', 'CRITICAL', 'INTERVIEW'].includes(user.sysprompt_preference)) {
            const SYSTEM_PROMPTS = {
                NORMAL: "Respond naturally and conversationally with balanced detail.",
                CONCISE: "Provide brief responses focused on key information only.",
                CRITICAL: "Analyze critically, identify flaws, and suggest improvements.",
                INTERVIEW: "Ask probing questions to gather more information."
            };
            
            const systemPrompt = SYSTEM_PROMPTS[user.sysprompt_preference as keyof typeof SYSTEM_PROMPTS];
            if (systemPrompt) allPrompts.push(systemPrompt);
        } else {
            const systemPrompt = await fetchSystemPrompt(user.sysprompt_preference);
            if (systemPrompt) allPrompts.push(systemPrompt);
        }
    }
    
if (user.prompt_preference) {
    let promptIds: string[] = [];
    
    if (Array.isArray(user.prompt_preference)) {
        promptIds = user.prompt_preference;
    } else if (typeof user.prompt_preference === 'string') {
        promptIds = [user.prompt_preference];
    }
    
    for (const promptId of promptIds) {
        try {
            const response = await fetch(`/api/prompts/${promptId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.data?.prompt) allPrompts.push(data.data.prompt);
            }
        } catch (error) {
            console.error('Error fetching user prompt:', error);
        }
    }
}
    
    if (allPrompts.length === 0) return messages;
    
    const combinedPromptContent = allPrompts.join('\n\n');
    
    if (systemMessageIndex >= 0) {
        messages[systemMessageIndex] = {
            ...messages[systemMessageIndex],
            content: `${combinedPromptContent}\n\n${messages[systemMessageIndex].content}`
        };
    } else {
        messages.unshift({
            role: 'system',
            content: combinedPromptContent,
            model: messages[0]?.model || 'default'
        });
    }
    
    return messages;
}
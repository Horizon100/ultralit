import { writable } from 'svelte/store';
import { get } from 'svelte/store';
import type { PromptType, AIMessage } from '$lib/types/types';
import { fetchUserPrompts } from '$lib/clients/promptInputClient';
import { currentUser } from '$lib/pocketbase';
import { fetchSystemPrompt } from '$lib/utils/promptUtils';

let manualUpdate = false;

export const promptStore = writable<{
  selectedPromptId: string | null;
  promptContent: string | null;
  promptType: PromptType | null;
}>({
  selectedPromptId: null,
  promptContent: null,
  promptType: null 
});

export const syspromptStore = writable<{
  selectedPromptId: string | null;
  promptContent: string | null;
  promptType: PromptType | null;
}>({
  selectedPromptId: null,
  promptContent: null,
  promptType: null
});

export function setSystemPrompt(promptType: PromptType) {
  manualUpdate = true;
  setTimeout(() => { manualUpdate = false; }, 1000); 
  
  syspromptStore.update(state => ({
    ...state,
    promptType,
    selectedPromptId: null
  }));
}

export async function initPromptStores(userData: any) {
  if (!userData || manualUpdate) return;
  
  if (userData.sysprompt_preference) {
    if (['NORMAL', 'CONCISE', 'CRITICAL', 'INTERVIEW'].includes(userData.sysprompt_preference)) {
      syspromptStore.update(state => ({
        ...state,
        promptType: userData.sysprompt_preference as PromptType,
        selectedPromptId: null
      }));
    }
  }
}

export async function prepareMessagesWithCustomPrompts(
    originalMessages: AIMessage[],
    userId: string
): Promise<AIMessage[]> {
    const user = get(currentUser);
    if (!user) return originalMessages;

    const messages = [...originalMessages];
    const systemMessageIndex = messages.findIndex(msg => msg.role === 'system');
    
    const allPrompts: string[] = [];
    
    // Get system prompt
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
    
    // Get user prompts - fetch each individually
    if (user.prompt_preference && Array.isArray(user.prompt_preference)) {
        for (const promptId of user.prompt_preference) {
            try {
                const response = await fetch(`/api/prompts/${promptId}`);
                if (response.ok) {
                    const promptData = await response.json();
                    if (promptData.data?.prompt) {
                        allPrompts.push(promptData.data.prompt);
                    }
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
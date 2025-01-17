import type { Scenario, Task, RoleType, PromptType, NetworkData, AIAgent } from '$lib/types/types';
import { t } from '$lib/stores/translationStore';
import { get } from 'svelte/store';
import { getPromptText } from '$lib/chat/promptHandlers';

type MessageContent = string | Scenario[] | Task[] | AIAgent | NetworkData;


export function formatDate(date: string): string {
    // Get the current value of the t store
    const translate = get(t);
    
    if (date === translate('threads.today') || date === translate('threads.yesterday')) {
        return date;
    }
    
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}


 export function formatContent(content: MessageContent, type: PromptType, role: RoleType): string {
    const baseContent = typeof content === 'string' ? content : JSON.stringify(content);
    const promptText = type ? getPromptText(type) : '';
    
    return role === 'assistant' && promptText 
      ? `[Instructions: ${promptText}]\n${baseContent}`
      : baseContent;
  }


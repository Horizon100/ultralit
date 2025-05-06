import { writable } from 'svelte/store';
import type { PromptType, PromptInput } from '$lib/types/types';

// Store for regular prompts (user-created custom prompts)
export const promptStore = writable<{
  selectedPromptId: string | null;  // ID reference to PocketBase prompts collection
  promptContent: string | null;     // The actual prompt text content
  promptType: PromptType | null;    // For reference to built-in types if needed
}>({
  selectedPromptId: null,
  promptContent: null,
  promptType: null 
});

// Store for system prompts
export const syspromptStore = writable<{
  selectedPromptId: string | null;  // ID reference to PocketBase prompts collection
  promptContent: string | null;     // The actual system prompt text content
  promptType: PromptType | null;    // Type from the PromptType enum
}>({
  selectedPromptId: null,
  promptContent: null, 
  promptType: null    // No default, we'll load from user preferences
});

// Function to initialize stores from user data
export async function initPromptStores(userData) {
  if (userData) {
    // Initialize system prompt
    if (userData.sysprompt_preference) {
      // Check if it's a built-in type
      if (['NORMAL', 'CONCISE', 'CRITICAL', 'INTERVIEW'].includes(userData.sysprompt_preference)) {
        syspromptStore.update(state => ({
          ...state,
          promptType: userData.sysprompt_preference as PromptType,
          selectedPromptId: null
        }));
      } else {
        // It's a custom prompt ID - fetch from API
        try {
          const response = await fetch(`/api/prompts/${userData.sysprompt_preference}`);
          if (response.ok) {
            const promptData = await response.json();
            syspromptStore.update(state => ({
              ...state,
              selectedPromptId: userData.sysprompt_preference,
              promptContent: promptData.prompt,
              promptType: promptData.type || null
            }));
          }
        } catch (error) {
          console.error('Failed to load system prompt:', error);
        }
      }
    }
    
    // Initialize user prompt
    if (userData.prompt_preference) {
      try {
        const response = await fetch(`/api/prompts/${userData.prompt_preference}`);
        if (response.ok) {
          const promptData = await response.json();
          promptStore.update(state => ({
            ...state,
            selectedPromptId: userData.prompt_preference,
            promptContent: promptData.prompt,
            promptType: promptData.type || null
          }));
        }
      } catch (error) {
        console.error('Failed to load user prompt:', error);
      }
    }
  }
}
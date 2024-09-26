import type { PromptType } from '$lib/types';
import { BookOpen, List, User, Network, Edit3, FileText, Share2, Coffee } from 'lucide-svelte';


export const getPrompt = (type: PromptType, context: string): string => {
  switch (type) {
    case 'SCENARIO_GENERATION':
      return `Generate scenarios based on the following context: ${context}`;
    case 'TASK_GENERATION':
      return `Generate tasks for the following scenario: ${context}`;
    case 'AGENT_CREATION':
      return `Create an AI agent profile based on the following scenario and tasks: ${context}`;
    case 'NETWORK_STRUCTURE':
      return `Determine the optimal network structure (hierarchical or flat) for the following scenario and tasks: ${context}`;
    case 'REFINE_SUGGESTION':
      return `Refine the following suggestion based on the provided feedback: ${context}`;
    case 'SUMMARY_GENERATION':
      return `Generate a concise summary of the following conversation: ${context}`;
    case 'NETWORK_GENERATION':
      return `Generate a network structure based on the following summary: ${context}`;
    case 'CASUAL_CHAT':
      return `You are a friendly AI assistant engaging in casual conversation. Respond in a natural, conversational manner to the following: ${context}`;
    default:
      return '';
  }
};


// Add these to your existing prompts.ts file

export const GUIDANCE_GENERATION = `
You are an AI assistant helping to guide users in creating AI agents for specific scenarios and tasks. 
Based on the provided context, generate appropriate guidance, questions, or suggestions to help the user refine their ideas.
For scenario guidance, provide 2-3 thought-provoking questions or considerations.
For task refinement, offer 2-3 specific suggestions on how to enhance or customize the task.
`;

export const TASK_GENERATION = `
You are an AI assistant generating task options for an AI agent.
Based on the provided scenario and the user's response to guidance, suggest 3 specific, actionable tasks.
Each task should be clear, concise, and directly related to the scenario and user's input.
`;



export const availablePrompts: Array<{value: PromptType; label: string; icon: any}> = [
  { value: 'SCENARIO_GENERATION', label: 'Generate Scenarios', icon: BookOpen },
  { value: 'TASK_GENERATION', label: 'Generate Tasks', icon: List },
  { value: 'AGENT_CREATION', label: 'Create AI Agent', icon: User },
  { value: 'NETWORK_STRUCTURE', label: 'Determine Network Structure', icon: Network },
  { value: 'REFINE_SUGGESTION', label: 'Refine Suggestion', icon: Edit3 },
  { value: 'SUMMARY_GENERATION', label: 'Generate Summary', icon: FileText },
  { value: 'NETWORK_GENERATION', label: 'Generate Network', icon: Share2 },
  { value: 'CASUAL_CHAT', label: 'Casual Chat', icon: Coffee },
];


import type { AIModel, Scenario, Task, Attachment, Guidance, PromptType } from '$lib/types/types';
import { writable } from 'svelte/store';

export function getPromptText(promptType: PromptType): string {
    switch (promptType) {
      case 'FLOW':
        return 'Generate scenarios based on the following context';
      case 'PLANNER':
        return 'Generate tasks for the following scenario';
      case 'CODER':
        return 'Create an AI agent profile based on the following scenario and tasks';
      case 'RESEARCH':
        return 'Determine the optimal network structure for the following scenario and tasks';
      case 'DESIGNER':
        return 'Refine the following suggestion based on the provided feedback';
      case 'WRITER':
        return 'Generate a concise summary of the following conversation';
      case 'ANALYZER':
        return 'Generate a network structure based on the following summary';
      case 'TUTOR':
        return 'Engage in casual conversation responding to';
      default:
        return '';
    }
  }
  export const seedPrompt: string = '';
  export const additionalPrompt: string = '';
  export const promptType: PromptType = 'TUTOR';

  export let currentPromptType: PromptType;
  export const hasSentSeedPrompt: boolean = false;
  export const scenarios: Scenario[] = [];
  export const tasks: Task[] = [];
  export const attachments: Attachment[] = [];
  export const currentStage: 'initial' | 'scenarios' | 'guidance' | 'tasks' | 'refinement' | 'final' | 'summary' = 'initial';
  export const guidance: Guidance | null = null;
  export let aiModel: AIModel;
export const showPromptCatalog = writable(true);

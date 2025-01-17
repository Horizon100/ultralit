import type { PromptType } from '$lib/types/types';
import { BookOpen, List, User, Network, Edit3, FileText, Share2, Coffee, Lightbulb, ChartScatter, NotebookText, CodeXml, CalendarRange, SearchSlash, BrickWall } from 'lucide-svelte';


export const getPrompt = (type: PromptType, context: string): string => {
  switch (type) {
    case 'FLOW':
      return `Generate scenarios based on the following context: ${context}`;
    case 'PLANNER':
      return `Generate tasks for the following scenario: ${context}`;
    case 'CODER':
      return `Create an AI agent profile based on the following scenario and tasks: ${context}`;
    case 'RESEARCH':
      return `Determine the optimal network structure (hierarchical or flat) for the following scenario and tasks: ${context}`;
    case 'DESIGNER':
      return `Refine the following suggestion based on the provided feedback: ${context}`;
    case 'WRITER':
      return `Generate a concise summary of the following conversation: ${context}`;
    case 'ANALYZER':
      return `Generate a network structure based on the following summary: ${context}`;
    case 'BRAINSTORM':
      return `Generate a network structure based on the following summary: ${context}`;
    case 'TUTOR':
      return `You are a friendly AI assistant engaging in casual conversation. Respond in a natural, conversational manner to the following: ${context}`;
    default:
      return '';
  }
};


// Add these to your existing prompts.ts file

// export const GUIDANCE_GENERATION = `
// You are an AI assistant helping to guide users in creating AI agents for specific scenarios and tasks. 
// Based on the provided context, generate appropriate guidance, questions, or suggestions to help the user refine their ideas.
// For scenario guidance, provide 2-3 thought-provoking questions or considerations.
// For task refinement, offer 2-3 specific suggestions on how to enhance or customize the task.
// `;

// export const PLANNER = `
// You are an AI assistant generating task options for an AI agent.
// Based on the provided scenario and the user's response to guidance, suggest 3 specific, actionable tasks.
// Each task should be clear, concise, and directly related to the scenario and user's input.
// `;



export const availablePrompts: Array<{
  value: PromptType;
  label: string;
  icon: any;
  description: string;
  youtubeUrl: string;
}> = [
  { 
    value: 'FLOW', 
    label: 'Flow', 
    icon: Share2,
    description: 'Create detailed scenarios and use cases for your project. The AI will help you explore different possibilities and edge cases, generating comprehensive scenarios that cover various aspects of your requirements.',
    youtubeUrl: 'https://www.youtube.com/embed/J---aiyznGQ'
  },
  { 
    value: 'PLANNER', 
    label: 'Planner', 
    icon: CalendarRange,
    description: 'Break down your projects into actionable tasks. The AI will help you create a structured task list with priorities, dependencies, and estimated effort levels to streamline your workflow.',
    youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },
  { 
    value: 'CODER', 
    label: 'Coder', 
    icon: CodeXml,
    description: 'Design and configure specialized AI agents for specific tasks. Define their behavior, capabilities, and interaction patterns to create autonomous agents that can handle specific aspects of your workflow.',
    youtubeUrl: 'https://www.youtube.com/embed/hY7m5jjJ9mM'
  },
  { 
    value: 'RESEARCH', 
    label: 'Researcher', 
    icon: SearchSlash,
    description: 'Analyze and optimize the relationships between different components in your system. Visualize connections, identify bottlenecks, and design efficient network architectures.',
    youtubeUrl: 'https://www.youtube.com/embed/9bZkp7q19f0'
  },
  { 
    value: 'DESIGNER', 
    label: 'Designer', 
    icon: BrickWall,
    description: 'Improve and iterate on existing ideas or solutions. The AI will help you polish and enhance your current proposals, offering alternatives and optimizations.',
    youtubeUrl: 'https://www.youtube.com/embed/QH2-TGUlwu4'
  },
  { 
    value: 'WRITER', 
    label: 'Writer', 
    icon: NotebookText,
    description: 'Create concise summaries of complex information. Transform lengthy content into clear, digestible summaries while maintaining key points and insights.',
    youtubeUrl: 'https://www.youtube.com/embed/y6120QOlsfU'
  },
  { 
    value: 'ANALYZER', 
    label: 'Analyzer', 
    icon: ChartScatter,
    description: 'Create interconnected systems and relationships between different elements. Visualize and generate optimal network configurations based on your requirements.',
    youtubeUrl: 'https://www.youtube.com/embed/L_LUpnjgPso'
  },
  { 
    value: 'BRAINSTORM', 
    label: 'Brainstorm', 
    icon: Lightbulb,
    description: 'Create interconnected systems and relationships between different elements. Visualize and generate optimal network configurations based on your requirements.',
    youtubeUrl: 'https://www.youtube.com/embed/L_LUpnjgPso'
  },
  { 
    value: 'TUTOR', 
    label: 'Tutor', 
    icon: BookOpen,
    description: 'Engage in natural, conversational interactions with the AI. Perfect for brainstorming, general discussions, and exploring ideas in a relaxed setting.',
    youtubeUrl: 'https://www.youtube.com/embed/ZyhrYis509A'
  },
];

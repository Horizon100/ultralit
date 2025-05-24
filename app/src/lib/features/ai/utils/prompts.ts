import type { PromptType } from '$lib/types/types';
import { MessageSquareText, Minimize, AlertCircle, HelpCircle } from 'lucide-svelte';

export const SYSTEM_PROMPTS = {
	NORMAL: 'Respond naturally and conversationally with balanced detail.',
	CONCISE: 'Provide brief responses focused on key information only.',
	CRITICAL: 'Analyze critically, identify flaws, and suggest improvements.',
	INTERVIEW: 'Ask probing questions to gather more information.'
};

export const getPrompt = (type: PromptType, context: string): string => {
	switch (type) {
		case 'NORMAL':
			return `${SYSTEM_PROMPTS.NORMAL}\n${context}`;
		case 'CONCISE':
			return `${SYSTEM_PROMPTS.CONCISE}\n${context}`;
		case 'CRITICAL':
			return `${SYSTEM_PROMPTS.CRITICAL}\n${context}`;
		case 'INTERVIEW':
			return `${SYSTEM_PROMPTS.INTERVIEW}\n${context}`;
		default:
			return context;
	}
};

// Add these to your existing prompts.ts file

/*
 * export const GUIDANCE_GENERATION = `
 * You are an AI assistant helping to guide users in creating AI agents for specific scenarios and tasks.
 * Based on the provided context, generate appropriate guidance, questions, or suggestions to help the user refine their ideas.
 * For scenario guidance, provide 2-3 thought-provoking questions or considerations.
 * For task refinement, offer 2-3 specific suggestions on how to enhance or customize the task.
 * `;
 */

/*
 * export const PLANNER = `
 * You are an AI assistant generating task options for an AI agent.
 * Based on the provided scenario and the user's response to guidance, suggest 3 specific, actionable tasks.
 * Each task should be clear, concise, and directly related to the scenario and user's input.
 * `;
 */

export const availablePrompts: Array<{
	value: PromptType;
	label: string;
	icon: any;
	description: string;
}> = [
	{
		value: 'NORMAL',
		label: 'Normal',
		icon: MessageSquareText,
		description: 'Balanced responses with appropriate detail for most conversations.'
	},
	{
		value: 'CONCISE',
		label: 'Concise',
		icon: Minimize,
		description: 'Brief, to-the-point responses that focus only on essential information.'
	},
	{
		value: 'CRITICAL',
		label: 'Critical',
		icon: AlertCircle,
		description:
			'Analytical responses that evaluate information critically and suggest improvements.'
	},
	{
		value: 'INTERVIEW',
		label: 'Interview',
		icon: HelpCircle,
		description: 'Response style that asks follow-up questions to gather more information.'
	}
];

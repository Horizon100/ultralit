// src/lib/data/perks.ts
import type { Perk } from '$lib/types/types';

export const INCREMENTS = [10, 50, 100, 500, 1000, 5000, 10000];

export const PERKS: Omit<Perk, 'id' | 'created' | 'updated' | 'achievedBy'>[] = [
	// Message perks
	{
		perkName: 'Chatterbox',
		perkDescription: 'Created 10 messages',
		perkIcon: '💬',
		filterConditions: [{ parameter: 'messages', operator: '>=', value: 10 }]
	},
	{
		perkName: 'Communicator',
		perkDescription: 'Created 50 messages',
		perkIcon: '📨',
		filterConditions: [{ parameter: 'messages', operator: '>=', value: 50 }]
	},
	{
		perkName: 'Messenger',
		perkDescription: 'Created 100 messages',
		perkIcon: '📩',
		filterConditions: [{ parameter: 'messages', operator: '>=', value: 100 }]
	},
	{
		perkName: 'Conversationalist',
		perkDescription: 'Created 500 messages',
		perkIcon: '🗣️',
		filterConditions: [{ parameter: 'messages', operator: '>=', value: 500 }]
	},
	{
		perkName: 'Wordsmith',
		perkDescription: 'Created 1,000 messages',
		perkIcon: '📝',
		filterConditions: [{ parameter: 'messages', operator: '>=', value: 1000 }]
	},
	{
		perkName: 'Prolific Writer',
		perkDescription: 'Created 5,000 messages',
		perkIcon: '✍️',
		filterConditions: [{ parameter: 'messages', operator: '>=', value: 5000 }]
	},
	{
		perkName: 'Message Master',
		perkDescription: 'Created 10,000 messages',
		perkIcon: '🏆',
		filterConditions: [{ parameter: 'messages', operator: '>=', value: 10000 }]
	},

	// Thread perks
	{
		perkName: 'Thread Starter',
		perkDescription: 'Created 10 threads',
		perkIcon: '🧵',
		filterConditions: [{ parameter: 'threads', operator: '>=', value: 10 }]
	},
	{
		perkName: 'Topic Creator',
		perkDescription: 'Created 50 threads',
		perkIcon: '🔄',
		filterConditions: [{ parameter: 'threads', operator: '>=', value: 50 }]
	},
	{
		perkName: 'Discussion Leader',
		perkDescription: 'Created 100 threads',
		perkIcon: '👥',
		filterConditions: [{ parameter: 'threads', operator: '>=', value: 100 }]
	},
	{
		perkName: 'Conversation Hub',
		perkDescription: 'Created 500 threads',
		perkIcon: '🌐',
		filterConditions: [{ parameter: 'threads', operator: '>=', value: 500 }]
	},
	{
		perkName: 'Thread Weaver',
		perkDescription: 'Created 1,000 threads',
		perkIcon: '🕸️',
		filterConditions: [{ parameter: 'threads', operator: '>=', value: 1000 }]
	},
	{
		perkName: 'Thread Virtuoso',
		perkDescription: 'Created 5,000 threads',
		perkIcon: '🎭',
		filterConditions: [{ parameter: 'threads', operator: '>=', value: 5000 }]
	},
	{
		perkName: 'Thread Legend',
		perkDescription: 'Created 10,000 threads',
		perkIcon: '👑',
		filterConditions: [{ parameter: 'threads', operator: '>=', value: 10000 }]
	},

	// Task perks
	{
		perkName: 'Task Taker',
		perkDescription: 'Created 10 tasks',
		perkIcon: '📋',
		filterConditions: [{ parameter: 'tasks', operator: '>=', value: 10 }]
	},
	{
		perkName: 'To-Do Pro',
		perkDescription: 'Created 50 tasks',
		perkIcon: '✅',
		filterConditions: [{ parameter: 'tasks', operator: '>=', value: 50 }]
	},
	{
		perkName: 'Task Manager',
		perkDescription: 'Created 100 tasks',
		perkIcon: '📊',
		filterConditions: [{ parameter: 'tasks', operator: '>=', value: 100 }]
	},
	{
		perkName: 'Productivity Maven',
		perkDescription: 'Created 500 tasks',
		perkIcon: '⚡',
		filterConditions: [{ parameter: 'tasks', operator: '>=', value: 500 }]
	},
	{
		perkName: 'Task Master',
		perkDescription: 'Created 1,000 tasks',
		perkIcon: '🔨',
		filterConditions: [{ parameter: 'tasks', operator: '>=', value: 1000 }]
	},
	{
		perkName: 'Efficiency Expert',
		perkDescription: 'Created 5,000 tasks',
		perkIcon: '⏱️',
		filterConditions: [{ parameter: 'tasks', operator: '>=', value: 5000 }]
	},
	{
		perkName: 'Task Titan',
		perkDescription: 'Created 10,000 tasks',
		perkIcon: '🏋️',
		filterConditions: [{ parameter: 'tasks', operator: '>=', value: 10000 }]
	},

	// Tag perks
	{
		perkName: 'Tagger',
		perkDescription: 'Created 10 tags',
		perkIcon: '🏷️',
		filterConditions: [{ parameter: 'tags', operator: '>=', value: 10 }]
	},
	{
		perkName: 'Organizer',
		perkDescription: 'Created 50 tags',
		perkIcon: '📎',
		filterConditions: [{ parameter: 'tags', operator: '>=', value: 50 }]
	},
	{
		perkName: 'Cataloger',
		perkDescription: 'Created 100 tags',
		perkIcon: '🗂️',
		filterConditions: [{ parameter: 'tags', operator: '>=', value: 100 }]
	},
	{
		perkName: 'Taxonomy Expert',
		perkDescription: 'Created 500 tags',
		perkIcon: '🔖',
		filterConditions: [{ parameter: 'tags', operator: '>=', value: 500 }]
	},
	{
		perkName: 'Metadata Maven',
		perkDescription: 'Created 1,000 tags',
		perkIcon: '📑',
		filterConditions: [{ parameter: 'tags', operator: '>=', value: 1000 }]
	},
	{
		perkName: 'Tag Virtuoso',
		perkDescription: 'Created 5,000 tags',
		perkIcon: '🎯',
		filterConditions: [{ parameter: 'tags', operator: '>=', value: 5000 }]
	},
	{
		perkName: 'Tag Legend',
		perkDescription: 'Created 10,000 tags',
		perkIcon: '💯',
		filterConditions: [{ parameter: 'tags', operator: '>=', value: 10000 }]
	},

	// Combined perks
	{
		perkName: 'Beginner Explorer',
		perkDescription: 'Created at least 10 of each: messages, threads, tasks, and tags',
		perkIcon: '🔍',
		filterConditions: [
			{ parameter: 'messages', operator: '>=', value: 10 },
			{ parameter: 'threads', operator: '>=', value: 10 },
			{ parameter: 'tasks', operator: '>=', value: 10 },
			{ parameter: 'tags', operator: '>=', value: 10 }
		]
	},
	{
		perkName: 'Balanced Contributor',
		perkDescription: 'Created at least 50 of each: messages, threads, tasks, and tags',
		perkIcon: '⚖️',
		filterConditions: [
			{ parameter: 'messages', operator: '>=', value: 50 },
			{ parameter: 'threads', operator: '>=', value: 50 },
			{ parameter: 'tasks', operator: '>=', value: 50 },
			{ parameter: 'tags', operator: '>=', value: 50 }
		]
	},
	{
		perkName: 'Platform Enthusiast',
		perkDescription: 'Created at least 100 of each: messages, threads, tasks, and tags',
		perkIcon: '🌟',
		filterConditions: [
			{ parameter: 'messages', operator: '>=', value: 100 },
			{ parameter: 'threads', operator: '>=', value: 100 },
			{ parameter: 'tasks', operator: '>=', value: 100 },
			{ parameter: 'tags', operator: '>=', value: 100 }
		]
	},
	{
		perkName: 'Platform Expert',
		perkDescription: 'Created at least 500 of each: messages, threads, tasks, and tags',
		perkIcon: '🎓',
		filterConditions: [
			{ parameter: 'messages', operator: '>=', value: 500 },
			{ parameter: 'threads', operator: '>=', value: 500 },
			{ parameter: 'tasks', operator: '>=', value: 500 },
			{ parameter: 'tags', operator: '>=', value: 500 }
		]
	},
	{
		perkName: 'Platform Master',
		perkDescription: 'Created at least 1,000 of each: messages, threads, tasks, and tags',
		perkIcon: '🏅',
		filterConditions: [
			{ parameter: 'messages', operator: '>=', value: 1000 },
			{ parameter: 'threads', operator: '>=', value: 1000 },
			{ parameter: 'tasks', operator: '>=', value: 1000 },
			{ parameter: 'tags', operator: '>=', value: 1000 }
		]
	},
	{
		perkName: 'Platform Virtuoso',
		perkDescription: 'Created at least 5,000 of each: messages, threads, tasks, and tags',
		perkIcon: '🌠',
		filterConditions: [
			{ parameter: 'messages', operator: '>=', value: 5000 },
			{ parameter: 'threads', operator: '>=', value: 5000 },
			{ parameter: 'tasks', operator: '>=', value: 5000 },
			{ parameter: 'tags', operator: '>=', value: 5000 }
		]
	},
	{
		perkName: 'Platform Legend',
		perkDescription: 'Created at least 10,000 of each: messages, threads, tasks, and tags',
		perkIcon: '🌈',
		filterConditions: [
			{ parameter: 'messages', operator: '>=', value: 10000 },
			{ parameter: 'threads', operator: '>=', value: 10000 },
			{ parameter: 'tasks', operator: '>=', value: 10000 },
			{ parameter: 'tags', operator: '>=', value: 10000 }
		]
	}
];

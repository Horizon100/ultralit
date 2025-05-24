export const startPrompts = [
	'How do I find purpose in my work?',
	'What makes life meaningful?',
	'How can I balance ambition with contentment?',
	'Why do we seek connection with others?',
	'How do different cultures define happiness?',
	'What can ancient philosophy teach us about modern life?',
	'How do I discover my authentic self?',
	'Why is mindfulness important for wellbeing?',
	'How can I build deeper relationships?',
	'What practices lead to lasting fulfillment?',
	'How do I overcome fear of the unknown?',
	'Why do humans create art?',
	'How can I contribute meaningfully to my community?',
	'What role does gratitude play in happiness?',
	'How do I find balance between solitude and connection?',
	'Why is personal growth important?',
	'How can I cultivate resilience during difficult times?',
	'What defines a life well lived?',
	'How do different spiritual traditions approach meaning?',
	'Why do we seek knowledge and understanding?',
	'How can I align my actions with my core values?',
	'What practices help develop self-awareness?',
	'How do I find my calling?',
	'Why is connection to nature important for humans?',
	'How can I leave a positive legacy?',
	'What helps people overcome existential anxiety?',
	'How do I recognize my true passions?',
	'Why do we need both challenge and comfort?',
	'How can I embrace uncertainty as part of life?',
	'What does it mean to live authentically?'
];

export function getRandomPrompts(count: number = 3): string[] {
	const shuffled = [...startPrompts].sort(() => 0.5 - Math.random());
	return shuffled.slice(0, count);
}

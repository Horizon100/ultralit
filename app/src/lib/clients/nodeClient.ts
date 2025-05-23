import { } from '../pocketbase';
import type { Node, AIAgent } from '../types/types';

export async function saveNode(node: Node): Promise<AIAgent> {
	try {
		const agentData: Partial<AIAgent> = {
			prompt: node.seedPrompt,
			name: node.title,
			description: node.content,
			status: 'active'
			// Add any other fields that map from Node to AIAgent
		};

		let agent: AIAgent;

		if (node.id) {
			// Update existing agent
			agent = await pb.collection('ai_agents').update<AIAgent>(node.id, agentData);
		} else {
			// Create new agent
			agent = await pb.collection('ai_agents').create<AIAgent>(agentData);
		}

		console.log('Agent saved:', agent);
		return agent;
	} catch (error) {
		console.error('Error saving agent:', error);
		throw error;
	}
}

export async function getNodeById(id: string): Promise<Node | null> {
	try {
		const agent = await pb.collection('ai_agents').getOne<AIAgent>(id);
		return convertAgentToNode(agent);
	} catch (error) {
		console.error('Error fetching agent:', error);
		return null;
	}
}

function convertAgentToNode(agent: AIAgent): Node {
	return {
		id: agent.id,
		title: agent.name,
		content: agent.description || '',
		x: 0, // You might want to store and retrieve position data
		y: 0,
		seedPrompt: agent.prompt,
		expanded: false,
		config: {
			maxTokens: 100,
			temperature: 0.7
		},
		label: agent.name,
		collectionId: agent.collectionId,
		collectionName: agent.collectionName,
		created: agent.created,
		updated: agent.updated
	};
}

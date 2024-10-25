import type { AIModel, AIMessage, Scenario, Task, AIAgent, NetworkData, Guidance, PartialAIAgent, VisNode, Messages, Threads } from '$lib/types';

import { getPrompt } from '$lib/constants/prompts';
import { createTask, updateAIAgent, createNetwork } from '$lib/pocketbase';
import { pb } from '$lib/pocketbase';

const toVisNode = (agent: AIAgent): VisNode => {
    const position = typeof agent.position === 'string' ? JSON.parse(agent.position) : agent.position;
    return {
      id: agent.id,
      label: agent.name,
      x: position.x,
      y: position.y
    };
};

export async function fetchAIResponse(messages: AIMessage[], model: AIModel, userId: string, attachment: File | null = null): Promise<string> {
    try {
        const supportedMessages = messages.filter(msg => ['system', 'assistant', 'user', 'function', 'tool'].includes(msg.role));
        
        console.log('Sending messages to API:', supportedMessages);

        let body;
        let headers;

        if (attachment) {
            const formData = new FormData();
            formData.append('messages', JSON.stringify(supportedMessages));
            formData.append('model', model);
            formData.append('userId', userId);
            formData.append('attachment', attachment);

            body = formData;
            // Don't set Content-Type header for FormData, let the browser set it
        } else {
            body = JSON.stringify({ messages: supportedMessages, model, userId });
            headers = {
                'Content-Type': 'application/json',
            };
        }

        const response = await fetch('/api/ai', {
            method: 'POST',
            headers,
            body,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error('Error in fetchAIResponse:', error);
        throw error;
    }
}

export async function fetchNamingResponse(userMessage: string, aiResponse: string, model: AIModel, userId: string): Promise<string> {
    try {
        const messages: AIMessage[] = [
            { 
                role: 'system', 
                content: 'Create a concise, descriptive title (max 5 words) for this conversation based on the user message and AI response. Focus on the main topic or question being discussed.' 
            },
            { 
                role: 'user', 
                content: `User message: "${userMessage}"\nAI response: "${aiResponse}"\nGenerate title:` 
            }
        ];

        const response = await fetchAIResponse(messages, model, userId);
        
        // Clean and format the response
        const threadName = response
            .trim()
            .replace(/^["']|["']$/g, '') // Remove quotes if present
            .slice(0, 50);               // Enforce max length
            
        return threadName;
    } catch (error) {
        console.error('Error in fetchNamingResponse:', error);
        throw error;
    }
}

export async function generateGuidance(context: { type: string; description: string }, model: AIModel, userId: string): Promise<Guidance> {
    const messages: AIMessage[] = [
        { role: 'system', content: getPrompt('GUIDANCE_GENERATION', '') },
        { role: 'user', content: JSON.stringify(context) }
    ];

    const response = await fetchAIResponse(messages, model, userId);
    
    return {
        type: context.type,
        content: response
    };
}

export async function generateScenarios(seedPrompt: string, model: AIModel, userId: string): Promise<Scenario[]> {
    const messages: AIMessage[] = [
        { role: 'system', content: getPrompt('SCENARIO_GENERATION', '') },
        { role: 'user', content: seedPrompt }
    ];

    const response = await fetchAIResponse(messages, model, userId);
    
    // Parse the response into three scenarios
    const scenarios: Scenario[] = response.split('\n').filter(Boolean).map((desc, index) => ({
        id: `scenario-${index + 1}`,
        description: desc.trim(),
        collectionId: '', // Add this
        collectionName: '', // Add this
        created: '', // Add this
        updated: '' // Add this
    }));

    return scenarios;
}


export async function generateTasks(scenario: Scenario, model: AIModel, userId: string): Promise<Task[]> {
    const messages: AIMessage[] = [
        { role: 'system', content: getPrompt('TASK_GENERATION', '') },
        { role: 'user', content: scenario.description }
    ];

    const response = await fetchAIResponse(messages, model, userId);
    
    const tasks: Task[] = response.split('\n').filter(Boolean).map((desc, index) => ({
        id: `task-${index + 1}`,
        title: `Task ${index + 1}`,
        description: desc.trim(),
        status: 'todo',
        priority: 'medium',
        due_date: new Date(),
        created_by: userId,
        assigned_to: '',
        ai_agents: '',
        tags: [],
        attachments: '',
        eisenhower: '',
        rice_score: 0,
        parent_task_id: '',
        subtasks: [],
        prompt: '',
        context: '',
        base_priority: 0,
        adaptive_priority: 0,
        altruism_weight: 0,
        survival_weight: 0,
        exploration_weight: 0,
        aspiration_weight: 0,
        surrogate_weight: 0,
        selfdev_weight: 0,
        collectionId: '',
        collectionName: '',
        created: '',
        updated: '',
        task_outcome: '',
        parent_agent: '',
        dependencies: [],
        messages: []
    }));

    return tasks;
}

export async function createAIAgent(scenario: Scenario, tasks: Task[], model: AIModel, userId: string): Promise<AIAgent> {
    const context = `Scenario: ${scenario.description}\nTasks: ${tasks.map(t => t.description).join(', ')}`;
    const messages: AIMessage[] = [
        { role: 'system', content: getPrompt('AGENT_CREATION', context) }
    ];

    const response = await fetchAIResponse(messages, model, userId);
    
    const agentProperties = parseAgentProperties(response);

    return {
        id: `agent-${Date.now()}`,
        prompt: agentProperties.prompt || '',
        user_id: userId,
        editors: [userId],
        viewers: [userId],
        name: agentProperties.name || `Agent for ${scenario.id}`,
        description: agentProperties.description || '',
        avatar: agentProperties.avatar || '',
        role: agentProperties.role || [],
        capabilities: agentProperties.capabilities || [],
        tasks: tasks.map(t => t.id),
        status: 'active',
        messages: [],
        tags: agentProperties.tags || [],
        performance: 0,
        version: '1.0',
        last_activity: new Date(),
        child_agents: [],
        base_priority: 0,
        adaptive_priority: 0,
        weight_altruism: 0,
        weight_survival: 0,
        weight_exploration: 0,
        weight_aspiration: 0,
        weight_surrogate: 0,
        weight_selfdev: 0,
        collectionId: '',
        collectionName: '',
        position:({ x: 0, y: 0 }),
        expanded: false,
        created: '',
        updated: ''
    };
}

function parseAgentProperties(response: string): PartialAIAgent {
    
    const properties: PartialAIAgent = {
        position: { x: 0, y: 0 } // Set a default position as a stringified object
    };
    const lines = response.split('\n');

    lines.forEach(line => {
        const [key, value] = line.split(':').map(s => s.trim());
        if (key && value) {
            switch (key) {
                case 'type':
                    if (value === 'host' || value === 'sub' || value === 'peer') {
                        properties.type = value;
                    }
                    break;
                case 'role':
                case 'capabilities':
                case 'tags':
                    properties[key] = value.split(',').map(item => item.trim());
                    break;
                case 'prompt':
                case 'name':
                case 'description':
                case 'avatar':
                    properties[key] = value;
                    break;
                case 'position':
                    try {
                        const positionObject = JSON.parse(value);
                        properties.position = JSON.stringify(positionObject);

                    } catch {
                        console.warn('Invalid position format:', value);
                    }
                    break;
                default:
                    console.warn(`Unexpected property: ${key}`);
            }
        }
    });

    return properties;
}

export async function determineNetworkStructure(scenario: Scenario, tasks: Task[], model: AIModel, userId: string): Promise<string> {
    const context = `Scenario: ${scenario.description}\nTasks: ${tasks.map(t => t.description).join(', ')}`;
    const messages: AIMessage[] = [
        { role: 'system', content: getPrompt('NETWORK_STRUCTURE', context) }
    ];

    const response = await fetchAIResponse(messages, model, userId);
    
    if (response.toLowerCase().includes('hierarchical')) {
        return 'hierarchical';
    } else if (response.toLowerCase().includes('flat')) {
        return 'flat';
    } else {
        console.warn('Unclear network structure response, defaulting to flat');
        return 'flat';
    }
}

export async function refineSuggestion(currentSuggestion: string, feedback: string, model: AIModel, userId: string): Promise<string> {
    const messages: AIMessage[] = [
        { role: 'system', content: getPrompt('REFINE_SUGGESTION', '') },
        { role: 'user', content: `Current suggestion: ${currentSuggestion}\nFeedback: ${feedback}` }
    ];

    const response = await fetchAIResponse(messages, model, userId);
    return response;
}

export async function generateSummary(messages: AIMessage[], model: AIModel, userId: string): Promise<string> {
    const summaryMessages: AIMessage[] = [
        { role: 'system', content: getPrompt('SUMMARY_GENERATION', '') },
        ...messages
    ];

    const response = await fetchAIResponse(summaryMessages, model, userId);
    return response;
    
}

export async function generateNetwork(summary: string, model: AIModel, userId: string): Promise<NetworkData> {
    const messages: AIMessage[] = [
      { role: 'system', content: getPrompt('NETWORK_GENERATION', '') },
      { role: 'user', content: summary }
    ];

    const response = await fetchAIResponse(messages, model, userId);
    
    const rootScenario: Scenario = {
        id: `scenario-root`,
        description: summary,
        collectionId: '',
        collectionName: '',
        created: '',
        updated: ''
    };

    const rootAgent = await createAIAgent(rootScenario, [], model, userId);

    const childAgents: AIAgent[] = [];
    const tasks: Task[] = [];

    const lines = response.split('\n');
    for (const line of lines) {
      if (line.startsWith('Agent:')) {
        const childScenario: Scenario = {
            id: `scenario-${Date.now()}`,
            description: line.substr(7),
            collectionId: '',
            collectionName: '',
            created: '',
            updated: ''
        };
        const childAgent = await createAIAgent(childScenario, [], model, userId);
        childAgents.push(childAgent);
      } else if (line.startsWith('Task:')) {
        const task = await createTask({
          title: line.substr(6),
          description: `Task for ${rootAgent.name}`,
          status: 'todo',
          priority: 'medium',
          assigned_to: rootAgent.id,
          created_by: userId,
        } as Partial<Task>);
        tasks.push(task);
      }
    }

    await updateAIAgent(rootAgent.id, {
      child_agents: childAgents.map(agent => agent.id),
    });

    await createNetwork({
      name: `Network for ${rootAgent.name}`,
      description: 'Generated network',
      user_id: userId,
      root_agent: rootAgent.id,
      agents: [rootAgent.id, ...childAgents.map(agent => agent.id)],
    });

    // Mapping AIAgent to VisNode
    const nodes: VisNode[] = [
        { id: rootAgent.id, label: rootAgent.name },
        ...childAgents.map(agent => ({ id: agent.id, label: agent.name }))
    ];

    const edges = childAgents.map(child => ({
      source: rootAgent.id,
      target: child.id
    }));

    return { 
        rootAgent: toVisNode(rootAgent),
        childAgents: childAgents.map(toVisNode),
        tasks,
        nodes,
        edges,
    };
}

export async function createThread(name: string, userId: string): Promise<Threads> {
    const thread = await pb.collection('threads').create<Threads>({
        name,
        created_by: userId
    });
    return thread;
}

export async function fetchThreads(userId: string): Promise<Threads[]> {
    const threads = await pb.collection('threads').getFullList<Threads>({
        sort: '-created',
        filter: `created_by = "${userId}"`
    });
    return threads;
}

export async function fetchMessagesForThread(threadId: string): Promise<Messages[]> {
    try {
        const messages = await pb.collection('messages').getFullList<Messages>({
            sort: 'created',
            filter: `thread = "${threadId}"`,
            expand: 'user'
        });
        return messages;
    } catch (error) {
        console.error('Error fetching messages for thread:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
        }
        return [];
    }
}

// export async function generateNetwork(summary: string, model: AIModel, userId: string): Promise<NetworkData> {
//     const messages: AIMessage[] = [
//         { role: 'system', content: getPrompt('NETWORK_GENERATION', '') },
//         { role: 'user', content: summary }
//     ];

//     const response = await fetchAIResponse(messages, model, userId);
    
//     console.log('AI Response:', response);

//     // Parse the text-based response
//     const lines = response.split('\n').map(line => line.trim()).filter(Boolean);
//     const nodes: NetworkNode[] = [];
//     const edges: Array<{ source: string; target: string }> = [];
//     let parsingEdges = false;

//     for (const line of lines) {
//         if (line.toLowerCase().startsWith('nodes:')) {
//             continue;
//         }
//         if (line.toLowerCase().startsWith('edges:')) {
//             parsingEdges = true;
//             continue;
//         }

//         if (!parsingEdges) {
//             // Parsing nodes
//             const match = line.match(/^\d+\.\s*(.+)$/);
//             if (match) {
//                 const label = match[1];
//                 nodes.push({ id: label, label });
//             }
//         } else {
//             // Parsing edges
//             const edgeMatch = line.match(/^-\s*(.+?)\s+(is|are)\s+(.+?)\s+(.+)$/);
//             if (edgeMatch) {
//                 const [, source, , , target] = edgeMatch;
//                 edges.push({ source, target });
//             }
//         }
//     }

//     return { 
//         id: `network-${Date.now()}`, // Generate a unique id
//         nodes, 
//         edges 
//     };
// }

// function isValidNetworkData(data: any): data is NetworkData {
//     return (
//         data &&
//         Array.isArray(data.nodes) &&
//         Array.isArray(data.edges) &&
//         data.nodes.every((node: any) => typeof node.id === 'string' && typeof node.label === 'string') &&
//         data.edges.every((edge: any) => typeof edge.source === 'string' && typeof edge.target === 'string')
//     );
// }

// function extractEntities(text: string): Node[] {
//     const entityRegex = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g;
//     const entities = new Set<string>();
//     let match;
//     while ((match = entityRegex.exec(text)) !== null) {
//         entities.add(match[1]);
//     }
//     return Array.from(entities).map(entity => ({ id: entity, label: entity }));
// }

// function extractRelationships(text: string): Array<{ source: string; target: string }> {
//     const relationships: Array<{ source: string; target: string }> = [];
//     const sentences = text.split(/[.!?]+/);
//     const entities = extractEntities(text);
    
//     sentences.forEach(sentence => {
//         const sentenceEntities = entities.filter(entity => sentence.includes(entity.id));
//         for (let i = 0; i < sentenceEntities.length; i++) {
//             for (let j = i + 1; j < sentenceEntities.length; j++) {
//                 relationships.push({
//                     source: sentenceEntities[i].id,
//                     target: sentenceEntities[j].id
//                 });
//             }
//         }
//     });
    
//     return relationships;
// }

import type { AIModel, AIMessage, Scenario, Task, AIAgent, Guidance } from '$lib/types/types';
// import { availableModels } from '$lib/constants/models';
// import { modelStore } from '$lib/stores/modelStore';
import type { ModelState } from '$lib/stores/modelStore';

import { getPrompt } from '$lib/constants/prompts';
// import { createTask, updateAIAgent, createNetwork } from '$lib/pocketbase';
import { pb } from '$lib/pocketbase';
// import type { ProviderType } from '$lib/constants/providers';

// const toVisNode = (agent: AIAgent): VisNode => {
//     const position = typeof agent.position === 'string' ? JSON.parse(agent.position) : agent.position;
//     return {
//       id: agent.id,
//       label: agent.name,
//       x: position.x,
//       y: position.y
//     };
// };

export async function fetchAIResponse(
    messages: AIMessage[], 
    model: ModelState['selectedModel'], 
    userId: string, 
    attachment: File | null = null
): Promise<string> {
    try {
        const supportedMessages = messages
            .filter(msg => ['system', 'assistant', 'user', 'function', 'tool'].includes(msg.role))
            .map(msg => ({
                role: msg.role,
                content: msg.prompt_type ? `${getPrompt(msg.prompt_type, '')}\n${msg.content}` : msg.content,
                model: msg.model
            }));

        const userSelectedModel = await pb.collection('users')
            .getOne(userId, { fields: 'model' })
            .then(user => user.model)
            .catch(() => model);

        const body = attachment ? new FormData() : {
            messages: supportedMessages,
            model: userSelectedModel || model,
            userId
        };

        if (attachment) {
            (body as FormData).append('messages', JSON.stringify(supportedMessages));
            (body as FormData).append('model', userSelectedModel || model);
            (body as FormData).append('userId', userId);
            (body as FormData).append('attachment', attachment);
        }

        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: {
                ...(!attachment && { 'Content-Type': 'application/json' }),
                Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
            },
            body: attachment ? body : JSON.stringify(body)
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return (await response.json()).response;
    } catch (error) {
        console.error('Error in fetchAIResponse:', error);
        throw error;
    }
}

export async function fetchNamingResponse(userMessage: string, aiResponse: string, model: AIModel, userId: string): Promise<string> {
    try {
        const messages: AIMessage[] = [
            { 
                role: 'assistant', 
                content: 'Create a concise, descriptive title (max 5 words) for this conversation based on the user message and AI response. Focus on the main topic or question being discussed.',
                model: model.api_type // Add model property
            },
            { 
                role: 'user', 
                content: `User message: "${userMessage}"\nAI response: "${aiResponse}"\nGenerate title:`,
                model: model.api_type // Add model property
            }
        ];

        const response = await fetchAIResponse(messages, model.api_type, userId);
        
        const threadName = response
            .trim()
            .replace(/^["']|["']$/g, '')
            .slice(0, 50);
            
        return threadName;
    } catch (error) {
        console.error('Error in fetchNamingResponse:', error);
        throw error;
    }
}

export async function generateGuidance(context: { type: string; description: string }, model: AIModel, userId: string): Promise<Guidance> {
    const messages: AIMessage[] = [
        { 
            role: 'assistant', 
            content: getPrompt('BRAINSTORM', ''),
            model: model.api_type 
        },
        { 
            role: 'user', 
            content: JSON.stringify(context),
            model: model.api_type 
        }
    ];

    const response = await fetchAIResponse(messages, model.api_type, userId);
    
    return {
        type: context.type,
        content: response
    };
}

export async function generateScenarios(seedPrompt: string, model: AIModel, userId: string): Promise<Scenario[]> {
    const messages: AIMessage[] = [
        { 
            role: 'assistant', 
            content: getPrompt('FLOW', ''),
            model: model.api_type
        },
        { 
            role: 'user', 
            content: seedPrompt,
            model: model.api_type 
        }
    ];

    const response = await fetchAIResponse(messages, model.api_type, userId);
    
    // Parse the response into three scenarios
    const scenarios: Scenario[] = response.split('\n').filter(Boolean).map((desc, index) => ({
        id: `scenario-${index + 1}`,
        description: desc.trim(),
        collectionId: '',
        collectionName: '', 
        created: '', 
        updated: '' 
    }));

    return scenarios;
}


export async function generateTasks(scenario: Scenario, model: AIModel, userId: string): Promise<Task[]> {
    const messages: AIMessage[] = [
        { 
            role: 'assistant', 
            content: getPrompt('PLANNER', ''),
            model: model.api_type 
        },
        {   role: 'user', 
            content: scenario.description,
            model: model.api_type 
        }
    ];

    const response = await fetchAIResponse(messages, model.api_type , userId);
    
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
        { 
            role: 'assistant', 
            content: getPrompt('CODER', context),
            model: model.api_type 
        }
    ];

    const response = await fetchAIResponse(messages, model.api_type, userId);
    [{
        "resource": "/Users/jr/Repositories/ultralit/app/src/lib/clients/aiClient.ts",
        "owner": "typescript",
        "code": "2322",
        "severity": 8,
        "message": "Type 'RoleType | never[]' is not assignable to type 'RoleType'.\n  Type 'never[]' is not assignable to type 'RoleType'.",
        "source": "ts",
        "startLineNumber": 245,
        "startColumn": 9,
        "endLineNumber": 245,
        "endColumn": 13,
        "relatedInformation": [
            {
                "startLineNumber": 118,
                "startColumn": 5,
                "endLineNumber": 118,
                "endColumn": 9,
                "message": "The expected type comes from property 'role' which is declared here on type 'AIAgent'",
                "resource": "/Users/jr/Repositories/ultralit/app/src/lib/types.ts"
            }
        ]
    }]

// function parseAgentProperties(response: string): PartialAIAgent {
//     const properties: PartialAIAgent = {
//         position: { x: 0, y: 0 } // Set a default position as a stringified object
//     };
//     const lines = response.split('\n');

//     lines.forEach(line => {
//         const [key, value] = line.split(':').map(s => s.trim());
//         if (key && value) {
//             switch (key) {
//                 case 'type':
//                     if (value === 'host' || value === 'sub' || value === 'peer') {
//                         properties.type = value;
//                     }
//                     break;
//                 case 'role':
//                 case 'capabilities':
//                 case 'tags':
//                     // properties[key] = value.split(',').map(item => item.trim());
//                     break;
//                 case 'prompt':
//                 case 'name':
//                 case 'description':
//                 case 'avatar':
//                     properties[key] = value;
//                     break;
//                 case 'position':
//                     try {
//                         const positionObject = JSON.parse(value);
//                         properties.position = JSON.stringify(positionObject);
//                     } catch {
//                         console.warn('Invalid position format:', value);
//                     }
//                     break;
//                 default:
//                     console.warn(`Unexpected property: ${key}`);
//             }
//         }
//     });

//     return properties;
// }

// export async function determineNetworkStructure(scenario: Scenario, tasks: Task[], model: AIModel, userId: string): Promise<string> {
//     const context = `Scenario: ${scenario.description}\nTasks: ${tasks.map(t => t.description).join(', ')}`;
//     const messages: AIMessage[] = [
//         { 
//             role: 'assistant', 
//             content: getPrompt('RESEARCH', context), 
//             model: model.api_type 
//         }
//     ];

//     const response = await fetchAIResponse(messages, model.api_type, userId);
    
//     if (response.toLowerCase().includes('hierarchical')) {
//         return 'hierarchical';
//     } else if (response.toLowerCase().includes('flat')) {
//         return 'flat';
//     } else {
//         console.warn('Unclear network structure response, defaulting to flat');
//         return 'flat';
//     }
// }

// export async function refineSuggestion(currentSuggestion: string, feedback: string, model: AIModel, userId: string): Promise<string> {
//     const messages: AIMessage[] = [
//         { 
//             role: 'assistant', 
//             content: getPrompt('DESIGNER', ''),
//             model: model.api_type 
//         },
//         { 
//             role: 'user', 
//             content: `Current suggestion: ${currentSuggestion}\nFeedback: ${feedback}`,
//             model: model.api_type 
//         }
//     ];

//     const response = await fetchAIResponse(messages, model.api_type, userId);
//     return response;
// }

// export async function generateSummary(messages: AIMessage[], model: AIModel, userId: string): Promise<string> {
//     const summaryMessages: AIMessage[] = [
//         { 
//             role: 'assistant', 
//             content: getPrompt('WRITER', ''),            
//             model: model.api_type 
//         },
//         ...messages
//     ];

//     const response = await fetchAIResponse(summaryMessages, model.api_type, userId);
//     return response;
    
// }

// export async function generateNetwork(summary: string, model: AIModel, userId: string): Promise<NetworkData> {
//     const messages: AIMessage[] = [
//       { 
//         role: 'assistant', 
//         content: getPrompt('ANALYZER', ''),
//         model: model.api_type 
//     },
//       { 
//         role: 'user', 
//         content: summary,
//         model: model.api_type,
//     }
//     ];

//     const response = await fetchAIResponse(messages, model.api_type, userId);
    
//     const rootScenario: Scenario = {
//         id: `scenario-root`,
//         description: summary,
//         collectionId: '',
//         collectionName: '',
//         created: '',
//         updated: ''
//     };

//     const rootAgent = await createAIAgent(rootScenario, [], model, userId);

//     const childAgents: AIAgent[] = [];
//     const tasks: Task[] = [];

//     const lines = response.split('\n');
//     for (const line of lines) {
//       if (line.startsWith('Agent:')) {
//         const childScenario: Scenario = {
//             id: `scenario-${Date.now()}`,
//             description: line.substr(7),
//             collectionId: '',
//             collectionName: '',
//             created: '',
//             updated: ''
//         };
//         const childAgent = await createAIAgent(childScenario, [], model, userId);
//         childAgents.push(childAgent);
//       } else if (line.startsWith('Task:')) {
//         const task = await createTask({
//           title: line.substr(6),
//           description: `Task for ${rootAgent.name}`,
//           status: 'todo',
//           priority: 'medium',
//           assigned_to: rootAgent.id,
//           created_by: userId,
//         } as Partial<Task>);
//         tasks.push(task);
//       }
//     }

//     await updateAIAgent(rootAgent.id, {
//       child_agents: childAgents.map(agent => agent.id),
//     });

//     await createNetwork({
//       name: `Network for ${rootAgent.name}`,
//       description: 'Generated network',
//       user_id: userId,
//       root_agent: rootAgent.id,
//       agents: [rootAgent.id, ...childAgents.map(agent => agent.id)],
//     });

//     // Mapping AIAgent to VisNode
//     const nodes: VisNode[] = [
//         { id: rootAgent.id, label: rootAgent.name },
//         ...childAgents.map(agent => ({ id: agent.id, label: agent.name }))
//     ];

//     const edges = childAgents.map(child => ({
//       source: rootAgent.id,
//       target: child.id
//     }));

//     return { 
//         rootAgent: toVisNode(rootAgent),
//         childAgents: childAgents.map(toVisNode),
//         tasks,
//         nodes,
//         edges,
//     };
// }

// export async function generateNetwork(summary: string, model: AIModel, userId: string): Promise<NetworkData> {
//     const messages: AIMessage[] = [
//         { role: 'system', content: getPrompt('ANALYZER', '') },
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
    
}
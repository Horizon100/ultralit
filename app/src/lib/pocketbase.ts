import PocketBase from 'pocketbase';
import type { AuthModel } from 'pocketbase';
import { ClientResponseError } from 'pocketbase';
import { writable } from 'svelte/store'
import type { AIAgent, Network, Task, AIPreferences, Message, NetworkData, CursorPosition, User, AIModel, Actions, Workflows, Workspaces, Threads, Messages } from '$lib/types';
// import { role } from './components/common/chat/MessageHeader.svelte';
// import type { ClientResponseError } from 'pocketbase'; // Unused
// import type { RecordModel } from 'pocketbase'; // Unused

// Types
interface CursorChangeEvent {
    action: string;
    record: CursorPosition;
}

// Variables
let publishTimer: ReturnType<typeof setTimeout> | null = null;
let lastPublishedPosition: { userId: string, x: number, y: number, name: string } | null = null;


////////////////////////////////////////////////////////////////

// PocketBase setup

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL);
pb.autoCancellation(false);

export const currentUser = writable<User | null>(pb.authStore.model as User | null);


pb.authStore.onChange((auth) => {
    console.log('authStore changed', auth);
    currentUser.set(pb.authStore.model as User | null);
});



console.log('PocketBase URL:', pb.baseUrl);

////////////////////////////////////////////////////////////////

// Debugging



export async function checkPocketBaseConnection() {
    try {
        const health = await pb.health.check();
        console.log('PocketBase health check:', health);
        return true;
    } catch (error) {
        console.error('PocketBase connection error:', error);
        return false;
    }
}

// Log the base URL for debugging
console.log('PocketBase URL:', pb.baseUrl);

////////////////////////////////////////////////////////////////

// Authentication functions

export async function ensureAuthenticated(): Promise<boolean> {
    console.log('Checking authentication...');
    console.log('Current auth model:', pb.authStore.model);
    console.log('Is auth valid?', pb.authStore.isValid);

    if (!pb.authStore.isValid) {
        
        console.log('Auth token is invalid. Attempting to refresh...');
        
        try {
            const authData = await pb.collection('users').authRefresh();
            console.log('Auth token refreshed successfully');
            console.log('New auth model:', pb.authStore.model);
            console.log('Auth refreshed:', authData);
            return true;
        } catch (error) {
            console.error('Failed to refresh auth token:', error);
            pb.authStore.clear();
            return false;
        }
    }
    return true;
}

export async function signUp(email: string, password: string): Promise<User | null> {
    try {
        const user = await pb.collection('users').create<User>({
            email,
            password,
            passwordConfirm: password
        });
        return user;
    } catch (error) {
        console.error('Sign-up error:', error instanceof Error ? error.message : String(error));
        return null;
    }
}

export async function signIn(email: string, password: string): Promise<AuthModel | null> {
    try {
        const authData = await pb.collection('users').authWithPassword<User>(email, password);
        return authData;
    } catch (error) {
        console.error('Sign-in error:', error instanceof Error ? error.message : String(error));
        return null;
    }
}

export function signOut() {
    pb.authStore.clear();
    currentUser.set(null);
}


export async function updateUser(id: string, userData: FormData | Partial<User>): Promise<User> {
    const record = await pb.collection('users').update(id, userData);
    return record as User;
}

export async function getUserById(id: string): Promise<User | null> {
    try {
        const record = await pb.collection('users').getOne(id);
        return record as User;
    } catch (error) {
        console.error('Error fetching user:', error);
        return null;
    }
}



////////////////////////////////////////////////////////////////

// AI Agent functions

export async function createAgentWithSummary(summary: string, userId: string): Promise<AIAgent> {
    const agent: Partial<AIAgent> & Pick<AIAgent, 'tasks' | 'messages' | 'child_agents'> = {
        prompt: summary,
        user_id: userId,
        editors: [userId],
        viewers: [userId],
        name: `Agent ${Date.now()}`,
        description: `Agent created from summary: ${summary.substring(0, 50)}...`,
        avatar: '',
        capabilities: [],
        focus: 'processor',
        status: 'active',
        tags: [],
        performance: 0,
        version: '1.0',
        tasks: [],
        messages: [],
        child_agents: [],
        position: '0,0', // Default position as a string
        expanded: false,
    };
    try {
        const record = await pb.collection('ai_agents').create(agent);
        return record as AIAgent;
    } catch (error) {
        if (error instanceof ClientResponseError) {
            console.error('ClientResponseError:', {
                message: error.message,
                status: error.status,
                data: error.data,
            });
        } else {
            console.error('Unexpected error:', error);
        }
        throw error;
    }
}

export async function updateAIAgent(id: string, agentData: Partial<AIAgent>): Promise<AIAgent> {
    // No need to stringify position, PocketBase should handle object storage
    const record = await pb.collection('ai_agents').update(id, agentData);
    return record as AIAgent;
}

export async function getAgentById(id: string): Promise<AIAgent | null> {
    try {
        const record = await pb.collection('ai_agents').getOne(id);
        return record as AIAgent;
    } catch (error) {
        console.error('Error fetching agent:', error);
        return null;
    }
}
// export async function createNetworkStructure(structure: NetworkStructure): Promise<NetworkStructure> {
//     const record = await pb.collection('networks').create(structure);
//     return record as unknown as NetworkStructure;
// }

export async function createNetwork(networkData: Partial<Network>): Promise<Network> {
    const record = await pb.collection('networks').create(networkData);
    return record as Network;
  }

  export async function updateNetwork(id: string, networkData: Partial<Network>): Promise<Network> {
    const record = await pb.collection('networks').update(id, networkData);
    return record as Network;
  }

////////////////////////////////////////////////////////////////

// AI Preferences functions

export async function saveAIPreferences(preferences: AIPreferences): Promise<AIPreferences> {
    const record = await pb.collection('ai_preferences').create(preferences);
    return record as AIPreferences;
}

export async function updateAIPreferences(id: string, preferences: Partial<AIPreferences>): Promise<AIPreferences> {
    const record = await pb.collection('ai_preferences').update(id, preferences);
    return record as AIPreferences;
}

export async function getAIPreferencesByUserId(userId: string): Promise<AIPreferences | null> {
    try {
        const record = await pb.collection('ai_preferences').getFirstListItem(`user_id="${userId}"`);
        return record as AIPreferences;
    } catch (error) {
        console.error('Error fetching AI preferences:', error);
        return null;
    }
}

////////////////////////////////////////////////////////////////

// Network Structure functions

export async function saveNetworkLayout(networkData: NetworkData): Promise<NetworkData | null> {
    try {
        const isAuthenticated = await ensureAuthenticated();
        if (!isAuthenticated) {
            throw new Error('User is not authenticated');
        }

        console.log('Attempting to save network layout for user:', pb.authStore.model?.id);

        const record = await pb.collection('networks').create({
            nodes: JSON.stringify(networkData.nodes),
            edges: JSON.stringify(networkData.edges),
            rootAgent: networkData.rootAgent.id,
            childAgents: networkData.childAgents.map((agent) => agent.id),
            tasks: networkData.tasks.map((task: Task) => task.id),
            user: pb.authStore.model?.id as string
        });

        console.log('Network layout saved successfully:', record);

        return {
            id: record.id,
            nodes: JSON.parse(record.nodes),
            edges: JSON.parse(record.edges),
            rootAgent: networkData.rootAgent,
            childAgents: networkData.childAgents,
            tasks: networkData.tasks
        };
    } catch (error) {
        console.error('Error saving network layout:', error);
        if (error instanceof ClientResponseError) {
            console.error(`ClientResponseError: ${error.message}, Status: ${error.status}`);
            if (error.status === 401) {
                console.error('User is not authorized to perform this action. Please log in and try again.');
            } else if (error.status === 403) {
                console.error('User does not have permission to create network layouts.');
            }
        }
        return null;
    }
}
////////////////////////////////////////////////////////////////

// Task functions

export async function createTask(taskData: Partial<Task>): Promise<Task> {
    const record = await pb.collection('tasks').create(taskData);
    return record as Task;
}

export async function saveTasksForAgent(tasks: Task[], agentId: string): Promise<Task[]> {
    try {
        const savedTasks = await Promise.all(tasks.map(async (task) => {
            const taskData = {
                title: task.title,
                description: task.description,
                status: task.status || 'todo',
                priority: task.priority || 'medium',
                employer: pb.authStore.model?.id,
                employee: agentId,
                ai_agents: [agentId],
            };
            const record = await pb.collection('tasks').create(taskData);
            return record as Task;
        }));
        return savedTasks;
    } catch (error) {
        console.error('Error saving tasks for agent:', error);
        throw error;
    }
}

export async function updateTask(id: string, task: Partial<Task>): Promise<Task> {
    const record = await pb.collection('tasks').update(id, task);
    return record as Task;
}

export async function getTaskById(id: string): Promise<Task | null> {
    try {
        const record = await pb.collection('tasks').getOne(id);
        return record as Task;
    } catch (error) {
        console.error('Error fetching task:', error);
        return null;
    }
}



////////////////////////////////////////////////////////////////

// Helper function to create an agent and a related task

export async function createAIAgent(agentData: Partial<AIAgent>): Promise<AIAgent> {
    const record = await pb.collection('ai_agents').create(agentData);
    return record as AIAgent;
  }

  export async function createAgentAndTask(summary: string, userId: string, taskTitle: string, taskDescription: string): Promise<{ agent: AIAgent, task: Task }> {
    const agent = await createAgentWithSummary(summary, userId);
    const task = await createTask({
        title: taskTitle,
        description: taskDescription,
        ai_agents: [agent.id]
    });
    
    return { agent, task };
}

////////////////////////////////////////////////////////////////

// Message functions



export async function getMessagesByTaskId(taskId: string): Promise<Message[]> {
    try {
        const records = await pb.collection('messages').getFullList({ filter: `task_id="${taskId}"` });
        return records as Message[];
    } catch (error) {
        console.error('Error fetching messages:', error);
        return [];
    }
}



////////////////////////////////////////////////////////////////

// Cursor sharing functions

export async function subscribeToCursorChanges(callback: (data: CursorChangeEvent) => void): Promise<() => void> {
    try {
        console.log('Subscribing to cursor position changes...');
        
        const unsubscribe = await pb.realtime.subscribe('cursors', callback);
        console.log('Subscribed successfully to cursor changes');
        return unsubscribe;
    } catch (error) {
        console.error('Error subscribing to cursor changes:', error);
        if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        throw error;
    }
}

export async function publishCursorPosition(userId: string, x: number, y: number, name: string): Promise<void> {
    lastPublishedPosition = { userId, x, y, name };

    if (publishTimer) {
        clearTimeout(publishTimer);
    }

    publishTimer = setTimeout(async () => {
        if (!lastPublishedPosition) return;

        try {
            console.debug('Publishing cursor position with parameters:', lastPublishedPosition);

            const existingRecords = await pb.collection('cursor_positions').getFullList({
                filter: `user="${lastPublishedPosition.userId}"`,
                $autoCancel: false
            });

            if (existingRecords.length > 0) {
                await pb.collection('cursor_positions').update(existingRecords[0].id, {
                    position: { x: lastPublishedPosition.x, y: lastPublishedPosition.y },
                    name: lastPublishedPosition.name
                }, { $autoCancel: false });
            } else {
                await pb.collection('cursor_positions').create({
                    user: lastPublishedPosition.userId,
                    position: { x: lastPublishedPosition.x, y: lastPublishedPosition.y },
                    name: lastPublishedPosition.name
                }, { $autoCancel: false });
            }
        } catch (error) {
            if (error instanceof ClientResponseError) {
                console.error('Error publishing cursor position:', {
                    message: error.message,
                    data: error.data,
                    status: error.status
                });
            } else {
                console.error('Unknown error publishing cursor position:', error);
            }
        }
    }, 100); // Debounce for 100ms
}

export function unsubscribeFromChanges(unsubscribe: () => void): void {
    unsubscribe();
}

// Agent functions

export async function fetchUserAgents(userId: string): Promise<AIAgent[]> {
    try {
        const records = await pb.collection('ai_agents').getFullList({
            filter: `user_id = "${userId}" || editors ~ "${userId}" || viewers ~ "${userId}"`,
        });

        return records.map(record => {
            const agent = record as AIAgent;
            if (typeof agent.position === 'string') {
                try {
                    agent.position = JSON.parse(agent.position);
                } catch (e) {
                    console.error('Error parsing agent position:', e);
                    agent.position = { x: 0, y: 0 };
                }
            }
            return agent;
        });
    } catch (error) {
        console.error('Error fetching user agents:', error);
        if (error instanceof ClientResponseError) {
            console.error('Response data:', error.data);
            console.error('Status code:', error.status);
        }
        throw error;
    }
}

export async function fetchUserModels(userId: string): Promise<AIModel[]> {
    try {
        const records = await pb.collection('models').getFullList<AIModel>({
            filter: `user ~ "${userId}"`,
        });
        return records.map(record => {
            const model = record as AIModel;
            return model;
        });
    } catch (error) {
        console.error('Error fetching user models:', error);
        return [];
    }
}

// Get user's current model preferences
export async function fetchUserModelPreferences(userId: string): Promise<{ provider: string | null, model: string | null }> {
    try {
        const user = await pb.collection('users').getOne<User>(userId);
        return {
            provider: user.selected_provider || null,
            model: user.model || null
        };
    } catch (error) {
        console.error('Error fetching user model preferences:', error);
        return {
            provider: null,
            model: null
        };
    }
}

// Update user's model preferences
export async function updateUserModelPreferences(userId: string, provider: string, model: string): Promise<User> {
    try {
        const updated = await pb.collection('users').update<User>(userId, {
            selected_provider: provider,
            model: model
        });
        return updated;
    } catch (error) {
        console.error('Error updating user model preferences:', error);
        throw error;
    }
}

// Optional: Helper function to get default model if none is selected
export function getDefaultModelPreferences() {
    return {
        provider: 'openai',  // or whatever your default provider is
        model: 'gpt-3.5-turbo'  // or whatever your default model is
    };
}

export async function fetchUserActions(userId: string): Promise<Actions[]> {
    try {
        console.log('Fetching actions for user:', userId);
        
        // Fetch all actions
        const allRecords = await pb.collection('actions').getFullList();
        console.log('All actions:', allRecords);

        // Log the structure of the first action (if available)
        if (allRecords.length > 0) {
            console.log('Structure of first action:', JSON.stringify(allRecords[0], null, 2));
        }

        // Filter actions based on user ID
        const userActions = allRecords.filter(record => {
            console.log(`Checking action ${record.id}:`, record);
            return record.user === userId || (Array.isArray(record.user) && record.user.includes(userId));
        });
        console.log('Filtered user actions:', userActions);

        return userActions as Actions[];
    } catch (error) {
        console.error('Error fetching user actions:', error);
        throw error;
    }
}



export async function fetchUserFlows(userId: string): Promise<Workflows[]> {
    try {
      const records = await pb.collection('workflows').getList<Workflows>(1, 500, {
        filter: `user_id = "${userId}"`,
      });
      return records.items;
    } catch (error) {
      console.error('Error fetching user flows:', error);
      throw error;
    }
  }

export async function fetchUserWorkspaces(userId: string): Promise<Workspaces[]> {
    try {
        const records = await pb.collection('workspaces').getFullList({
            filter: `created_by = "${userId}" || collaborators ?~ "${userId}"`,
            sort: '-created',
        });

        return records.map(record => ({
            id: record.id,
            name: record.name,
            description: record.description,
            created_by: record.created_by,
            collaborators: record.collaborators || [],
            created: record.created,
            updated: record.updated,
        }));
    } catch (error) {
        console.error('Error fetching user workspaces:', error);
        return [];
    }
}


// Thread functions
export async function fetchThreads(): Promise<Threads[]> {
    try {
        const records = await pb.collection('threads').getFullList<Threads>({
            sort: '-created',
        });
        return records;
    } catch (error) {
        console.error('Error fetching threads:', error);
        throw error;
    }
}

export async function createThread(threadData: Partial<Threads>): Promise<Threads> {
    try {
        const record = await pb.collection('threads').create<Threads>(threadData);
        return record;
    } catch (error) {
        console.error('Error creating thread:', error);
        throw error;
    }
}

export async function updateThread(id: string, threadData: Partial<Threads>): Promise<Threads> {
    try {
        const record = await pb.collection('threads').update<Threads>(id, threadData);
        return record;
    } catch (error) {
        console.error('Error updating thread:', error);
        throw error;
    }
}

export async function deleteThread(id: string): Promise<boolean> {
    try {
        await pb.collection('threads').delete(id);
        return true;
    } catch (error) {
        console.error('Error deleting thread:', error);
        return false;
    }
}

// Message functions for threads
export async function fetchMessagesForThread(threadId: string): Promise<Messages[]> {
    try {
        const records = await pb.collection('messages').getFullList<Messages>({
            sort: '+created',
            filter: `thread = "${threadId}"`,
        });
        console.log('Fetched messages:', records);
        return records;
    } catch (error) {
        console.error('Error fetching messages for thread:', error);
        throw error;
    }
}

export async function createMessage(messageData: Partial<Message>): Promise<Message> {
    try {
        const defaultedMessageData = {
            text: messageData.text,
            user: messageData.user || pb.authStore.model?.id,
            thread: messageData.thread_id,
            task_id: messageData.task_id,
            parent_msg_id: messageData.parent_msg_id,
            ai_agent_id: messageData.ai_agent_id,
            type: messageData.type || 'text',
            sender: messageData.sender,
            receiver: messageData.receiver,
            attachments: messageData.attachments,
            reactions: messageData.reactions || {},
            update_status: messageData.update_status || 'not_updated',
            prompt_type: messageData.prompt_type,
            model: messageData.model  

        };

        const record = await pb.collection('messages').create<Message>(defaultedMessageData);
        return record;
    } catch (error) {
        console.error('Error creating message:', error);
        throw error;
    }
}

export async function updateMessage(id: string, messageData: Partial<Message>): Promise<Message> {
    try {
        const record = await pb.collection('messages').update<Message>(id, messageData);
        return record;
    } catch (error) {
        console.error('Error updating message:', error);
        throw error;
    }
}

export async function deleteMessage(id: string): Promise<boolean> {
    try {
        await pb.collection('messages').delete(id);
        return true;
    } catch (error) {
        console.error('Error deleting message:', error);
        return false;
    }
}
import { debounce } from 'lodash-es';
import { ClientResponseError } from 'pocketbase';
import { pb } from './pocketbase';
import type { AIAgent } from './types';

export async function createAgent(agentData: Partial<AIAgent> | FormData): Promise<AIAgent> {
  try {
    const userId = pb.authStore.model?.id;
    if (!userId) {
      throw new Error('User not logged in');
    }

    let finalAgentData: Record<string, unknown>;

    if (agentData instanceof FormData) {
      finalAgentData = Object.fromEntries(agentData.entries());
      // Parse JSON strings back into objects/arrays
      for (const key in finalAgentData) {
        try {
          finalAgentData[key] = JSON.parse(finalAgentData[key] as string);
        } catch {
          // If parsing fails, keep the original value
        }
      }
    } else {
      finalAgentData = { ...agentData };
    }

    // Set owner and other common fields
    finalAgentData.user_id = userId;
    finalAgentData.owner = userId;
    finalAgentData.editors = finalAgentData.editors || [userId];
    finalAgentData.viewers = finalAgentData.viewers || [userId];
    finalAgentData.position = JSON.stringify(finalAgentData.position || {x: 0, y: 0});
    finalAgentData.status = finalAgentData.status || 'inactive';

    // Handle actions
    if (Array.isArray(finalAgentData.actions)) {
      finalAgentData.actions = finalAgentData.actions.map(action => 
        typeof action === 'string' ? action : action.id
      );
    }

    // Ensure role and user_input are lowercase
    if (finalAgentData.role) {
      finalAgentData.role = (finalAgentData.role as string).toLowerCase();
    }
    if (finalAgentData.user_input) {
      finalAgentData.user_input = (finalAgentData.user_input as string).toLowerCase();
    }

    console.log('Sending data to server:', finalAgentData);

    const agent = await pb.collection('ai_agents').create<AIAgent>(finalAgentData);

    console.log('Created agent:', agent);

    return {
      ...agent,
      position: typeof agent.position === 'string' ? JSON.parse(agent.position) : agent.position
    };
  } catch (error) {
    console.error('Error creating agent:', error);
    if (error instanceof ClientResponseError) {
      console.error('Response data:', error.data);
      console.error('Status code:', error.status);
    }
    throw error;
  }
}

export const updateAgentDebounced = debounce(async (id: string, agentData: Partial<AIAgent> | FormData): Promise<AIAgent> => {
  try {
    let finalAgentData: Record<string, unknown>;

    if (agentData instanceof FormData) {
      finalAgentData = Object.fromEntries(agentData.entries());
      // Parse JSON strings back into objects/arrays
      for (const key in finalAgentData) {
        if (typeof finalAgentData[key] === 'string') {
          try {
            finalAgentData[key] = JSON.parse(finalAgentData[key] as string);
          } catch {
            // If parsing fails, keep the original value
          }
        }
      }
    } else {
      finalAgentData = { ...agentData };
    }

    // Handle actions, role, user_input, and position as before...

    console.log('Sending data to server for update:', finalAgentData);

    const agent = await pb.collection('ai_agents').update<AIAgent>(id, finalAgentData);

    console.log('Updated agent:', agent);

    if (!agent) {
      throw new Error('Failed to update agent: No agent returned');
    }

    return {
      ...agent,
      position: typeof agent.position === 'string' ? JSON.parse(agent.position) : agent.position
    };
  } catch (error) {
    console.error('Error updating agent:', error);
    if (error instanceof ClientResponseError) {
      console.error('Response data:', error.data);
      console.error('Status code:', error.status);
    }
    throw error;
  }
}, 300, { leading: true, trailing: true });

// Function to update agent (calls debounced function)
export async function updateAgent(id: string, agentData: Partial<AIAgent> | FormData): Promise<AIAgent> {
  return updateAgentDebounced(id, agentData);
}

export async function getAgentById(id: string): Promise<AIAgent> {
  try {
    const agent = await pb.collection('ai_agents').getOne<AIAgent>(id);
    console.log('Fetched agent:', agent);
    return {
      ...agent,
      position: typeof agent.position === 'string' ? JSON.parse(agent.position) : agent.position
    };
  } catch (error) {
    console.error('Error fetching agent:', error);
    throw error;
  }
}

export async function deleteAgent(id: string): Promise<boolean> {
  try {
    await pb.collection('ai_agents').delete(id);
    console.log('Agent deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting agent:', error);
    if (error instanceof ClientResponseError) {
      console.error('Response data:', error.data);
      console.error('Status code:', error.status);
    }
    throw error;
  }
}
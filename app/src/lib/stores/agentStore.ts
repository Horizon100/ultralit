import { writable } from 'svelte/store';
import type { AIAgent } from '$lib/types/types';
import { debounce } from 'lodash-es';
import { updateAgent as updateAgentAPI } from '$lib/clients/agentClient';
import { browser } from '$app/environment';

// Helper function to handle fetch API responses
async function handleResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.message || `API request failed with status ${response.status}`);
	}
	return await response.json();
}

function createAgentStore() {
	const initialAgents = browser ? JSON.parse(localStorage.getItem('userAgents') || '[]') : [];

	const { subscribe, set, update } = writable<{ agents: AIAgent[]; updateStatus: string }>({
		agents: initialAgents,
		updateStatus: ''
	});

	if (browser) {
		subscribe((state) => {
			localStorage.setItem('userAgents', JSON.stringify(state.agents));
		});
	}

	const debouncedUpdateAgent = debounce(async (id: string, changes: Partial<AIAgent>) => {
		try {
			const updatedAgent = await updateAgentAPI(id, changes);
			update((state) => ({
				agents: state.agents.map((n) => (n.id === id ? { ...n, ...updatedAgent } : n)),
				updateStatus: 'Agent updated successfully'
			}));
			setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
		} catch (error) {
			console.error('Failed to update agent in backend:', error);
			update((state) => ({ ...state, updateStatus: 'Failed to update agent' }));
			setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
		}
	}, 300);

	return {
		subscribe,
		loadAgents: async (workspaceId: string): Promise<AIAgent[]> => {
			try {
				console.log('Loading agents for workspace:', workspaceId);

				// Fetch workspace using API
				const workspaceResponse = await fetch(`/api/workspaces/${workspaceId}`, {
					method: 'GET',
					credentials: 'include'
				});
				
				const workspaceData = await handleResponse<{ success: boolean; data: any; error?: string }>(workspaceResponse);
				
				if (!workspaceData.success) {
					throw new Error(workspaceData.error || 'Failed to fetch workspace');
				}
				
				const workspace = workspaceData.data;
				console.log('Workspace:', workspace);

				const parentAgentId = workspace.parent_agent;
				console.log('Parent agent ID:', parentAgentId);

				if (!parentAgentId) {
					console.error('No parent agent found for this workspace');
					set({ agents: [], updateStatus: 'No parent agent found for this workspace' });
					setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
					return [];
				}

				// Fetch parent agent
				const parentAgentResponse = await fetch(`/api/agents/${parentAgentId}?expand=actions,model`, {
					method: 'GET',
					credentials: 'include'
				});
				
				const parentAgentData = await handleResponse<{ success: boolean; data: AIAgent; error?: string }>(parentAgentResponse);
				
				if (!parentAgentData.success) {
					throw new Error(parentAgentData.error || 'Failed to fetch parent agent');
				}
				
				const parentAgent = parentAgentData.data;
				console.log('Parent agent:', parentAgent);

				let allAgents = [parentAgent];

				if (parentAgent.child_agents && parentAgent.child_agents.length > 0) {
					// Fetch child agents
					const childAgentsResponse = await fetch(`/api/agents/list?filter=${encodeURIComponent(
						parentAgent.child_agents.map((id) => `id = "${id}"`).join(' || ')
					)}&expand=actions,model`, {
						method: 'GET',
						credentials: 'include'
					});
					
					const childAgentsData = await handleResponse<{ success: boolean; data: AIAgent[]; error?: string }>(childAgentsResponse);
					
					if (!childAgentsData.success) {
						throw new Error(childAgentsData.error || 'Failed to fetch child agents');
					}
					
					console.log('Child agents response:', childAgentsData.data);

					allAgents = [...allAgents, ...childAgentsData.data];
				}

				const parsedAgents = allAgents.map((agent) => ({
					...agent,
					position: typeof agent.position === 'string' ? JSON.parse(agent.position) : agent.position
				}));

				console.log('Parsed agents:', parsedAgents);

				set({ agents: parsedAgents, updateStatus: 'Agents loaded successfully' });
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return parsedAgents;
			} catch (error) {
				console.error('Error loading agents:', error);
				set({ agents: [], updateStatus: 'Failed to load agents' });
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return [];
			}
		},
		addAgent: (agent: AIAgent) =>
			update((state) => ({
				...state,
				agents: [...state.agents, agent],
				updateStatus: 'Agent added successfully'
			})),
		updateAgent: (id: string, changes: Partial<AIAgent>) => {
			const formattedChanges: Partial<AIAgent> = { ...changes };
			if (formattedChanges.position && typeof formattedChanges.position !== 'string') {
				formattedChanges.position = JSON.stringify(formattedChanges.position);
			}

			update((state) => ({
				...state,
				agents: state.agents.map((n) => (n.id === id ? { ...n, ...formattedChanges } : n)),
				updateStatus: 'Updating agent...'
			}));

			debouncedUpdateAgent(id, formattedChanges).catch((error) => {
				console.error('Error in debouncedUpdateAgent:', error);
				update((state) => ({ ...state, updateStatus: 'Failed to update agent' }));
			});
		},
		removeAgent: (id: string) =>
			update((state) => ({
				...state,
				agents: state.agents.filter((n) => n.id !== id),
				updateStatus: 'Agent removed successfully'
			})),
		reset: () => set({ agents: [], updateStatus: '' })
	};
}

export const agentStore = createAgentStore();
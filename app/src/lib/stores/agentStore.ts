import { writable } from 'svelte/store';
import type { AIAgent } from '$lib/types/types';
import { debounce } from 'lodash-es';
import { browser } from '$app/environment';

interface ApiResponse<T> {
	success: boolean;
	data: T;
	error?: string;
	totalItems?: number;
	totalPages?: number;
}

interface AgentStoreState {
	agents: AIAgent[];
	updateStatus: string;
	isLoading: boolean;
}


async function handleResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
		throw new Error(errorData.error || `API request failed with status ${response.status}`);
	}
	
	const result: ApiResponse<T> = await response.json();
	if (!result.success) {
		throw new Error(result.error || 'API request failed');
	}
	
	return result.data;
}
function createAgentStore() {
	const initialAgents = browser ? JSON.parse(localStorage.getItem('userAgents') || '[]') : [];

	const { subscribe, set, update } = writable<AgentStoreState>({
		agents: initialAgents,
		updateStatus: '',
		isLoading: false
	});

	if (browser) {
		subscribe((state) => {
			localStorage.setItem('userAgents', JSON.stringify(state.agents));
		});
	}

const debouncedUpdateAgent: (id: string, changes: Partial<AIAgent>) => void = debounce(async (id: string, changes: Partial<AIAgent>) => {
	try {
		const response = await fetch(`/api/agents/${id}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			credentials: 'include',
			body: JSON.stringify(changes)
		});

		const result = await handleResponse<AIAgent>(response);
		
		update((state) => ({
			...state,
			agents: state.agents.map((agent) => 
				agent.id === id ? { ...agent, ...result } : agent
			),
			updateStatus: 'Agent updated successfully'
		}));
		setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
	} catch (error) {
		console.error('Failed to update agent:', error);
		update((state) => ({ ...state, updateStatus: 'Failed to update agent' }));
		setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
	}
}, 300);

	return {
		subscribe,
		
		loadAgents: async (userId?: string): Promise<AIAgent[]> => {
			update((state) => ({ ...state, isLoading: true }));
			
			try {
				console.log('Loading agents for user:', userId);
				const response = await fetch('/api/agents', {
					method: 'GET',
					credentials: 'include'
				});
				
				const agents = await handleResponse<AIAgent[]>(response);
				console.log('Loaded agents:', agents);

				// Parse position strings to objects if needed
				const parsedAgents = agents.map((agent) => ({
					...agent,
					position: typeof agent.position === 'string' 
						? JSON.parse(agent.position) 
						: agent.position
				}));

				set({ 
					agents: parsedAgents, 
					updateStatus: 'Agents loaded successfully',
					isLoading: false
				});
				
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return parsedAgents;
				
			} catch (error) {
				console.error('Error loading agents:', error);
				set({ 
					agents: [], 
					updateStatus: 'Failed to load agents',
					isLoading: false
				});
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return [];
			}
		},
		createAgent: async (agentData: Partial<AIAgent> | FormData): Promise<AIAgent | null> => {
			try {
				const isFormData = agentData instanceof FormData;
				
				const response = await fetch('/api/agents', {
					method: 'POST',
					credentials: 'include',
					headers: isFormData ? {} : {
						'Content-Type': 'application/json',
					},
					body: isFormData ? agentData : JSON.stringify(agentData)
				});

				const result = await handleResponse<AIAgent>(response);
				
				update((state) => ({
					...state,
					agents: [...state.agents, result],
					updateStatus: 'Agent created successfully'
				}));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return result;
			} catch (error) {
				console.error('Error creating agent:', error);
				update((state) => ({ ...state, updateStatus: 'Failed to create agent' }));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}
		},
		updateAgent: (id: string, changes: Partial<AIAgent>) => {
			const formattedChanges: Partial<AIAgent> = { ...changes };
			if (formattedChanges.position && typeof formattedChanges.position !== 'string') {
				formattedChanges.position = JSON.stringify(formattedChanges.position);
			}

			update((state) => ({
				...state,
				agents: state.agents.map((agent) => 
					agent.id === id ? { ...agent, ...formattedChanges } : agent
				),
				updateStatus: 'Updating agent...'
			}));

			debouncedUpdateAgent(id, formattedChanges);
		},

		updateAgentAPI: async (id: string, agentData: Partial<AIAgent> | FormData): Promise<AIAgent | null> => {
			try {
				const isFormData = agentData instanceof FormData;
				
				const response = await fetch(`/api/agents/${id}`, {
					method: 'PUT',
					credentials: 'include',
					...(isFormData ? {} : {
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify(agentData)
					}),
					...(isFormData ? { body: agentData } : {})
				});

				const result = await handleResponse<AIAgent>(response);
				
				if (result.success) {
					update((state) => ({
						...state,
						agents: state.agents.map((agent) => 
							agent.id === id ? { ...agent, ...result.data } : agent
						),
						updateStatus: 'Agent updated successfully'
					}));
					setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
					return result.data;
				}
				
				throw new Error(result.error || 'Failed to update agent');
			} catch (error) {
				console.error('Error updating agent:', error);
				update((state) => ({ ...state, updateStatus: 'Failed to update agent' }));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}
		},

		deleteAgent: async (id: string): Promise<boolean> => {
			try {
				const response = await fetch(`/api/agents/${id}`, {
					method: 'DELETE',
					credentials: 'include'
				});

        		const result = await handleResponse<{ success: boolean; error?: string }>(response);
				
				if (result.success) {
					update((state) => ({
						...state,
						agents: state.agents.filter((agent) => agent.id !== id),
						updateStatus: 'Agent deleted successfully'
					}));
					setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
					return true;
				}
				
				throw new Error(result.error || 'Failed to delete agent');
			} catch (error) {
				console.error('Error deleting agent:', error);
				update((state) => ({ ...state, updateStatus: 'Failed to delete agent' }));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return false;
			}
		},

		addAgent: (agent: AIAgent) =>
			update((state) => ({
				...state,
				agents: [...state.agents, agent],
				updateStatus: 'Agent added successfully'
			})),

		removeAgent: (id: string) =>
			update((state) => ({
				...state,
				agents: state.agents.filter((agent) => agent.id !== id),
				updateStatus: 'Agent removed successfully'
			})),

		reset: () => set({ agents: [], updateStatus: '', isLoading: false })
	};
}

export const agentStore = createAgentStore();
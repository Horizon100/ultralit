import { writable } from 'svelte/store';
import type { AIAgent } from '$lib/types/types';
import { debounce } from 'lodash-es';
import { browser } from '$app/environment';
import { clientTryCatch, isSuccess } from '$lib/utils/errorUtils';

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
	console.log('Raw API response:', result); // Debug log

	if (!result.success) {
		throw new Error(result.error || 'API request failed');
	}

	if (result.data === undefined || result.data === null) {
		console.error('API returned undefined/null data:', result);
		throw new Error('API returned no data');
	}

	console.log('Extracted data:', result.data); // Debug log
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

	const debouncedUpdateAgent: (id: string, changes: Partial<AIAgent>) => void = debounce(
		async (id: string, changes: Partial<AIAgent>) => {
			const result = await clientTryCatch(
				(async () => {
					const response = await fetch(`/api/agents/${id}`, {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json'
						},
						credentials: 'include',
						body: JSON.stringify(changes)
					});
					return await handleResponse<AIAgent>(response);
				})(),
				'Failed to update agent'
			);

			if (isSuccess(result)) {
				update((state) => ({
					...state,
					agents: state.agents.map((agent) =>
						agent.id === id ? { ...agent, ...result.data } : agent
					),
					updateStatus: 'Agent updated successfully'
				}));
			} else {
				console.error(result.error);
				update((state) => ({ ...state, updateStatus: result.error ?? 'Failed to update agent' }));
			}

			setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
		},
		300
	);

	return {
		subscribe,

		loadAgents: async (userId?: string): Promise<AIAgent[]> => {
			update((state) => ({ ...state, isLoading: true }));

			const result = await clientTryCatch(
				(async () => {
					console.log('Loading agents for user:', userId);
					const response = await fetch('/api/agents', {
						method: 'GET',
						credentials: 'include'
					});

					// Debug: Let's see the raw response
					const responseText = await response.text();
					console.log('Raw response text:', responseText);

					let responseData;
					try {
						responseData = JSON.parse(responseText);
						console.log('Parsed response data:', responseData);
						console.log('Response data type:', typeof responseData);
						console.log('Response data keys:', Object.keys(responseData));

						if (responseData.data) {
							console.log('Data field exists:', responseData.data);
							console.log('Data field type:', typeof responseData.data);
							console.log('Is data an array?', Array.isArray(responseData.data));
						} else {
							console.log('No data field found in response');
						}
					} catch (e) {
						console.error('Failed to parse JSON:', e);
						throw new Error('Invalid JSON response');
					}

					if (!response.ok) {
						throw new Error(
							responseData.error || `API request failed with status ${response.status}`
						);
					}

					if (!responseData.success) {
						throw new Error(responseData.error || 'API request failed');
					}

					const agents = responseData.data;
					console.log('Final agents data:', agents);

					// Check if agents is actually an array before mapping
					if (!Array.isArray(agents)) {
						console.error('Expected agents to be an array, got:', typeof agents, agents);
						throw new Error('Invalid response format: expected array of agents');
					}

					// Parse position strings to objects if needed
					const parsedAgents = agents.map((agent) => ({
						...agent,
						position:
							typeof agent.position === 'string' ? JSON.parse(agent.position) : agent.position
					}));

					return parsedAgents;
				})(),
				'Error loading agents'
			);

			if (isSuccess(result)) {
				set({
					agents: result.data,
					updateStatus: 'Agents loaded successfully',
					isLoading: false
				});
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return result.data;
			} else {
				console.error(result.error);
				set({
					agents: [],
					updateStatus: result.error ?? 'Failed to load agents',
					isLoading: false
				});
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return [];
			}
		},
		createAgent: async (agentData: Partial<AIAgent> | FormData): Promise<AIAgent | null> => {
			const result = await clientTryCatch(
				(async () => {
					const isFormData = agentData instanceof FormData;

					const response = await fetch('/api/agents', {
						method: 'POST',
						credentials: 'include',
						headers: isFormData
							? {}
							: {
									'Content-Type': 'application/json'
								},
						body: isFormData ? agentData : JSON.stringify(agentData)
					});

					return await handleResponse<AIAgent>(response);
				})(),
				'Error creating agent'
			);

			if (isSuccess(result)) {
				update((state) => ({
					...state,
					agents: [...state.agents, result.data],
					updateStatus: 'Agent created successfully'
				}));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return result.data;
			} else {
				console.error(result.error);
				update((state) => ({ ...state, updateStatus: result.error ?? 'Failed to create agent' }));
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

		updateAgentAPI: async (
			id: string,
			agentData: Partial<AIAgent> | FormData
		): Promise<AIAgent | null> => {
			const result = await clientTryCatch(
				(async () => {
					const isFormData = agentData instanceof FormData;

					const response = await fetch(`/api/agents/${id}`, {
						method: 'PUT',
						credentials: 'include',
						...(isFormData
							? {}
							: {
									headers: {
										'Content-Type': 'application/json'
									},
									body: JSON.stringify(agentData)
								}),
						...(isFormData ? { body: agentData } : {})
					});

					return await handleResponse<AIAgent>(response);
				})(),
				'Error updating agent'
			);

			if (isSuccess(result)) {
				update((state) => ({
					...state,
					agents: state.agents.map((agent) =>
						agent.id === id ? { ...agent, ...result.data } : agent
					),
					updateStatus: 'Agent updated successfully'
				}));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return result.data;
			} else {
				console.error(result.error);
				update((state) => ({ ...state, updateStatus: result.error ?? 'Failed to update agent' }));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return null;
			}
		},

		deleteAgent: async (id: string): Promise<boolean> => {
			const result = await clientTryCatch(
				(async () => {
					const response = await fetch(`/api/agents/${id}`, {
						method: 'DELETE',
						credentials: 'include'
					});

					return await handleResponse<{ success: boolean; error?: string }>(response);
				})(),
				'Error deleting agent'
			);

			if (isSuccess(result)) {
				update((state) => ({
					...state,
					agents: state.agents.filter((agent) => agent.id !== id),
					updateStatus: 'Agent deleted successfully'
				}));
				setTimeout(() => update((state) => ({ ...state, updateStatus: '' })), 3000);
				return true;
			} else {
				console.error(result.error);
				update((state) => ({ ...state, updateStatus: result.error ?? 'Failed to delete agent' }));
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

import { debounce } from 'lodash-es';
import { currentUser } from '../pocketbase';
import { get } from 'svelte/store';
import type { AIAgent } from '../types/types';

// Helper function to handle fetch API responses
async function handleResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.message || `API request failed with status ${response.status}`);
	}
	return await response.json();
}

export async function createAgent(agentData: Partial<AIAgent> | FormData): Promise<AIAgent> {
	try {
		const user = get(currentUser);
		if (!user) {
			throw new Error('User not logged in');
		}

		let finalAgentData: Record<string, unknown>;

		if (agentData instanceof FormData) {
			// Use FormData directly for file uploads
			const formData = agentData;
			// Add the user data
			formData.append('user_id', user.id);
			formData.append('owner', user.id);

			if (!formData.has('editors')) {
				formData.append('editors', JSON.stringify([user.id]));
			}

			if (!formData.has('viewers')) {
				formData.append('viewers', JSON.stringify([user.id]));
			}

			if (!formData.has('position')) {
				formData.append('position', JSON.stringify({ x: 0, y: 0 }));
			}

			if (!formData.has('status')) {
				formData.append('status', 'inactive');
			}

			// Ensure role and user_input are lowercase
			if (formData.has('role')) {
				const role = formData.get('role') as string;
				formData.set('role', role.toLowerCase());
			}

			if (formData.has('user_input')) {
				const userInput = formData.get('user_input') as string;
				formData.set('user_input', userInput.toLowerCase());
			}

			console.log('Sending FormData to server');

			const response = await fetch('/api/agents', {
				method: 'POST',
				body: formData,
				credentials: 'include'
			});

			const data = await handleResponse<{ success: boolean; data: AIAgent; error?: string }>(
				response
			);

			if (!data.success) {
				throw new Error(data.error || 'Failed to create agent');
			}

			console.log('Created agent:', data.data);

			return {
				...data.data,
				position:
					typeof data.data.position === 'string'
						? JSON.parse(data.data.position)
						: data.data.position
			};
		} else {
			finalAgentData = { ...agentData };

			// Set owner and other common fields
			finalAgentData.user_id = user.id;
			finalAgentData.owner = user.id;
			finalAgentData.editors = finalAgentData.editors || [user.id];
			finalAgentData.viewers = finalAgentData.viewers || [user.id];
			finalAgentData.position = finalAgentData.position || { x: 0, y: 0 };
			finalAgentData.status = finalAgentData.status || 'inactive';

			// Handle actions
			if (Array.isArray(finalAgentData.actions)) {
				finalAgentData.actions = finalAgentData.actions.map((action) =>
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

			const response = await fetch('/api/agents', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify(finalAgentData)
			});

			const data = await handleResponse<{ success: boolean; data: AIAgent; error?: string }>(
				response
			);

			if (!data.success) {
				throw new Error(data.error || 'Failed to create agent');
			}

			console.log('Created agent:', data.data);

			return {
				...data.data,
				position:
					typeof data.data.position === 'string'
						? JSON.parse(data.data.position)
						: data.data.position
			};
		}
	} catch (error) {
		console.error('Error creating agent:', error);
		throw error;
	}
}

export const updateAgentDebounced = debounce(
	async (id: string, agentData: Partial<AIAgent> | FormData): Promise<AIAgent> => {
		try {
			if (agentData instanceof FormData) {
				// Use FormData directly for file uploads
				const formData = agentData;

				console.log('Sending FormData to server for update');

				const response = await fetch(`/api/agents/${id}`, {
					method: 'PATCH',
					body: formData,
					credentials: 'include'
				});

				const data = await handleResponse<{ success: boolean; data: AIAgent; error?: string }>(
					response
				);

				if (!data.success) {
					throw new Error(data.error || 'Failed to update agent');
				}

				console.log('Updated agent:', data.data);

				if (!data.data) {
					throw new Error('Failed to update agent: No agent returned');
				}

				return {
					...data.data,
					position:
						typeof data.data.position === 'string'
							? JSON.parse(data.data.position)
							: data.data.position
				};
			} else {
				// Handle JSON data
				const finalAgentData = { ...agentData };

				console.log('Sending data to server for update:', finalAgentData);

				const response = await fetch(`/api/agents/${id}`, {
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json'
					},
					credentials: 'include',
					body: JSON.stringify(finalAgentData)
				});

				const data = await handleResponse<{ success: boolean; data: AIAgent; error?: string }>(
					response
				);

				if (!data.success) {
					throw new Error(data.error || 'Failed to update agent');
				}

				console.log('Updated agent:', data.data);

				if (!data.data) {
					throw new Error('Failed to update agent: No agent returned');
				}

				return {
					...data.data,
					position:
						typeof data.data.position === 'string'
							? JSON.parse(data.data.position)
							: data.data.position
				};
			}
		} catch (error) {
			console.error('Error updating agent:', error);
			throw error;
		}
	},
	300,
	{ leading: true, trailing: true }
);

// Function to update agent (calls debounced function)
export async function updateAgent(
	id: string,
	agentData: Partial<AIAgent> | FormData
): Promise<AIAgent> {
	return updateAgentDebounced(id, agentData);
}

export async function getAgentById(id: string): Promise<AIAgent> {
	try {
		const response = await fetch(`/api/agents/${id}`, {
			method: 'GET',
			credentials: 'include'
		});

		const data = await handleResponse<{ success: boolean; data: AIAgent; error?: string }>(
			response
		);

		if (!data.success) {
			throw new Error(data.error || 'Failed to fetch agent');
		}

		console.log('Fetched agent:', data.data);

		return {
			...data.data,
			position:
				typeof data.data.position === 'string' ? JSON.parse(data.data.position) : data.data.position
		};
	} catch (error) {
		console.error('Error fetching agent:', error);
		throw error;
	}
}

export async function deleteAgent(id: string): Promise<boolean> {
	try {
		const response = await fetch(`/api/agents/${id}`, {
			method: 'DELETE',
			credentials: 'include'
		});

		const data = await handleResponse<{ success: boolean; error?: string }>(response);

		if (!data.success) {
			throw new Error(data.error || 'Failed to delete agent');
		}

		console.log('Agent deleted successfully');
		return true;
	} catch (error) {
		console.error('Error deleting agent:', error);
		throw error;
	}
}

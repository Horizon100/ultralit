import { get } from 'svelte/store';
import { currentUser } from '$lib/pocketbase';
import { fetchTryCatch, validationTryCatch, isFailure, type Result } from '$lib/utils/errorUtils';
import type { AIAgent, RoleType } from '$lib/types/types';
import { debounce } from 'lodash-es';

export async function createAgent(
	agentData: Partial<AIAgent> | FormData
): Promise<Result<AIAgent, string>> {
	// Validate user authentication
	const userValidation = validationTryCatch(() => {
		const user = get(currentUser);
		if (!user) {
			throw new Error('User not logged in');
		}
		return user;
	}, 'user authentication');

	if (isFailure(userValidation)) {
		return { data: null, error: userValidation.error, success: false };
	}

	const user = userValidation.data;

	if (agentData instanceof FormData) {
		// Handle FormData for file uploads
		const formData = agentData;

		// Add user data
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

		// Ensure role and user_input are lowercase with type validation
if (formData.has('role')) {
	const role = formData.get('role') as string;
	const lowerRole = role.toLowerCase();
	// Validate that it's a valid RoleType before setting
	if (['system', 'human', 'user', 'assistant', 'proxy', 'hub', 'moderator', 'thinking'].includes(lowerRole)) {
		formData.set('role', lowerRole);
	}
}


		if (formData.has('user_input')) {
			const userInput = formData.get('user_input') as string;
			const lowerUserInput = userInput.toLowerCase();
			// Validate that it's a valid user_input type before setting
			if (['end', 'never', 'always'].includes(lowerUserInput)) {
				formData.set('user_input', lowerUserInput);
			}
		}

		console.log('Sending FormData to server');

		const result = await fetchTryCatch<{ success: boolean; data: AIAgent; error?: string }>(
			'/api/agents',
			{
				method: 'POST',
				body: formData,
				credentials: 'include'
			}
		);

		if (isFailure(result)) {
			return { data: null, error: result.error, success: false };
		}

		if (!result.data.success) {
			return { data: null, error: result.data.error || 'Failed to create agent', success: false };
		}

		console.log('Created agent:', result.data.data);

		// Parse position if it's a string
		const agent = {
			...result.data.data,
			position:
				typeof result.data.data.position === 'string'
					? JSON.parse(result.data.data.position)
					: result.data.data.position
		};

		return { data: agent, error: null, success: true };
	} else {
		// Handle JSON data
		const finalAgentData = { ...agentData };

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
				typeof action === 'string' ? action : (action as { id: string }).id
			);
		}

		// Ensure role and user_input are lowercase with proper type casting
if (finalAgentData.role) {
	const lowerRole = (finalAgentData.role as string).toLowerCase();
	// Type-safe assignment with validation
	if (['system', 'human', 'user', 'assistant', 'proxy', 'hub', 'moderator', 'thinking'].includes(lowerRole)) {
		finalAgentData.role = lowerRole as RoleType;
	}
}

		if (finalAgentData.user_input) {
			const lowerUserInput = (finalAgentData.user_input as string).toLowerCase();
			// Type-safe assignment with validation
			if (['end', 'never', 'always'].includes(lowerUserInput)) {
				finalAgentData.user_input = lowerUserInput as 'end' | 'never' | 'always';
			}
		}

		console.log('Sending data to server:', finalAgentData);

		const result = await fetchTryCatch<{ success: boolean; data: AIAgent; error?: string }>(
			'/api/agents',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify(finalAgentData)
			}
		);

		if (isFailure(result)) {
			return { data: null, error: result.error, success: false };
		}

		if (!result.data.success) {
			return { data: null, error: result.data.error || 'Failed to create agent', success: false };
		}

		console.log('Created agent:', result.data.data);

		// Parse position if it's a string
		const agent = {
			...result.data.data,
			position:
				typeof result.data.data.position === 'string'
					? JSON.parse(result.data.data.position)
					: result.data.data.position
		};

		return { data: agent, error: null, success: true };
	}
}

export const updateAgentDebounced = debounce(
	async (id: string, agentData: Partial<AIAgent> | FormData): Promise<Result<AIAgent, string>> => {
		if (agentData instanceof FormData) {
			// Use FormData directly for file uploads
			console.log('Sending FormData to server for update');

			const result = await fetchTryCatch<{ success: boolean; data: AIAgent; error?: string }>(
				`/api/agents/${id}`,
				{
					method: 'PATCH',
					body: agentData,
					credentials: 'include'
				}
			);

			if (isFailure(result)) {
				return { data: null, error: result.error, success: false };
			}

			if (!result.data.success) {
				return { data: null, error: result.data.error || 'Failed to update agent', success: false };
			}

			if (!result.data.data) {
				return { data: null, error: 'Failed to update agent: No agent returned', success: false };
			}

			console.log('Updated agent:', result.data.data);

			const agent = {
				...result.data.data,
				position:
					typeof result.data.data.position === 'string'
						? JSON.parse(result.data.data.position)
						: result.data.data.position
			};

			return { data: agent, error: null, success: true };
		} else {
			// Handle JSON data
			const finalAgentData = { ...agentData };

			console.log('Sending data to server for update:', finalAgentData);

			const result = await fetchTryCatch<{ success: boolean; data: AIAgent; error?: string }>(
				`/api/agents/${id}`,
				{
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json'
					},
					credentials: 'include',
					body: JSON.stringify(finalAgentData)
				}
			);

			if (isFailure(result)) {
				return { data: null, error: result.error, success: false };
			}

			if (!result.data.success) {
				return { data: null, error: result.data.error || 'Failed to update agent', success: false };
			}

			if (!result.data.data) {
				return { data: null, error: 'Failed to update agent: No agent returned', success: false };
			}

			console.log('Updated agent:', result.data.data);

			const agent = {
				...result.data.data,
				position:
					typeof result.data.data.position === 'string'
						? JSON.parse(result.data.data.position)
						: result.data.data.position
			};

			return { data: agent, error: null, success: true };
		}
	},
	300,
	{ leading: true, trailing: true }
);

// Function to update agent (calls debounced function)
export async function updateAgent(
	id: string,
	agentData: Partial<AIAgent> | FormData
): Promise<Result<AIAgent, string>> {
	return updateAgentDebounced(id, agentData);
}

export async function getAgentById(id: string): Promise<Result<AIAgent, string>> {
	const result = await fetchTryCatch<{ success: boolean; data: AIAgent; error?: string }>(
		`/api/agents/${id}`,
		{
			method: 'GET',
			credentials: 'include'
		}
	);

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to fetch agent', success: false };
	}

	console.log('Fetched agent:', result.data.data);

	const agent = {
		...result.data.data,
		position:
			typeof result.data.data.position === 'string'
				? JSON.parse(result.data.data.position)
				: result.data.data.position
	};

	return { data: agent, error: null, success: true };
}

export async function deleteAgent(id: string): Promise<Result<boolean, string>> {
	const result = await fetchTryCatch<{ success: boolean; error?: string }>(`/api/agents/${id}`, {
		method: 'DELETE',
		credentials: 'include'
	});

	if (isFailure(result)) {
		return { data: null, error: result.error, success: false };
	}

	if (!result.data.success) {
		return { data: null, error: result.data.error || 'Failed to delete agent', success: false };
	}

	console.log('Agent deleted successfully');
	return { data: true, error: null, success: true };
}

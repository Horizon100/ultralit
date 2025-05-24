import type { Actions } from '$lib/types/types';

export async function fetchActions(): Promise<Actions[]> {
	try {
		const response = await fetch('/api/actions', {
			method: 'GET',
			credentials: 'include'
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.actions;
	} catch (error) {
		console.error('Error fetching actions:', error);
		throw error;
	}
}
export async function createAction(actionData: Partial<Actions>): Promise<Actions> {
	try {
		const response = await fetch('/api/actions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify(actionData)
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.action;
	} catch (error) {
		console.error('Error creating action:', error);
		throw error;
	}
}

export async function updateAction(id: string, actionData: Partial<Actions>): Promise<Actions> {
	try {
		const response = await fetch('/api/actions', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({ id, ...actionData })
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return data.action;
	} catch (error) {
		console.error('Error updating action:', error);
		throw error;
	}
}

export async function deleteAction(id: string): Promise<boolean> {
	try {
		const response = await fetch(`/api/actions?id=${id}`, {
			method: 'DELETE',
			credentials: 'include'
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		if (!data.success) throw new Error(data.error);

		return true;
	} catch (error) {
		console.error('Error deleting action:', error);
		throw error;
	}
}

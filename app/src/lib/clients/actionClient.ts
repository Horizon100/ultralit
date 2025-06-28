import type { Actions } from '$lib/types/types';
import { fetchTryCatch, type Result } from '$lib/utils/errorUtils';

export async function fetchActions(): Promise<Result<Actions[], string>> {
	return fetchTryCatch<{ success: boolean; actions: Actions[]; error?: string }>('/api/actions', {
		method: 'GET',
		credentials: 'include'
	}).then((result) => {
		if (result.success) {
			if (!result.data.success) {
				return {
					data: null,
					error: result.data.error || 'Failed to fetch actions',
					success: false
				};
			}
			return { data: result.data.actions, error: null, success: true };
		}
		return { data: null, error: result.error, success: false };
	});
}

export async function createAction(actionData: Partial<Actions>): Promise<Result<Actions, string>> {
	return fetchTryCatch<{ success: boolean; action: Actions; error?: string }>('/api/actions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		credentials: 'include',
		body: JSON.stringify(actionData)
	}).then((result) => {
		if (result.success) {
			if (!result.data.success) {
				return {
					data: null,
					error: result.data.error || 'Failed to create action',
					success: false
				};
			}
			return { data: result.data.action, error: null, success: true };
		}
		return { data: null, error: result.error, success: false };
	});
}

export async function updateAction(
	id: string,
	actionData: Partial<Actions>
): Promise<Result<Actions, string>> {
	return fetchTryCatch<{ success: boolean; action: Actions; error?: string }>('/api/actions', {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json'
		},
		credentials: 'include',
		body: JSON.stringify({ id, ...actionData })
	}).then((result) => {
		if (result.success) {
			if (!result.data.success) {
				return {
					data: null,
					error: result.data.error || 'Failed to update action',
					success: false
				};
			}
			return { data: result.data.action, error: null, success: true };
		}
		return { data: null, error: result.error, success: false };
	});
}

export async function deleteAction(id: string): Promise<Result<boolean, string>> {
	return fetchTryCatch<{ success: boolean; error?: string }>(`/api/actions?id=${id}`, {
		method: 'DELETE',
		credentials: 'include'
	}).then((result) => {
		if (result.success) {
			if (!result.data.success) {
				return {
					data: null,
					error: result.data.error || 'Failed to delete action',
					success: false
				};
			}
			return { data: true, error: null, success: true };
		}
		return { data: null, error: result.error, success: false };
	});
}

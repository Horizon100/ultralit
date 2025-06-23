// src/lib/services/fileService.ts
import { addNotification, updateNotification } from '$lib/stores/ideNotificationStore';
import type { CodeFiles } from '$lib/types/types.ide';
import { clientTryCatch, isFailure } from '$lib/utils/errorUtils';

/**
 * Saves file content to the server
 * @param file The file to save
 * @param content The content to save
 * @returns Promise resolving to the updated file
 */
export async function saveFile(file: CodeFiles, content: string): Promise<CodeFiles> {
	// Show saving notification
	const notificationId = addNotification(`Saving ${file.name}...`, 'loading');

	const contentArray = Array.isArray(content) ? content : [content];

	const result = await clientTryCatch(
		fetch(`/api/files/${file.id}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				content: contentArray
			})
		}).then(async (response) => {
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to save file');
			}
			return response.json();
		})
	);

	if (result.success) {
		updateNotification(notificationId, {
			message: `${file.name} saved successfully`,
			type: 'success'
		});
	} else {
		updateNotification(notificationId, {
			message: `Error saving ${file.name}: ${String(result.error || 'Unknown error')}`,
			type: 'error',
			autoClose: false // Keep error notifications visible
		});
	}

	if (isFailure(result)) {
		throw result.error;
	}

	return result.data as CodeFiles;
}

/**
 * Creates a new file on the server
 */
export async function createNewFile(
	repositoryId: string,
	branch: string,
	fileName: string,
	content: string[] = ['// New file'],
	path: string = '/'
): Promise<CodeFiles> {
	const notificationId = addNotification(`Creating ${fileName}...`, 'loading');

	const result = await clientTryCatch(
		fetch('/api/files', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: fileName,
				content,
				path,
				repository: repositoryId,
				branch
			})
		}).then(async (response) => {
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to create file');
			}
			return response.json();
		})
	);

	if (result.success) {
		updateNotification(notificationId, {
			message: `${fileName} created successfully`,
			type: 'success'
		});
	} else {
		updateNotification(notificationId, {
			message: `Error creating ${fileName}: ${String(result.error || 'Unknown error')}`,
			type: 'error',
			autoClose: false
		});
	}

	if (isFailure(result)) {
		throw result.error;
	}

	return result.data as CodeFiles;
}

import type { Folders, Notes, Attachment } from '$lib/types/types';
import { fetchTryCatch, fileTryCatch, isSuccess, isFailure } from '$lib/utils/errorUtils';

type ApiResponse<T> = {
	success: boolean;
	error?: string;
} & T;

export const notesClient = {
	async getFolders(): Promise<Folders[]> {
		const result = await fetchTryCatch<ApiResponse<{ folders: Folders[] }>>('/api/notes/folders', {
			method: 'GET',
			credentials: 'include'
		});

		if (isFailure(result)) {
			console.error('Error fetching folders:', result.error);
			throw new Error(result.error);
		}

		if (!result.data.success) {
			throw new Error(result.data.error || 'Failed to fetch folders');
		}

		return result.data.folders;
	},

	async createFolder(folderData: Partial<Folders>): Promise<Folders> {
		const result = await fetchTryCatch<ApiResponse<{ folder: Folders }>>('/api/notes/folders', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify(folderData)
		});

		if (isFailure(result)) {
			console.error('Error creating folder:', result.error);
			throw new Error(result.error);
		}

		if (!result.data.success) {
			throw new Error(result.data.error || 'Failed to create folder');
		}

		return result.data.folder;
	},

	async updateFolder(id: string, folderData: Partial<Folders>): Promise<Folders> {
		const result = await fetchTryCatch<ApiResponse<{ folder: Folders }>>('/api/notes/folders', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({ id, ...folderData })
		});

		if (isFailure(result)) {
			console.error('Error updating folder:', result.error);
			throw new Error(result.error);
		}

		if (!result.data.success) {
			throw new Error(result.data.error || 'Failed to update folder');
		}

		return result.data.folder;
	},

	async deleteFolder(id: string): Promise<boolean> {
		const result = await fetchTryCatch<ApiResponse<Record<string, never>>>(
			`/api/notes/folders?id=${id}`,
			{
				method: 'DELETE',
				credentials: 'include'
			}
		);

		if (isFailure(result)) {
			console.error('Error deleting folder:', result.error);
			throw new Error(result.error);
		}

		if (!result.data.success) {
			throw new Error(result.data.error || 'Failed to delete folder');
		}

		return true;
	},

	async getNotes(folderId: string): Promise<Notes[]> {
		const result = await fetchTryCatch<ApiResponse<{ notes: Notes[] }>>(
			`/api/notes?folderId=${folderId}`,
			{
				method: 'GET',
				credentials: 'include'
			}
		);

		if (isFailure(result)) {
			console.error('Error fetching notes:', result.error);
			throw new Error(result.error);
		}

		if (!result.data.success) {
			throw new Error(result.data.error || 'Failed to fetch notes');
		}

		return result.data.notes;
	},

	async getNote(id: string): Promise<Notes> {
		const result = await fetchTryCatch<ApiResponse<{ note: Notes }>>(`/api/notes/${id}`, {
			method: 'GET',
			credentials: 'include'
		});

		if (isFailure(result)) {
			console.error('Error fetching note:', result.error);
			throw new Error(result.error);
		}

		if (!result.data.success) {
			throw new Error(result.data.error || 'Failed to fetch note');
		}

		return result.data.note;
	},

	async createNote(noteData: Partial<Notes>): Promise<Notes> {
		const result = await fetchTryCatch<ApiResponse<{ note: Notes }>>('/api/notes', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify(noteData)
		});

		if (isFailure(result)) {
			console.error('Error creating note:', result.error);
			throw new Error(result.error);
		}

		if (!result.data.success) {
			throw new Error(result.data.error || 'Failed to create note');
		}

		return result.data.note;
	},

	async updateNote(id: string, noteData: Partial<Notes>): Promise<Notes> {
		const result = await fetchTryCatch<ApiResponse<{ note: Notes }>>('/api/notes', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({ id, ...noteData })
		});

		if (isFailure(result)) {
			console.error('Error updating note:', result.error);
			throw new Error(result.error);
		}

		if (!result.data.success) {
			throw new Error(result.data.error || 'Failed to update note');
		}

		return result.data.note;
	},

	async deleteNote(id: string): Promise<boolean> {
		const result = await fetchTryCatch<ApiResponse<Record<string, never>>>(`/api/notes?id=${id}`, {
			method: 'DELETE',
			credentials: 'include'
		});

		if (isFailure(result)) {
			console.error('Error deleting note:', result.error);
			throw new Error(result.error);
		}

		if (!result.data.success) {
			throw new Error(result.data.error || 'Failed to delete note');
		}

		return true;
	},

	async searchNotes(searchTerm: string): Promise<Notes[]> {
		const result = await fetchTryCatch<ApiResponse<{ notes: Notes[] }>>(
			`/api/notes/search?q=${encodeURIComponent(searchTerm)}`,
			{
				method: 'GET',
				credentials: 'include'
			}
		);

		if (isFailure(result)) {
			console.error('Error searching notes:', result.error);
			throw new Error(result.error);
		}

		if (!result.data.success) {
			throw new Error(result.data.error || 'Failed to search notes');
		}

		return result.data.notes;
	},

	async uploadAttachment(noteId: string, file: File): Promise<Attachment> {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('noteId', noteId);

		console.log('Uploading attachment:', { noteId, fileName: file.name });

		const result = await fileTryCatch(
			fetchTryCatch<ApiResponse<{ attachment: Attachment }>>('/api/attachments', {
				method: 'POST',
				credentials: 'include',
				body: formData
			}).then((fetchResult) => {
				if (isFailure(fetchResult)) {
					throw new Error(fetchResult.error);
				}
				return fetchResult.data;
			}),
			file.name,
			10 // Assuming 10MB max file size
		);

		if (isFailure(result)) {
			console.error('Error in uploadAttachment:', result.error);
			throw new Error(result.error);
		}

		if (!result.data.success) {
			throw new Error(result.data.error || 'Failed to upload attachment');
		}

		console.log('Attachment created:', result.data.attachment);
		return result.data.attachment;
	},

	async getAttachments(noteId: string): Promise<Attachment[]> {
		const result = await fetchTryCatch<ApiResponse<{ attachments: Attachment[] }>>(
			`/api/attachments?noteId=${noteId}`,
			{
				method: 'GET',
				credentials: 'include'
			}
		);

		if (isFailure(result)) {
			console.error('Error fetching attachments:', result.error);
			throw new Error(result.error);
		}

		if (!result.data.success) {
			throw new Error(result.data.error || 'Failed to fetch attachments');
		}

		return result.data.attachments;
	}
};

import type { Folders, Notes, Attachment } from '$lib/types/types';

export const notesClient = {
	async getFolders(): Promise<Folders[]> {
		try {
			const response = await fetch('/api/notes/folders', {
				method: 'GET',
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (!data.success) throw new Error(data.error);

			return data.folders;
		} catch (error) {
			console.error('Error fetching folders:', error);
			throw error;
		}
	},

	async createFolder(folderData: Partial<Folders>): Promise<Folders> {
		try {
			const response = await fetch('/api/notes/folders', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify(folderData)
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (!data.success) throw new Error(data.error);

			return data.folder;
		} catch (error) {
			console.error('Error creating folder:', error);
			throw error;
		}
	},

	async updateFolder(id: string, folderData: Partial<Folders>): Promise<Folders> {
		try {
			const response = await fetch('/api/notes/folders', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ id, ...folderData })
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (!data.success) throw new Error(data.error);

			return data.folder;
		} catch (error) {
			console.error('Error updating folder:', error);
			throw error;
		}
	},

	async deleteFolder(id: string): Promise<boolean> {
		try {
			const response = await fetch(`/api/notes/folders?id=${id}`, {
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
			console.error('Error deleting folder:', error);
			throw error;
		}
	},

	async getNotes(folderId: string): Promise<Notes[]> {
		try {
			const response = await fetch(`/api/notes?folderId=${folderId}`, {
				method: 'GET',
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (!data.success) throw new Error(data.error);

			return data.notes;
		} catch (error) {
			console.error('Error fetching notes:', error);
			throw error;
		}
	},

	async getNote(id: string): Promise<Notes> {
		try {
			const response = await fetch(`/api/notes/${id}`, {
				method: 'GET',
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (!data.success) throw new Error(data.error);

			return data.note;
		} catch (error) {
			console.error('Error fetching note:', error);
			throw error;
		}
	},

	async createNote(noteData: Partial<Notes>): Promise<Notes> {
		try {
			const response = await fetch('/api/notes', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify(noteData)
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (!data.success) throw new Error(data.error);

			return data.note;
		} catch (error) {
			console.error('Error creating note:', error);
			throw error;
		}
	},

	async updateNote(id: string, noteData: Partial<Notes>): Promise<Notes> {
		try {
			const response = await fetch('/api/notes', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ id, ...noteData })
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (!data.success) throw new Error(data.error);

			return data.note;
		} catch (error) {
			console.error('Error updating note:', error);
			throw error;
		}
	},

	async deleteNote(id: string): Promise<boolean> {
		try {
			const response = await fetch(`/api/notes?id=${id}`, {
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
			console.error('Error deleting note:', error);
			throw error;
		}
	},

	async searchNotes(searchTerm: string): Promise<Notes[]> {
		try {
			const response = await fetch(`/api/notes/search?q=${encodeURIComponent(searchTerm)}`, {
				method: 'GET',
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (!data.success) throw new Error(data.error);

			return data.notes;
		} catch (error) {
			console.error('Error searching notes:', error);
			throw error;
		}
	},

	async uploadAttachment(noteId: string, file: File): Promise<Attachment> {
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('noteId', noteId);

			console.log('Uploading attachment:', { noteId, fileName: file.name });

			const response = await fetch('/api/attachments', {
				method: 'POST',
				credentials: 'include',
				body: formData
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (!data.success) throw new Error(data.error);

			console.log('Attachment created:', data.attachment);

			return data.attachment;
		} catch (error) {
			console.error('Error in uploadAttachment:', error);
			if (error instanceof Error) {
				console.error('Error details:', error.message);
			}
			throw error;
		}
	},

	async getAttachments(noteId: string): Promise<Attachment[]> {
		try {
			const response = await fetch(`/api/attachments?noteId=${noteId}`, {
				method: 'GET',
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (!data.success) throw new Error(data.error);

			return data.attachments;
		} catch (error) {
			console.error('Error fetching attachments:', error);
			throw error;
		}
	}
};

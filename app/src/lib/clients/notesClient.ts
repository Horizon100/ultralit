import { } from '../pocketbase';
import type { Folders, Notes, Attachment } from '$lib/types/types';

export const notesClient = {
	async getFolders(): Promise<Folders[]> {
		return await pb.collection('notes_folders').getFullList<Folders>();
	},

	async createFolder(folderData: Partial<Folders>): Promise<Folders> {
		return await pb.collection('notes_folders').create<Folders>(folderData);
	},

	async updateFolder(id: string, parentIdData: Partial<Folders>): Promise<Folders> {
		return await pb.collection('notes_folders').update<Folders>(id, parentIdData);
	},

	async deleteFolder(id: string): Promise<boolean> {
		await pb.collection('notes_folders').delete(id);
		return true;
	},

	async getNotes(folderId: string): Promise<Notes[]> {
		return await pb.collection('notes').getFullList<Notes>({
			filter: `folder="${folderId}"`,
			sort: '-created'
		});
	},

	async createNote(noteData: Partial<Notes>): Promise<Notes> {
		return await pb.collection('notes').create<Notes>(noteData);
	},

	async deleteNote(id: string): Promise<boolean> {
		await pb.collection('notes').delete(id);
		return true;
	},

	async searchNotes(searchTerm: string): Promise<Notes[]> {
		return await pb.collection('notes').getFullList<Notes>({
			filter: `title ~ "${searchTerm}" || content ~ "${searchTerm}"`,
			sort: '-created'
		});
	},

	async uploadAttachment(noteId: string, file: File): Promise<Attachment> {
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('note', noteId);

			console.log('Uploading attachment:', { noteId, fileName: file.name });

			const attachment = await pb.collection('attachments').create<Attachment>(formData);

			console.log('Attachment created:', attachment);

			// Fetch the current note
			const note = await this.getNote(noteId);

			console.log('Fetched note:', note);

			// Update the note with the new attachment
			const updatedAttachments = [...(note.attachments || []), attachment.id];
			const updatedNote = await this.updateNote(noteId, { attachments: updatedAttachments });

			console.log('Updated note:', updatedNote);

			return attachment;
		} catch (error) {
			console.error('Error in uploadAttachment:', error);
			if (error instanceof Error) {
				console.error('Error details:', error.message);
			}
			throw error;
		}
	},

	async getNote(id: string): Promise<Notes> {
		return await pb.collection('notes').getOne<Notes>(id);
	},

	async updateNote(id: string, noteData: Partial<Notes>): Promise<Notes> {
		return await pb.collection('notes').update<Notes>(id, noteData);
	},

	async getAttachments(noteId: string): Promise<Attachment[]> {
		return await pb.collection('attachments').getFullList<Attachment>({
			filter: `note="${noteId}"`,
			sort: 'created'
		});
	}
};

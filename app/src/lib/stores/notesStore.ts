import { writable, derived } from 'svelte/store';
import type { Folders, Notes } from '$lib/types';
import { notesClient } from '$lib/notesClient';

function createNotesStore() {
    const { subscribe, update } = writable<{
        folders: Folders[];
        notes: Record<string, Notes[]>;
        currentFolder: Folders | null;
        currentNote: Notes | null;
        openTabs: Notes[];
    }>({
        folders: [],
        notes: {},
        currentFolder: null,
        currentNote: null,
        openTabs: []
    });

    return {
        subscribe,
        initializeFolders: async () => {
            const folders = await notesClient.getFolders();
            update(store => ({ ...store, folders }));
        },
        addFolder: async (folderData: Partial<Folders>) => {
            const newFolder = await notesClient.createFolder(folderData);
            update(store => ({
                ...store,
                folders: [...store.folders, newFolder]
            }));
        },
        updateFolder: async (id: string, folderData: Partial<Folders>) => {
            const updatedFolder = await notesClient.updateFolder(id, folderData);
            update(store => ({
                ...store,
                folders: store.folders.map(f => f.id === id ? { ...f, ...updatedFolder } : f)
            }));
        },
        deleteFolder: async (id: string) => {
            await notesClient.deleteFolder(id);
            update(store => ({
                ...store,
                folders: store.folders.filter(f => f.id !== id),
                notes: Object.fromEntries(
                    Object.entries(store.notes).filter(([key]) => key !== id)
                )
            }));
        },
        loadNotes: async (folderId: string) => {
            const notes = await notesClient.getNotes(folderId);
            update(store => ({
                ...store,
                notes: { ...store.notes, [folderId]: notes }
            }));
        },
        loadAllNotes: async () => {
            const folders = await notesClient.getFolders();
            const allNotes: Record<string, Notes[]> = {};
            
            for (const folder of folders) {
                const notes = await notesClient.getNotes(folder.id);
                allNotes[folder.id] = notes;
            }
            
            const unassignedNotes = await notesClient.getNotes('');
            allNotes[''] = unassignedNotes;

            update(store => ({ ...store, notes: allNotes }));
        },
        addNote: async (noteData: Partial<Notes>) => {
            const newNote = await notesClient.createNote(noteData);
            update(store => ({
                ...store,
                notes: {
                    ...store.notes,
                    [newNote.folder]: [...(store.notes[newNote.folder] || []), newNote]
                },
                openTabs: [...store.openTabs, newNote],
                currentNote: newNote
            }));
        },
        updateNote: async (id: string, noteData: Partial<Notes>) => {
            const updatedNote = await notesClient.updateNote(id, noteData);
            update(store => ({
                ...store,
                notes: {
                    ...store.notes,
                    [updatedNote.folder]: (store.notes[updatedNote.folder] || [])
                        .map(n => n.id === id ? { ...n, ...updatedNote } : n)
                },
                openTabs: store.openTabs.map(n => n.id === id ? { ...n, ...updatedNote } : n),
                currentNote: store.currentNote?.id === id ? { ...store.currentNote, ...updatedNote } : store.currentNote
            }));
        },
        deleteNote: async (id: string, folderId: string) => {
            await notesClient.deleteNote(id);
            update(store => ({
                ...store,
                notes: {
                    ...store.notes,
                    [folderId]: (store.notes[folderId] || []).filter(n => n.id !== id)
                },
                openTabs: store.openTabs.filter(n => n.id !== id),
                currentNote: store.currentNote?.id === id ? null : store.currentNote
            }));
        },
        setCurrentFolder: (folder: Folders | null) => update(store => ({ ...store, currentFolder: folder })),
        setCurrentNote: (note: Notes | null) => update(store => ({ ...store, currentNote: note })),
        addOpenTab: (note: Notes) => {
            update(store => ({
                ...store,
                openTabs: store.openTabs.some(n => n.id === note.id) 
                    ? store.openTabs 
                    : [...store.openTabs, note]
            }));
        },
        removeOpenTab: (note: Notes) => {
            update(store => ({
                ...store,
                openTabs: store.openTabs.filter(n => n.id !== note.id)
            }));
        },
    };
}

export const notesStore = createNotesStore();

export const currentFolderNotes = derived(notesStore, $store => 
    $store.currentFolder ? $store.notes[$store.currentFolder.id] || [] : []
);


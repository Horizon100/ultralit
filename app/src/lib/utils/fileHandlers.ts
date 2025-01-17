// src/lib/fileHandlers.ts

import type { TextFile } from '$lib/types/types';


import { uploadedFiles } from '../stores/fileStore';

export async function handleFileUpload(files: File[], x: number, y: number) {
  try {
    console.log(`Attempting to upload ${files.length} file(s)`);
    
    const newUploadedFiles = files.map(file => {
      console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
      return { file, x, y };
    });

    uploadedFiles.update(files => [...files, ...newUploadedFiles]);
    
    console.log(`Successfully added ${newUploadedFiles.length} file(s) to uploadedFiles`);
  } catch (error) {
    console.error('Error in handleFileUpload:', error);
  }
}

export function isTextFile(file: unknown): file is TextFile {
  return typeof file === 'object' &&
    file !== null && 'type' in file && 'name' in file && 'content' in file && 'lastModified' in file && 'size' in file;
}

export function handleDrop(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer?.items) {
    for (let i = 0; i < event.dataTransfer.items.length; i++) {
      if (event.dataTransfer.items[i].kind === 'file') {
        const file = event.dataTransfer.items[i].getAsFile();
        if (file) {
          handleFileUpload([file], event.clientX, event.clientY);
        }
      } else if (event.dataTransfer.items[i].kind === 'string') {
        event.dataTransfer.items[i].getAsString(text => {
          const newFile = {
            type: 'text/plain',
            name: 'Dragged Text',
            content: text,
            lastModified: Date.now(),
            size: text.length
          } as unknown as File;
          handleFileUpload([newFile], event.clientX, event.clientY);
        });
      }
    }
  }
}

export function handleFileInputChange(event: Event, contextMenuX: number, contextMenuY: number) {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    handleFileUpload(Array.from(input.files), contextMenuX, contextMenuY);
  }
  input.value = ''; // Reset the input
}

export function handleFileMove(event: CustomEvent<{ id: string; x: number; y: number }>) {
  const { id, x, y } = event.detail;
  uploadedFiles.update(files => 
    files.map(file => 
      file.file.name === id ? { ...file, x, y } : file
    )
  );
}
export function handleImportComplete(event: CustomEvent<File[]>, importX: number, importY: number) {
  handleFileUpload(event.detail, importX, importY);
  return false; // to indicate that ImportDocs should be hidden
}
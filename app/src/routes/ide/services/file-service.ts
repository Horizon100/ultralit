// src/lib/services/fileService.ts
import { addNotification, updateNotification } from '$lib/stores/ideNotificationStore';
import type { CodeFiles } from '$lib/types/types.ide';

/**
 * Saves file content to the server
 * @param file The file to save
 * @param content The content to save
 * @returns Promise resolving to the updated file
 */
export async function saveFile(file: CodeFiles, content: string): Promise<CodeFiles> {
  // Show saving notification
  const notificationId = addNotification(`Saving ${file.name}...`, 'loading');
  
  try {
    // Format content as array if it's not already
    const contentArray = Array.isArray(content) ? content : [content];
    
    const response = await fetch(`/api/files/${file.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: contentArray
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save file');
    }
    
    const updatedFile = await response.json();
    
    // Update notification to success
    updateNotification(notificationId, {
      message: `${file.name} saved successfully`,
      type: 'success'
    });
    
    return updatedFile;
  } catch (error) {
    // Update notification to error
    updateNotification(notificationId, {
      message: `Error saving ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'error',
      autoClose: false // Keep error notifications visible
    });
    
    throw error;
  }
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
  
  try {
    const response = await fetch('/api/files', {
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
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create file');
    }
    
    const newFile = await response.json();
    
    updateNotification(notificationId, {
      message: `${fileName} created successfully`,
      type: 'success'
    });
    
    return newFile;
  } catch (error) {
    updateNotification(notificationId, {
      message: `Error creating ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'error',
      autoClose: false
    });
    
    throw error;
  }
}
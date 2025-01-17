import { pb } from '../pocketbase';
import type { Workspaces } from '$lib/types/types';
import { ClientResponseError } from 'pocketbase';

export async function createWorkspace(workspaceData: Partial<Workspaces>): Promise<Workspaces> {
  try {
    console.log('Creating workspace with data:', workspaceData);
    const workspace = await pb.collection('workspaces').create<Workspaces>(workspaceData);
    console.log('Workspace created successfully:', workspace);
    return workspace;
  } catch (error) {
    console.error('Error creating workspace:', error);
    if (error instanceof ClientResponseError) {
      console.error('Response data:', error.data);
      console.error('Status code:', error.status);
    } else if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    throw error;
  }
}

export async function getWorkspaces(userId: string): Promise<Workspaces[]> {
  try {
    const workspaces = await pb.collection('workspaces').getFullList<Workspaces>({
      filter: `created_by = "${userId}" || collaborators ~ "${userId}"`,
      sort: '-created',
    });
    return workspaces;
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    if (error instanceof ClientResponseError) {
      console.error('Response data:', error.data);
      console.error('Status code:', error.status);
    }
    throw error;
  }
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  try {
    await pb.collection('workspaces').delete(workspaceId);
  } catch (error) {
    console.error('Error deleting workspace:', error);
    if (error instanceof ClientResponseError) {
      console.error('Response data:', error.data);
      console.error('Status code:', error.status);
    }
    throw error;
  }
}

export async function updateWorkspace(workspaceId: string, data: Partial<Workspaces>): Promise<Workspaces> {
  try {
    const updatedWorkspace = await pb.collection('workspaces').update<Workspaces>(workspaceId, data);
    return updatedWorkspace;
  } catch (error) {
    console.error('Error updating workspace:', error);
    if (error instanceof ClientResponseError) {
      console.error('Response data:', error.data);
      console.error('Status code:', error.status);
    }
    throw error;
  }
}
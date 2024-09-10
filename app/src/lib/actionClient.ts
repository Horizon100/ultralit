import { pb } from './pocketbase';
import type { Actions } from '$lib/types';

export async function createAction(actionData: Partial<Actions>): Promise<Actions> {
  try {
    const action = await pb.collection('actions').create<Actions>(actionData);
    return action;
  } catch (error) {
    console.error('Error creating action:', error);
    throw error;
  }
}

export async function updateAction(id: string, actionData: Partial<Actions>): Promise<Actions> {
  try {
    const action = await pb.collection('actions').update<Actions>(id, actionData);
    return action;
  } catch (error) {
    console.error('Error updating action:', error);
    throw error;
  }
}

export async function deleteAction(id: string): Promise<boolean> {
  try {
    await pb.collection('actions').delete(id);
    return true;
  } catch (error) {
    console.error('Error deleting action:', error);
    throw error;
  }
}
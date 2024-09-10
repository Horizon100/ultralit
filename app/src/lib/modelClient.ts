import { pb } from './pocketbase';
import type { AIModel } from '$lib/types';

export async function createModel(modelData: Partial<AIModel>): Promise<AIModel> {
  try {
    const model = await pb.collection('models').create<AIModel>(modelData);
    return model;
  } catch (error) {
    console.error('Error creating model:', error);
    throw error;
  }
}

export async function updateModel(id: string, modelData: Partial<AIModel>): Promise<AIModel> {
  try {
    const model = await pb.collection('models').update<AIModel>(id, modelData);
    return model;
  } catch (error) {
    console.error('Error updating model:', error);
    throw error;
  }
}

export async function deleteModel(id: string): Promise<boolean> {
  try {
    await pb.collection('models').delete(id);
    return true;
  } catch (error) {
    console.error('Error deleting model:', error);
    throw error;
  }
}

export async function fetchUserModels(userId: string): Promise<AIModel[]> {
  try {
    const models = await pb.collection('models').getFullList<AIModel>({
      filter: `user ~ "${userId}"`,
    });
    return models;
  } catch (error) {
    console.error('Error fetching user models:', error);
    throw error;
  }
}
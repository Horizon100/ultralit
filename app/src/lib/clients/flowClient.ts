import {  } from '../pocketbase';
import type { Workflows } from '$lib/types/types';

export async function createFlow(flowData: Workflows): Promise<Workflows> {
	try {
		const flow = await pb.collection('workflows').create<Workflows>(flowData);
		return flow;
	} catch (error) {
		console.error('Error creating flow:', error);
		throw error;
	}
}

export async function updateFlow(id: string, flowData: Partial<Workflows>): Promise<Workflows> {
	try {
		const flow = await pb.collection('workflows').update<Workflows>(id, flowData);
		return flow;
	} catch (error) {
		console.error('Error updating flow:', error);
		throw error;
	}
}

export async function deleteFlow(id: string): Promise<boolean> {
	try {
		await pb.collection('workflows').delete(id);
		return true;
	} catch (error) {
		console.error('Error deleting flow:', error);
		throw error;
	}
}

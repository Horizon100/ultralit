// src/lib/workshopClient.ts

import { pb } from '../pocketbase';
import type { Workshops } from '$lib/types/types';

export async function createWorkshop(workshopData: Partial<Workshops>): Promise<Workshops> {
	try {
		const workshop = await pb.collection('workshops').create<Workshops>(workshopData);
		return workshop;
	} catch (error) {
		console.error('Error creating workshop:', error);
		throw error;
	}
}

export async function getWorkshops(workspaceId: string): Promise<Workshops[]> {
	try {
		const workshops = await pb.collection('workshops').getFullList<Workshops>({
			filter: `workspace = "${workspaceId}"`,
			sort: '-created'
		});
		return workshops;
	} catch (error) {
		console.error('Error fetching workshops:', error);
		throw error;
	}
}

export async function updateWorkshop(
	workshopId: string,
	data: Partial<Workshops>
): Promise<Workshops> {
	try {
		const updatedWorkshop = await pb.collection('workshops').update<Workshops>(workshopId, data);
		return updatedWorkshop;
	} catch (error) {
		console.error('Error updating workshop:', error);
		throw error;
	}
}
export async function deleteWorkshop(workshopId: string): Promise<void> {
	try {
		await pb.collection('workshops').delete(workshopId);
	} catch (error) {
		console.error('Error deleting workshop:', error);
		throw error;
	}
}

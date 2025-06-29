// src/routes/api/game/dialog/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { GameDialog } from '$lib/types/types.game';

interface DialogRequest {
	type: 'table' | 'private' | 'room';
	participants: string[];
	tableId?: string;
	roomId?: string;
}

interface DialogCreateData {
	type: 'table' | 'private' | 'room';
	participants: string[];
	currentThread: string;
	isActive: boolean;
	table?: string;
	room?: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.pb.authStore.isValid) {
		throw error(401, 'Unauthorized');
	}

	const { type, participants, tableId, roomId }: DialogRequest = await request.json();

	try {
		// Create thread for dialog
		const thread = await pb.collection('threads').create({
			name: `${type.charAt(0).toUpperCase() + type.slice(1)} Discussion`,
			op: participants[0],
			members: participants.join(','),
			project_id: '',
			agents: []
		});

		// Create dialog session
		const dialogData: DialogCreateData = {
			type,
			participants,
			currentThread: thread.id,
			isActive: true
		};

		if (tableId) dialogData.table = tableId;
		if (roomId) dialogData.room = roomId;

		const dialog = (await pb.collection('game_dialog').create(dialogData)) as GameDialog;

		return json({ dialog });
	} catch (err) {
		throw error(500, 'Failed to create dialog');
	}
};

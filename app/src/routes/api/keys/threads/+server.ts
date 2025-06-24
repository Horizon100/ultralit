// src/routes/api/keys/threads/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { Threads } from '$lib/types/types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	try {
		const threads = await locals.pb.collection('threads').getFullList<Threads>({
			// Add any query parameters you need
		});
		return json({ success: true, data: threads });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		throw error(400, message);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	console.log('API keys/threads: Creating new thread');

	if (!locals.user) {
		console.error('API keys/threads: User not authenticated');
		throw error(401, 'Unauthorized');
	}

	try {
		const data = await request.json();
		const currentUserId = locals.user.id;

		console.log('API keys/threads: Raw request data:', data);

		// Prepare thread data with proper typing
		const threadData: Partial<Threads> & {
			name: string;
			user: string;
			op: string;
			members: string[];
			updated: string;
			created: string;
		} = {
			name: data.name || 'New Thread',
			user: currentUserId,
			op: data.op || currentUserId,
			members: data.members || [currentUserId],
			description: data.description || '',
			updated: new Date().toISOString(),
			created: new Date().toISOString(),
			agents: data.agents || [],
			project_id: data.project || null
		};

		// Include any other fields that were sent
		for (const [key, value] of Object.entries(data)) {
			if (value !== undefined && !Object.keys(threadData).includes(key)) {
				// Use type assertion for dynamic properties
				(threadData as Record<string, unknown>)[key] = value;
			}
		}

		console.log('API keys/threads: Creating thread with data:', threadData);

		try {
			// Create the thread with proper typing
			const thread = await pb.collection('threads').create<Threads>(threadData);

			console.log(`API keys/threads: Thread created with ID: ${thread.id}`);

			return json({
				success: true,
				thread: thread
			});
		} catch (pbError: unknown) {
			console.error('API keys/threads: PocketBase error creating thread:', pbError);

			// Type-safe error handling
			if (
				typeof pbError === 'object' &&
				pbError !== null &&
				'status' in pbError &&
				pbError.status === 400
			) {
				const errorData = 'data' in pbError ? pbError.data : {};
				return json(
					{
						success: false,
						message: `Validation error: ${JSON.stringify(errorData)}`,
						errors: errorData
					},
					{ status: 400 }
				);
			}

			const message = pbError instanceof Error ? pbError.message : 'Unknown error';
			throw error(500, message);
		}
	} catch (err: unknown) {
		console.error('API keys/threads: Error creating thread:', err);
		const message = err instanceof Error ? err.message : 'Failed to create thread';
		return json(
			{
				success: false,
				message
			},
			{ status: 400 }
		);
	}
};

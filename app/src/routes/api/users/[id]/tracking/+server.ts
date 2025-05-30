import { pb } from '$lib/server/pocketbase';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { TimerSession } from '$lib/types/types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const userId = params.id;

	// Check if user can only update their own tracking data
	if (locals.user.id !== userId) {
		throw error(403, 'Forbidden - Can only update your own tracking data');
	}

	try {
		const data = await request.json();
		const { date, startTime, endTime, duration, path } = data;

		// Validate required fields
        if (!date || !startTime || !endTime || typeof duration !== 'number' || !path) {
            throw error(400, 'Missing required fields: date, startTime, endTime, duration, path');
        }
		// Get current user data
		const user = await pb.collection('users').getOne(userId);

		if (!user) {
			throw error(404, 'User not found');
		}

		// Create new timer session
		const timerSession = {
			date,
			startTime,
			endTime,
			duration,
            path
		};

		// Get existing timer sessions or create empty array
		const currentSessions = user.timer_sessions || [];

		// Update user with new timer session
		const updatedUser = await pb.collection('users').update(userId, {
			timer_sessions: [...currentSessions, timerSession]
		});

		return json({
			success: true,
			message: 'Timer session saved successfully',
			session: timerSession,
			totalSessions: updatedUser.timer_sessions?.length || 0
		});

	} catch (err) {
		console.error('Error saving timer session:', err);
		
		if (err instanceof Error && err.message.includes('status')) {
			throw err; // Re-throw HTTP errors
		}
		
		throw error(500, 'Failed to save timer session');
	}
};

export const GET: RequestHandler = async ({ params, locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const userId = params.id;

	if (locals.user.id !== userId) {
		throw error(403, 'Forbidden - Can only access your own tracking data');
	}

	try {
		const user = await pb.collection('users').getOne(userId, {
			fields: 'id,timer_sessions'
		});

		if (!user) {
			throw error(404, 'User not found');
		}

		const sessions = user.timer_sessions || [];
		
		// Optional: Filter by path if requested
		const pathFilter = url.searchParams.get('path');
		const filteredSessions = pathFilter ? 
	        sessions.filter((session: TimerSession) => session.path === pathFilter) : 
			sessions;

		// Calculate total duration
        const totalDuration = filteredSessions.reduce((sum: number, session: TimerSession) => sum + (session.duration || 0), 0);

		return json({
			success: true,
			sessions: filteredSessions,
			totalDuration,
			pathFilter
		});

	} catch (err) {
		console.error('Error fetching timer sessions:', err);
		throw error(500, 'Failed to fetch timer sessions');
	}
};
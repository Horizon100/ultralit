// src/routes/api/users/[id]/tracking/+server.ts
import { pb } from '$lib/server/pocketbase';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { TimerSession, TimerSessionSummary } from '$lib/types/types';

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
		let data: { date: string; startTime: string; endTime: string; duration: number };

		// Handle both regular JSON requests and sendBeacon blob requests
		const contentType = request.headers.get('content-type');

		if (contentType && contentType.includes('application/json')) {
			// Regular JSON request
			data = await request.json();
		} else {
			// Likely a sendBeacon blob request
			const text = await request.text();
			try {
				data = JSON.parse(text);
			} catch (parseError) {
				console.error('Error parsing request data:', parseError);
				throw error(400, 'Invalid request data format');
			}
		}

		const { date, startTime, endTime, duration } = data;

		// Validate required fields
		if (!date || !startTime || !endTime || typeof duration !== 'number') {
			throw error(400, 'Missing required fields: date, startTime, endTime, duration');
		}

		// Validate duration is positive
		if (duration <= 0) {
			throw error(400, 'Duration must be positive');
		}

		// Get current user data
		const user = await pb.collection('users').getOne(userId);

		if (!user) {
			throw error(404, 'User not found');
		}

		// Create new timer session
		const timerSession: TimerSession = {
			date,
			startTime,
			endTime,
			duration
		};

		// Get existing timer sessions or create empty array
		const currentSessions: TimerSession[] = user.timer_sessions || [];

		// Check for duplicate sessions (same startTime)
		const isDuplicate = currentSessions.some(
			(session: TimerSession) => session.startTime === timerSession.startTime
		);

		if (isDuplicate) {
			console.log('Duplicate timer session detected, skipping save');
			return json({
				success: true,
				message: 'Timer session already exists',
				session: timerSession,
				totalSessions: currentSessions.length
			});
		}

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

		const sessions: TimerSession[] = user.timer_sessions || [];

		// Optional: Filter by date if requested
		const dateFilter = url.searchParams.get('date');

		let filteredSessions = sessions;

		if (dateFilter) {
			filteredSessions = filteredSessions.filter(
				(session: TimerSession) => session.date === dateFilter
			);
		}

		// Calculate total duration
		const totalDuration = filteredSessions.reduce(
			(sum: number, session: TimerSession) => sum + (session.duration || 0),
			0
		);

		// Group sessions by date for summary - now properly typed
		const sessionsByDate = filteredSessions.reduce(
			(acc: Record<string, TimerSessionSummary>, session: TimerSession) => {
				const date = session.date;
				if (!acc[date]) {
					acc[date] = {
						date,
						totalDuration: 0,
						sessions: []
					};
				}
				acc[date].totalDuration += session.duration;
				acc[date].sessions.push(session);
				return acc;
			},
			{}
		);

		return json({
			success: true,
			sessions: filteredSessions,
			sessionsByDate: Object.values(sessionsByDate),
			totalDuration,
			filters: {
				date: dateFilter
			}
		});
	} catch (err) {
		console.error('Error fetching timer sessions:', err);
		throw error(500, 'Failed to fetch timer sessions');
	}
};

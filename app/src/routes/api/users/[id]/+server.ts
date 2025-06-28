import { pb } from '$lib/server/pocketbase';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const userId = params.id;

	try {
		const user = await pb.collection('users').getOne(userId, {
			fields:
				'id,name,username,email,avatar,collectionId,model_preference,taskAssignments,userTaskStatus,hero,wallpaper_preference,profileWallpaper,status,last_login,followers,following'
		});

		if (!user) {
			throw error(404, 'User not found');
		}

		return json({
			success: true,
			user: {
				id: user.id,
				name: user.name || '',
				username: user.username || '',
				email: user.email || '',
				avatar: user.avatar || '',
				collectionId: user.collectionId,
				model_preference: user.model_preference || [],
				taskAssignments: user.taskAssignments || [],
				hero: user.hero || '',
				wallpaper_preference: user.wallpaper_preference || null,
				profileWallpaper: user.profileWallpaper || null,
				status: user.status || 'offline',
				last_login: user.last_login || '',
				followers: user.followers || [],
				following: user.following || [],
				userTaskStatus: user.userTaskStatus || {
					backlog: 0,
					todo: 0,
					focus: 0,
					done: 0,
					hold: 0,
					postpone: 0,
					cancel: 0,
					review: 0,
					delegate: 0,
					archive: 0
				}
			}
		});
	} catch (err) {
		console.error('Error fetching user data:', err);
		throw error(404, 'User not found');
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const userId = params.id;

	try {
		const user = await pb.collection('users').getOne(userId);

		if (!user) {
			return json(
				{
					success: false,
					error: 'User not found'
				},
				{ status: 404 }
			);
		}

		const data = await request.json();

		// Updated inline object type to include status and last_login
		const updateData: {
			model_preference?: string[];
			taskAssignments?: string[];
			hero?: string;
			status?: string;
			last_login?: string;
			userTaskStatus?: {
				backlog: number;
				todo: number;
				focus: number;
				done: number;
				hold: number;
				postpone: number;
				cancel: number;
				review: number;
				delegate: number;
				archive: number;
			};
			wallpaper_preference?: string;
		} = {};

		if ('model_preference' in data) {
			updateData.model_preference = data.model_preference;
		}

		if ('taskAssignments' in data) {
			updateData.taskAssignments = data.taskAssignments;
		}

		if ('hero' in data) {
			updateData.hero = data.hero;
		}

		if ('status' in data) {
			updateData.status = data.status;
		}

		if ('last_login' in data) {
			updateData.last_login = data.last_login;
		}

		if ('userTaskStatus' in data) {
			updateData.userTaskStatus = data.userTaskStatus;
		}

		if ('wallpaper_preference' in data) {
			updateData.wallpaper_preference = data.wallpaper_preference;
		}

		if (Object.keys(updateData).length === 0) {
			return json(
				{
					success: false,
					error: 'No valid fields to update'
				},
				{ status: 400 }
			);
		}

		console.log('📝 Updating user with data:', updateData);
		const updated = await pb.collection('users').update(userId, updateData);

		return json({
			success: true,
			user: {
				id: updated.id,
				model_preference: updated.model_preference || [],
				taskAssignments: updated.taskAssignments || [],
				wallpaper_preference: updated.wallpaper_preference || null,
				status: updated.status || 'offline',
				last_login: updated.last_login || '',
				followers: updated.followers || [],
				following: updated.following || [],
				userTaskStatus: updated.userTaskStatus || {
					backlog: 0,
					todo: 0,
					focus: 0,
					done: 0,
					hold: 0,
					postpone: 0,
					cancel: 0,
					review: 0,
					delegate: 0,
					archive: 0
				}
			}
		});
	} catch (err) {
		console.error('Error updating user data:', err);

		// Log detailed error information
		if (err && typeof err === 'object') {
			console.error('Full error object:', JSON.stringify(err, null, 2));
			if ('response' in err) {
				console.error('Error response:', err.response);
			}
		}

		return json(
			{
				success: false,
				error: err instanceof Error ? err.message : 'Failed to update user'
			},
			{ status: 400 }
		);
	}
};

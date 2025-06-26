import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pb } from '$lib/server/pocketbase';
import type { User } from '$lib/types/types';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ params }) => {
	return apiTryCatch(async () => {
		const { id } = params;

		if (!id) {
			throw new Error('User ID is required');
		}

		// Get user's current status from PocketBase
		const user = await pb.collection('users').getOne<User>(id, {
			fields: 'id,status,last_login,followers,following,name,username'
		});

		// Calculate if user is actually online based on last_login
		// Consider user online if they were active in the last 5 minutes
		const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
		const lastLogin = new Date(user.last_login);
		const isOnline = user.status === 'online' && lastLogin > fiveMinutesAgo;

		return {
			userId: user.id,
			status: isOnline ? 'online' : 'offline',
			lastSeen: user.last_login,
			name: user.name || user.username
		};
	}, 'fetch user status');
};

// Allow updating current user's status
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	console.log('🔍 === STATUS PATCH ENDPOINT HIT ===');
	
	try {
		return await apiTryCatch(async () => {
			console.log('🔍 === STATUS PATCH DEBUG START ===');
			console.log('User from locals:', locals.user?.id);
			console.log('Params ID:', params.id);

			if (!locals.user) {
				console.log('❌ No user in locals');
				throw new Error('Unauthorized');
			}

			const { id } = params;
			console.log('Updating status for user ID:', id);

			// Only allow users to update their own status
			if (id !== locals.user.id) {
				console.log('❌ User ID mismatch:', { requestedId: id, actualId: locals.user.id });
				throw new Error('Can only update your own status');
			}

			const { status } = await request.json();
			console.log('Requested status:', status);

			if (!status || !['online', 'offline'].includes(status)) {
				console.log('❌ Invalid status:', status);
				throw new Error('Invalid status. Must be "online" or "offline"');
			}

			// Check current status before update
			try {
				const beforeUpdate = await pb.collection('users').getOne(id, {
					fields: 'id,status,last_login,followers,following,username'
				});
				console.log('📊 BEFORE UPDATE:', {
					id: beforeUpdate.id,
					status: beforeUpdate.status,
					last_login: beforeUpdate.last_login,
					username: beforeUpdate.username
				});
			} catch (error) {
				console.log('⚠️ Could not fetch user before update:', error);
			}

			// Update user status and last_login in PocketBase
			const updateData = {
				status,
				last_login: new Date().toISOString()
			};
			console.log('📝 Update data:', updateData);

			let updatedUser;
			try {
				console.log('🔍 About to call pb.collection("users").update...');
				updatedUser = await pb.collection('users').update<User>(id, updateData);
				console.log('✅ PocketBase update successful:', {
					id: updatedUser.id,
					status: updatedUser.status,
					last_login: updatedUser.last_login
				});
} catch (updateError) {
	console.error('❌ PocketBase update failed with error:', updateError);
	
	// Log the FULL error response to see exactly what PocketBase is rejecting
	console.error('❌ Full error response:', JSON.stringify(updateError.response, null, 2));
	console.error('❌ Error data:', JSON.stringify(updateError.data, null, 2));
	console.error('❌ Original error data:', JSON.stringify(updateError.originalError, null, 2));
	
	throw new Error(`PocketBase update failed: ${updateError.message}`);
}
			console.log('🔍 === STATUS PATCH DEBUG END ===');

			return { 
				success: true, 
				user: updatedUser,
				status: updatedUser.status,
				last_login: updatedUser.last_login,
				timestamp: new Date().toISOString()
			};
		}, 'update user status');
	} catch (outerError) {
		console.error('❌ OUTER ERROR in status PATCH:', outerError);
		return json({
			success: false,
			error: `Status update failed: ${outerError.message}`
		}, { status: 500 });
	}
};
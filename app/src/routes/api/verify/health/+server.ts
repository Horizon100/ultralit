import type { RequestHandler } from './$types';
import * as pbServer from '$lib/server/pocketbase';
import { apiTryCatch } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async () => {
	return apiTryCatch(async () => {
		const isHealthy = await pbServer.checkPocketBaseConnection();
		return {
			success: isHealthy,
			message: isHealthy ? 'PocketBase is healthy' : 'PocketBase is not healthy'
		};
	}, 'PocketBase health check failed', 500);
};
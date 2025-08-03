import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { version } from '../../../../package.json';

export const GET: RequestHandler = async () => {
	return json({ 
		status: 'ok', 
		timestamp: new Date().toISOString(),
		service: 'vrazum',
		version: version,
		
	});
};
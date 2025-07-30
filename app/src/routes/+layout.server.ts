// src/routes/+layout.server.ts
import { env } from '$env/dynamic/public';

export async function load() {
	return {
		pocketbaseUrl: env.PUBLIC_POCKETBASE_URL || 'http://100.87.185.104:8090'
	};
}

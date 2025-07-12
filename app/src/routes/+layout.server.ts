import { VITE_POCKETBASE_URL } from '$env/static/private';

export async function load() {
	return {
		pocketbaseUrl: VITE_POCKETBASE_URL || 'http://localhost:8090'
	};
}

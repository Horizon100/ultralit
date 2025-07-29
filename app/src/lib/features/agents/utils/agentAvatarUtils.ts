import type { AIAgent } from '$lib/types/types';
import { pocketbaseUrl } from '$lib/stores/pocketbase';


export function getAgentAvatarUrl(agent: AIAgent): string {
	if (agent.avatar) {
		console.log('Agent object:', agent);
		console.log('Agent ID:', agent.id);
		console.log('Avatar filename:', agent.avatar);
		
		// Get the actual URL value from the store
		let baseUrl = '';
		
		// If pocketbaseUrl is a store, subscribe to get the value
		if (typeof pocketbaseUrl === 'object' && 'subscribe' in pocketbaseUrl) {
			pocketbaseUrl.subscribe(value => baseUrl = value)();
		} else {
			baseUrl = String(pocketbaseUrl);
		}
		
		console.log('Base URL resolved:', baseUrl);
		
		// Get auth token
		let token = '';
		if (typeof window !== 'undefined') {
			const authData = localStorage.getItem('pocketbase_auth');
			if (authData) {
				try {
					const parsed = JSON.parse(authData);
					token = parsed.token || '';
					console.log('Auth token available:', !!token);
				} catch (e) {
					console.log('No auth token found');
				}
			}
		}
		
		// Construct the proper URL
		const url = `${baseUrl}/api/files/4pbqdhs3elnrnss/${agent.id}/${agent.avatar}`;
		console.log('Final URL (no auth):', url);
		
		const finalUrl = token ? `${url}?token=${token}` : url;
		console.log('Final URL (with auth):', finalUrl);
		
		return finalUrl;
	}
	return '';
}
// +page.ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch }) => {
	const response = await fetch('/api/user');
	const user = await response.json();

	if (typeof window !== 'undefined') {
		localStorage.setItem('lastVisited', url.pathname);
	}

	return {
		user
	};
};

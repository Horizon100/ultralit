import type { User, Threads } from '$lib/types/types';
import type { Writable } from 'svelte/store';

export interface FavoriteHandlerOptions {
	currentUser: Writable<User | null>;
	thread: Threads | null;
	isFavoriteState: boolean;
	onStateUpdate: (newState: boolean) => void;
	onTooltipShow: (text: string) => void;
}

export async function handleFavoriteThread({
	currentUser,
	thread,
	isFavoriteState,
	onStateUpdate,
	onTooltipShow
}: FavoriteHandlerOptions): Promise<void> {
	try {
		let user: User | null = null;
		currentUser.subscribe(value => { user = value; })();

		console.log('handleFavoriteThread called:', { 
			user: user?.id, 
			thread: thread?.id, 
			isFavoriteState,
			userFavoriteThreads: user?.favoriteThreads 
		});

		if (!user || !thread) {
			console.log('Missing user or thread:', { user: !!user, thread: !!thread });
			return;
		}

		// Determine if we're adding or removing
		const favoriteAction = isFavoriteState ? 'remove' : 'add';
		console.log('Action determined:', favoriteAction);

		// Use API route with POST method
		const response = await fetch('/api/favorites', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				threadId: thread.id,
				action: favoriteAction
			})
		});

		console.log('API response status:', response.status);

		if (!response.ok) {
			throw new Error('Failed to update favorite thread');
		}

		const result = await response.json();
		console.log('API result:', result);

		if (result.success) {
			// Update local state
			const newFavoriteState = !isFavoriteState;
			onStateUpdate(newFavoriteState);

			const tooltipText = newFavoriteState
				? 'Added to favorites'
				: 'Removed from favorites';

			// Update the current user store with new favorite threads
			currentUser.update((currentUser) => {
				if (!currentUser) return currentUser;
				return {
					...currentUser,
					favoriteThreads: result.favoriteThreads
				};
			});

			onTooltipShow(tooltipText);
		} else {
			throw new Error(result.message || 'Favorite thread operation failed');
		}
	} catch (error) {
		console.error('Error handling favorite thread:', error);
		onTooltipShow('Failed to update favorite');
	}
}
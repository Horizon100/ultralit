import type { Threads } from '$lib/types/types';
import { currentUser } from '$lib/pocketbase';
import { get } from 'svelte/store';
import { 
	fetchTryCatch, 
	validationTryCatch, 
	isFailure 
} from '$lib/utils/errorUtils';

export interface FavoriteHandlerOptions {
	thread: Threads | null;
	isFavoriteState: boolean;
	onStateUpdate: (newState: boolean) => void;
	onTooltipShow: (text: string) => void;
}

export async function handleFavoriteThread({
	thread,
	isFavoriteState,
	onStateUpdate,
	onTooltipShow
}: FavoriteHandlerOptions): Promise<void> {
	// Validate required parameters
	const validation = validationTryCatch(() => {
		const user = get(currentUser);
		
		console.log('handleFavoriteThread called:', {
			user: user?.id,
			thread: thread?.id,
			isFavoriteState,
			userFavoriteThreads: user?.favoriteThreads
		});

		if (!user) {
			throw new Error('User not authenticated');
		}

		if (!thread) {
			throw new Error('Thread not provided');
		}

		return { user, validatedThread: thread };
	}, 'favorite thread parameters');

	if (isFailure(validation)) {
		console.log('Validation failed:', validation.error);
		onTooltipShow('Failed to update favorite');
		return;
	}

	const { validatedThread } = validation.data;

	// Determine if we're adding or removing
	const favoriteAction = isFavoriteState ? 'remove' : 'add';
	console.log('Action determined:', favoriteAction);

	// Make API call
	const apiResult = await fetchTryCatch<{
		success: boolean;
		favoriteThreads: string[];
		message?: string;
	}>('/api/favorites', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			threadId: validatedThread.id,
			action: favoriteAction
		})
	});

	if (isFailure(apiResult)) {
		console.error('API call failed:', apiResult.error);
		onTooltipShow('Failed to update favorite');
		return;
	}

	console.log('API response received:', apiResult.data);

	// Validate API response
	const responseValidation = validationTryCatch(() => {
		const result = apiResult.data;
		
		if (!result.success) {
			throw new Error(result.message || 'Favorite thread operation failed');
		}

		return result;
	}, 'API response');

	if (isFailure(responseValidation)) {
		console.error('API response validation failed:', responseValidation.error);
		onTooltipShow('Failed to update favorite');
		return;
	}

	const result = responseValidation.data;

	// Update local state
	const newFavoriteState = !isFavoriteState;
	onStateUpdate(newFavoriteState);

	const tooltipText = newFavoriteState ? 'Added to favorites' : 'Removed from favorites';

	// Update the current user store with new favorite threads
	currentUser.update((currentUserData) => {
		if (!currentUserData) return currentUserData;
		return {
			...currentUserData,
			favoriteThreads: result.favoriteThreads
		};
	});

	onTooltipShow(tooltipText);
}
// src/lib/clients/gameClient.ts
import { gameStore } from '$lib/stores/gameStore';
import { get } from 'svelte/store';
import type { GamePosition } from '$lib/types/types.game';
import { fetchTryCatch, isSuccess } from '$lib/utils/errorUtils';

class GameClient {
	private pendingPosition: GamePosition | null = null;
	private lastSentPosition: GamePosition | null = null;
	private syncTimeout: ReturnType<typeof setTimeout> | null = null;
	private readonly syncDelay = 500; // ms - delay before syncing to server
	private readonly moveThreshold = 32; // minimum distance to trigger server sync (half grid cell)
	private isOnline = true;

	/**
	 * Update hero position locally with instant feedback
	 * Server sync happens with debouncing
	 */
	async moveHeroImmediate(userId: string, position: GamePosition) {
		// Update local state immediately for instant feedback
		this.updateLocalHeroPosition(position);

		// Store this as pending position for server sync
		this.pendingPosition = position;

		// Clear existing sync timeout
		if (this.syncTimeout) {
			clearTimeout(this.syncTimeout);
		}

		// Debounce server sync
		this.syncTimeout = setTimeout(() => {
			this.syncPositionToServer(userId);
		}, this.syncDelay);
	}

	/**
	 * Handle keyboard movement with grid-based constraints
	 */
	async handleKeyboardMovement(userId: string, direction: string) {
		const $gameStore = get(gameStore);
		if (!$gameStore.heroPawn) return;

		const currentPos = $gameStore.heroPawn.position;
		const gridSize = 64; // Should match your GRID_SIZE

		// Calculate current grid position
		const currentGridX = Math.floor(currentPos.x / gridSize);
		const currentGridY = Math.floor(currentPos.y / gridSize);

		// Calculate new grid position
		let newGridX = currentGridX;
		let newGridY = currentGridY;

		switch (direction) {
			case 'up':
				newGridY = Math.max(0, currentGridY - 1);
				break;
			case 'down':
				newGridY = Math.min(49, currentGridY + 1); // Assuming 50x50 grid
				break;
			case 'left':
				newGridX = Math.max(0, currentGridX - 1);
				break;
			case 'right':
				newGridX = Math.min(49, currentGridX + 1); // Assuming 50x50 grid
				break;
		}

		// Convert back to pixel position (centered in grid cell)
		const newPosition = {
			x: newGridX * gridSize + gridSize / 2,
			y: newGridY * gridSize + gridSize / 2
		};

		// Check if position actually changed
		if (newGridX !== currentGridX || newGridY !== currentGridY) {
			await this.moveHeroImmediate(userId, newPosition);
		}
	}

	/**
	 * Update local hero position immediately
	 */
	private updateLocalHeroPosition(position: GamePosition) {
		gameStore.update((state) => {
			if (state.heroPawn) {
				return {
					...state,
					heroPawn: {
						...state.heroPawn,
						position: { ...position },
						isMoving: true
					}
				};
			}
			return state;
		});

		// Stop moving animation after short delay
		setTimeout(() => {
			gameStore.update((state) => {
				if (state.heroPawn) {
					return {
						...state,
						heroPawn: {
							...state.heroPawn,
							isMoving: false
						}
					};
				}
				return state;
			});
		}, 300);
	}

	/**
	 * Sync position to server with throttling
	 */
	private async syncPositionToServer(userId: string) {
		if (!this.pendingPosition || !this.isOnline) return;

		// Check if we should sync based on distance threshold
		if (
			this.lastSentPosition &&
			!this.shouldSyncPosition(this.lastSentPosition, this.pendingPosition)
		) {
			return;
		}

		console.log(`[GAME CLIENT] Syncing position to server:`, this.pendingPosition);

		const result = await fetchTryCatch<{ success: boolean; error?: string }>(
			`/api/game/heroes/${userId}`,
			{
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({
					position: this.pendingPosition,
					lastSeen: new Date().toISOString()
				})
			}
		);

		if (isSuccess(result)) {
			this.lastSentPosition = { ...this.pendingPosition };
			this.pendingPosition = null;
			console.log(`[GAME CLIENT] Position synced successfully`);
		} else {
			console.error(`[GAME CLIENT] Failed to sync position: ${result.error}`);
			
			// Set offline status for network-related errors
			if (result.error.includes('timeout') || result.error.includes('Network')) {
				this.isOnline = false;
			}
			
			// Retry on failure (could implement exponential backoff)
			this.scheduleRetrySync(userId);
		}
	}

	/**
	 * Check if position change is significant enough to sync
	 */
	private shouldSyncPosition(lastPos: GamePosition, currentPos: GamePosition): boolean {
		const distance = Math.sqrt(
			Math.pow(currentPos.x - lastPos.x, 2) + Math.pow(currentPos.y - lastPos.y, 2)
		);
		return distance >= this.moveThreshold;
	}

	/**
	 * Schedule retry for failed sync
	 */
	private scheduleRetrySync(userId: string) {
		setTimeout(() => {
			this.isOnline = true;
			if (this.pendingPosition) {
				this.syncPositionToServer(userId);
			}
		}, 3000); // Retry after 3 seconds
	}

	/**
	 * Force immediate sync to server (useful when leaving page)
	 */
	async forceSyncToServer(userId: string) {
		if (this.syncTimeout) {
			clearTimeout(this.syncTimeout);
			this.syncTimeout = null;
		}

		if (this.pendingPosition) {
			await this.syncPositionToServer(userId);
		}
	}

	/**
	 * Handle page visibility change for better sync management
	 */
	initializeVisibilityHandling(userId: string) {
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				// Page is being hidden, force sync
				this.forceSyncToServer(userId);
			}
		});

		// Also sync on page unload
		window.addEventListener('beforeunload', () => {
			if (this.pendingPosition) {
				// Use sendBeacon for reliable sync on page unload
				const data = new Blob(
					[
						JSON.stringify({
							position: this.pendingPosition,
							lastSeen: new Date().toISOString()
						})
					],
					{ type: 'application/json' }
				);

				navigator.sendBeacon(`/api/game/heroes/${userId}`, data);
			}
		});
	}

	/**
	 * Check if hero position is blocked by buildings
	 */
	async isPositionBlocked(): Promise<boolean> {
		return false;
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		if (this.syncTimeout) {
			clearTimeout(this.syncTimeout);
		}
		this.pendingPosition = null;
		this.lastSentPosition = null;
	}
}

export const gameClient = new GameClient();

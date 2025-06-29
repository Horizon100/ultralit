import { writable } from 'svelte/store';
import type {
	GameState,
	GameOrganization,
	GameBuilding,
	GameRoom,
	GameTable,
	GameHero,
	GameDialog,
	GameRoad
} from '$lib/types/types.game';

import { clientTryCatch, isSuccess } from '$lib/utils/errorUtils';
interface ApiRequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	headers?: Record<string, string>;
	body?: string;
	signal?: AbortSignal;
}

// existing stores
export const gameStore = writable<GameState>({
	currentOrganization: null,
	currentView: 'building',
	currentBuilding: null,
	currentRoom: null,
	currentTable: null,
	currentDialog: null,
	heroPawn: null,
	viewportPosition: { x: 0, y: 0 },
	zoomLevel: 1,
	isLoading: false
});
export const gameOrganizationStore = writable<GameOrganization[]>([]);
export const gameBuildingStore = writable<GameBuilding[]>([]);
export const gameRoomStore = writable<GameRoom[]>([]);
export const gameTableStore = writable<GameTable[]>([]);
export const gameRoadStore = writable<GameRoad[]>([]);
export const otherHeroesStore = writable<GameHero[]>([]);

class GameService {
	private static instance: GameService;

	public static getInstance(): GameService {
		if (!GameService.instance) {
			GameService.instance = new GameService();
		}
		return GameService.instance;
	}

	private async apiCall(endpoint: string, options?: ApiRequestOptions) {
		const response = await fetch(endpoint, {
			...options,
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				...options?.headers
			}
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
		}

		return response.json();
	}

	// Initialize game for a user
	async initializeGame(userId: string) {
		gameStore.update((state) => ({ ...state, isLoading: true }));

		const result = await clientTryCatch(
			(async () => {
				// Get or create hero
				const hero = await this.getOrCreateHero(userId);

				// Load world data
				await this.loadWorldData();

				// Load other heroes
				await this.loadOtherHeroes(userId);

				// Load current organization if hero has one
				let currentOrganization = null;
				if (hero.currentOrganization && hero.currentOrganization !== '') {
					try {
						const orgResponse = await this.apiCall(
							`/api/game/organizations/${hero.currentOrganization}`
						);
						currentOrganization = orgResponse.data;
					} catch (error) {
						console.error('[GAME SERVICE] Failed to load current organization:', error);
					}
				}

				gameStore.update((state) => ({
					...state,
					heroPawn: hero,
					currentOrganization,
					isLoading: false
				}));
			})(),
			'Failed to initialize game'
		);

		if (!isSuccess(result)) {
			console.error(result.error);
			gameStore.update((state) => ({ ...state, isLoading: false }));
		}
	}

	async getOrCreateHero(userId: string): Promise<GameHero> {
		const result = await clientTryCatch(
			this.apiCall(`/api/game/heroes/${userId}`),
			'Failed to get hero'
		);

		if (isSuccess(result)) {
			return result.data;
		}

		// If 404, create new hero
		if (result.error && result.error.includes('404')) {
			const createResult = await clientTryCatch(
				this.apiCall(`/api/game/heroes`, {
					method: 'POST',
					body: JSON.stringify({ userId })
				}),
				'Failed to create hero'
			);

			if (isSuccess(createResult)) {
				return createResult.data;
			}
			throw new Error(createResult.error ?? 'Failed to create hero');
		}

		throw new Error(result.error ?? 'Failed to get or create hero');
	}

	// Load world data
	async loadWorldData() {
		const result = await clientTryCatch(
			(async () => {
				const orgsResponse = await this.apiCall('/api/game/organizations');
				gameOrganizationStore.set(orgsResponse.data);

				const buildingsResponse = await this.apiCall('/api/game/buildings');
				gameBuildingStore.set(buildingsResponse.data);

				const roadsResponse = await this.apiCall('/api/game/roads');
				gameRoadStore.set(roadsResponse.data || []);

				const roomsResponse = await this.apiCall('/api/game/rooms');
				gameRoomStore.set(roomsResponse.data);

				const tablesResponse = await this.apiCall('/api/game/tables');
				gameTableStore.set(tablesResponse.data);
			})(),
			'Failed to load world data'
		);

		if (!isSuccess(result)) {
			console.error(result.error);
		}
	}

	// Load other heroes
	async loadOtherHeroes(currentUserId: string) {
		const result = await clientTryCatch(
			this.apiCall(`/api/game/heroes?exclude=${currentUserId}`),
			'Failed to load other heroes'
		);

		if (isSuccess(result)) {
			otherHeroesStore.set(result.data || []);
		} else {
			console.error(result.error);
		}
	}

	// Enter a building
	async enterBuilding(userId: string, buildingId: string) {
		const result = await clientTryCatch(
			(async () => {
				await this.apiCall(`/api/game/heroes/${userId}`, {
					method: 'PATCH',
					body: JSON.stringify({
						currentBuilding: buildingId,
						currentRoom: null,
						currentTable: null,
						lastSeen: new Date().toISOString()
					})
				});

				const buildingResponse = await this.apiCall(`/api/game/buildings/${buildingId}`);

				gameStore.update((state) => ({
					...state,
					currentView: 'room',
					currentBuilding: buildingResponse.data,
					currentRoom: null,
					currentTable: null
				}));
			})(),
			'Failed to enter building'
		);

		if (!isSuccess(result)) {
			console.error(result.error);
		}
	}

	// Enter a room within a building
	async enterRoom(userId: string, roomId: string) {
		const result = await clientTryCatch(
			(async () => {
				await this.apiCall(`/api/game/heroes/${userId}`, {
					method: 'PATCH',
					body: JSON.stringify({
						currentRoom: roomId,
						currentTable: null,
						lastSeen: new Date().toISOString()
					})
				});

				const roomResponse = await this.apiCall(`/api/game/rooms/${roomId}`);

				const room = roomResponse.data;
				const updatedMembers = [...(room.activeMembers || [])];

				if (!updatedMembers.includes(userId)) {
					updatedMembers.push(userId);
					await this.apiCall(`/api/game/rooms/${roomId}`, {
						method: 'PATCH',
						body: JSON.stringify({ activeMembers: updatedMembers })
					});
				}

				gameStore.update((state) => ({
					...state,
					currentView: 'table',
					currentRoom: { ...room, activeMembers: updatedMembers },
					currentTable: null
				}));
			})(),
			'Failed to enter room'
		);

		if (!isSuccess(result)) {
			console.error(result.error);
		}
	}

	// Sit at a table
	async sitAtTable(userId: string, tableId: string) {
		const result = await clientTryCatch(
			(async () => {
				await this.apiCall(`/api/game/heroes/${userId}`, {
					method: 'PATCH',
					body: JSON.stringify({
						currentTable: tableId,
						lastSeen: new Date().toISOString()
					})
				});

				const tableResponse = await this.apiCall(`/api/game/tables/${tableId}`);

				gameStore.update((state) => ({
					...state,
					currentView: 'dialog',
					currentTable: tableResponse.data
				}));
			})(),
			'Failed to sit at table'
		);

		if (!isSuccess(result)) {
			console.error(result.error);
		}
	}

	// Start a dialog session
	async startDialog(
		participants: string[],
		type: 'table' | 'private' | 'room',
		tableId?: string,
		roomId?: string
	): Promise<GameDialog> {
		const result = await clientTryCatch(
			this.apiCall('/api/game/dialog', {
				method: 'POST',
				body: JSON.stringify({
					type,
					participants,
					tableId,
					roomId
				})
			}),
			'Failed to start dialog'
		);

		if (isSuccess(result)) {
			gameStore.update((state) => ({
				...state,
				currentView: 'dialog',
				currentDialog: result.data
			}));
			return result.data;
		} else {
			console.error(result.error);
			throw new Error(result.error ?? 'Failed to start dialog');
		}
	}

	// Leave current location (room, table, or building)
	async leaveCurrentLocation(userId: string) {
		const result = await clientTryCatch(
			(async () => {
				let currentState: GameState;
				const unsubscribe = gameStore.subscribe((state) => {
					currentState = state;
				});
				unsubscribe();

				if (currentState!.currentRoom) {
					const room = currentState!.currentRoom;
					const updatedMembers = (room.activeMembers || []).filter((id) => id !== userId);

					await this.apiCall(`/api/game/rooms/${room.id}`, {
						method: 'PATCH',
						body: JSON.stringify({ activeMembers: updatedMembers })
					});
				}

				await this.apiCall(`/api/game/heroes/${userId}`, {
					method: 'PATCH',
					body: JSON.stringify({
						currentBuilding: null,
						currentRoom: null,
						currentTable: null,
						lastSeen: new Date().toISOString()
					})
				});

				gameStore.update((state) => ({
					...state,
					currentView: 'building',
					currentBuilding: null,
					currentRoom: null,
					currentTable: null,
					currentDialog: null
				}));
			})(),
			'Failed to leave current location'
		);

		if (!isSuccess(result)) {
			console.error(result.error);
		}
	}
}

export const gameService = GameService.getInstance();

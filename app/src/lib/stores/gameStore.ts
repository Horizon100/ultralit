// src/lib/stores/gameStore.ts
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

interface DialogData {
	type: 'table' | 'private' | 'room';
	participants: string[];
	tableId?: string;
	roomId?: string;
}

// Create the main game store
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

// Additional stores for game data
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

	private async apiCall(endpoint: string, options?: RequestInit) {
		console.log(`[GAME SERVICE] Calling API: ${endpoint}`, options);

		const response = await fetch(endpoint, {
			...options,
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				...options?.headers
			}
		});

		console.log(`[GAME SERVICE] Response status: ${response.status} for ${endpoint}`);

		if (!response.ok) {
			console.error(
				`[GAME SERVICE] API call failed: ${response.status} ${response.statusText} for ${endpoint}`
			);
			throw new Error(`API call failed: ${response.status}`);
		}

		const result = await response.json();
		console.log(`[GAME SERVICE] Response data:`, result);
		return result;
	}

	// Initialize game for a user
async initializeGame(userId: string) {
	try {
		gameStore.update((state) => ({ ...state, isLoading: true }));

		// Get or create hero
		const hero = await this.getOrCreateHero(userId);

		// Load world data
		await this.loadWorldData();

		// Load other heroes
		await this.loadOtherHeroes(userId);

		// Load current organization if hero has one
		let currentOrganization = null;
		// Check for both null and empty string
		if (hero.currentOrganization && hero.currentOrganization !== "") {
			try {
				console.log(`[GAME SERVICE] Loading organization: ${hero.currentOrganization}`);
				const orgResponse = await this.apiCall(`/api/game/organizations/${hero.currentOrganization}`);
				currentOrganization = orgResponse.data;
				console.log(`[GAME SERVICE] Loaded organization: ${currentOrganization.name}`);
			} catch (error) {
				console.error('[GAME SERVICE] Failed to load current organization:', error);
			}
		} else {
			console.log('[GAME SERVICE] Hero has no current organization (empty or null)');
		}

		gameStore.update((state) => ({
			...state,
			heroPawn: hero,
			currentOrganization: currentOrganization,
			isLoading: false
		}));
	} catch (error) {
		console.error('Failed to initialize game:', error);
		gameStore.update((state) => ({ ...state, isLoading: false }));
	}
}

	// Get or create hero
	async getOrCreateHero(userId: string): Promise<GameHero> {
		console.log(`[GAME SERVICE] Getting or creating hero for user: ${userId}`);
		try {
			const response = await this.apiCall(`/api/game/heroes/${userId}`);
			return response.data;
		} catch (error) {
			console.log(`[GAME SERVICE] Hero not found, creating new one...`);
			if (error instanceof Error && error.message.includes('404')) {
				const response = await this.apiCall(`/api/game/heroes`, {
					method: 'POST',
					body: JSON.stringify({
						userId: userId
					})
				});
				return response.data;
			}
			throw error;
		}
	}

	// Load world data
	async loadWorldData() {
		try {
			// Load organizations
			const orgsResponse = await this.apiCall('/api/game/organizations');
			gameOrganizationStore.set(orgsResponse.data);

			// Load buildings
			const buildingsResponse = await this.apiCall('/api/game/buildings');
			gameBuildingStore.set(buildingsResponse.data);

			// Load roads
			const roadsResponse = await this.apiCall('/api/game/roads');
			gameRoadStore.set(roadsResponse.data || []);

			// Load rooms
			const roomsResponse = await this.apiCall('/api/game/rooms');
			gameRoomStore.set(roomsResponse.data);

			// Load tables
			const tablesResponse = await this.apiCall('/api/game/tables');
			gameTableStore.set(tablesResponse.data);
		} catch (error) {
			console.error('Failed to load world data:', error);
		}
	}

	// Load other heroes
	async loadOtherHeroes(currentUserId: string) {
		try {
			const response = await this.apiCall(`/api/game/heroes?exclude=${currentUserId}`);
			otherHeroesStore.set(response.data || []);
		} catch (error) {
			console.error('Failed to load other heroes:', error);
		}
	}

	// Enter a building
	async enterBuilding(userId: string, buildingId: string) {
		try {
			await this.apiCall(`/api/game/heroes/${userId}`, {
				method: 'PATCH',
				body: JSON.stringify({
					currentBuilding: buildingId,
					currentRoom: null,
					currentTable: null,
					lastSeen: new Date().toISOString()
				})
			});

			// Get building details
			const buildingResponse = await this.apiCall(`/api/game/buildings/${buildingId}`);

			// Update game state
			gameStore.update((state) => ({
				...state,
				currentView: 'room',
				currentBuilding: buildingResponse.data,
				currentRoom: null,
				currentTable: null
			}));
		} catch (error) {
			console.error('Failed to enter building:', error);
		}
	}

	// Enter a room within a building
	async enterRoom(userId: string, roomId: string) {
		try {
			await this.apiCall(`/api/game/heroes/${userId}`, {
				method: 'PATCH',
				body: JSON.stringify({
					currentRoom: roomId,
					currentTable: null,
					lastSeen: new Date().toISOString()
				})
			});

			// Get room details
			const roomResponse = await this.apiCall(`/api/game/rooms/${roomId}`);

			// Add user to room's active members
			const room = roomResponse.data;
			const updatedMembers = [...(room.activeMembers || [])];
			if (!updatedMembers.includes(userId)) {
				updatedMembers.push(userId);
				await this.apiCall(`/api/game/rooms/${roomId}`, {
					method: 'PATCH',
					body: JSON.stringify({ activeMembers: updatedMembers })
				});
			}

			// Update game state
			gameStore.update((state) => ({
				...state,
				currentView: 'table',
				currentRoom: { ...room, activeMembers: updatedMembers },
				currentTable: null
			}));
		} catch (error) {
			console.error('Failed to enter room:', error);
		}
	}

	// Sit at a table
	async sitAtTable(userId: string, tableId: string) {
		try {
			await this.apiCall(`/api/game/heroes/${userId}`, {
				method: 'PATCH',
				body: JSON.stringify({
					currentTable: tableId,
					lastSeen: new Date().toISOString()
				})
			});

			// Get table details
			const tableResponse = await this.apiCall(`/api/game/tables/${tableId}`);

			// Update game state
			gameStore.update((state) => ({
				...state,
				currentView: 'dialog',
				currentTable: tableResponse.data
			}));
		} catch (error) {
			console.error('Failed to sit at table:', error);
		}
	}

	// Start a dialog session
	async startDialog(
		participants: string[],
		type: 'table' | 'private' | 'room',
		tableId?: string,
		roomId?: string
	): Promise<GameDialog> {
		try {
			const dialogData: DialogData = {
				type,
				participants,
				tableId,
				roomId
			};

			const response = await this.apiCall('/api/game/dialog', {
				method: 'POST',
				body: JSON.stringify(dialogData)
			});

			// Update game state
			gameStore.update((state) => ({
				...state,
				currentView: 'dialog',
				currentDialog: response.data
			}));

			return response.data;
		} catch (error) {
			console.error('Failed to start dialog:', error);
			throw error;
		}
	}

	// Leave current location (room, table, or building)
	async leaveCurrentLocation(userId: string) {
		try {
			const $gameStore = gameStore;
			let currentState: GameState;
			
			const unsubscribe = $gameStore.subscribe(state => {
				currentState = state;
			});
			unsubscribe();

			// Remove from current location
			if (currentState!.currentRoom) {
				// Remove from room's active members
				const room = currentState!.currentRoom;
				const updatedMembers = (room.activeMembers || []).filter(id => id !== userId);
				await this.apiCall(`/api/game/rooms/${room.id}`, {
					method: 'PATCH',
					body: JSON.stringify({ activeMembers: updatedMembers })
				});
			}

			// Update hero location
			await this.apiCall(`/api/game/heroes/${userId}`, {
				method: 'PATCH',
				body: JSON.stringify({
					currentBuilding: null,
					currentRoom: null,
					currentTable: null,
					lastSeen: new Date().toISOString()
				})
			});

			// Return to world view
			gameStore.update((state) => ({
				...state,
				currentView: 'building',
				currentBuilding: null,
				currentRoom: null,
				currentTable: null,
				currentDialog: null
			}));
		} catch (error) {
			console.error('Failed to leave current location:', error);
		}
	}
}

export const gameService = GameService.getInstance();
// src/lib/stores/gameStore.ts
import { writable } from 'svelte/store';
import type { 
  GameState, 
  GameMap, 
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
  currentView: 'map',
  currentMap: null,
  currentRoom: null,
  currentTable: null,
  currentDialog: null,
  heroPawn: null,
  viewportPosition: { x: 0, y: 0 },
  zoomLevel: 1,
  isLoading: false
});

// Additional stores for game data
export const gameMapStore = writable<GameMap[]>([]);
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
      console.error(`[GAME SERVICE] API call failed: ${response.status} ${response.statusText} for ${endpoint}`);
      throw new Error(`API call failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[GAME SERVICE] Response data:`, result);
    return result;
  }
  
  // Initialize game for a user
  async initializeGame(userId: string, projectId?: string) {
    try {
      gameStore.update(state => ({ ...state, isLoading: true }));
      
      // Get or create hero
      const hero = await this.getOrCreateHero(userId, projectId);
      
      // Load map data
      await this.loadMapData(projectId);
      
      // Load other heroes
      await this.loadOtherHeroes(userId);
      
      gameStore.update(state => ({ 
        ...state, 
        heroPawn: hero,
        isLoading: false 
      }));
      
    } catch (error) {
      console.error('Failed to initialize game:', error);
      gameStore.update(state => ({ ...state, isLoading: false }));
    }
  }

  // Get or create hero (no longer used for movement updates)
  async getOrCreateHero(userId: string, projectId?: string): Promise<GameHero> {
    console.log(`[GAME SERVICE] Getting or creating hero for user: ${userId}, project: ${projectId}`);
    try {
      const response = await this.apiCall(`/api/game/hero/${userId}`);
      return response.hero;
    } catch (error) {
      console.log(`[GAME SERVICE] Hero not found, creating new one...`);
      if (error instanceof Error && error.message.includes('404')) {
        if (!projectId) {
          throw new Error('Project ID required to create hero');
        }
        const response = await this.apiCall(`/api/game/hero`, {
          method: 'POST',
          body: JSON.stringify({
            user: userId,
            currentProject: projectId,
            position: { x: 400, y: 300 },
            currentMap: null,
            currentRoom: null,
            currentTable: null,
            isMoving: false
          })
        });
        return response.hero;
      }
      throw error;
    }
  }
  
  // Load map data
  async loadMapData(projectId?: string) {
    try {
      const mapsUrl = projectId ? `/api/game/maps?project=${projectId}` : '/api/game/maps';
      const mapsResponse = await this.apiCall(mapsUrl);
      gameMapStore.set(mapsResponse.maps);
      
      const roadsUrl = projectId ? `/api/game/roads?project=${projectId}` : '/api/game/roads';
      const roadsResponse = await this.apiCall(roadsUrl);
      gameRoadStore.set(roadsResponse.roads);
      
      // Load rooms
      const roomsUrl = projectId ? `/api/game/rooms?project=${projectId}` : '/api/game/rooms';
      const roomsResponse = await this.apiCall(roomsUrl);
      gameRoomStore.set(roomsResponse.rooms);
      
    } catch (error) {
      console.error('Failed to load map data:', error);
    }
  }
  
  // Load other heroes
  async loadOtherHeroes(currentUserId: string) {
    try {
      const response = await this.apiCall(`/api/game/heroes?exclude=${currentUserId}`);
      otherHeroesStore.set(response.heroes);
    } catch (error) {
      console.error('Failed to load other heroes:', error);
    }
  }
  
  // REMOVED: moveHeroTo method - now handled by gameClient
  
  // Enter a map container (building)
  async enterGameMap(userId: string, mapContainerId: string) {
    try {
      await this.apiCall(`/api/game/hero/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          currentMap: mapContainerId,
          currentRoom: null,
          currentTable: null,
          lastSeen: new Date().toISOString()
        })
      });
      
      // Get map container details
      const mapResponse = await this.apiCall(`/api/game/maps/${mapContainerId}`);
      
      // Update game state
      gameStore.update(state => ({
        ...state,
        currentView: 'room',
        currentMap: mapResponse.map,
        currentRoom: null,
        currentTable: null
      }));
      
    } catch (error) {
      console.error('Failed to enter map container:', error);
    }
  }
  
  // Enter a room within a building
  async enterRoom(userId: string, roomId: string) {
    try {
      await this.apiCall(`/api/game/hero/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          currentRoom: roomId,
          currentTable: null,
          lastSeen: new Date().toISOString()
        })
      });
      
      // Add user to room's current users
      await this.apiCall(`/api/game/rooms/${roomId}/join`, {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
      
      // Get room details
      const roomResponse = await this.apiCall(`/api/game/rooms/${roomId}`);
      
      // Update game state
      gameStore.update(state => ({
        ...state,
        currentView: 'room',
        currentRoom: roomResponse.room,
        currentTable: null
      }));
      
    } catch (error) {
      console.error('Failed to enter room:', error);
    }
  }
  
  // Sit at a table
  async sitAtTable(userId: string, tableId: string) {
    try {
      await this.apiCall(`/api/game/hero/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          currentTable: tableId,
          lastSeen: new Date().toISOString()
        })
      });
      
      // Add user to table's current users
      await this.apiCall(`/api/game/tables/${tableId}/join`, {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
      
      // Get table details
      const tableResponse = await this.apiCall(`/api/game/tables/${tableId}`);
      
      // Update game state
      gameStore.update(state => ({
        ...state,
        currentView: 'table',
        currentTable: tableResponse.table
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
      gameStore.update(state => ({
        ...state,
        currentView: 'dialog',
        currentDialog: response.dialog
      }));
      
      return response.dialog;
      
    } catch (error) {
      console.error('Failed to start dialog:', error);
      throw error;
    }
  }
    
  // Leave current location (room, table, or building)
  async leaveCurrentLocation(userId: string) {
    try {
      await this.apiCall(`/api/game/hero/${userId}/leave`, {
        method: 'POST'
      });
      
      // Return to map view
      gameStore.update(state => ({
        ...state,
        currentView: 'map',
        currentMap: null,
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
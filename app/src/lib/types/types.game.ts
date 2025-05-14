import type { RecordModel } from 'pocketbase';
import type { User, Messages, Projects } from '$lib/types/types';

export interface GamePosition {
  x: number;
  y: number;
}

export interface GameMap extends RecordModel {
  id: string;
  name: string;
  type: 'office' | 'factory' | 'logistics' | 'support';
  project: Projects;
  position: GamePosition;
  description: string;
  isActive: boolean;
  rooms: string[]; 
  created: string;
  updated: string;
}

export interface GameRoom extends RecordModel {
  id: string;
  name: string;
  type: 'hr' | 'library' | 'manufacturing' | 'assembly' | 'qa' | 'inbound' | 'outbound' | 'support_desk';
  project: string;
  mapContainer: string;
  tables: string[]; 
  position: GamePosition;
  description: string;
  capacity: number;
  currentUsers: string[];
  created: string;
  updated: string;
}

export interface GameTable extends RecordModel {
  id: string;
  name: string;
  project: string; 
  map: string;
  room: string;
  position: GamePosition;
  maxUsers: number;
  currentUsers: string[]; 
  currentThread: string | null; 
  isActive: boolean;
  created: string;
  updated: string;
}

export interface GameHero extends RecordModel {
  id: string;
  user: string;
  position: GamePosition;
  projects: Projects[];
  currentProject: string;
  currentMap: string | null; 
  currentRoom: string | null; 
  currentTable: string | null;
  isMoving: boolean;
  lastSeen: string;
  created: string;
  updated: string;
    expand?: {
    user?: User;
  };
}

export interface GameDialog extends RecordModel {
  id: string;
  type: 'table' | 'private' | 'room';
  participants: string[]; 
  room: string | null; 
  table: string | null; 
  currentThread: string; 
  isActive: boolean;
  created: string;
  updated: string;
}

export interface GameState {
  currentView: 'map' | 'room' | 'table' | 'dialog';
  currentMap: GameMap | null;
  currentRoom: GameRoom | null;
  currentTable: GameTable | null;
  currentDialog: GameDialog | null;
  heroPawn: GameHero | null;
  viewportPosition: GamePosition;
  zoomLevel: number;
  isLoading: boolean;
}

export interface GameRoad {
  id: string;
  from: string; 
  to: string;
  path: GamePosition[];
  isActive: boolean;
  messageFlow: {
    direction: 'bidirectional' | 'from_to' | 'to_from';
    animating: boolean;
  };
}
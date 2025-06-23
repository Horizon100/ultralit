import type { RecordModel } from 'pocketbase';
import type { User } from '$lib/types/types';

export interface GamePosition {
	x: number;
	y: number;
}

export interface GameTile {
	width: number;
	height: number;
}

export interface GameOrganization extends RecordModel {
	id: string;
	name: string;
	description: string;
	createdBy: User;
	isPublic: boolean;
	isActive: boolean;
	buildings: string[];
	members: string[];
	rooms: string[];
	tables: string[];
	roads: string[];
	created: string;
	updated: string;
}
export interface GameBuilding extends RecordModel {
	id: string;
	name: string;
	description: string;
	organization: string;
	rooms: string[];
	tables: string[];
	position: GamePosition;
	size: GameTile;
	isPublic: boolean;
	isActive: boolean;
	buildingType: string;
	created: string;
	updated: string;
}
export interface GameRoom extends RecordModel {
	id: string;
	name: string;
	description: string;
	organization: string;
	building: string;
	tables: string[];
	position: GamePosition;
	size: GameTile;
	isPublic: boolean;
	isActive: boolean;
	capacity: number;
	activeMembers: string[];
	created: string;
	updated: string;
}

export interface GameTable extends RecordModel {
	id: string;
	name: string;
	organization: string;
	building: string;
	room: string;
	dialog: string[];
	position: GamePosition;
	size: GameTile;
	capacity: number;
	isPublic: boolean;
	isActive: boolean;
	created: string;
	updated: string;
}

export interface GameActivity extends RecordModel {
	visitCount: number;
	visitDuration: number;
	organizationVisits: string[];
	buildingVisits: string[];
	roomVisits: string[];
	tableVisits: string[];
	dialogVisits: string[];
}

export interface GameHero extends RecordModel {
	id: string;
	user: string;
	position: GamePosition;
	organization: string[];
	currentOrganization: string;
	currentBuilding: string | null;
	currentRoom: string | null;
	currentTable: string | null;
	isMoving: boolean;
	activityLog: GameActivity;
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
	currentOrganization: GameOrganization | null;
	currentView: 'building' | 'room' | 'table' | 'dialog';
	currentBuilding: GameBuilding | null;
	currentRoom: GameRoom | null;
	currentTable: GameTable | null;
	currentDialog: GameDialog | null;
	heroPawn: GameHero | null;
	viewportPosition: GamePosition;
	zoomLevel: number;
	isLoading: boolean;
}

export interface GameRoad {
	hasTraffic: string;
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

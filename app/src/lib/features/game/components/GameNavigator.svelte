<!-- src/lib/features/game/components/GameNavigator.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { gameStore } from '$lib/stores/gameStore';
	import { currentUser } from '$lib/pocketbase';
	import { gameClient } from '$lib/clients/gameClient';
	import AddHero from './AddHero.svelte';
	import { showSidenav } from '$lib/stores/sidenavStore';
	import GameDynamicSidenav from '$lib/components/navigation/GameDynamicSidenav.svelte';
	import MapGrid from './MapGrid.svelte';
	import BuildingView from './BuildingView.svelte';
	import Hero from './Hero.svelte';
	import Road from './Road.svelte';
	import { gameService, gameRoadStore, otherHeroesStore } from '$lib/stores/gameStore';
	import type {
		GameState,
		GameOrganization,
		GameBuilding,
		GameRoad,
		GameRoom,
		GameHero,
		GameBuildingType,
		GamePageData
	} from '$lib/types/types.game';

	export let data: GamePageData;

	// World grid configuration
	const WORLD_GRID_SIZE = 50;
	const WORLD_MAP_WIDTH = 50;
	const WORLD_MAP_HEIGHT = 50;

	// Game state
	let organizations: GameOrganization[] = [];
	let buildings: GameBuilding[] = [];
	let rooms: GameRoom[] = [];
	let loading = true;
	let isCreatingBuilding = false;
	let selectedBuildingType = '';

	// Building types
	const buildingTypes = [
		{ id: 'house', name: 'House', icon: '🏠', size: { width: 6, height: 6 } },
		{ id: 'office', name: 'Office', icon: '🏢', size: { width: 9, height: 9 } },
		{ id: 'shop', name: 'Shop', icon: '🏪', size: { width: 6, height: 6 } },
		{ id: 'factory', name: 'Factory', icon: '🏭', size: { width: 9, height: 6 } },
		{ id: 'warehouse', name: 'Warehouse', icon: '🏗️', size: { width: 9, height: 9 } }
	];

	// Room layout for buildings (4 rooms + lobby, each room 3x3 cells minimum)
	const ROOM_LAYOUTS = {
		2: [
			// 2x2 building - too small for 3x3 rooms, use 1x1
			{ name: 'Lobby', position: { x: 0, y: 0 }, size: { width: 1, height: 1 } },
			{ name: 'Room A', position: { x: 1, y: 0 }, size: { width: 1, height: 1 } },
			{ name: 'Room B', position: { x: 0, y: 1 }, size: { width: 1, height: 1 } },
			{ name: 'Room C', position: { x: 1, y: 1 }, size: { width: 1, height: 1 } }
		],
		3: [
			// 3x3 building - each room takes full space
			{ name: 'Lobby', position: { x: 0, y: 0 }, size: { width: 3, height: 3 } }
		],
		4: [
			// 4x4 building
			{ name: 'Lobby', position: { x: 1, y: 1 }, size: { width: 2, height: 2 } },
			{ name: 'Room A', position: { x: 0, y: 0 }, size: { width: 1, height: 1 } },
			{ name: 'Room B', position: { x: 3, y: 0 }, size: { width: 1, height: 1 } },
			{ name: 'Room C', position: { x: 0, y: 3 }, size: { width: 1, height: 1 } },
			{ name: 'Room D', position: { x: 3, y: 3 }, size: { width: 1, height: 1 } }
		],
		6: [
			// 6x6 building - proper 3x3 rooms
			{ name: 'Lobby', position: { x: 1, y: 1 }, size: { width: 3, height: 3 } },
			{ name: 'Room A', position: { x: 0, y: 0 }, size: { width: 3, height: 3 } },
			{ name: 'Room B', position: { x: 3, y: 0 }, size: { width: 3, height: 3 } },
			{ name: 'Room C', position: { x: 0, y: 3 }, size: { width: 3, height: 3 } },
			{ name: 'Room D', position: { x: 3, y: 3 }, size: { width: 3, height: 3 } }
		],
		9: [
			// 9x9 building - larger 3x3 rooms with spacing
			{ name: 'Lobby', position: { x: 3, y: 3 }, size: { width: 3, height: 3 } },
			{ name: 'Room A', position: { x: 0, y: 0 }, size: { width: 3, height: 3 } },
			{ name: 'Room B', position: { x: 6, y: 0 }, size: { width: 3, height: 3 } },
			{ name: 'Room C', position: { x: 0, y: 6 }, size: { width: 3, height: 3 } },
			{ name: 'Room D', position: { x: 6, y: 6 }, size: { width: 3, height: 3 } }
		],
		18: [
			// 18x18 building - 4 separate 9x9 rooms, no overlap
			{ name: 'Room A', position: { x: 0, y: 0 }, size: { width: 9, height: 9 } },
			{ name: 'Room B', position: { x: 9, y: 0 }, size: { width: 9, height: 9 } },
			{ name: 'Room C', position: { x: 0, y: 9 }, size: { width: 9, height: 9 } },
			{ name: 'Room D', position: { x: 9, y: 9 }, size: { width: 9, height: 9 } }
		],
		20: [
			// 20x20 building - 4 separate 9x9 rooms with 2-cell corridors
			{ name: 'Room A', position: { x: 0, y: 0 }, size: { width: 9, height: 9 } },
			{ name: 'Room B', position: { x: 11, y: 0 }, size: { width: 9, height: 9 } },
			{ name: 'Room C', position: { x: 0, y: 11 }, size: { width: 9, height: 9 } },
			{ name: 'Room D', position: { x: 11, y: 11 }, size: { width: 9, height: 9 } }
		]
	};

	// Camera/viewport management
	let mapContainer: HTMLDivElement;
	let mapGrid: MapGrid;
	let camera = {
		x: 0,
		y: 0,
		targetX: 0,
		targetY: 0,
		smoothing: 0.1
	};

	// Store subscriptions
	$: roads = $gameRoadStore || [];
	$: otherHeroes = $otherHeroesStore;
	$: heroPosition = $gameStore.heroPawn?.position;
	$: visibleHeroes = filterHeroesByOrganization(otherHeroes, $gameStore.currentOrganization);

	function filterHeroesByOrganization(
		heroes: GameHero[],
		currentOrg: GameOrganization | null
	): GameHero[] {
		if (!currentOrg || !currentOrg.members || !heroes) {
			console.log('[DEBUG] No organization or members to filter by');
			return [];
		}

		// Get the hero IDs that are members of the current organization
		const memberHeroIds = currentOrg.members;
		console.log('[DEBUG] Organization members:', memberHeroIds);

		// Filter heroes to only include those who are members
		const filtered = heroes.filter((hero) => {
			const isMember = memberHeroIds.includes(hero.id);
			console.log(`[DEBUG] Hero ${hero.id} is member: ${isMember}`);
			return isMember;
		});

		console.log('[DEBUG] Filtered heroes count:', filtered.length);
		return filtered;
	}

	// Load buildings separately
	async function loadBuildings() {
		try {
			const buildingsResponse = await fetch('/api/game/buildings');
			if (buildingsResponse.ok) {
				const buildingsData = await buildingsResponse.json();
				buildings = buildingsData.data || [];
				console.log('Buildings loaded:', buildings.length);
			}
		} catch (buildingError) {
			console.log('Buildings not available:', buildingError);
			buildings = [];
		}
	}

	// Load rooms separately
	async function loadRooms() {
		try {
			const roomsResponse = await fetch('/api/game/rooms');
			if (roomsResponse.ok) {
				const roomsData = await roomsResponse.json();
				rooms = roomsData.data || [];
				console.log('Rooms loaded:', rooms.length);
			}
		} catch (roomError) {
			console.log('Rooms not available:', roomError);
			rooms = [];
		}
	}

	// Load world data
	async function loadWorldData() {
		try {
			loading = true;

			// Load organizations first
			try {
				const orgsResponse = await fetch('/api/game/organizations');
				if (orgsResponse.ok) {
					const orgsData = await orgsResponse.json();
					organizations = orgsData.data || [];
				} else {
					console.log('No organizations endpoint or empty world');
					organizations = [];
				}
			} catch (orgError) {
				console.log('Organizations not available yet:', orgError);
				organizations = [];
			}

			// Always try to load buildings and rooms
			await loadBuildings();
			await loadRooms();
		} catch (error) {
			console.error('Failed to load world data:', error);
			organizations = [];
			buildings = [];
		} finally {
			loading = false;
		}
	}

	// Building creation functions
	function selectBuildingType(buildingType: GameBuildingType) {
		selectedBuildingType = buildingType.id;
		isCreatingBuilding = true;
		console.log('Selected building type:', buildingType.name);
	}

	function cancelBuildingCreation() {
		isCreatingBuilding = false;
		selectedBuildingType = '';
	}

	// Create rooms for a building
	async function createRoomsForBuilding(building: GameBuilding) {
		try {
			console.log('=== CREATING ROOMS FOR BUILDING ===');
			console.log('Building:', building);
			console.log('Building ID:', building.id);
			console.log('Building size:', building.size);
			console.log('Building position:', building.position);

			// Get room layout based on building size
			const buildingSize = Math.max(building.size.width, building.size.height);
			console.log('Calculated building size:', buildingSize);

			const roomLayout = ROOM_LAYOUTS[buildingSize as keyof typeof ROOM_LAYOUTS] || ROOM_LAYOUTS[3];
			console.log('Selected room layout:', roomLayout);
			console.log('Number of rooms to create:', roomLayout.length);

			const createdRooms = [];

			for (let i = 0; i < roomLayout.length; i++) {
				const room = roomLayout[i];
				if (room.name.includes('Corridor') || room.name.includes('Lobby')) {
					continue;
				}

				console.log(`\n--- Creating room ${i + 1}/${roomLayout.length}: ${room.name} ---`);

				const roomPixelPosition = {
					x: building.position.x + room.position.x * WORLD_GRID_SIZE,
					y: building.position.y + room.position.y * WORLD_GRID_SIZE
				};

				console.log(`Room ${room.name} position calculation:`);
				console.log(`  Building position: ${building.position.x}, ${building.position.y}`);
				console.log(`  Room offset: ${room.position.x}, ${room.position.y}`);
				console.log(`  Grid size: ${WORLD_GRID_SIZE}`);
				console.log(`  Final position: ${roomPixelPosition.x}, ${roomPixelPosition.y}`);

				const roomData = {
					name: room.name,
					description: room.name === 'Lobby' ? 'Main lobby area' : `Meeting room`,
					organization: building.organization,
					building: building.id,
					position: roomPixelPosition,
					size: room.size,
					isPublic: false,
					capacity: room.name === 'Lobby' ? 20 : 10
				};

				console.log('Room data to send:', roomData);

				try {
					console.log('Making POST request to /api/game/rooms...');
					const roomResponse = await fetch('/api/game/rooms', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(roomData)
					});

					console.log(`Room ${room.name} response status:`, roomResponse.status);
					console.log(
						`Room ${room.name} response headers:`,
						Array.from(roomResponse.headers.entries())
					);

					if (roomResponse.ok) {
						const roomResult = await roomResponse.json();
						console.log(`✅ Room ${room.name} created successfully:`, roomResult);
						createdRooms.push(roomResult.data.id);
					} else {
						const errorText = await roomResponse.text();
						console.error(`❌ Failed to create room ${room.name}:`, errorText);

						// Try to parse as JSON for better error info
						try {
							const errorJson = JSON.parse(errorText);
							console.error(`Room creation error details:`, errorJson);
						} catch (parseError) {
							console.error(`Raw error response:`, errorText);
						}
					}
				} catch (roomError) {
					console.error(`💥 Exception creating room ${room.name}:`, roomError);
				}
			}

			console.log('\n=== ROOM CREATION SUMMARY ===');
			console.log('Total rooms attempted:', roomLayout.length);
			console.log('Total rooms created successfully:', createdRooms.length);
			console.log('Created room IDs:', createdRooms);

			if (createdRooms.length > 0) {
				console.log('\n--- Updating building with room references ---');
				try {
					const updateResponse = await fetch(`/api/game/buildings/${building.id}`, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							rooms: createdRooms
						})
					});

					console.log('Building update response status:', updateResponse.status);

					if (updateResponse.ok) {
						const updateResult = await updateResponse.json();
						console.log('✅ Building updated with room references successfully:', updateResult);
					} else {
						const updateError = await updateResponse.text();
						console.error('❌ Failed to update building with room references:', updateError);
					}
				} catch (updateError) {
					console.error('💥 Exception updating building with rooms:', updateError);
				}
			} else {
				console.warn('⚠️ No rooms were created, skipping building update');
			}
		} catch (error) {
			console.error('💥 Error in createRoomsForBuilding:', error);
		}
	}

	async function createBuilding(gridX: number, gridY: number) {
		if (!isCreatingBuilding || !selectedBuildingType || !data.user) {
			console.log('Cannot create building - missing requirements:', {
				isCreatingBuilding,
				selectedBuildingType,
				hasUser: !!data.user
			});
			return;
		}

		if (!$gameStore.currentOrganization) {
			alert('No organization selected. Please select an organization first.');
			return;
		}

		const buildingType = buildingTypes.find((bt) => bt.id === selectedBuildingType);
		if (!buildingType) return;

		// Check if area is clear
		if (isBuildingAreaBlocked(gridX, gridY, buildingType.size)) {
			alert('Cannot place building here - area is blocked!');
			return;
		}

		try {
			// Use grid coordinates directly converted to pixels (top-left corner)
			const pixelPosition = {
				x: gridX * WORLD_GRID_SIZE,
				y: gridY * WORLD_GRID_SIZE
			};

			console.log('=== BUILDING CREATION DEBUG ===');
			console.log('Attempting to create building at grid:', { gridX, gridY });
			console.log('Pixel position:', pixelPosition);
			console.log('Current organization:', $gameStore.currentOrganization);
			console.log('Building type:', buildingType);

			const buildingData = {
				name: `${buildingType.name} ${buildings.length + 1}`,
				description: `A ${buildingType.name.toLowerCase()} building`,
				organization: $gameStore.currentOrganization.id,
				position: pixelPosition,
				size: buildingType.size,
				buildingType: buildingType.id,
				isPublic: false
			};

			console.log('Building data to send:', buildingData);

			// Create the building first
			const response = await fetch('/api/game/buildings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildingData)
			});

			console.log('Building creation response status:', response.status);
			console.log('Building creation response headers:', Array.from(response.headers.entries()));

			if (response.ok) {
				const result = await response.json();
				const newBuilding = result.data;
				console.log('✅ Building created successfully:', newBuilding);

				// Create rooms for the new building
				await createRoomsForBuilding(newBuilding);

				// Add the new building to the list immediately
				buildings = [...buildings, newBuilding];

				// Also reload buildings and rooms to ensure we have the latest data
				await loadBuildings();
				await loadRooms();

				// Reset creation mode
				cancelBuildingCreation();
			} else {
				// Handle non-JSON error responses
				let errorMessage = 'Unknown error';
				let errorDetails = null;

				try {
					const error = await response.json();
					errorMessage = error.error || error.message || 'Failed to create building';
					errorDetails = error;
					console.error('❌ Building creation JSON error:', error);
				} catch (parseError) {
					// If response isn't JSON, get the text
					const errorText = await response.text();
					console.error('❌ Building creation non-JSON error:', errorText);
					errorMessage = `Server error (${response.status}): ${response.statusText}`;
					errorDetails = { rawError: errorText };
				}

				console.error('Building creation failed:', {
					status: response.status,
					statusText: response.statusText,
					errorMessage,
					errorDetails,
					sentData: buildingData
				});

				alert(`Failed to create building: ${errorMessage}`);
			}
		} catch (error) {
			console.error('Building creation error:', error);
			alert('Failed to create building. Please try again.');
		}
	}

	function isBuildingAreaBlocked(
		gridX: number,
		gridY: number,
		size: { width: number; height: number }
	): boolean {
		// Check if building would go outside world bounds
		if (gridX + size.width > WORLD_MAP_WIDTH || gridY + size.height > WORLD_MAP_HEIGHT) {
			return true;
		}

		// Check for overlaps with existing buildings
		for (let x = gridX; x < gridX + size.width; x++) {
			for (let y = gridY; y < gridY + size.height; y++) {
				if (isPositionBlocked(x, y)) {
					return true;
				}
			}
		}

		return false;
	}

	// Camera management
	function followHero() {
		if (!$gameStore.heroPawn || !mapContainer) return;

		const heroPos = $gameStore.heroPawn.position;
		const containerRect = mapContainer.getBoundingClientRect();

		const viewportCenterX = containerRect.width / 2;
		const viewportCenterY = containerRect.height / 2;

		camera.targetX = viewportCenterX - heroPos.x;
		camera.targetY = viewportCenterY - heroPos.y;

		// Constrain camera to world bounds
		const worldPixelWidth = WORLD_MAP_WIDTH * WORLD_GRID_SIZE;
		const worldPixelHeight = WORLD_MAP_HEIGHT * WORLD_GRID_SIZE;

		camera.targetX = Math.min(0, Math.max(containerRect.width - worldPixelWidth, camera.targetX));
		camera.targetY = Math.min(0, Math.max(containerRect.height - worldPixelHeight, camera.targetY));
	}

	function updateCamera() {
		camera.x += (camera.targetX - camera.x) * camera.smoothing;
		camera.y += (camera.targetY - camera.y) * camera.smoothing;

		if (mapContainer) {
			const gridElement = mapContainer.querySelector('.map-grid') as HTMLElement;
			if (gridElement) {
				gridElement.style.transform = `translate(${camera.x}px, ${camera.y}px)`;
			}
		}

		requestAnimationFrame(updateCamera);
	}

	// Movement handling
	function setupKeyboardControls() {
		window.addEventListener('keydown', (e) => {
			// Cancel building creation on Escape
			if (e.key === 'Escape' && isCreatingBuilding) {
				cancelBuildingCreation();
				return;
			}

			const $gameStore = get(gameStore);
			if (!$gameStore.heroPawn || !data.user || isCreatingBuilding) return;

			let direction = '';
			switch (e.key) {
				case 'ArrowUp':
				case 'w':
				case 'W':
					direction = 'up';
					break;
				case 'ArrowDown':
				case 's':
				case 'S':
					direction = 'down';
					break;
				case 'ArrowLeft':
				case 'a':
				case 'A':
					direction = 'left';
					break;
				case 'ArrowRight':
				case 'd':
				case 'D':
					direction = 'right';
					break;
				default:
					return;
			}

			e.preventDefault();
			handleGridMovement(direction);
		});
	}

	async function handleGridMovement(direction: string) {
		const $gameStore = get(gameStore);
		if (!$gameStore.heroPawn || !data.user || !mapGrid) return;

		const currentPos = $gameStore.heroPawn.position;
		const gridX = mapGrid.pixelToGrid(currentPos.x);
		const gridY = mapGrid.pixelToGrid(currentPos.y);

		let newGridX = gridX;
		let newGridY = gridY;

		switch (direction) {
			case 'up':
				newGridY = Math.max(0, gridY - 1);
				break;
			case 'down':
				newGridY = Math.min(WORLD_MAP_HEIGHT - 1, gridY + 1);
				break;
			case 'left':
				newGridX = Math.max(0, gridX - 1);
				break;
			case 'right':
				newGridX = Math.min(WORLD_MAP_WIDTH - 1, gridX + 1);
				break;
		}

		// Check for collisions with buildings
		if (!isPositionBlocked(newGridX, newGridY)) {
			const newPixelPos = {
				x: mapGrid.gridToPixel(newGridX),
				y: mapGrid.gridToPixel(newGridY)
			};

			await gameClient.moveHeroImmediate(data.user.id, newPixelPos);
		}
	}

	/*
	 * Check if position is blocked by buildings
	 * Check if position is blocked by buildings
	 */
	function isPositionBlocked(gridX: number, gridY: number): boolean {
		return buildings.some((building) => {
			if (!building || !building.size || !building.position) return false;

			// Convert building pixel position to grid coordinates
			const buildingGridX = Math.floor(building.position.x / WORLD_GRID_SIZE);
			const buildingGridY = Math.floor(building.position.y / WORLD_GRID_SIZE);
			const buildingWidth = building.size?.width || 2;
			const buildingHeight = building.size?.height || 2;

			// Check if position is within building bounds
			const isInBuilding =
				gridX >= buildingGridX &&
				gridX < buildingGridX + buildingWidth &&
				gridY >= buildingGridY &&
				gridY < buildingGridY + buildingHeight;

			if (!isInBuilding) return false;

			// If inside building, check if position is in a room or lobby (allow movement)
			const matchingRooms = rooms.filter((room) => room.building === building.id);
			const isInRoom = matchingRooms.some((room) => {
				if (!room.position || !room.size) return false;
				const roomGridX = Math.floor(room.position.x / WORLD_GRID_SIZE);
				const roomGridY = Math.floor(room.position.y / WORLD_GRID_SIZE);
				return (
					gridX >= roomGridX &&
					gridX < roomGridX + room.size.width &&
					gridY >= roomGridY &&
					gridY < roomGridY + room.size.height
				);
			});

			return !isInRoom;
		});
	}

	// Handle grid clicks for movement or building placement
	async function onGridClick(event: CustomEvent) {
		const { gridX, gridY, pixelX, pixelY } = event.detail;

		if (isCreatingBuilding) {
			await createBuilding(gridX, gridY);
		} else if (!isPositionBlocked(gridX, gridY) && data.user) {
			await gameClient.moveHeroImmediate(data.user.id, { x: pixelX, y: pixelY });
		}
	}

	// Building interaction
	async function enterBuilding(building: GameBuilding) {
		try {
			if (data.user) {
				await fetch(`/api/game/heroes/${data.user.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						currentBuilding: building.id,
						position: building.position
					})
				});
			}

			goto(`/game/building/${building.id}`);
		} catch (error) {
			console.error('Failed to enter building:', error);
		}
	}

	// React to hero position changes
	$: if (heroPosition) {
		followHero();
	}

	onMount(async () => {
		if (browser) {
			setupKeyboardControls();
			updateCamera();
			await loadWorldData();

			const user = get(currentUser);
			if (user) {
				gameClient.initializeVisibilityHandling(user.id);
				await gameService.initializeGame(user.id);
			}
		}
	});
</script>

<div class="world-navigator" class:drawer-visible={$showSidenav}>
	<!-- Building creation toolbar -->
	{#if $showSidenav}
		<GameDynamicSidenav
			width={300}
			{buildingTypes}
			{selectedBuildingType}
			{isCreatingBuilding}
			onSelectBuildingType={selectBuildingType}
			onCancelBuilding={cancelBuildingCreation}
		/>
	{/if}

	<!-- Main world view -->
	<div
		bind:this={mapContainer}
		class="world-container"
		class:drawer-visible={$showSidenav}
		in:fly={{ x: -200, duration: 100 }}
		out:fly={{ x: -200, duration: 500 }}
	>
		{#if loading}
			<div class="loading-overlay">
				<div class="spinner"></div>
				<p>Loading world...</p>
			</div>
		{:else}
			<MapGrid
				bind:this={mapGrid}
				width={WORLD_MAP_WIDTH}
				height={WORLD_MAP_HEIGHT}
				cellSize={WORLD_GRID_SIZE}
				showGrid={true}
				allowMovement={true}
				gridClass="world-grid {isCreatingBuilding ? 'building-mode' : ''}"
				on:gridClick={onGridClick}
			>
				<!-- Roads -->
				{#each roads as road}
					{#if road && road.path && road.path.length >= 2}
						<Road {road} GRID_SIZE={WORLD_GRID_SIZE} />
					{/if}
				{/each}

				<!-- Buildings with room layouts -->
				{#each buildings as building}
					{#if building && building.position && building.size}
						<!-- Building container -->
						<div
							style="position: absolute; 
								   left: {building.position.x}px; 
								   top: {building.position.y}px; 
								   width: {building.size.width * WORLD_GRID_SIZE}px; 
								   height: {building.size.height * WORLD_GRID_SIZE}px; 
								   background: rgba(139, 69, 19, 0.3); 
								   border: 3px solid #8B4513; 
								   z-index: 15;
								   box-sizing: border-box;"
							title="Building: {building.name}"
						>
							<!-- Building name label -->
							<div
								style="position: absolute; top: -25px; left: 0; background: #8B4513; color: white; padding: 2px 8px; font-size: 12px; border-radius: 3px; font-weight: bold;"
							>
								{building.name}
							</div>

							<!-- Show rooms inside this building -->
							{#each rooms.filter((room) => room.building === building.id) as room}
								{#if room && room.position && room.size}
									<!-- Debug room positioning -->
									{@const relativeX = room.position.x - building.position.x}
									{@const relativeY = room.position.y - building.position.y}
									{@const roomWidth = room.size.width * WORLD_GRID_SIZE}
									{@const roomHeight = room.size.height * WORLD_GRID_SIZE}

									<div
										style="position: absolute;
											   left: {relativeX}px;
											   top: {relativeY}px;
											   width: {roomWidth}px;
											   height: {roomHeight}px;
											   background: {room.name === 'Lobby' ? 'rgba(255, 215, 0, 0.6)' : 'rgba(135, 206, 235, 0.6)'};
											   border: 2px solid {room.name === 'Lobby' ? '#FFD700' : '#4682B4'};
											   display: flex;
											   align-items: center;
											   justify-content: center;
											   box-sizing: border-box;"
										title="{room.name} - Capacity: {room.capacity} - Size: {room.size.width}x{room
											.size.height} - Pos: {relativeX},{relativeY}"
									>
										<span
											style="font-size: 12px; color: black; font-weight: bold; text-shadow: 1px 1px 1px white; text-align: center;"
										>
											{room.name}<br />
											<small style="font-size: 8px;">{room.size.width}x{room.size.height}</small>
										</span>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				{/each}

				<!-- Other heroes -->
				{#each visibleHeroes as hero}
					<Hero {hero} isCurrentUser={false} gridSize={WORLD_GRID_SIZE} />
				{/each}

				<!-- Current hero -->
				{#if $gameStore.heroPawn}
					<Hero hero={$gameStore.heroPawn} isCurrentUser={true} gridSize={WORLD_GRID_SIZE} />
				{/if}
			</MapGrid>
		{/if}
	</div>

	<!-- Minimap -->
	<div class="minimap">
		<div class="minimap-content">
			<!-- Buildings on minimap -->
			{#each buildings as building}
				{#if building && building.position && building.size}
					<div
						class="minimap-building"
						style="left: {(building.position.x / WORLD_GRID_SIZE) * 2.4}px; 
							   top: {(building.position.y / WORLD_GRID_SIZE) * 1.6}px;
							   width: {building.size.width * 2.4}px;
							   height: {building.size.height * 1.6}px;"
					>
						<div class="minimap-building-box"></div>
					</div>
				{/if}
			{/each}

			<!-- Rooms on minimap -->
			{#each rooms as room}
				{#if room && room.position && room.size}
					<div
						class="minimap-room"
						style="left: {(room.position.x / WORLD_GRID_SIZE) * 2.4}px; 
							   top: {(room.position.y / WORLD_GRID_SIZE) * 1.6}px;
							   width: {room.size.width * 2.4}px;
							   height: {room.size.height * 1.6}px;"
					>
						<div
							class="minimap-room-dot"
							style="background: {room.name === 'Lobby' ? '#FFD700' : '#4682B4'};"
						></div>
					</div>
				{/if}
			{/each}

			<!-- Player on minimap -->
			{#if $gameStore.heroPawn}
				<div
					class="minimap-player"
					style="left: {($gameStore.heroPawn.position.x / WORLD_GRID_SIZE) *
						2.4}px; top: {($gameStore.heroPawn.position.y / WORLD_GRID_SIZE) * 1.6}px;"
				>
					<div class="minimap-player-dot"></div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.world-navigator {
		height: 89vh;
		width: 100%;
		position: relative;
		overflow: hidden;
		background-color: var(--secondary-color);

		// background: linear-gradient(135deg, #87ceeb, #e0f6ff);
	}

	.cancel-btn {
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 50%;
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 0.875rem;
		transition: background 0.2s;
	}

	.cancel-btn:hover {
		background: #dc2626;
	}

	.building-types {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.building-btn {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: white;
		border: 2px solid var(--border-primary);
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
		width: 100%;
		flex-direction: column;
		align-items: flex-start;
	}

	.building-btn:hover {
		background: var(--bg-secondary);
		border-color: var(--primary);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.building-btn.selected {
		background: var(--primary);
		color: white;
		border-color: var(--primary);
	}

	.building-btn.creating {
		animation: pulse-green 1.5s ease-in-out infinite;
	}

	.building-icon {
		font-size: 1.25rem;
		min-width: 1.5rem;
	}

	.building-name {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.building-rooms {
		font-size: 0.75rem;
		opacity: 0.7;
		color: #10b981;
		font-weight: 600;
	}

	.creation-hint {
		margin-top: 1rem;
		padding: 0.75rem;
		background: rgba(34, 197, 94, 0.1);
		border: 1px solid rgba(34, 197, 94, 0.3);
		border-radius: 0.5rem;
		font-size: 0.875rem;
	}

	.creation-hint p {
		margin: 0 0 0.25rem 0;
		color: #059669;
	}

	.hint-small {
		font-size: 0.75rem !important;
		opacity: 0.8;
	}

	.world-container {
		position: absolute;
		max-width: 1600px;
		inset: 0;
		overflow: hidden;
		transition: all 0.2s ease;
	}

	.drawer-visible .world-container {
		transform: translateX(300px);
		border-radius: 2rem !important;
		border: 1px solid var(--tertiary-color);
	}

	.loading-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: white;
		z-index: 100;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top: 2px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	.minimap {
		position: absolute;
		bottom: 12rem;
		right: 1rem;
		width: 12rem;
		height: 8rem;
		background: rgba(255, 255, 255, 0.9);
		border-radius: 0.5rem;
		border: 2px solid var(--border-primary);
		z-index: 20;
		backdrop-filter: blur(5px);
	}

	.minimap-content {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.minimap-building {
		position: absolute;
		transform: translate(-50%, -50%);
	}

	/* .minimap-building-dot {
		width: 0.75rem;
		height: 0.75rem;
		background-color: var(--primary);
		border-radius: 0.25rem;
	} */

	.minimap-building-box {
		width: 100%;
		height: 100%;
		background-color: #8b4513;
		border: 1px solid #654321;
		opacity: 0.8;
	}

	.minimap-room {
		position: absolute;
		transform: translate(-50%, -50%);
	}

	.minimap-room-dot {
		width: 100%;
		height: 100%;
		border: 1px solid rgba(255, 255, 255, 0.5);
		opacity: 0.7;
	}

	.minimap-player {
		position: absolute;
		transform: translate(-50%, -50%);
	}

	.minimap-player-dot {
		width: 0.5rem;
		height: 0.5rem;
		background-color: #ef4444;
		border-radius: 50%;
		animation: pulse 1.5s ease-in-out infinite;
	}

	:global(.world-grid) {
		background: linear-gradient(135deg, #87ceeb, #e0f6ff);
	}

	:global(.world-grid.building-mode) {
		cursor: crosshair;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	@keyframes pulse-green {
		0%,
		100% {
			background: var(--primary);
			box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
		}
		50% {
			background: #22c55e;
			box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
		}
	}

	@media (max-width: 768px) {
		.building-toolbar {
			width: 10rem;
			padding: 0.75rem;
		}

		.building-btn {
			padding: 0.5rem;
			gap: 0.5rem;
		}

		.building-name {
			font-size: 0.75rem;
		}

		.minimap {
			width: 8rem;
			height: 5rem;
		}
	}
</style>

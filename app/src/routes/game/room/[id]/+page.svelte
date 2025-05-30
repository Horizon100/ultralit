<!-- src/routes/game/room/[id]/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { GameRoom, GameTable, GameHero } from '$lib/types/types.game';
	import { gameStore } from '$lib/stores/gameStore'; 

	export let data;

	let room: GameRoom | null = null;
	let tables: GameTable[] = [];
	let activeHeroes: GameHero[] = [];
	let loading = true;
	let error = '';

	async function loadRoom() {
		try {
			loading = true;
			const roomId = $page.params.id;

			// Fetch room details
			const roomResponse = await fetch(`/api/game/rooms/${roomId}`);
			if (!roomResponse.ok) {
				throw new Error('Failed to load room');
			}
			const roomData = await roomResponse.json();
			room = roomData.data;

			// Fetch tables for this room
			const tablesResponse = await fetch(`/api/game/tables?room=${roomId}`);
			if (!tablesResponse.ok) {
				throw new Error('Failed to load tables');
			}
			const tablesData = await tablesResponse.json();
			tables = tablesData.data;

			// Fetch active heroes in this room
			await loadActiveHeroes();

			// Update game state
			gameStore.update((state: any) => ({ 
				...state,
				currentView: 'table',
				currentRoom: room
			}));

		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
			console.error('Room load error:', err);
		} finally {
			loading = false;
		}
	}

	async function loadActiveHeroes() {
		if (!room) return;
		
		try {
			const heroesResponse = await fetch(`/api/game/heroes?room=${room.id}`);
			if (heroesResponse.ok) {
				const heroesData = await heroesResponse.json();
				activeHeroes = heroesData.data;
			}
		} catch (err) {
			console.error('Failed to load active heroes:', err);
		}
	}

	async function joinTable(table: GameTable) {
		try {
			// Update hero position to table
			if (data.user) {
				await fetch(`/api/game/heroes/${data.user.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						currentTable: table.id,
						position: table.position
					})
				});
			}

			// Navigate to table/dialog view
			goto(`/game/table/${table.id}`);
		} catch (err) {
			console.error('Failed to join table:', err);
		}
	}

	async function enterRoom() {
		try {
			if (data.user && room) {
				// Add user to room's active members
				const updatedMembers = [...(room.activeMembers || [])];
				if (!updatedMembers.includes(data.user.id)) {
					updatedMembers.push(data.user.id);
				}

				await fetch(`/api/game/rooms/${room.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						activeMembers: updatedMembers
					})
				});

				// Update hero
				await fetch(`/api/game/heroes/${data.user.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						currentRoom: room.id
					})
				});

				// Reload to update active members
				await loadActiveHeroes();
			}
		} catch (err) {
			console.error('Failed to enter room:', err);
		}
	}

	onMount(() => {
		loadRoom();
		enterRoom();
	});
</script>

<div class="room-view">
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Loading room...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<h2>Error</h2>
			<p>{error}</p>
			<button on:click={() => goto('/game')}>Return to Game</button>
		</div>
	{:else if room}
		<div class="room-header">
			<div class="header-content">
				<h1>{room.name}</h1>
				<p class="description">{room.description}</p>
				<div class="room-info">
					<div class="info-item">
						<span class="label">Capacity:</span>
						<span class="value">{room.activeMembers?.length || 0}/{room.capacity}</span>
					</div>
					<div class="info-item">
						<span class="label">Tables:</span>
						<span class="value">{tables.length}</span>
					</div>
					<div class="info-item">
						<span class="label">Position:</span>
						<span class="value">({room.position.x}, {room.position.y})</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Room Grid Layout -->
		<div class="room-grid">
			<h2>Room Layout</h2>
			<div 
				class="grid-container"
				style="--grid-width: {room.size.width}; --grid-height: {room.size.height};"
			>
			{#each Array(room.size.height) as _, y}
				{#each Array(room.size.width) as _, x}
					{@const table = tables.find(t => 
						t.position.x <= x && x < t.position.x + t.size.width &&
						t.position.y <= y && y < t.position.y + t.size.height
					)}
					{#if table}
						<!-- Interactive table cell -->
						<div 
							class="grid-cell has-table"
							class:table-start={table.position.x === x && table.position.y === y}
							style="grid-column: {x + 1}; grid-row: {y + 1};"
							role="button"
							tabindex={0}
							on:click={() => joinTable(table)}
							on:keydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									joinTable(table);
								}
							}}
						>
							{#if table.position.x === x && table.position.y === y}
								<div 
									class="table-tile"
									style="width: {table.size.width * 100}%; height: {table.size.height * 100}%;"
								>
									<h3>{table.name}</h3>
									<p>0/{table.capacity} seats</p>
								</div>
							{/if}
						</div>
					{:else}
						<!-- Non-interactive empty cell -->
						<div 
							class="grid-cell"
							style="grid-column: {x + 1}; grid-row: {y + 1};"
							role="gridcell"
						>
						</div>
					{/if}
				{/each}
			{/each}
			</div>
		</div>

		<!-- Tables List -->
	<div class="tables-section">
		<h2>Available Tables</h2>
		{#if tables.length > 0}
			<div class="tables-list">
				{#each tables as table}
					<div 
						class="table-card" 
						role="button"
						tabindex={0}
						on:click={() => joinTable(table)}
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								joinTable(table);
							}
						}}
					>
						<div class="table-header">
							<h3>{table.name}</h3>
							<div class="table-capacity">
								0/{table.capacity}
							</div>
						</div>
						<div class="table-stats">
							<span class="stat">
								Position: ({table.position.x}, {table.position.y})
							</span>
							<span class="stat">
								Size: {table.size.width}×{table.size.height}
							</span>
							<span class="stat">
								{table.isPublic ? 'Public' : 'Private'}
							</span>
						</div>
						<button class="join-button">Join Table</button>
					</div>
				{/each}
			</div>
		{:else}
			<div class="empty-state">
				<p>No tables found in this room.</p>
			</div>
		{/if}
	</div>

		<!-- Active Members -->
		{#if activeHeroes.length > 0}
			<div class="members-section">
				<h2>People in Room</h2>
				<div class="members-list">
					{#each activeHeroes as hero}
						<div class="member-card">
							<div class="member-avatar">
								{#if hero.expand?.user?.avatar}
									<img src={hero.expand.user.avatar} alt={hero.expand?.user?.name || 'User'} />
								{:else}
									<div class="avatar-placeholder">
										{(hero.expand?.user?.name || 'U').charAt(0).toUpperCase()}
									</div>
								{/if}
							</div>
							<div class="member-info">
								<h4>{hero.expand?.user?.name || 'Anonymous'}</h4>
								<p>Position: ({hero.position.x}, {hero.position.y})</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">

	@use "src/lib/styles/themes.scss" as *;	
	* {
		font-family: var(--font-family);
	}		
	.room-view {
		padding: 2rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.loading-state,
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 50vh;
		gap: 1rem;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid var(--border-primary);
		border-top: 2px solid var(--primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.room-header {
		margin-bottom: 3rem;
	}

	.header-content h1 {
		color: var(--text-primary);
		margin-bottom: 0.5rem;
		font-size: 2.5rem;
	}

	.description {
		color: var(--text-secondary);
		font-size: 1.125rem;
		margin-bottom: 1.5rem;
		line-height: 1.6;
	}

	.room-info {
		display: flex;
		gap: 2rem;
		flex-wrap: wrap;
	}

	.info-item {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.label {
		color: var(--text-secondary);
		font-weight: 500;
	}

	.value {
		color: var(--primary);
		font-family: monospace;
		font-weight: 600;
	}

	.room-grid {
		margin-bottom: 3rem;
	}

	.room-grid h2,
	.tables-section h2,
	.members-section h2 {
		color: var(--text-primary);
		margin-bottom: 1.5rem;
		font-size: 1.5rem;
	}

	.grid-container {
		display: grid;
		grid-template-columns: repeat(var(--grid-width), 1fr);
		grid-template-rows: repeat(var(--grid-height), 1fr);
		gap: 1px;
		background: var(--border-primary);
		border: 1px solid var(--border-primary);
		border-radius: 0.5rem;
		overflow: hidden;
		max-width: 600px;
		aspect-ratio: var(--grid-width) / var(--grid-height);
	}

	.grid-cell {
		background: var(--background-secondary);
		min-height: 80px;
		position: relative;
		transition: background-color 0.2s;
	}

	.grid-cell.has-table {
		cursor: pointer;
	}

	.grid-cell.has-table:hover {
		background: var(--background-tertiary);
	}

	.table-tile {
		position: absolute;
		top: 0;
		left: 0;
		background: var(--accent);
		color: white;
		border-radius: 0.25rem;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		z-index: 1;
	}

	.table-tile h3 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.table-tile p {
		margin: 0;
		font-size: 0.75rem;
		opacity: 0.9;
	}

	.tables-section {
		margin-bottom: 3rem;
	}

	.tables-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	.table-card {
		background: var(--background-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 0.75rem;
		padding: 1.5rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.table-card:hover {
		border-color: var(--primary);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.table-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}

	.table-header h3 {
		color: var(--text-primary);
		margin: 0;
		font-size: 1.25rem;
	}

	.table-capacity {
		background: var(--background-tertiary);
		color: var(--text-secondary);
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.875rem;
		font-family: monospace;
	}

	.table-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.stat {
		color: var(--text-secondary);
	}

	.join-button {
		background: var(--primary);
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s;
		width: 100%;
	}

	.join-button:hover {
		background: var(--primary-hover);
	}

	.members-section {
		margin-top: 3rem;
	}

	.members-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
	}

	.member-card {
		background: var(--background-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 0.5rem;
		padding: 1rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.member-avatar {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
	}

	.member-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		background: var(--primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 1.125rem;
	}

	.member-info h4 {
		color: var(--text-primary);
		margin: 0 0 0.25rem 0;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.member-info p {
		color: var(--text-secondary);
		margin: 0;
		font-size: 0.75rem;
		font-family: monospace;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--text-secondary);
	}

	.error-state button {
		background: var(--primary);
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.error-state button:hover {
		background: var(--primary-hover);
	}

	@media (max-width: 768px) {
		.room-view {
			padding: 1rem;
		}

		.header-content h1 {
			font-size: 2rem;
		}

		.room-info {
			flex-direction: column;
			gap: 0.5rem;
		}

		.tables-list {
			grid-template-columns: 1fr;
		}

		.grid-container {
			max-width: 100%;
		}

		.table-tile h3 {
			font-size: 0.75rem;
		}

		.table-tile p {
			font-size: 0.625rem;
		}

		.members-list {
			grid-template-columns: 1fr;
		}
	}
</style>
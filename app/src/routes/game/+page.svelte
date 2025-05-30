<script lang="ts">
	import { onMount } from 'svelte';
	import { gameService } from '$lib/stores/gameStore';
	import { currentUser, pocketbaseUrl } from '$lib/pocketbase'; 
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import GameNavigator from '$lib/features/game/components/GameNavigator.svelte';
	import type { GameHero, GameOrganization } from '$lib/types/types.game';
	import Background from '$lib/assets/illustrations/gamelanding-2.jpeg';

	export let data;

	let isChecking = true;
	let needsHero = false;
	let needsWorld = false;
	let hero: GameHero | null = null; 
	let organizations: GameOrganization[] = [];

async function loadGameState() {
	console.log('[DEBUG] Starting game state check...');
	const user = get(currentUser);

	if (!user) {
		console.error('[DEBUG] User not found despite authentication');
		return;
	}

	isChecking = true;

	try {
		// Always try to load hero first
		console.log('[DEBUG] Loading hero...');
		hero = await gameService.getOrCreateHero(user.id);
		console.log('[DEBUG] Hero loaded:', hero);

		// Try to load organizations, but don't fail if they don't exist
		console.log('[DEBUG] Loading organizations...');
		try {
			const orgResponse = await fetch('/api/game/organizations');
			if (orgResponse.ok) {
				const orgData = await orgResponse.json();
				organizations = orgData.data || [];
			} else {
				console.log('[DEBUG] No organizations available');
				organizations = [];
			}
		} catch (orgError) {
			console.log('[DEBUG] Organizations fetch failed:', orgError);
			organizations = [];
		}

		console.log('[DEBUG] Organizations loaded:', organizations.length);

		// Set organization state
		needsWorld = organizations.length === 0;

	} catch (error) {
		console.error('[DEBUG] Error loading game state:', error);
		needsHero = true;
	} finally {
		isChecking = false;
	}
}

	async function createWorld() {
		try {
			console.log('[DEBUG] Creating organization...');
			const response = await fetch('/api/game/initialize', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});

			if (response.ok) {
				console.log('[DEBUG] World created successfully');
				// Reload organizations
				await loadGameState();
			} else {
				console.error('[DEBUG] Failed to create organization');
			}
		} catch (error) {
			console.error('[DEBUG] World creation error:', error);
		}
	}

	async function createHero() {
		try {
			console.log('[DEBUG] Creating hero...');
			const user = get(currentUser);
			if (!user) return;

			hero = await gameService.getOrCreateHero(user.id);
			console.log('[DEBUG] Hero created successfully');
			needsHero = false;
		} catch (error) {
			console.error('[DEBUG] Failed to create hero:', error);
		}
	}

async function selectOrganization(org: GameOrganization) {
	try {
		console.log('[DEBUG] Selecting organization:', org.name);
		const user = get(currentUser);
		if (!user) return;

		// Update hero's current organization
		const response = await fetch(`/api/game/heroes/${user.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				currentOrganization: org.id
			})
		});

		if (response.ok) {
			console.log('[DEBUG] Hero organization updated successfully');
			// Update local hero object
			if (hero) {
				hero.currentOrganization = org.id;
			}
			
			// Navigate to organization
			goto(`/game/organization/${org.id}`);
		} else {
			console.error('[DEBUG] Failed to update hero organization');
			const errorData = await response.json();
			console.error('[DEBUG] Error details:', errorData);
		}
	} catch (error) {
		console.error('[DEBUG] Error selecting organization:', error);
	}
}

	onMount(async () => {
		await loadGameState();
	});
</script>

<div class="game-wrapper">
	<img src={Background} alt="Wallpaper" class="illustration" />

	{#if isChecking}
		<div class="game-status">
			<div class="spinner"></div>
			<p>Loading game...</p>
		</div>
	{:else if needsHero}
		<div class="hero-creation-screen">
			<h2>Create Your Hero</h2>
			<p>You need a hero to enter the game.</p>
			<button on:click={createHero} class="btn-primary">Create Hero</button>
		</div>
	{:else if needsWorld}
		<div class="organization-creation-screen">
			<h2>Welcome to the Game!</h2>
			<p>No organizations exists yet. Would you like to create the initial organization?</p>
			<button on:click={createWorld} class="btn-primary">			
				Create New Organization
			</button>
		</div>
	{:else if organizations.length === 0}
		<div class="empty-organization-screen">
			<h2>Empty Organization</h2>
			<p>The organization exists but has no organizations.</p>
			<button on:click={createWorld} class="btn-primary">Initialize Default Organization</button>
		</div>
{:else}
	<!-- Show hero info if found -->
		<div class="organization-overview">

		<div class="organization-header">
			<h1>Game World</h1>
			<span>
				<p>Select an organization to enter or</p>
				<div class="create-organization">
					<button on:click={createWorld} class="btn-primary">
						Create New Organization
					</button>
				</div>
			</span>

		</div>
	<!-- World/Organization selection -->

{#if organizations.length > 0}


		<div class="organizations-grid">
			{#each organizations as org}
				<button 
					class="organization-card" 
					on:click={() => selectOrganization(org)}
					type="button"
				>
					<h3>{org.name}</h3>
					<p>{org.description}</p>
					<div class="org-stats">
						<span>Buildings: {org.buildings?.length || 0}</span>
						<span>Members: {org.members?.length || 0}</span>
					</div>
					{#if hero?.currentOrganization === org.id}
						<div class="current-org-badge">Current</div>
					{/if}
				</button>
			{/each}
		</div>


	{:else}
		<div class="empty-organization-screen">
			<h2>Empty World</h2>
			<p>The organization exists but has no organizations.</p>
			<button on:click={createWorld} class="btn-primary">Initialize Default World</button>
		</div>
	{/if}

		</div>
		{#if hero}
		<div class="hero-status">
			<div class="hero-info">
				<h2>Welcome back, {hero.expand?.user?.name || hero.expand?.user?.username}!</h2>
				<div class="hero-details">
					<div class="hero-avatar">
						{#if hero.expand?.user?.avatar}
							<img src="{pocketbaseUrl}/api/files/users/{hero.expand.user.id}/{hero.expand.user.avatar}?thumb=100x100" alt="Avatar" />
						{:else}
							<div class="avatar-placeholder">
								{(hero.expand?.user?.name || hero.expand?.user?.username || 'U').charAt(0).toUpperCase()}
							</div>
						{/if}
					</div>
					<div class="hero-stats">
						<p><strong>Current Organization:</strong> {hero.currentOrganization || 'None'}</p>
						<p><strong>Current Building:</strong> {hero.currentBuilding || 'None'}</p>
						<p><strong>Last Seen:</strong> {new Date(hero.lastSeen).toLocaleString()}</p>
					</div>
				</div>
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
	.game-wrapper {
		width: 100%;
		min-height: 90vh;
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		align-items: stretch;
		overflow: hidden;
		border-radius: 2rem;
	}
.illustration {
    position: relative;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0.2;
    transform: scale(2) translateX(15%) translateY(24%);
    object-fit: cover;
    pointer-events: none; 
    z-index: -1;
}

button.btn-primary {
	background: var(--secondary-color);
	transition: all 0.3s ease;
	&:hover {
		background: var(--primary-color);
	}
}
	.game-status,
	.hero-creation-screen,
	.organization-creation-screen,
	.empty-organization-screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		width: 100vw;
		border-left: 1px solid rgba(255, 255, 255, 0.05);

		backdrop-filter: blur(10px);
		gap: 1rem;
		padding: 2rem;
		text-align: center;
	}
	.game-status,
	.organization-creation-screen {
		position: fixed !important;
		background-color: red !important;
		width: 90vw;
		height: 90vh;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid var(--line-color);
		border-top: 2px solid var(--primary-color);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.organization-overview {
		padding: 2rem;
		max-width: 800px;
		width: 100%;
		margin: 0;
		display: flex;
		flex-direction: column;
		position: absolute;

	}

	.organization-header {
		text-align: center;
		margin-bottom: 3rem;
		display: flex;
		flex-direction: column;
		position: absolute;
		left: auto;

		& span {
			display: flex;
			flex-direction: row;
			align-items: center;
			justify-content: center;
			& p {
				margin: 0;
				padding: 0;
			}
		}
	}

	.organization-header h1 {
		color: var(--text-color);
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
		text-align: left;
	}
	.organization-header p {
		color: var(--text-color);
		font-size: 1rem;
		margin-bottom: 0.5rem;
		text-align: left;
	}

	.organizations-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
		margin-top: 10rem;
	}

.organization-card {
	background: transparent;
	backdrop-filter: blur(10px);
	border: 1px solid var(--line-color);
	border-radius: 0.75rem;
	padding: 1.5rem;
	cursor: pointer;
	transition: all 0.2s;
	position: relative;
	text-align: left;
	color: var(--text-color);
	width: 100%;
	display: block;
}

.organization-card:hover {
	border-color: var(--tertiary-color);
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

	.organization-card h3 {
		color: var(--text-primary);
		margin-bottom: 0.75rem;
		font-size: 1.25rem;
	}

	.organization-card p {
		color: var(--text-secondary);
		margin-bottom: 1rem;
		line-height: 1.5;
	}

	.org-stats {
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
		color: var(--text-tertiary);
	}

	.create-organization {
		text-align: center;
		top: auto;
		left: auto;
		margin: 1rem;
		& span {
			display: flex;
			flex-direction: row;
		}

	}

	.organization-navigator-section {
		border-top: 1px solid var(--border-primary);
		padding-top: 2rem;
	}

	.organization-navigator-section h2 {
		text-align: center;
		color: var(--text-primary);
		margin-bottom: 1rem;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
	}

	.btn-primary {
		background: var(--primary);
		color: white;
	}

	.btn-primary:hover {
		background: var(--primary-hover);
	}

	.btn-secondary {
		background: var(--secondary-color);
		color: var(--text-primary);
		border: 1px solid var(--border-primary);
	}

	.btn-secondary:hover {
		background: var(--background-tertiary);
		border-color: var(--primary);
	}
	.hero-status {
	border: 1px solid var(--border-primary);
	border-radius: 0.75rem;
	padding: 1.5rem;
	margin: 2rem auto;
	width: 100%;
	
}

.hero-info h2 {
	color: var(--text-primary);
	margin-bottom: 1rem;
	text-align: left;
}

.hero-details {
	display: flex;
	gap: 1.5rem;
	align-items: center;
}

.hero-avatar {
	flex-shrink: 0;
}

.hero-avatar img {
	width: 80px;
	height: 80px;
	border-radius: 50%;
	object-fit: cover;
	border: 3px solid var(--primary);
}

.avatar-placeholder {
	width: 80px;
	height: 80px;
	border-radius: 50%;
	background: var(--primary);
	color: white;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 2rem;
	font-weight: 600;
}

.hero-stats {
	flex: 1;
}

.hero-stats p {
	margin: 0.5rem 0;
	color: var(--text-secondary);
}

.hero-stats strong {
	color: var(--text-primary);
}

.current-org-badge {
	position: absolute;
	top: 0.5rem;
	right: 0.5rem;
	background: var(--primary);
	color: white;
	padding: 0.25rem 0.5rem;
	border-radius: 0.25rem;
	font-size: 0.75rem;
	font-weight: 600;
}

.organization-card {
	position: relative; /* For badge positioning */
}

@media (max-width: 768px) {
	.hero-details {
		flex-direction: column;
		text-align: center;
	}
	
	.hero-stats {
		text-align: left;
	}
}

	@media (max-width: 768px) {
		.organizations-grid {
			grid-template-columns: 1fr;
		}

		.organization-header h1 {
			font-size: 2rem;
		}
	}
</style>
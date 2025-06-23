<script lang="ts">
	import { onMount } from 'svelte';
	import { gameService } from '$lib/stores/gameStore';
	import { currentUser, pocketbaseUrl } from '$lib/pocketbase';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import GameNavigator from '$lib/features/game/components/GameNavigator.svelte';
	import type { GameHero, GameOrganization } from '$lib/types/types.game';
	import Background from '$lib/assets/illustrations/gamelanding-2.jpeg';
	import { 
		clientTryCatch, 
		fetchTryCatch, 
		validationTryCatch,
		isSuccess, 
		isFailure,
		type Result
	} from '$lib/utils/errorUtils';
	import { page } from '$app/stores';
	import { toast } from '$lib/utils/toastUtils';
	import Toast from '$lib/components/modals/Toast.svelte';

	export let data;

	let isChecking = true;
	let needsHero = false;
	let needsWorld = false;
	let hero: GameHero | null = null;
	let organizations: GameOrganization[] = [];

async function loadGameState(): Promise<Result<void, string>> {
	console.log('[DEBUG] Starting game state check...');
	
	// Validate user authentication
	const userValidation = validationTryCatch(() => {
		const user = get(currentUser);
		if (!user) {
			throw new Error('User not found despite authentication');
		}
		return user;
	}, 'user authentication');

	if (isFailure(userValidation)) {
		console.error('[DEBUG]', userValidation.error);
		return { data: null, error: userValidation.error, success: false };
	}

	const user = userValidation.data;
	isChecking = true;

	try {
		// Always try to load hero first
		console.log('[DEBUG] Loading hero...');
		const heroResult = await clientTryCatch(
			gameService.getOrCreateHero(user.id),
			'Loading game hero'
		);

		if (isSuccess(heroResult)) {
			hero = heroResult.data;
			console.log('[DEBUG] Hero loaded:', hero);
		} else {
			console.error('[DEBUG] Error loading hero:', heroResult.error);
			needsHero = true;
			return { data: null, error: heroResult.error, success: false };
		}

		// Try to load organizations, but don't fail if they don't exist
		console.log('[DEBUG] Loading organizations...');
		const orgResult = await fetchTryCatch<{ data: GameOrganization[] }>(
			'/api/game/organizations'
		);

		if (isSuccess(orgResult)) {
			organizations = orgResult.data.data || [];
			console.log('[DEBUG] Organizations loaded:', organizations.length);
		} else {
			console.log('[DEBUG] Organizations fetch failed:', orgResult.error);
			organizations = [];
		}

		// Set organization state
		needsWorld = organizations.length === 0;
		
		return { data: undefined, error: null, success: true };
	} finally {
		isChecking = false;
	}
}

async function createWorld(): Promise<Result<void, string>> {
    console.log('[DEBUG] Creating organization...');
    
    const createResult = await fetchTryCatch<any>(
        '/api/game/initialize',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        }
    );

    if (isSuccess(createResult)) {
        console.log('[DEBUG] World created successfully');
        toast.success('World created successfully!');
        
        // Reload organizations
        const reloadResult = await loadGameState();
        if (isFailure(reloadResult)) {
            toast.warning('World created but failed to reload data');
        }
        return reloadResult;
    }

    toast.error(`Failed to create world: ${createResult.error}`);
    return { data: null, error: createResult.error, success: false };
}

async function createHero(): Promise<Result<void, string>> {
    console.log('[DEBUG] Creating hero...');
    
    const userValidation = validationTryCatch(() => {
        const user = get(currentUser);
        if (!user) {
            throw new Error('User not authenticated');
        }
        return user;
    }, 'user authentication');

    if (isFailure(userValidation)) {
        toast.error('Authentication error - please refresh the page');
        return { data: null, error: userValidation.error, success: false };
    }

    const user = userValidation.data;

    const heroResult = await clientTryCatch(
        gameService.getOrCreateHero(user.id),
        'Creating game hero'
    );

    if (isSuccess(heroResult)) {
        hero = heroResult.data;
        console.log('[DEBUG] Hero created successfully');
        toast.success('Hero created successfully!');
        needsHero = false;
        return { data: undefined, error: null, success: true };
    }

    toast.error(`Failed to create hero: ${heroResult.error}`);
    return { data: null, error: heroResult.error, success: false };
}
async function selectOrganization(org: GameOrganization): Promise<Result<void, string>> {
    console.log('[DEBUG] Selecting organization:', org.name);
    
    const userValidation = validationTryCatch(() => {
        const user = get(currentUser);
        if (!user) {
            throw new Error('User not authenticated');
        }
        return user;
    }, 'user authentication');

    if (isFailure(userValidation)) {
        toast.error('Authentication error - please refresh the page');
        return { data: null, error: userValidation.error, success: false };
    }

    const user = userValidation.data;

    const updateResult = await fetchTryCatch<any>(
        `/api/game/heroes/${user.id}`,
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentOrganization: org.id
            })
        }
    );

    if (isSuccess(updateResult)) {
        console.log('[DEBUG] Hero organization updated successfully');
        toast.success(`Joined ${org.name}!`);
        
        // Update local hero object
        if (hero) {
            hero.currentOrganization = org.id;
        }

        // Navigate to organization
        goto(`/game/organization/${org.id}`);
        return { data: undefined, error: null, success: true };
    }

    toast.error(`Failed to join ${org.name}: ${updateResult.error}`);
    return { data: null, error: updateResult.error, success: false };
}

onMount(async () => {
    const result = await loadGameState();
    
    if (isFailure(result)) {
        toast.error(`Failed to load game: ${result.error}`);
    }
    
    // Check for server-side errors
    if ($page.status >= 400) {
        toast.error('Failed to load user data. Please try refreshing the page.');
    }
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
			<button on:click={createWorld} class="btn-primary"> Create New Organization </button>
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
						<button on:click={createWorld} class="btn-primary"> Create New Organization </button>
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
								<img
									src="{pocketbaseUrl}/api/files/users/{hero.expand.user.id}/{hero.expand.user
										.avatar}?thumb=100x100"
									alt="Avatar"
								/>
							{:else}
								<div class="avatar-placeholder">
									{(hero.expand?.user?.name || hero.expand?.user?.username || 'U')
										.charAt(0)
										.toUpperCase()}
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
<Toast />

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
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
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
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

<script lang="ts">
	import { onMount } from 'svelte';
	import { gameService } from '$lib/stores/gameStore';
	import { currentUser } from '$lib/pocketbase';
	import { get } from 'svelte/store';
	import GameNavigator from '$lib/features/game/components/GameNavigator.svelte';

	export let data;

	let isChecking = true;
	let needsHero = false;

	async function checkHeroExists(userId: string): Promise<boolean> {
		try {
			console.log('[DEBUG] Checking if hero exists for user:', userId);
			const response = await fetch(`/api/game/hero/${userId}`);
			console.log('[DEBUG] Hero check response status:', response.status);
			return response.ok;
		} catch (error) {
			console.error('[DEBUG] Hero check error:', error);
			return false;
		}
	}

	async function createHero() {
		isChecking = true;
		try {
			console.log('[DEBUG] Creating hero...');
			const user = get(currentUser);
			if (!user) {
				console.error('[DEBUG] No user found');
				return;
			}

			console.log('[DEBUG] User found:', user.id);
			await gameService.getOrCreateHero(user.id);
			console.log('[DEBUG] Hero created successfully');
			needsHero = false;
			isChecking = false;
		} catch (error) {
			console.error('[DEBUG] Failed to create hero:', error);
			isChecking = false;
		}
	}

	async function checkGameStatus() {
		console.log('[DEBUG] Starting game status check...');
		const user = get(currentUser);

		if (!user) {
			console.error('[DEBUG] User not found despite authentication');
			return;
		}

		console.log('[DEBUG] User found:', user.id);
		isChecking = true;

		// Auto-initialize world if needed (silently)
		try {
			console.log('[DEBUG] Auto-initializing world...');
			await fetch('/api/game/initialize', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});
			console.log('[DEBUG] World initialization completed');
		} catch (error) {
			console.log('[DEBUG] World initialization skipped or already exists');
		}

		// Check if hero exists
		const hasHero = await checkHeroExists(user.id);
		console.log('[DEBUG] Has hero:', hasHero);
		
		if (!hasHero) {
			console.log('[DEBUG] No hero found, showing hero creation');
			needsHero = true;
			isChecking = false;
			return;
		}

		// Hero exists, we're ready to show the game
		console.log('[DEBUG] Hero found, showing game');
		isChecking = false;
	}

	onMount(async () => {
		checkGameStatus();
	});
</script>

<div class="game-wrapper">
	{#if isChecking}
		<div class="game-redirect">
			<p>Checking game status...</p>
		</div>
	{:else if needsHero}
		<div class="hero-creation-screen">
			<h2>Create Your Hero</h2>
			<p>You need a hero to enter the game world.</p>
			<button on:click={createHero}>Create Hero</button>
		</div>
	{:else}
		<GameNavigator {data} />
	{/if}
</div>

<style lang="scss">
	@use "src/lib/styles/themes.scss" as *;
	
	* {
		font-family: var(--font-family);
		transition: all 0.3s ease;
	}

	.game-wrapper {
		width: calc(100%);
		margin-bottom: 4rem;
		overflow: hidden;
		border-radius: 1rem;
		background: var(--bg-gradient);
		color: var(--text-color);
		font-family: var(--font-family);
		height: calc(100vh - 10rem);
	}

	.game-redirect,
	.hero-creation-screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
	}

	button {
		margin-top: 1rem;
		padding: 0.75rem 1.5rem;
		background: var(--primary-color);
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
	}

	button:hover {
		background: var(--tertiary-color);
	}
</style>
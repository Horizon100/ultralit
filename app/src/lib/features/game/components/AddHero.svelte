<script lang="ts">
	import { gameStore } from '$lib/stores/gameStore';
	import { getAvatarUrl } from '$lib/features/users/utils/avatarHandling';
	import type { GameHero } from '$lib/types/types.game';
	import { writable } from 'svelte/store';
	import { addHeroSearchOpen } from '$lib/stores/addHeroStore';

	let isSearchOpen = false;
	let searchQuery = '';
	let searchResults: GameHero[] = [];
	let isSearching = false;
	let searchTimeout: NodeJS.Timeout;

	// Reactive search when query changes
	$: if (searchQuery.trim().length >= 2) {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			searchHeroes(searchQuery);
		}, 300); // Debounce search
	} else {
		searchResults = [];
	}

	async function searchHeroes(query: string) {
		if (!query.trim() || query.length < 2) return;

		try {
			isSearching = true;
			console.log('[ADD_HERO] Searching for heroes:', query);

			const response = await fetch(`/api/game/heroes/search?q=${encodeURIComponent(query)}`);
			if (response.ok) {
				const data = await response.json();
				searchResults = data.data || [];
				console.log('[ADD_HERO] Search results:', searchResults.length);
			} else {
				console.error('[ADD_HERO] Search failed:', response.status);
				searchResults = [];
			}
		} catch (error) {
			console.error('[ADD_HERO] Search error:', error);
			searchResults = [];
		} finally {
			isSearching = false;
		}
	}
	async function addHeroToOrganization(hero: GameHero) {
		if (!$gameStore.currentOrganization) {
			console.error('[ADD_HERO] No current organization');
			return;
		}

		try {
			console.log('[ADD_HERO] Adding hero to organization:', hero.id);

			// Check if hero is already a member
			const currentMembers = $gameStore.currentOrganization.members || [];
			if (currentMembers.includes(hero.id)) {
				alert('Hero is already a member of this organization');
				return;
			}

			// Add hero to members array
			const updatedMembers = [...currentMembers, hero.id];

			// Update organization members
			const response = await fetch(`/api/game/organizations/${$gameStore.currentOrganization.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					members: updatedMembers
				})
			});

			if (response.ok) {
				console.log('[ADD_HERO] Organization updated successfully');

				// Update the hero's organizations and currentOrganization
				const heroOrganizations = hero.organization || [];
				const updatedHeroOrganizations = heroOrganizations.includes(
					$gameStore.currentOrganization.id
				)
					? heroOrganizations
					: [...heroOrganizations, $gameStore.currentOrganization.id];

				const heroUpdateResponse = await fetch(`/api/game/heroes/update/${hero.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						organization: updatedHeroOrganizations,
						currentOrganization: $gameStore.currentOrganization.id
					})
				});

				if (heroUpdateResponse.ok) {
					console.log('[ADD_HERO] Hero updated successfully');

					// Update the store
					gameStore.update((state) => ({
						...state,
						currentOrganization: state.currentOrganization
							? {
									...state.currentOrganization,
									members: updatedMembers
								}
							: null
					}));

					closeSearch();
					alert('Hero added successfully!');
				} else {
					const heroError = await heroUpdateResponse.json();
					console.error('[ADD_HERO] Failed to update hero:', heroError);
					alert('Added to organization but failed to update hero');
				}
			} else {
				const errorData = await response.json();
				console.error('[ADD_HERO] Failed to update organization:', errorData);
				alert(`Failed to add hero: ${errorData.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('[ADD_HERO] Add hero error:', error);
			alert('Failed to add hero. Please try again.');
		}
	}

	function openSearch() {
		isSearchOpen = true;
		addHeroSearchOpen.set(true);
		setTimeout(() => {
			const input = document.querySelector('.hero-search-input') as HTMLInputElement;
			if (input) input.focus();
		}, 100);
	}

	function closeSearch() {
		isSearchOpen = false;
		searchQuery = '';
		searchResults = [];
		addHeroSearchOpen.set(false);
	}
	function handleKeydown(event: KeyboardEvent) {
		// Prevent all keyboard events from propagating to game navigation
		event.stopPropagation();

		if (event.key === 'Escape') {
			closeSearch();
		}
	}

	function handleInputKeydown(event: KeyboardEvent) {
		// Prevent game navigation shortcuts when typing in search
		event.stopPropagation();

		if (event.key === 'Escape') {
			closeSearch();
		}
	}
</script>

<div class="add-hero-container">
	{#if !isSearchOpen}
		<button class="add-hero-btn" on:click={openSearch} title="Add Hero to Organization">
			<!-- <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
				<circle cx="9" cy="7" r="4"/>
				<line x1="19" y1="8" x2="19" y2="14"/>
				<line x1="22" y1="11" x2="16" y2="11"/>
			</svg> -->
			Add Hero
		</button>
	{:else}
		<div class="hero-search-panel" on:keydown={handleKeydown}>
			<div class="search-header">
				<h4>Add Hero to {$gameStore.currentOrganization?.name || 'Organization'}</h4>
				<button class="close-btn" on:click={closeSearch} title="Close">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<div class="search-input-container">
				<input
					type="text"
					class="hero-search-input"
					placeholder="Search heroes by name or email..."
					bind:value={searchQuery}
					on:keydown={handleInputKeydown}
				/>
				{#if isSearching}
					<div class="search-spinner">
						<div class="spinner-small"></div>
					</div>
				{/if}
			</div>

			{#if searchQuery.length >= 2}
				<div class="search-results">
					<button on:click={() => alert('TEST BUTTON WORKS!')}>TEST OUTSIDE LOOP</button>

					{#if searchResults.length > 0}
						{#each searchResults as hero}
							<div class="hero-result">
								<div class="hero-info">
									<div class="hero-avatar">
										{#if hero.expand?.user}
											{@const avatarUrl = getAvatarUrl(hero.expand.user)}
											{#if avatarUrl}
												<img src={avatarUrl} alt="Avatar" />
											{:else}
												<div class="avatar-placeholder">
													{(hero.expand.user.name || hero.expand.user.username || 'U')
														.charAt(0)
														.toUpperCase()}
												</div>
											{/if}
										{:else}
											<div class="avatar-placeholder">U</div>
										{/if}
									</div>
									<div class="hero-details">
										<div class="hero-name">
											{hero.expand?.user?.name || hero.expand?.user?.username || 'Unknown'}
										</div>
										<div class="hero-meta">
											{#if hero.expand?.user?.email}
												<div>{hero.expand.user.email}</div>
											{/if}
										</div>
									</div>
								</div>
								<button
									class="add-btn"
									on:click={(event) => {
										console.log('[ADD_HERO] Add button clicked for hero:', hero.id);
										console.log('[ADD_HERO] Event:', event);
										console.log(
											'[ADD_HERO] Button disabled state:',
											$gameStore.currentOrganization?.members?.includes(hero.id)
										);
										event.stopPropagation();
										event.preventDefault();
										addHeroToOrganization(hero);
									}}
									disabled={$gameStore.currentOrganization?.members?.includes(hero.id)}
								>
									{#if $gameStore.currentOrganization?.members?.includes(hero.id)}
										Already Member
									{:else}
										Add
									{/if}
								</button>
							</div>
						{/each}
					{:else if !isSearching}
						<div class="no-results">
							No heroes found matching "{searchQuery}"
						</div>
					{/if}
				</div>
			{:else if searchQuery.length > 0}
				<div class="search-hint">Type at least 2 characters to search...</div>
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.add-hero-container {
		position: relative;
	}

	.add-hero-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--secondary-color);
		color: var(--text-color);
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		transition: background-color 0.2s;
		z-index: 9999;
	}

	.add-hero-btn:hover {
		background: var(--primary-color);
	}

	.hero-search-panel {
		position: absolute;
		top: 0;
		right: 0;
		background: var(--bg-color);
		border: 2px solid var(--line-color);
		border-radius: 0.5rem;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
		width: 22rem;
		z-index: 1000;
	}

	.search-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: var(--bg-color);
		height: 2rem;
	}

	.search-header h4 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-color);
	}

	.close-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		color: #64748b;
		border-radius: 0.25rem;
		transition: color 0.2s;
	}

	.close-btn:hover {
		color: #dc2626;
	}

	.search-input-container {
		position: relative;
		display: flex;
		justify-content: center;
		margin-bottom: 1rem;
	}

	.hero-search-input {
		width: calc(100% - 4rem);
		border-radius: 1rem;
		border: 1px solid var(--line-color);
		background: var(--secondary-color);
		padding: 1rem;
		font-size: 0.875rem;
		outline: none;
		transition: border-color 0.2s;
		color: var(--text-color);
	}

	.hero-search-input:focus {
		border-color: var(--tertiary-color);
		box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
	}

	.search-spinner {
		position: absolute;
		right: 1.5rem;
		top: 50%;
		transform: translateY(-50%);
	}

	.spinner-small {
		width: 1rem;
		height: 1rem;
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

	.search-results {
		max-height: 12rem;
		overflow-y: auto;
	}

	.hero-result {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: var(--bg-color);
		transition: background-color 0.2s;
		cursor: pointer;
	}

	.hero-result:hover {
		background: var(--primary-color);
		& .hero-name,
		& .hero-meta {
			color: var(--text-color);
		}
	}

	.hero-result:last-child {
		border-bottom: none;
	}

	.hero-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
	}

	.hero-avatar {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
	}

	.hero-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		background: var(--primary-color, #007bff);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 0.875rem;
	}

	.hero-details {
		flex: 1;
	}

	.hero-name {
		font-weight: 500;
		color: var(--placeholder-color);
		font-size: 0.875rem;
	}

	.hero-meta {
		font-size: 0.75rem;
		color: var(--placeholder-color);
		margin-top: 0.125rem;
	}

	.add-btn {
		padding: 0.375rem 0.75rem;
		background: var(--secondary-color);
		color: var(--text-color);
		border: none;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		pointer-events: auto !important;
		transition: background-color 0.2s;
	}

	.add-btn:hover:not(:disabled) {
		background: var(--tertiary-color);
		color: var(--primary-color);
	}

	.add-btn:disabled {
		background: #94a3b8;
		cursor: not-allowed;
	}

	.no-results,
	.search-hint {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.875rem;
	}

	.search-hint {
		color: #94a3b8;
		font-style: italic;
	}
</style>

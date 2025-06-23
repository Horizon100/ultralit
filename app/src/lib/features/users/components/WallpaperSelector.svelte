<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { currentUser, updateCurrentUserField } from '$lib/pocketbase';
	import {
		AVAILABLE_WALLPAPERS,
		getWallpaperSrc,
		getWallpaperCategories,
		parseWallpaperPreference,
		stringifyWallpaperPreference
	} from '$lib/utils/wallpapers';
	import type { Wallpaper, WallpaperPreference } from '$lib/utils/wallpapers';
	import { t } from '$lib/stores/translationStore';

	const dispatch = createEventDispatcher();

	export let currentWallpaper: string | WallpaperPreference = {
		wallpaperId: null,
		isActive: false
	};
	export let onWallpaperChange: (preference: WallpaperPreference) => void = () => {};

	let preference: WallpaperPreference;
	let selectedCategory = 'all';
	let isLoading = false;
	let error = '';
	let showPreview = false;
	let previewWallpaper = '';

	async function updateWallpaperPreference(newPreference: WallpaperPreference) {
		if (isLoading || !$currentUser?.id) {
			console.warn('Cannot update: loading or no user');
			return;
		}

		isLoading = true;
		error = '';

		console.log('Updating wallpaper preference:', newPreference);
		console.log('Available wallpapers:', AVAILABLE_WALLPAPERS.length);
		console.log('Current user:', $currentUser.id);

		try {
			const requestBody = {
				wallpaperId: newPreference.wallpaperId,
				isActive: newPreference.isActive
			};

			console.log('Sending request body:', requestBody);

			const response = await fetch(`/api/users/${$currentUser.id}/wallpapers`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			console.log('Response status:', response.status);

			let data;
			try {
				data = await response.json();
				console.log('Response data:', data);
			} catch (parseError) {
				console.error('Failed to parse response as JSON:', parseError);
				throw new Error('Invalid response from server');
			}

			if (!response.ok) {
				// Handle different error cases
				const errorMessage = data?.error || data?.message || `Server error: ${response.status}`;
				console.error('Server error:', errorMessage);
				throw new Error(errorMessage);
			}

			if (!data.success || !data.preference) {
				console.error('Unexpected response format:', data);
				throw new Error('Invalid response format from server');
			}

			preference = data.preference;
			onWallpaperChange(preference);
			await updateCurrentUserField(
				'wallpaper_preference',
				stringifyWallpaperPreference(preference)
			);

			// Dispatch events to match your existing pattern
			dispatch('styleChange', { wallpaperPreference: preference });

			console.log('Wallpaper preference updated successfully:', preference);
		} catch (err) {
			console.error('Wallpaper update error:', err);

			// Provide more specific error messages
			if (err instanceof TypeError && err.message.includes('fetch')) {
				error = 'Network error. Please check your connection and try again.';
			} else if (err instanceof Error) {
				error = err.message;
			} else {
				error = 'An unexpected error occurred while updating wallpaper settings.';
			}

			// Don't update the preference on error, keep the current state
		} finally {
			isLoading = false;
		}
	}

	function toggleWallpaper() {
		if (!preference) {
			console.warn('No preference object available');
			return;
		}

		console.log('Toggling wallpaper from:', preference);

		const newPreference: WallpaperPreference = {
			wallpaperId: preference.wallpaperId,
			isActive: !preference.isActive
		};

		console.log('Toggling to:', newPreference);
		updateWallpaperPreference(newPreference);
	}

	function selectWallpaper(wallpaperId: string) {
		console.log('Selecting wallpaper:', wallpaperId);

		const newPreference: WallpaperPreference = {
			wallpaperId,
			isActive: true
		};

		updateWallpaperPreference(newPreference);
	}

	function handlePreview(wallpaperId: string) {
		previewWallpaper = wallpaperId;
		showPreview = true;
	}

	function closePreview() {
		showPreview = false;
		previewWallpaper = '';
	}

	$: filteredWallpapers =
		selectedCategory === 'all'
			? AVAILABLE_WALLPAPERS
			: AVAILABLE_WALLPAPERS.filter((w) => w.category === selectedCategory);

	$: categories = ['all', ...getWallpaperCategories()];

	$: if (
		$currentUser?.wallpaper_preference &&
		Array.isArray($currentUser.wallpaper_preference) &&
		$currentUser.wallpaper_preference.length > 0 &&
		preference
	) {
		const userPreferenceString = $currentUser.wallpaper_preference[0];
		const currentPreferenceString = JSON.stringify(preference);

		if (userPreferenceString !== currentPreferenceString) {
			const newPreference = parseWallpaperPreference(userPreferenceString);
			if (
				newPreference &&
				(newPreference.isActive !== preference.isActive ||
					newPreference.wallpaperId !== preference.wallpaperId)
			) {
				console.log('CurrentUser wallpaper preference changed, updating:', newPreference);
				preference = newPreference;
			}
		}
	}
	onMount(async () => {
		// First, try to parse from the provided currentWallpaper prop
		preference = parseWallpaperPreference(currentWallpaper);
		console.log('Initial preference from prop:', preference);

		// Ensure we have a valid preference object
		if (!preference) {
			preference = { wallpaperId: null, isActive: false };
			console.log('Created default preference:', preference);
		}

		// If we have a current user, fetch the latest preference from the server
		if ($currentUser?.id) {
			try {
				console.log('Fetching current wallpaper preference from server...');
				const response = await fetch(`/api/users/${$currentUser.id}/wallpapers`);

				if (response.ok) {
					const data = await response.json();
					console.log('Fetched preference from server:', data);

					if (data.success && data.preference) {
						preference = data.preference;
						console.log('Updated preference from server:', preference);
						await updateCurrentUserField('wallpaper_preference', JSON.stringify(preference));
					}
				} else {
					console.warn('Failed to fetch wallpaper preference:', response.status);
				}
			} catch (err) {
				console.error('Error fetching wallpaper preference:', err);
				// Keep the current preference if fetch fails
			}
		}
	});
</script>

<div class="wallpaper-selector">
	<div class="header">
		<button class="close-btn-header" on:click={() => dispatch('close')}>×</button>
		<span class="header-toggle">
			<h3>Choose Background</h3>
			<div class="wallpaper-toggle">
				{#if !$currentUser}
					<div class="error">Please log in to change wallpaper settings.</div>
				{:else}
					<label class="toggle-label">
						<input
							type="checkbox"
							checked={preference?.isActive || false}
							on:change={toggleWallpaper}
							disabled={isLoading}
						/>
						<span class="toggle-slider"></span>
						<span class="toggle-text">
							{preference?.isActive ? $t('generic.on') : $t('generic.off')}
						</span>
					</label>
				{/if}
			</div>
		</span>
		<p class="subtitle">Select a wallpaper for your workspace</p>
	</div>

	{#if error}
		<div class="error" transition:fade>
			{error}
		</div>
	{/if}

	{#if preference?.isActive}
		<!-- Category Filter -->
		<div class="category-filter" transition:fade>
			{#each categories as category}
				<button
					class="category-btn"
					class:active={selectedCategory === category}
					on:click={() => (selectedCategory = category)}
				>
					{category.charAt(0).toUpperCase() + category.slice(1)}
				</button>
			{/each}
		</div>

		<!-- Wallpaper Grid -->
		<div class="wallpaper-grid" transition:fade>
			{#if filteredWallpapers.length === 0}
				<div class="no-wallpapers">
					<p>No wallpapers found in this category.</p>
					<p class="hint">
						Add some images to your <code>src/lib/assets/wallpapers/</code> folder!
					</p>
				</div>
			{:else}
				{#each filteredWallpapers as wallpaper}
					<div
						class="wallpaper-item"
						class:selected={preference.wallpaperId === wallpaper.id}
						class:loading={isLoading && preference.wallpaperId === wallpaper.id}
					>
						<div class="wallpaper-preview">
							<img
								src={wallpaper.src}
								alt={wallpaper.name}
								loading="lazy"
								on:click={() => selectWallpaper(wallpaper.id)}
								on:keydown={(e) => e.key === 'Enter' && selectWallpaper(wallpaper.id)}
								tabindex="0"
								role="button"
								aria-label="Select {wallpaper.name} wallpaper"
							/>

							<div class="wallpaper-overlay">
								<button
									class="preview-btn"
									on:click|stopPropagation={() => handlePreview(wallpaper.id)}
									title="Preview wallpaper"
								>
									👁️
								</button>

								{#if preference.wallpaperId === wallpaper.id}
									<div class="selected-indicator" transition:scale>✓</div>
								{/if}
							</div>
						</div>

						<div class="wallpaper-info">
							<h4>{wallpaper.name}</h4>
							{#if wallpaper.description}
								<p class="description">{wallpaper.description}</p>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	{:else}
		<div class="disabled-message" transition:fade>
			<p>Background wallpapers are currently disabled.</p>
			<p class="hint">Toggle the switch above to enable and select a wallpaper.</p>
		</div>
	{/if}
</div>

<!-- Preview Modal -->
{#if showPreview}
	<div
		class="preview-modal"
		transition:fade
		on:click={closePreview}
		on:keydown={(e) => e.key === 'Escape' && closePreview()}
	>
		<div class="preview-content" on:click|stopPropagation>
			<button class="close-btn" on:click={closePreview}>×</button>
			<img
				src={getWallpaperSrc({ wallpaperId: previewWallpaper, isActive: true })}
				alt="Wallpaper preview"
				class="preview-image"
			/>
			<div class="preview-actions">
				<button
					class="select-btn"
					on:click={() => {
						selectWallpaper(previewWallpaper);
						closePreview();
					}}
				>
					Select This Wallpaper
				</button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.wallpaper-selector {
		max-width: 400px;
		width: 100%;
		margin: 0 auto;
	}

	.header {
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
		margin-right: 1rem;

		h3 {
			margin: 0;
			font-size: 1.2rem;
			font-weight: 600;
		}
		span.header-toggle {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 1rem;
		}
		.subtitle {
			color: var(--placeholder-color);
			margin: 0;
			font-size: 0.9rem;
			text-align: left;
			margin: 0;
		}
	}

	.error {
		background: var(--primary-color);
		color: var(--error-text, #c33);
		padding: 0.75rem;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
		text-align: center;
		border: 1px solid var(--error-border, #fcc);
	}
	.close-btn-header {
		position: absolute;
		top: 0;
		left: 1rem;
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--placeholder-color);
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: all 0.2s ease;

		&:hover {
			color: var(--text-color);
		}
	}
	.wallpaper-toggle {
		position: relative;
		display: flex;
		top: 0;
		right: 0;
		.toggle-label {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			cursor: pointer;
			font-weight: 500;

			input[type='checkbox'] {
				display: none;
			}

			.toggle-slider {
				position: relative;
				width: 3rem;
				height: 1.5rem;
				background: var(--placeholder-color);
				border-radius: 1rem;
				transition: background 0.3s ease;

				&::before {
					content: '';
					position: absolute;
					top: 2px;
					left: 2px;
					width: 1.25rem;
					height: 1.25rem;
					background: var(--text-color);
					border-radius: 50%;
					transition: transform 0.3s ease;
					box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
				}
			}

			input:checked + .toggle-slider {
				background: var(--primary-color);

				&::before {
					transform: translateX(1.5rem);
					background: var(--tertiary-color);
				}
			}

			input:disabled + .toggle-slider {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.toggle-text {
				font-size: 1rem;
				color: var(--placeholder-color);
			}
		}
	}

	.disabled-message {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--text-secondary, #666);

		p {
			margin: 0.5rem 0;
		}

		.hint {
			font-size: 0.85rem;
			opacity: 0.8;
		}
	}

	.no-wallpapers {
		grid-column: 1 / -1;
		text-align: center;
		padding: 3rem 1rem;
		color: var(--text-secondary, #666);

		p {
			margin: 0.5rem 0;
		}

		.hint {
			font-size: 0.85rem;
			opacity: 0.8;
		}

		code {
			background: var(--bg-secondary, #f0f0f0);
			padding: 0.25rem 0.5rem;
			border-radius: 0.25rem;
			font-family: monospace;
		}
	}
	.category-filter {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
		justify-content: center;

		.category-btn {
			padding: 0.5rem 1rem;
			border: 1px solid transparent;
			background: var(--secondary-color);
			color: var(--placeholder-color);
			border-radius: 2rem;
			cursor: pointer;
			transition: all 0.2s ease;
			font-size: 0.85rem;

			&:hover {
				background: var(--primary-color);
				border-color: var(--tertiary-color);
				box-shadow: 0px 1px 4px 1px var(--text-color);
			}

			&.active {
				background: var(--primary-color);
				color: var(--text-color);
				border-color: transparent;
				box-shadow: 0px 1px 50px 1px var(--tertiary-color);
			}
		}
	}

	.wallpaper-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 1rem;
	}

	.wallpaper-item {
		border: 2px solid transparent;
		border-radius: 0.75rem;
		overflow: hidden;
		transition: all 0.3s ease;
		background: var(--primary-color);

		&:hover {
			border-color: var(--line-color);
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		}

		&.selected {
			border-color: var(--primary-color);
			border: 2px solid var(--tertiary-color);
			box-shadow: 0px 1px 50px 1px var(--tertiary-color);
		}

		&.loading {
			opacity: 0.7;
			pointer-events: none;
		}
	}

	.wallpaper-preview {
		position: relative;
		aspect-ratio: 16/10;
		overflow: hidden;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			cursor: pointer;
			transition: transform 0.3s ease;

			&:hover {
				transform: scale(1.05);
			}
		}

		.wallpaper-overlay {
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.3);
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			opacity: 0;
			transition: opacity 0.3s ease;

			.wallpaper-item:hover & {
				opacity: 1;
			}

			.preview-btn {
				background: rgba(255, 255, 255, 0.9);
				border: none;
				border-radius: 50%;
				width: 2.5rem;
				height: 2.5rem;
				cursor: pointer;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 1.2rem;
				transition: all 0.2s ease;

				&:hover {
					background: white;
					transform: scale(1.1);
					animation: shake 0.7s;
					animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
				}
			}

			.selected-indicator {
				background: var(--tertiary-color);
				color: white;
				border-radius: 50%;
				width: 2rem;
				height: 2rem;
				display: flex;
				align-items: center;
				justify-content: center;
				font-weight: bold;
			}
		}
	}

	.wallpaper-info {
		padding: 0.75rem;
		text-align: center;

		h4 {
			margin: 0 0 0.25rem;
			font-size: 0.9rem;
			font-weight: 500;
		}

		.description {
			margin: 0;
			font-size: 0.75rem;
			color: var(--text-secondary, #666);
		}
	}

	.preview-modal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 2rem;

		.preview-content {
			position: relative;
			max-width: 90vw;
			max-height: 90vh;
			background: var(--bg-color);
			box-shadow: 0px 1px 20px 1px var(--text-color);

			border-radius: 1rem;
			overflow: hidden;

			.close-btn {
				position: absolute;
				top: 1rem;
				right: 1rem;
				background: rgba(0, 0, 0, 0.5);
				color: white;
				border: none;
				border-radius: 50%;
				width: 2.5rem;
				height: 2.5rem;
				cursor: pointer;
				font-size: 1.5rem;
				z-index: 1001;
				display: flex;
				align-items: center;
				justify-content: center;

				&:hover {
					background: rgba(0, 0, 0, 0.7);
				}
			}

			.preview-image {
				width: 100%;
				height: auto;
				max-height: 70vh;
				object-fit: contain;
			}

			.preview-actions {
				padding: 1rem;
				text-align: center;

				.select-btn {
					background: var(--secondary-color);
					color: white;
					border: none;
					padding: 0.75rem 2rem;
					border-radius: 0.5rem;
					cursor: pointer;
					font-size: 1rem;
					font-weight: 500;
					transition: background 0.2s ease;

					&:hover {
						background: var(--primary-color);
					}
				}
			}
		}
	}
	@media (max-width: 1000px) {
		.wallpaper-selector {
			padding: 2rem;
			max-width: 90%;
			width: 100%;
			margin: 0 auto;
		}
	}
	@media (max-width: 768px) {
		.wallpaper-grid {
			grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
			gap: 0.75rem;
		}

		.preview-modal {
			padding: 1rem;
		}
	}
</style>

<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import { fly, fade, slide } from 'svelte/transition';
	import { swipeGesture } from '$lib/utils/swipeGesture';
	import { threadsStore } from '$lib/stores/threadsStore';
	import { currentUser } from '$lib/pocketbase';
	import { t } from '$lib/stores/translationStore';
	import { DateUtils } from '$lib/utils/dateUtils';
	import { UserService } from '$lib/services/userService';
	import type { Threads, SwipeConfig } from '$lib/types/types';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import { showThreadList } from '$lib/stores/sidenavStore';

	// Props
	export let threads: Threads[] = [];
	export let currentThreadId: string | null = null;
	export let isCreatingThread = false;
	export let isLoadingProject = false;
	export let isLoadingThreads = false;
	export let searchQuery = '';
	export let isExpanded = false;
	export let showSortOptions = false;
	export let showUserFilter = false;
	export let drawerSwipeConfig: SwipeConfig;

	// Local state
	let createHovered = false;
	let favoritesHovered = false;
	let searchHovered = false;
	let searchPlaceholder = '';

	// Computed
	$: groupedThreads = DateUtils.groupThreadsByTime(threads);
	$: searchPlaceholder = $t('nav.search') as string;

	// Event dispatcher
	const dispatch = createEventDispatcher();

	// Focus directive
	export const focusOnMount = (node: HTMLElement) => {
		node.focus();
	};

	// Event handlers
	function handleCreateThread() {
		if (isCreatingThread) return;
		dispatch('createThread');
	}

	function handleLoadThread(threadId: string) {
		dispatch('loadThread', { threadId });
	}

	function handleDeleteThread(event: MouseEvent, threadId: string) {
		event.stopPropagation();
		dispatch('deleteThread', { event, threadId });
	}

	function handleFavoriteThread(event: Event, thread: Threads) {
		event.stopPropagation();
		dispatch('favoriteThread', { event, thread });
	}

	function handleSearchChange(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;
		dispatch('searchChange', { query: searchQuery });
	}

	function toggleFavoriteFilter() {
		if (isExpanded) {
			isExpanded = false;
		}
		threadsStore.setSearchQuery('');
		threadsStore.toggleFavoriteFilter();
	}

	function toggleSearch() {
		if (!isExpanded && $threadsStore.showFavoriteThreads) {
			threadsStore.toggleFavoriteFilter();
		}
		isExpanded = !isExpanded;
	}

	function handleSearchBlur() {
		if (!searchQuery) {
			isExpanded = false;
		}
	}

	function isThreadFavorited(threadId: string): boolean {
		return UserService.isThreadFavorited(threadId);
	}
</script>

	<div
		class="drawer"
		transition:fly={{ x: -300, duration: 300 }}
		use:swipeGesture={drawerSwipeConfig}
	>
		<div class="drawer-list" in:fly={{ duration: 200 }} out:fade={{ duration: 200 }}>
			<div class="drawer-toolbar" in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
				<!-- Create Thread Button -->
				<button
					class="add"
					on:click={handleCreateThread}
					disabled={isCreatingThread}
					on:mouseenter={() => (createHovered = true)}
					on:mouseleave={() => (createHovered = false)}
				>
					{#if isCreatingThread}
						<div class="spinner2" in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
							<div class="bot-icon" />
						</div>
					{:else}
						<div class="icon" in:fade>
							<Icon name="MessageCirclePlus" />
							{#if createHovered}
								<span class="tooltip tooltip-delayed" in:fade>
									{$t('tooltip.newThread')}
								</span>
							{/if}
						</div>
					{/if}
				</button>

				<!-- Favorites Filter Button -->
				<button
					class="toolbar-button"
					class:active={$threadsStore.showFavoriteThreads}
					on:click={toggleFavoriteFilter}
					on:mouseenter={() => (favoritesHovered = true)}
					on:mouseleave={() => (favoritesHovered = false)}
				>
					<span class="star-filter" class:active={$threadsStore.showFavoriteThreads}>
						<Icon name="Star" size={18} />
					</span>
					{#if favoritesHovered && !$threadsStore.showFavoriteThreads}
						<span class="tooltip tooltip-delayed" in:fade>
							{$t('profile.favorites') || 'Favorite Threads'}
						</span>
					{/if}
					{#if $currentUser?.favoriteThreads && $currentUser.favoriteThreads.length > 0}
						<span class="filter-badge">{$currentUser.favoriteThreads.length}</span>
					{/if}
				</button>

				<!-- Search Input -->
				<div class="drawer-input">
					<button
						class="toolbar-button"
						class:active={isExpanded}
						on:click={toggleSearch}
						on:mouseenter={() => (searchHovered = true)}
						on:mouseleave={() => (searchHovered = false)}
					>
						<Icon name="Search" />
						{#if searchHovered && !isExpanded}
							<span class="tooltip tooltip-delayed" in:fade>
								{$t('nav.search') || 'Search threads'}
							</span>
						{/if}
					</button>
					{#if isExpanded}
						<input
							transition:slide={{ duration: 300 }}
							type="text"
							bind:value={searchQuery}
							placeholder={searchPlaceholder}
							on:input={handleSearchChange}
							on:blur={handleSearchBlur}
							use:focusOnMount
						/>
					{/if}
				</div>
			</div>

			<!-- Sort and Filter Dropdowns -->
			{#if showSortOptions}
				<div class="dropdown sort-dropdown" transition:fade={{ duration: 150 }}>
					<slot name="sortOptions" />
				</div>
			{/if}

			{#if showUserFilter}
				<div class="dropdown user-dropdown" transition:fade={{ duration: 150 }}>
					<slot name="userFilter" />
				</div>
			{/if}

			<!-- Thread List -->
			{#if isLoadingProject}
				<div class="spinner-container">
					<div class="spinner"></div>
				</div>
			{:else}
				<div class="thread-filtered-results" transition:slide={{ duration: 200 }}>
					{#if isLoadingThreads}
						<div class="spinner-container">
							<div class="spinner"></div>
						</div>
					{/if}

					{#if threads.length === 0}
						<div class="empty-state">
							<!-- No threads. Select or create project first. -->
						</div>
					{:else}
						{#each groupedThreads as { group, threads: groupThreads } (group)}
							<div class="time-divider" in:fade>
								<span class="time-label">{group}</span>
							</div>
							{#each groupThreads as thread (thread.id)}
								<button
									class="card-container"
									class:selected={currentThreadId === thread.id}
									on:click={() => handleLoadThread(thread.id)}
								>
									<div class="card" class:active={currentThreadId === thread.id} in:fade>
										<div class="card-static">
											<div class="card-title">
												{thread.name || 'Unnamed Thread'}
											</div>
										</div>

										<div class="card-actions" transition:fade={{ duration: 300 }}>
											<button
												class="action-btn delete"
												on:click|stopPropagation={(e) => handleDeleteThread(e, thread.id)}
											>
												<Icon name="Trash2" size={16} />
											</button>
											<button
												class="action-btn"
												on:click|stopPropagation={(e) => handleFavoriteThread(e, thread)}
											>
												<span class="star-icon" class:favorited={isThreadFavorited(thread.id)}>
													<Icon name="Star" size={16} />
												</span>
											</button>
										</div>
									</div>
								</button>
							{/each}
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</div>

<style lang="scss">
	$breakpoint-sm: 576px;
	$breakpoint-md: 1000px;
	$breakpoint-lg: 992px;
	$breakpoint-xl: 1200px;
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}

	:root {
		--h3-min-size: 0.875rem;
		--h3-max-size: 1.125rem;
		--breakpoint-sm: #{$breakpoint-sm};
		--breakpoint-md: #{$breakpoint-md};
		--breakpoint-lg: #{$breakpoint-lg};
		--breakpoint-xl: #{$breakpoint-xl};
	}

	.drawer-list {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;

		width: auto;
		margin-left: 0;
		margin-right: 0;
		margin-top: 0;
		top: 0;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 100%;
		// backdrop-filter: blur(20px);
		border-radius: 10px;
		overflow-y: hidden;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: var(--bg-color) transparent;
		scroll-behavior: smooth;
	}

	.drawer {
		display: flex;
		flex-direction: column;
		justify-content: auto;
		align-items: center;
		// background: var(--bg-gradient-right);
		// z-index: 11;
		transform: translateZ(0);
		backface-visibility: hidden;
		
		touch-action: pan-y;
		transition: box-shadow 0.2s ease-out;
		--drawer-easing: cubic-bezier(0.25, 0.46, 0.45, 0.94);
		z-index: 9999;
		overflow: {
			x: hidden;
			y: auto;
		}
		touch-action: pan-y;

		position: relative;
		top: 0rem;
		left: 0;
		margin-bottom: 0;
		margin-left: 0;
		height: 100%;
		width: 250px;
		scrollbar: {
			width: 1px;
			color: var(--bg-color) transparent;
		}
		border-bottom-right-radius: 2rem;

		scroll-behavior: smooth;
		padding-bottom: 0;
		&.hidden {
			display: none;
			transform: translateX(-100%);
		}

		& button {
			display: flex;
			flex-direction: row;
			justify-content: flex-start;
			background-color: transparent;
			border: none;
			cursor: pointer;
			color: #fff;
			transition: all 0.3s ease-in;
			font-family: var(--font-family);
			width: 100%;

			&.selected {
				backdrop-filter: blur(8px);
				font-weight: bold;
				animation: pulsate 0.5s 0.5s initial;
			}
		}
	}
	.drawer-backdrop {
		transition: backdrop-filter 0.2s ease-out;
	}

	.drawer-backdrop.swiping {
		backdrop-filter: blur(2px);
	}
	.drawer:active,
	.drawer.swiping {
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
	}
	.drawer-input {
		display: flex;
		flex-direction: row;
		align-items: center;
		// padding: 0.75rem 0;
		border-radius: var(--radius-m);
		height: auto;
		width: auto;
		padding: 0;
		color: var(--bg-color);
		transition: all 0.3s ease;

		& button {
			border-radius: var(--radius-m);
			width: auto;
			border: none;
			display: flex;
			justify-content: center;
			align-items: center;
			transition: all 0.3s ease;
			justify-content: center;
			z-index: 2000;
			// &:hover{
			//   // background: var(--secondary-color);
			//   // box-shadow: -0 2px 20px 1px rgba(255, 255, 255, 0.1);
			//   // transform: translateY(-10px);

			// }
		}

		& input {
			border: none;
			border-radius: 0;
			border-top-right-radius: 1rem;
			border-bottom-right-radius: 1rem;
			padding: 0.5rem;
			padding-left: 1rem;
			height: auto;
			outline: none;
			margin-right: 0;
			width: auto;
			background: var(--primary-color);
			color: var(--text-color);
			transition: all 0.3s ease;
			font-size: 1rem;
			&::placeholder {
				color: var(--placeholder-color);
			}

			&:focus {
				width: auto;
				right: 2rem;
				left: 4rem;
				z-index: 1;
				&::placeholder {
					color: var(--placeholder-color);
				}
			}
		}
	}
	/* Smooth slide-in/out transitions */
	.drawer-slide-enter {
		transform: translateX(-100%);
		opacity: 0;
	}

	.drawer-slide-enter-active {
		transform: translateX(0);
		opacity: 1;
		transition:
			transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94),
			opacity 0.3s ease-out;
	}

	.drawer-slide-exit {
		transform: translateX(0);
		opacity: 1;
	}

	.drawer-slide-exit-active {
		transform: translateX(-100%);
		opacity: 0;
		transition:
			transform 0.3s cubic-bezier(0.55, 0.06, 0.68, 0.19),
			opacity 0.3s ease-in;
	}

	button.drawer-tab {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: auto !important;
		padding: 0 1rem;
		position: relative;
		// padding: 0.5rem 1rem;
		height: 100%;
		border: none;
		border-radius: 2rem;
		background: var(--secondary-color);
		color: var(--placeholder-color);
		cursor: pointer;
		transition: all 0.2s ease-in-out;
		& h3 {
			margin: 0;
			font-weight: 300;
			font-size: var(--font-size-sm);
			font-weight: 600;
			line-height: 1.4;
			&.active {
				background: var(--primary-color);
				color: var(--tertiary-color);
				font-size: var(--font-size-xs);
			}
			&:hover {
				background: rgba(255, 255, 255, 0.1);
			}
		}

		&.active {
			color: var(--tertiary-color);
			font-size: var(--font-size-s);
			width: fit-content;
			flex: 1;
			justify-content: center;
		}
	}
	.thread-filtered-results {
		margin-top: 0;
		margin-bottom: 1rem;
		border-top-right-radius: 1rem;
		position: relative;
		// scrollbar-width: thin;
		scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: scroll;
		height: 100%;
		background: var(--primary-color);
		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 1rem;
		}
	}
	.drawer-header {
		width: 300px;
		margin-left: 4rem;
		margin-right: 0;
		height: 40px;
		// padding: 0.5rem 0.5rem;
		border: none;
		cursor: pointer;
		color: var(--text-color);
		text-align: left;
		display: flex;
		align-items: center;
		transition: background-color 0.2s;
		// border-radius: var(--radius-m);
		display: flex;
		flex-direction: row;
		position: absolute;
		// background: var(--bg-gradient-r);
		backdrop-filter: blur(100px);
		margin-bottom: 0;
		right: 0;
		top: 0;
		// border-radius: var(--radius-l);
	}

	.card {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		max-width: 100%;
		height: 100%;
		position: relative;
		// backdrop-filter: blur(8px);
		// background: var(--bg-gradient-left);
		// border-bottom: 5px solid var(--bg-color);
		// border-top: 1px solid var(--bg-color);
		// border-left: 5px solid var(--bg-color);
		// border-right: 1px solid var(--bg-color);
		transition: all 0.3s ease;
		min-width: 0;
		// &.active {
		//   border-left: 3px solid var(--primary-color);
		// }
	}
	.card-static {
		display: flex;
		flex-direction: column;
		position: relative;
		align-items: flex-start;
		justify-content: space-between;
		width: 250px;
		line-height: 1.2;
		margin-left: 0;
		color: var(--text-color);
		& .card-title {
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis !important;
			width: 90%;
			font-size: 0.8rem;
			text-align: left;
		}
		& .card-title.project {
			font-weight: 300;
			font-size: var(--font-size-sm);
			display: flex;
			width: auto;
		}
	}
	span.icon:hover .card-actions {
		transform: translateX(0);
		opacity: 1;
		visibility: visible;
	}

	.card-actions {
		position: absolute;
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		align-items: center;
		right: auto;
		left: -1rem;
		top: -1.75rem;
		gap: 1rem;
		height: 2rem;
		margin-left: 0;
		display: flex;
		transform: translateX(0%);
		width: auto;
		z-index: 1000;
		opacity: 0;
		transition: all 0.2s ease;
		visibility: hidden;
		cursor: default;
	}
	.cards {
		width: fit-content;
		backdrop-filter: blur(10px);
		// background: var(--primary-color);

		// box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.card-container {
		display: flex;
		flex-direction: row;
		position: relative;
		width: 100%;
		height: 3rem;
		margin-left: 0;
		// box-shadow: 0 1px 1px var(--secondary-color);
		margin-right: 0;
		padding: 0;
		cursor: pointer;
		border-radius: 0;
	}
	.star-icon :global(svg) {
		fill: none;
		transition: fill 0.2s ease;
	}

	.star-icon.favorited :global(svg) {
		fill: currentColor;
	}
	.star-filter :global(svg) {
		fill: none;
		transition: fill 0.2s ease;
	}

	.star-filter.active :global(svg) {
		fill: currentColor;
	}
	button.card-container {
		display: flex;
		flex-direction: column;
		position: relative;
		flex-grow: 1;
		padding: 1rem;
		border-radius: 0;

		// background-color: var(--bg-color);
		width: 100%;
		// box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		transition: all 0.1s ease-in-out;
		&:hover {
			box-shadow: none;
			background: var(--secondary-color) !important;
			border-radius: 0;
			// background: rgba(226, 226, 226, 0.2);  /* Very subtle white for the glass effect */
			opacity: 1;
			visibility: visible;
			// box-shadow: -5px -1px 5px 4px rgba(255, 255, 255, 0.2);
		}
		&.selected {
			backdrop-filter: blur(30px);
			background: var(--bg-color);
			border-radius: 0;
			border-radius: 0 1rem 1rem 0;
		}
	}

	.card-container:hover .card-actions {
		transform: translateX(0%) translateY(3rem);
		opacity: 1;
		visibility: visible;
		padding-left: 0;
		margin-left: 0;
	}
	.card-container:hover .card-time {
		opacity: 1;
		visibility: visible;
		height: auto;
	}
	.card-time {
		font-size: 0.6rem;
		display: flex;
		margin-top: 1rem;
		width: auto;
		opacity: 0;
		height: 100%;
		background: transparent;
	}

	.drawer-toolbar {
		margin-left: 0;
		position: relative;
		height: auto;
		width: auto;
		// padding: 0.75rem 1rem;
		// border-top: 1px solid var(--line-color);
		background: var(--bg-gradient-right);
		// border-bottom: 2px solid var(--secondary-color);
		cursor: pointer;
		// box-shadow: -0 2px 20px 1px rgba(255, 255, 255, 0.1);
		color: var(--text-color);
		z-index: 1;
		text-align: left;
		align-items: center;
		justify-content: flex-start;
		gap: 0.5rem;
		transition: all 0.2s ease;
		// border-radius: var(--radius-m);
		display: flex;
		flex-direction: row;
		left: 0;
		padding: 0.5rem;

		& input {
			width: auto;
			z-index: 2;
		}
	}
	button {
		display: flex;
		user-select: none;
		.toggle-btn {
			&.header {
				background-color: red !important;
				width: 500px;
			}
		}
		&.play {
			background: transparent;
			display: flex;
			justify-content: center;
			align-items: center;
			width: 3rem;
			height: 3rem;
		}
		&.btn-back {
			background-color: var(--placeholder-color);
			position: relative;
			display: flex;
			overflow-x: none;
			// height: 50%;
			// top: 3rem;
			justify-content: center;
			align-items: center;
			border: none;
			color: var(--text-color);
			cursor: pointer;
			border-radius: var(--radius-l);
			transition: all 0.3s ease;
			// &:hover {
			//   background-color: var(--tertiary-color);
			//   transform: translateX(2px);
			// }
			// &:active {
			// }
		}

		&.btn-ai {
			border-radius: var(--radius-m);
			width: auto;
			height: auto;
			border: none;
			display: flex;
			justify-content: center;
			align-items: center;
			transition: all 0.3s ease;
			justify-content: center !important;
			background-color: transparent;
			z-index: 2000;
			&:hover {
				background: var(--secondary-color);
				// box-shadow: -0 2px 20px 1px rgba(255, 255, 255, 0.1);
				transform: translateY(-10px);
			}
		}
		&.drawer-header {
			justify-content: space-between;
			width: 100%;
			height: 100%;
			gap: 0.5rem;
			&:hover {
				background-color: var(--secondary-color);
			}
		}
		&.add {
			background-color: transparent;
			font-size: var(--font-size-s);
			font-weight: bold;
			cursor: pointer;
			transition: all ease 0.3s;
			display: flex;
			justify-content: center;
			align-items: center;
			position: relative;
			user-select: none;
			transition: all 0.2s ease;
			width: fit-content !important;

			// gap: var(--spacing-sm);

			& span.icon {
				color: var(--placeholder-color);
				gap: 0.5rem;

				&:hover {
					color: var(--tertiary-color);
				}

				&.active {
					color: var(--tertiary-color);
				}
			}

			&:hover {
				color: var(--tertiary-color);
			}
		}
	}
	button.toolbar-button {
		display: flex;
		align-items: center;
		justify-content: center !important;
		color: var(--placeholder-color) !important;
		width: 2.5rem !important;
		height: 2.5rem;
		border-radius: 1rem;
		background: var(--bg-color);
		border: 1px solid var(--line-color);
		cursor: pointer;
		transition: all 0.2s ease;
		gap: 0.5rem;

		&:hover {
			background-color: var(--secondary-color);
			color: var(--text-color) !important;
		}

		&.active {
			background-color: var(--secondary-color);
			color: var(--text-color) !important;
		}
	}

	.time-divider {
		display: flex;
		align-items: center;
		padding: 2rem 0 0 1rem;
		margin: 0;
		user-select: none;
		.time-label {
			font-size: 0.9rem;
			font-weight: 400;
			color: var(--placeholder-color);
			letter-spacing: 0.2rem;
			&::first-letter {
				text-transform: uppercase;
			}
		}
	}
	.date-divider {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		position: relative;
		width: 200px;
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.05rem;
		padding: 0.25rem 1rem;
		margin: {
			top: 0;
			bottom: 1rem;
			left: calc(50% - 100px);
		}
		gap: 2rem;
		cursor: pointer;
		background: transparent;
		transition: all ease 0.15s;
		color: var(--line-color);
		user-select: none;
		border-radius: var(--radius-m);
		z-index: 1;

		&:hover {
			background: var(--secondary-color) !important;
			color: var(--tertiary-color);
		}

		&.bottom {
			display: flex;
			justify-content: center;
			align-items: center;
			background: none;
			border: 0;
			padding: 0;
			backdrop-filter: none;
			border: {
				top: none;
				bottom: none;
				bottom-left-radius: 30px;
				bottom-right-radius: 30px;
			}
			cursor: pointer;
		}
	}
	@media (max-width: 1000px) {
		.drawer-container {
			width: auto;
			margin-right: 2rem;
		}

		.drawer-list {
			height: 100%;
			border-radius: 0;
		}
		.thread-filtered-results {
			margin-bottom: 0rem;
		}


		.drawer-visible .drawer {
			margin-left: 0;
			transform: translateX(0);
			top: 3rem;
			padding-top: 0;
		}

		.drawer-visible .drawer-toolbar {
			border: none;
			margin: 0;
		}

		.drawer-header {
			width: auto;
			margin-bottom: 4rem;
			left: 4rem;
			right: 4rem;
			margin-right: 0;
			margin-left: 0;
			display: flex;
			position: absolute;
			height: 30px;
			padding: 0.75rem 1rem;
			border: none;
			cursor: pointer;
			color: var(--text-color);
			text-align: left;
			display: flex;
			align-items: center;
			transition: background-color 0.2s;
			// border-radius: var(--radius-m);
			display: flex;
			flex-direction: row;
			// background: var(--bg-gradient-r);
			z-index: 3000;

			// border-radius: var(--radius-l);
		}

		.drawer-toolbar {
			width: auto;
			left: 0;
			right: 0;
			margin-top: 0;
			margin-right: 0;
			margin-left: 0;
			display: flex;
			position: relative;
			height: auto;
			border: none;
			cursor: pointer;
			color: var(--text-color);
			border-bottom: 1px solid var(--line-color);
			text-align: left;
			display: flex;
			gap: auto;
			align-items: center;
			transition: background-color 0.2s;
			background: var(--bg-gradient-right);
			// border-radius: var(--radius-m);
			display: flex;
			flex-direction: row;
			// background: var(--bg-gradient-r);
			z-index: 3000;
		}
	}

	@media (max-width: 450px) {
		.drawer-visible .thread-filtered-results {
			border: none;
			padding: 0;
			margin-left: 0;
			margin-right: 0;
			border-radius: 0 2rem 2rem 0;
			backdrop-filter: blur(10px);
			overflow-x: hidden;
			overflow-y: auto;
			&::-webkit-scrollbar {
				width: 0.5rem;
				background-color: transparent;
			}
			&::-webkit-scrollbar-thumb {
				background: var(--secondary-color);
				border-radius: 1rem;
			}
		}

		.drawer-list {
			margin-top: 0 !important;
			top: 0 !important;
			margin-bottom: 0;
		}
		.drawer-visible .dashboard-scroll {
			display: none;
		}

		.drawer-visible .drawer {
			margin-left: 0;
			width: 300px;
			transform: translateX(0);
			top: 3rem !important;
			padding-top: 0;
			margin-bottom: 6rem !important;
			background: var(--primary-color) !important ;
		}
		.drawer {
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
			align-items: center;
			overflow-x: hidden;
			overflow-y: auto;
			position: relative;
			// padding: 20px 10px;
			// border-top-left-radius: 50px;
			// background-color: var(--bg-color);
			top: 0rem;
			bottom: 0rem;
			margin-bottom: 1rem;
			gap: 1px;
			// left: 64px;
			height: 100vh !important;
			width: calc(100% - 1rem);
			// height: 86%;
			// background: var(bg-gradient-r);
			// border-radius: var(--radius-l);
			transition: all 0.3s ease-in-out;
			scrollbar-width: 1px;
			scrollbar-color: #c8c8c8 transparent;
			scroll-behavior: smooth;
		}

		.drawer-input {
			display: flex;
			flex-direction: row;
			align-items: center;
			// padding: 0.75rem 0;
			gap: 0.5rem;
			border-radius: var(--radius-m);
			height: auto;
			width: 60px;
			color: var(--bg-color);
			transition: all 0.3s ease;
			z-index: 2000;
			input {
				background: transparent;
				border: none;
				color: var(--text-color);
				width: 100%;
				outline: none;

				&::placeholder {
					color: var(--placeholder-color);
				}
			}

			& button {
				border-radius: var(--radius-m);
				width: auto;
				border: none;
				display: flex;
				justify-content: center;
				align-items: center;
				transition: all 0.3s ease;
				justify-content: center;
				z-index: 2000;
				// &:hover{
				//   // background: var(--secondary-color);
				//   // box-shadow: -0 2px 20px 1px rgba(255, 255, 255, 0.1);
				//   // transform: translateY(-10px);

				// }
			}

			& input {
				padding: 0.5rem;
				border: none;
				border-radius: var(--radius-m);
				padding-left: 1rem;
				outline: none;
				margin-left: 2rem;
				margin-right: 0;
				width: 150px;
				color: var(--text-color);
				transition: all 0.3s ease;
				font-size: 1rem;
				&::placeholder {
					color: var(--placeholder-color);
				}

				&:focus {
					background-color: var(--secondary-color);
					position: absolute;
					width: auto;
					right: 2rem;
					left: 4rem;
					&::placeholder {
						color: var(--placeholder-color);
					}
				}
			}
		}
		button.toolbar-button {
			display: flex;
			align-items: center;
			justify-content: center !important;
			color: var(--placeholder-color) !important;
			width: 2rem !important;
			height: 2rem;
			border-radius: 1rem;
			background: var(--bg-color);
			border: 2px solid var(--line-color);
			cursor: pointer;
			transition: all 0.2s ease;
			padding: 0;

			&:hover {
				background-color: var(--secondary-color);
				color: var(--text-color) !important;
			}

			&.active {
				background-color: var(--secondary-color);
				color: var(--text-color) !important;
			}
		}
		input {
			flex-grow: 1;
			margin-right: auto;
			height: auto;
			font-size: 1rem;
			border-radius: 25px;
			background-color: transparent;
			justify-content: center;
			color: #818380;
			border: none;
			transition: all ease-in 0.3s;
			outline: none;

			&.thread-name {
				justify-content: center;
				font-size: 1.5rem;
			}
		}
		.thread-actions {
			display: flex;
			flex-direction: row;
			width: auto;
			height: 50px;
			background: var(--bg-gradient-left);
			margin-bottom: 0.5rem;
			margin-left: 2rem;
			margin-right: 2rem;
			border-radius: var(--radius-l);
		}
		.card {
			padding: 0;
		}
		.card-title {
			font-weight: 300;
			font-size: 0.9rem;
			// font-size: var( --font-size-s);
			margin-bottom: 0;
			text-align: left;
		}
		.card-title.project {
			font-weight: 300;
			font-size: var(--font-size-sm);
			display: flex;
			width: auto;
		}
		.card-static {
			display: flex;
			flex-direction: column;
			position: relative;
			align-items: flex-start;
			justify-content: flex-start;
			width: 100%;
			line-height: 1;
			margin-left: 0;
			padding: 0;
			height: 2rem;
			overflow: hidden;
		}
		button.card-container {
			display: flex;
			flex-direction: column;
			position: relative;
			flex-grow: 1;
			padding: 0.5rem;
			// background-color: var(--bg-color);
			width: calc(100% - 1rem);
			// box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
			transition: all 0.1s ease-in-out;
			&:hover {
				box-shadow: none;
				background: var(--secondary-color) !important;
				border-radius: 2rem;

				// background: rgba(226, 226, 226, 0.2);  /* Very subtle white for the glass effect */
				opacity: 1;
				visibility: visible;
				// box-shadow: -5px -1px 5px 4px rgba(255, 255, 255, 0.2);
			}
			&.selected {
				backdrop-filter: blur(30px);
				background: var(--bg-color);
				border-radius: 2rem;
			}
		}
	}
</style>

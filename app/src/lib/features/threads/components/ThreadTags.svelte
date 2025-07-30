<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import { fly, slide } from 'svelte/transition';
	import type { Tag } from '$lib/types/types';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	export let availableTags: Tag[] = [];
	export let currentThreadId: string | null = null;
	export let showTagSelector = false;
	export let isTags = true;

	const dispatch = createEventDispatcher();

	function toggleTagSelector() {
		showTagSelector = !showTagSelector;
		isTags = !isTags;
		dispatch('toggleSelector');
	}

	function toggleTag(tag: Tag) {
		dispatch('toggleTag', { tag });
	}
</script>

<div class="tag-row" transition:fly={{ y: -300, duration: 300 }}>
	{#if currentThreadId}
		<button
			on:click={toggleTagSelector}
			class="tag-selector-toggle"
			transition:fly={{ y: -300, duration: 300 }}
		>
			{#if isTags}
				<Icon name="TagIcon" color="var(--placeholder-color)" />
			{:else}
				<Icon name="Tags" color="var(--tertiary-color)" />
			{/if}
		</button>
		{#if showTagSelector}
			<div class="tag-selector" transition:fly={{ y: 20, duration: 500 }}>
				{#each availableTags as tag (tag.id)}
					<div class="tag-item" transition:fly={{ y: 20, duration: 50 }}>
						<button
							class="tag"
							class:selected={tag.thread_id?.includes(currentThreadId)}
							on:click={() => toggleTag(tag)}
							style="background-color: {tag.color}"
						>
							{tag.name}
							{#if tag.thread_id?.includes(currentThreadId)}
								<span class="checkmark">✓</span>
							{/if}
						</button>
					</div>
				{/each}
			</div>
		{:else}
			<div
				class="assigned-tags"
				on:click={toggleTagSelector}
				transition:fly={{ y: -300, duration: 300 }}
			>
				{#each availableTags.filter( (tag) => tag.thread_id?.includes(currentThreadId) ) as tag (tag.id)}
					<span class="tag" style="background-color: {tag.color}">{tag.name}</span>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.tag-row {
		display: flex;
		flex-wrap: nowrap;
		justify-content: top;
		align-items: top;
		position: relative;
		gap: 5px;
		margin-top: 0;
		user-select: none;
		border-radius: 1rem;
		transition: all ease 0.3s;
		width: 100% !important;
		margin-bottom: 1rem;
		margin-left: 0 !important;
		left: 0;
		margin-right: 4rem;
		// margin-right: 2rem;
		// margin-left: 2rem;
	}

	.tag-selector {
		display: flex;
		flex-wrap: wrap;
		justify-content: right;
		align-items: center;
		gap: 5px;
		border-radius: var(--radius-m);
		transition: all ease 0.3s;
		// background: var(--primary-color);
		margin-bottom: 2rem !important;
	}

	.assigned-tags {
		display: flex;
		width: 40px;
		height: 100%;
		width: 100%;
		transition: all 0.3s ease;
		justify-content: flex-start;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		padding: 4px 8px;
		border-radius: 16px;
		border: none;
		cursor: pointer;
		font-size: 14px;
		color: rgb(255, 255, 255);
		transition: all 0.1s ease;
		background: radial-gradient(
			circle at center,
			rgba(255, 255, 255, 0.2) 0%,
			rgba(255, 255, 255, 0) 50%
		);

		&:hover {
			opacity: 0.8;
			transform: scale(1.1);
		}

		&.selected {
			box-shadow: 0 0 0 2px rgb(51, 121, 105);
			font-weight: bolder;
			width: auto;
			height: auto;
			color: white;
		}
	}

	.tag-selector-toggle {
		background: none;
		border: none;
		cursor: pointer;
		color: white;
		position: relative;
		margin-top: 0 !important;
		top: 0;
		display: flex;

		&:hover {
			color: rgb(69, 171, 202);
			background-color: transparent;
		}
	}

	@media (max-width: 450px) {
		.tag-row {
			display: flex;
			flex-wrap: wrap;
			position: relative;
			justify-content: right;
			align-items: right;
			gap: 1px;
			border-radius: 20px;
			transition: all ease 0.3s;
			margin-right: 0;

			&:hover {
				display: flex;
				flex-wrap: nowrap;
				justify-content: right;
			}
		}

		.tag-selector {
			display: flex;
			flex-wrap: wrap;
			justify-content: right;
			align-items: center;
			gap: 1px;
			width: auto;
			border-radius: 20px;
			transition: all ease 0.3s;
		}
	}
</style>

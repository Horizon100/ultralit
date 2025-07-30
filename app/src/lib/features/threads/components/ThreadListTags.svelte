<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import { fly, slide } from 'svelte/transition';
	import {} from '$lib/pocketbase';
	import type { Tag } from '$lib/types/types';
	import { t } from '$lib/stores/translationStore';
	import { threadsStore } from '$lib/stores/threadsStore';
	import { fetchTryCatch, isSuccess } from '$lib/utils/errorUtils';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	let selectedTagIds: Set<string>;

	threadsStore.subscribe((state) => {
		console.log('Thread store state updated:', state);
		console.log('Thread store selectedTagIds:', state.selectedTagIds);
	});

	// Debug selectedTagIds changes
	$: {
		console.log('selectedTagIds reactive update:', selectedTagIds);
		console.log('Is Set?', selectedTagIds instanceof Set);
		console.log('Size:', selectedTagIds.size);
		console.log('Contents:', Array.from(selectedTagIds));
	}

	export let availableTags: Tag[] = [];
	export let editingTagId: string | null = null;
	export let editingTagIndex: number | null = null;
	export let newTagName = '';

	const dispatch = createEventDispatcher();

	$: selectedTagIds = $threadsStore.selectedTagIds;

	function toggleTagSelection(tagId: string) {
		console.log('Toggling tag selection for:', tagId);
		threadsStore.update((state) => {
			const newSelectedTags = new Set(state.selectedTagIds);
			if (newSelectedTags.has(tagId)) {
				newSelectedTags.delete(tagId);
			} else {
				newSelectedTags.add(tagId);
			}
			return {
				...state,
				selectedTagIds: newSelectedTags
			};
		});
		dispatch('toggleSelection', { tagId });
	}

	function startEditingTag(tagId: string) {
		editingTagId = tagId;
	}

	async function updateTag(tag: Tag) {
		if (!tag.name.trim()) return;

		const result = await fetchTryCatch<Tag>(`/api/tags/${tag.id}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: tag.name.trim(),
				color: tag.color
			})
		});

		if (isSuccess(result)) {
			dispatch('tagUpdated', { tag: result.data });
			editingTagId = null;
		} else {
			console.error('Error updating tag:', result.error);
		}
	}

	function toggleTagCreation() {
		console.log('Toggling tag creation mode');
		console.log('Current editingTagIndex:', editingTagIndex);

		if (editingTagIndex !== null) {
			editingTagIndex = null;
		} else {
			editingTagIndex = -1;
		}
		newTagName = '';

		console.log('New editingTagIndex:', editingTagIndex);
	}

	// Log when component receives new availableTags
	$: {
		console.log('Available tags updated:', availableTags);
	}
</script>

<!-- <div class="tags">
  
</div> -->

<div class="tag-list">
	{#each availableTags as tag (tag.id)}
		<div class="tag-item">
			{#if editingTagId === tag.id}
				<div class="tag-edit-container">
					<input
						bind:value={tag.name}
						on:blur={() => updateTag(tag)}
						on:keydown={(e) => e.key === 'Enter' && updateTag(tag)}
					/>
					<span class="tag-edit-buttons">
						<span class="save-tag-button" on:click={() => updateTag(tag)}>
							<Icon name="Check" />
						</span>
						<span
							class="delete-tag-button"
							on:click|stopPropagation={(event) => dispatch('deleteTag', { tagId: tag.id })}
						>
							<Icon name="Trash2" />
						</span>
					</span>
				</div>
			{:else}
				<span
					class="tag"
					class:selected={selectedTagIds.has(tag.id)}
					style="background-color: {tag.color}"
					on:click={() => toggleTagSelection(tag.id)}
				>
					{tag.name}
					<span class="edit-tag" on:click|stopPropagation={() => startEditingTag(tag.id)}>
						<Icon name="Pen" size={16} />
					</span>
				</span>
			{/if}
		</div>
	{/each}
	<button class="add-tag" on:click={toggleTagCreation}>
		<Icon name="Plus" />
		{$t('threads.newTag')}
	</button>
	{#if editingTagIndex !== null}
		<div class="new-tag-input" in:fly={{ y: -20, duration: 200 }} out:slide={{ duration: 200 }}>
			<input
				type="text"
				placeholder="New tag"
				bind:value={newTagName}
				on:keydown={(e) => {
					if (e.key === 'Enter') {
						dispatch('createTag', { name: newTagName });
						editingTagIndex = null; // Reset the state
						newTagName = ''; // Clear the input
					}
				}}
			/>
			<span
				class="new-tag"
				on:click={() => {
					dispatch('createTag', { name: newTagName });
					editingTagIndex = null; // Reset the state
					newTagName = ''; // Clear the input
				}}
			>
				<Icon name="Plus" />
			</span>
		</div>
	{/if}
</div>

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	.tag-list {
		display: flex;
		flex-wrap: wrap;
		width: 100%;
		justify-content: right;
		gap: var(--spacing-xs);
		// padding: var(--spacing-sm);
		margin-bottom: var(--spacing-md);
		background-color: transparent;
		border-radius: var(--radius-m);
		transition: all ease 0.3s;
	}

	.tag-list:hover {
		display: flex;
		flex-wrap: wrap;
		justify-content: right;
		gap: 5px;
		margin-bottom: 10px;
		background-color: var(--bg-color);
		height: auto;
	}

	span.save-tag-button,
	span.delete-tag-button {
		background: none;
		border: none;
		cursor: pointer;
		opacity: 0.7;
		transition: all ease 0.3s;
		display: inline-flex;
		position: relative;
		color: var(--placeholder-color);
	}
	span.save-tag-button {
		&:hover {
			color: rgb(147, 255, 147);
		}
	}
	span.delete-tag-button {
		&:hover {
			color: rgb(255, 0, 0);
		}
	}

	.tag.selected .edit-tag {
		opacity: 0.7;
		color: var(--text-color);
		pointer-events: auto;
		display: inline-flex;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		padding: 4px 8px;
		border-radius: 16px;
		border: none;
		cursor: pointer;
		font-size: 14px;
		color: var(--secondary-color);
		transition: all 0.1s ease;
		background: radial-gradient(
			circle at center,
			rgba(255, 255, 255, 0.2) 0%,
			rgba(255, 255, 255, 0) 50%
		);
		user-select: none;
		&:hover {
			opacity: 0.8;
			transform: scale(1.1);
		}

		&.selected {
			box-shadow: 0 0 0 2px rgb(51, 121, 105);
			font-weight: bolder;
			font-size: 20px;
			width: auto;
			height: auto;
			color: var(--text-color);

			border-color: var(--tertiary-color);
			background: var(--bg-gradient-right);
		}
	}

	.tag-edit-buttons {
		display: flex;
		width: auto;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
	}

	.new-tag-input,
	.tag-edit-container {
		display: flex;
		margin-bottom: 10px;
		width: auto;
		margin-left: 0;
		padding: 1rem;
		input {
			flex-grow: 1;
			border: 1px solid #ccc;
			border-radius: 15px;
			background-color: var(--secondary-color);
			padding: 0 1rem;
			font-size: 16px;
			color: white;
			width: 100%;
		}
	}

	// .tag-edit-container {
	//   display: flex;
	//   flex-direction: row;
	//   align-items: center;
	//   padding: 2px;
	//   border-radius: 15px;
	//   margin-left: 1rem;

	//   input {
	//     width: 80%;
	//     background-color: var(--primary-color);
	//     color: var(--text-color);
	//   }
	// }

	.new-tag {
		border: none;
		cursor: pointer;
		display: flex;
		position: relative;
		justify-content: right;
		transition: all ease 0.3s;
		border-radius: 50%;
		width: auto;
		height: auto;
		padding: 1rem;

		&:hover {
			background-color: var(--tertiary-color);
			color: var(--text-color);
			transform: scale(1.1);
		}
	}

	span.new-tag:hover {
		background-color: var(--tertiary-color);
		color: var(--text-color);
		transform: scale(1.1);
	}

	.new-tag-input {
		display: flex;
		margin-bottom: 10px;
		// width: 500px;
		margin-left: 0;
	}

	.new-tag-input input {
		flex-grow: 1;
		border: 1px solid #ccc;
		border-radius: 15px;
		background-color: var(--secondary-color);
		padding: 5px 10px;
		font-size: 12px;
		color: white;
		font-size: 16px;
		width: 100%;
	}

	button {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		background-color: transparent;
		// margin-left: 5%;
		// padding: 20px 20px;
		border: none;
		// margin-bottom: 10px;
		// margin-left: 10px;
		// border-radius: 10px;
		/* margin-bottom: 5px; */
		/* text-align: left; */
		/* border-bottom: 1px solid #4b4b4b; */
		cursor: pointer;
		color: #fff;
		transition: background-color var(--transition-speed);
		// transition: transform 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		border-radius: var(--radius-m);
		// letter-spacing: 4px;
		// font-size: 20px;
		font-family: var(--font-family);
		width: 100%;
		&:hover {
			background: var(--secondary-color);
		}
	}

	button.add-tag {
		background-color: var(--primary-color);
		// font-size: var(--font-size-s);
		font-weight: bold;
		cursor: pointer;
		height: auto;
		margin-top: 1rem;
		transition: all ease 0.3s;
		height: 2rem;
		width: 100%;
		// padding: 1rem;
		display: flex;
		user-select: none;
		gap: var(--spacing-sm);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	button.add-tag:hover {
		background-color: var(--tertiary-color);
	}

	.edit-tag {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px;
		margin-left: 2px;
		color: transparent;
		opacity: 0;
		transition: all ease 0.3s;
		display: none;
		position: relative;
		pointer-events: none;
	}

	button.add-tag:hover {
		background-color: var(--tertiary-color);
	}

	@keyframes pulsate {
		0% {
			box-shadow:
				0 0 0 var(--secondary-color),
				0 0 4px var(--tertiary-color);
		}

		100% {
			box-shadow:
				0 0 1px var(--secondary-color),
				0 0 6px var(--bg-color);
		}
	}
</style>

<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import type { AIAgent, Transform } from '$lib/types/types';
	import { Network, ClipboardList, MessageSquare, Settings, User, Save } from 'lucide-svelte';
	// import Kanban from '../features/Kanban.svelte';
	import CircleMap from '../network/CircleMap.svelte';
	import NodeChat from '../node/NodeChat.svelte';
	import { fade } from 'svelte/transition';
	import { updateAgent, deleteAgent, updateAgentDebounced } from '$lib/clients/agentClient';
	import AIChat from '$lib/features/ai/components/chat/AIChat.svelte';
	import { agentStore } from '../../stores/agentStore';

	export let agent: AIAgent;
	export let transform: Transform;

	let agentElement: HTMLElement;

	const dispatch = createEventDispatcher();

	let activeContent: 'chat' | 'info' | 'settings' | 'connections' = 'chat';

	let isDragging = false;
	let startX = 0;
	let startY = 0;
	let moveThreshold = 5; // pixels
	let hasMoved = false;

	let editingName = false;
	let editingPrompt = false;
	let tempName = agent.name;
	let tempPrompt = agent.prompt;

	$: isNodeOptionsView = transform.scale === 2.5;
	$: position = agent.position ? JSON.parse(agent.position) : { x: 0, y: 0 };
	$: style = `
        left: ${position.x * transform.scale + transform.offsetX}px;
        top: ${position.y * transform.scale + transform.offsetY}px;
        width: ${agent.expanded ? '400px' : '200px'};
        height: ${agent.expanded ? '300px' : '50px'};
        transform: scale(${transform.scale});
        transform-origin: top left;
    `;

	onMount(() => {
		document.addEventListener('click', handleOutsideClick);
	});

	onDestroy(() => {
		document.removeEventListener('click', handleOutsideClick);
	});

	function handleOutsideClick(event: MouseEvent) {
		if (agent.expanded && agentElement && !agentElement.contains(event.target as Node)) {
			handleAgentClose();
		}
	}

	function handleMouseDown(event: MouseEvent) {
		isDragging = true;
		startX = event.clientX - position.x * transform.scale;
		startY = event.clientY - position.y * transform.scale;
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
		event.stopPropagation();
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging) return;
		const newX = (event.clientX - startX) / transform.scale;
		const newY = (event.clientY - startY) / transform.scale;

		if (
			Math.abs(newX - position.x) > moveThreshold ||
			Math.abs(newY - position.y) > moveThreshold
		) {
			hasMoved = true;
		}

		position = { x: newX, y: newY };
	}
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			dispatch('click');
		}
	}

	async function handleMouseUp() {
		if (isDragging && hasMoved) {
			try {
				const updatedAgent = await updateAgent(agent.id, { position: JSON.stringify(position) });
				agentStore.updateAgent(agent.id, updatedAgent);
				console.log('Agent position updated successfully');
			} catch (error) {
				console.error('Failed to update agent position in backend:', error);
			}
		}
		isDragging = false;
		hasMoved = false;
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	}

	function handleAgentExpand(event: MouseEvent) {
		if (event && typeof event.stopPropagation === 'function') {
			event.stopPropagation();
		}
		if (agent.expanded) {
			handleAgentClose();
		} else {
			agent.expanded = true;
			agentStore.updateAgent(agent.id, { expanded: true });
			updateAgent(agent.id, { expanded: true }).catch((error) => {
				console.error('Failed to update agent expansion in backend:', error);
			});
		}
		dispatch('expand');
	}

	function handleContentChange(content: typeof activeContent, event: MouseEvent) {
		event.stopPropagation();
		activeContent = content;
	}

	async function handleDelete() {
		try {
			await deleteAgent(agent.id);
			agentStore.removeAgent(agent.id);
			dispatch('delete', agent.id);
		} catch (error) {
			console.error('Error deleting agent:', error);
		}
	}

	function handleNameEdit() {
		editingName = true;
		tempName = agent.name;
	}

	function handlePromptEdit() {
		editingPrompt = true;
		tempPrompt = agent.prompt;
	}

	async function handleNameSubmit() {
		agent.name = tempName;
		editingName = false;
		try {
			const updatedAgent = await updateAgent(agent.id, { name: agent.name });
			agentStore.updateAgent(agent.id, updatedAgent);
			agent = { ...agent, ...updatedAgent };
			console.log('Agent name updated successfully');
		} catch (error) {
			console.error('Failed to update agent name in backend:', error);
		}
	}

	async function handlePromptSubmit() {
		agent.prompt = tempPrompt;
		editingPrompt = false;
		try {
			const updatedAgent = await updateAgent(agent.id, { prompt: agent.prompt });
			agentStore.updateAgent(agent.id, updatedAgent);
			agent = { ...agent, ...updatedAgent };
			console.log('Agent prompt updated successfully');
		} catch (error) {
			console.error('Failed to update agent prompt in backend:', error);
		}
	}

	async function handleAgentClose() {
		if (agent.expanded) {
			agent.expanded = false;
			try {
				const updatedAgent = await updateAgent(agent.id, {
					name: agent.name,
					prompt: agent.prompt,
					expanded: false,
					x: agent.x,
					y: agent.y
				});
				agentStore.updateAgent(agent.id, updatedAgent);
				console.log('Agent updated successfully on close');
			} catch (error) {
				console.error('Failed to update agent on close:', error);
			}
		}
	}

	$: expandedClass = agent.expanded ? 'expanded' : '';
	$: ({ agents, updateStatus } = $agentStore);
</script>

{#if updateStatus}
	<div class="tooltip" class:error={updateStatus.includes('Failed')}>
		{updateStatus}
	</div>
{/if}

<div
	bind:this={agentElement}
	class="agent {agent.expanded ? 'expanded' : ''}"
	class:full-screen={isNodeOptionsView && agent.expanded}
	style="left: {agent.x * transform.scale + transform.offsetX}px; top: {agent.y * transform.scale +
		transform.offsetY}px; {style}"
	on:mousedown={handleMouseDown}
	on:click={handleAgentExpand}
	on:keydown={handleKeydown}
	role="button"
	tabindex="0"
	aria-expanded={agent.expanded}
>
	<div class="handle">
		<div class="title">
			<User size={24} color="#596363" />
			{#if editingName}
				<input
					bind:value={tempName}
					on:blur={handleNameSubmit}
					on:keydown={(e) => e.key === 'Enter' && handleNameSubmit()}
					autoFocus
				/>
			{:else}
				<h2 on:click={handleNameEdit}>{agent.name}</h2>
			{/if}
		</div>
		{#if editingPrompt}
			<textarea
				bind:value={tempPrompt}
				on:blur={handlePromptSubmit}
				on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && handlePromptSubmit()}
				autoFocus
			></textarea>
		{:else}
			<h3 on:click={handlePromptEdit}>{agent.prompt}</h3>
		{/if}
	</div>
	<div class="button-row">
		<button
			class:active={activeContent === 'chat'}
			on:click|stopPropagation={(event) => handleContentChange('chat', event)}
		>
			<MessageSquare size="24" color="#596363" />
		</button>
		<button
			class:active={activeContent === 'info'}
			on:click|stopPropagation={(event) => handleContentChange('info', event)}
		>
			<ClipboardList size="24" color="#596363" />
		</button>
		<button
			class:active={activeContent === 'settings'}
			on:click|stopPropagation={(event) => handleContentChange('settings', event)}
		>
			<Settings size="24" color="#596363" />
		</button>
		<button
			class:active={activeContent === 'connections'}
			on:click|stopPropagation={(event) => handleContentChange('connections', event)}
		>
			<Network size="24" color="#596363" />
		</button>
		<!-- <button class="save-button" on:click|stopPropagation={handleSave}>
            <Save size={20} color="#596363" />
        </button> -->
	</div>
	{#if agent.expanded && activeContent !== null}
		<div class="content" transition:fade={{ duration: 300 }}>
			{#if activeContent === 'chat'}
				<CircleMap />
			<!-- {:else if activeContent === 'info'}
				<Kanban /> -->
			{:else if activeContent === 'settings'}
				<p>Agent settings here</p>
			{:else if activeContent === 'connections'}
				<NodeChat />
			{/if}
		</div>
	{/if}
</div>

<style>
	.agent {
		position: fixed;
		display: flex;
		flex-direction: column;
		background-color: #353f3f;
		border: 1px solid #ccc;
		border-radius: 10px;
		padding: 10px;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
		transition: 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		overflow: hidden;
		cursor: move;
		z-index: 1000;
	}

	.agent:focus {
		outline: 2px solid #007bff;
		outline-offset: 2px;
		z-index: 1001;
	}

	.agent:hover {
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3); /* Enhanced shadow for deeper effect */
	}

	.agent.expanded {
		background-color: #353f3f;
		z-index: 1002;
	}

	.agent.full-screen {
		position: fixed;
		z-index: 1003;
		background-color: #353f3f;
	}

	.agent:active {
		cursor: grabbing;
	}

	h2 {
		/* margin: 0 0 10px 0; */
		font-size: 16px;
		font-family: Georgia, 'Times New Roman', Times, serif;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		justify-content: center;
		color: lightgray;
	}

	h3 {
		margin: 0 0 10px 0;
		font-size: 16px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: lightgray;
	}

	.button-row {
		display: flex;
		margin-top: 10px;
	}

	.button-row button {
		background-color: #353f3f;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	.button-row button:hover {
		background-color: #e0e0e0;
	}

	.button-row button.active {
		background-color: #d0d0d0;
		font-weight: bold;
	}

	.content {
		flex-grow: 1;
		display: flex;
		flex-direction: column;

		/* height: calc(100% - 70px); Adjust based on your title and button row height */
		overflow-y: auto;
		background-color: #2a3130;
		padding-left: 20px;
		border-radius: 20px;
		color: white;
	}

	.handle {
		display: flex;
		color: white;
		padding: 0 5px 0 5px;
		flex-direction: column;
		background-color: #2a3130;
		border-radius: 5px;

		/* justify-content: center; */
		/* align-items: center; */
	}

	.title {
		display: flex;
		height: 25px;
		/* justify-content: center; */
		align-items: center;
		flex-direction: row;
		gap: 10px;
	}

	.save-button {
		position: absolute;
		bottom: 10px;
		right: 10px;
		cursor: pointer;
		padding: 5px;
		border-radius: 50%;
		background-color: #f0f0f0;
		transition: background-color 0.3s;
	}

	.save-button:hover {
		background-color: #e0e0e0;
	}

	input,
	textarea {
		background: transparent;
		border: none;
		color: lightgray;
		font-size: inherit;
		font-family: inherit;
		width: 100%;
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-bottom: 1px solid lightgray;
	}

	textarea {
		resize: vertical;
		min-height: 50px;
	}

	.tooltip {
		position: fixed;
		top: 10px;
		right: 10px;
		background-color: #4caf50;
		color: white;
		padding: 10px;
		border-radius: 5px;
	}

	.tooltip.error {
		background-color: #f44336;
	}
</style>

<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import AIChat from '$lib/features/ai/components/chat/AIChat.svelte';
	import { networkStore } from '$lib/stores/networkStore';
	import type {
		Node,
		NodeConfig,
		AIModel,
		NetworkData,
		Task,
		PromptType,
		Attachment
	} from '$lib/types/types';
	import { ArrowRight, Check, X, Paperclip, File } from 'lucide-svelte';
	// import { generateNetwork } from '$lib/clients/aiClient';
	import {
		createAgentWithSummary,
		saveNetworkLayout,
		saveTasksForAgent,
		ensureAuthenticated,
		updateAIAgent
	} from '$lib/pocketbase';
	import { ClientResponseError } from 'pocketbase';
	import { goto } from '$app/navigation';
	import PromptSelector from '../ai/PromptSelector.svelte';

	export let x: number;
	export let y: number;
	export let aiModel: AIModel;
	export let userId: string = crypto.randomUUID();

	let seedPrompt = '';
	let showChat = false;
	let showIntro = false;
	let config: NodeConfig = {
		maxTokens: 100,
		temperature: 0.7
	};
	let summary: string = '';
	let tasks: Task[] = [];
	let textareaElement: HTMLTextAreaElement | null = null;
	let isAuthenticated = false;

	let attachment: Attachment | null = null;
	let fileInput: HTMLInputElement;
	let selectedPromptType: PromptType = 'TUTOR';

	const dispatch = createEventDispatcher<{
		create: { node: Node; networkData: NetworkData | null };
		cancel: void;
	}>();

	onMount(async () => {
		isAuthenticated = await ensureAuthenticated();
		if (!isAuthenticated) {
			console.error('User is not logged in. Please log in to create a network.');
			goto('/login');
		}

		if (textareaElement) {
			const adjustTextareaHeight = () => {
				if (textareaElement) {
					textareaElement.style.height = 'auto';
					textareaElement.style.height = `${Math.min(textareaElement.scrollHeight)}px`;
				}
			};

			textareaElement.addEventListener('input', adjustTextareaHeight);
			adjustTextareaHeight();

			if (!showChat) {
				textareaElement.focus();
			}

			return undefined;
		}
	});

	function handleUpload() {
		fileInput.click();
	}

	function handleFileSelected(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			const file = target.files[0];
			attachment = {
				id: crypto.randomUUID(),
				name: file.name,
				url: URL.createObjectURL(file),
				file: file
			};
		}
	}

	function deleteAttachment() {
		attachment = null;
	}

	function handlePromptSelection(event: CustomEvent<PromptType>) {
		selectedPromptType = event.detail;
		console.log('Selected prompt:', event.detail);
	}

	async function handleSeedPromptSubmit() {
		if (seedPrompt.trim() || attachment) {
			showChat = true;
			showIntro = false;
		}
	}

	function resetSeedPrompt() {
		seedPrompt = '';
		showChat = false;
		showIntro = true;
	}

	async function handleFinalize() {
		if (!summary) {
			console.error('No summary available. Cannot create network.');
			return;
		}

		try {
			const isAuthenticated = await ensureAuthenticated();
			if (!isAuthenticated) {
				console.error('User is not authenticated. Please log in and try again.');
				goto('/login');
				return;
			}

			const rootAgent = await createAgentWithSummary(summary, userId);

			if (Array.isArray(tasks) && tasks.length > 0) {
				const childAgents = await Promise.all(
					tasks.map((task) => createAgentWithSummary(task.description, userId))
				);

				// Update root agent with child agents
				await updateAIAgent(rootAgent.id, {
					child_agents: childAgents.map((agent) => agent.id)
				});

				console.log('Created root agent with child agents:', rootAgent);
			}

			const newNode: Node = {
				id: rootAgent.id,
				title: seedPrompt,
				content: summary,
				x,
				y,
				seedPrompt,
				expanded: false,
				config,
				label: seedPrompt,
				collectionId: rootAgent.collectionId,
				collectionName: rootAgent.collectionName,
				created: rootAgent.created,
				updated: rootAgent.updated
			};

			networkStore.addNode(newNode);
			networkStore.setRootAgent(rootAgent);
			dispatch('create', { node: newNode, networkData: null });
		} catch (error) {
			console.error('Error saving network data:', error);
			// ... (error handling)
		}
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleSummaryGeneration(event: CustomEvent<string>) {
		summary = event.detail;
		console.log('Summary received:', summary);
	}

	function handleTasksGeneration(event: CustomEvent<Task[]>) {
		tasks = event.detail;
		console.log('Tasks received:', tasks);
	}
</script>

<div class="seed-container">
	<div class="modal">
		{#if !showChat}
			<div class="seed-prompt-input">
				<div class="text-container">
					<textarea
						bind:this={textareaElement}
						bind:value={seedPrompt}
						placeholder={currentQuote}
						on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && handleSeedPromptSubmit()}
					></textarea>
				</div>

				<div class="button-row">
					{#if attachment}
						<button class="attachment-icon" on:dblclick={deleteAttachment}>
							<Paperclip size="20" color="white" />
							<span class="file-name">{attachment.name}</span>
						</button>
					{/if}
					<PromptSelector on:select={handlePromptSelection} />

					<button on:click={handleUpload}>
						<Paperclip size="20" color="white" />
					</button>
					<button on:click={handleSeedPromptSubmit}>
						<ArrowRight size="20" color="white" />
					</button>
				</div>
			</div>
		{:else}
			<AIChat
				{seedPrompt}
				{aiModel}
				{userId}
				attachment={attachment?.file}
				promptType={selectedPromptType}
				on:summary={handleSummaryGeneration}
				on:tasks={handleTasksGeneration}
			/>
			<!-- ... (rest of the existing code) -->
		{/if}
	</div>
</div>

<input type="file" bind:this={fileInput} style="display: none;" on:change={handleFileSelected} />

<style>
	.modal {
		display: flex;
		height: 100%;
		width: 100%;
		/* left: 2rem; */
		/* transform: translate(-50%, 0%); */
		/* border-radius: 80px; */
		width: 98%;
		transition: all 0.2s ease-in-out;
		z-index: 1000;
	}

	.seed-prompt-input {
		display: flex;
		flex-direction: row;

		/* height: auto; */
		/* align-content: center; */
		/* justify-content: center; */
		padding: 10px;
		gap: 10px;
		align-items: bottom;
		width: 100%;
		/* margin: 0 auto; */
	}

	@media (max-width: 940px) {
		.seed-prompt-input {
			flex-direction: column;
		}
	}

	.text-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-justify: center;
		text-align: center;
		/* margin-bottom: 20px; */
		flex-grow: 1;
		/* height: calc(80% - 40px); */
		/* height: calc(80% - 40px); */
		scroll-behavior: smooth; /* Smooth scrolling */
		max-height: 90vh;
	}

	@media (max-width: 500px) {
		.text-container {
			flex-direction: column;
			width: 90%;
		}
	}

	/* flex-grow: 1;
      overflow-y: auto;
      padding: 10px;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      scrollbar-width: thin;
      scrollbar-color: #000000 transparent;
      margin-bottom: 10px;
      padding-top: 40px;
      padding-bottom: 40px;
 */

	@media (max-width: 600px) {
		.text-container {
			flex-direction: column;
		}
	}

	textarea {
		width: 98%;
		/* min-height: 60px; Set a minimum height */
		/* max-height: 1200px; Set a maximum height */
		padding: 20px;
		text-justify: center;
		justify-content: center;
		resize: none;
		font-size: 16px;
		letter-spacing: 1.4px;
		border: none;
		border-radius: 20px;
		/* background-color: #2e3838; */
		background-color: #21201d;
		color: #818380;
		line-height: 1.4;
		height: auto;
		text-justify: center;
		box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
		overflow: scroll;
		scrollbar-width: none;
		scrollbar-color: #21201d transparent;
		vertical-align: middle; /* Align text vertically */
	}

	textarea:focus {
		outline: none;
		border: 2px solid #000000;
		color: white;
	}

	.button-row {
		display: flex;
		flex-direction: row;
		position: fixed;
		bottom: 3rem;
		right: 1rem;
		gap: 10px;
		padding: 10px;
		align-items: center;
		justify-content: center;
	}

	h1 {
		padding: 20px;
		border-radius: 50px;
		justify-content: center;
		align-items: center;
		font-size: 70px;
		color: white;
		letter-spacing: 4px;
		font-style: italic;
	}

	button {
		width: 50px;
		height: 50px;
		/* padding: 12px; */
		justify-content: center;
		align-items: center;
		/* margin-bottom: 20px; */
		background: #21201d;
		color: black;
		font-size: 18px;
		border: 2px solid #506262;
		border-radius: 80px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	button:hover {
		background: #818380;
		color: white;
	}

	p {
		margin: 0 0 20px 0;
		font-size: 24px;
		padding: 20px;
		font-style: italic;
		position: relative;
		backdrop-filter: blur(15px);
		transition: all 0.2s ease-in-out;
	}

	p::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border-radius: inherit;
		z-index: -1;
		filter: blur(30px);
		opacity: 0.6;
	}

	p:hover {
		box-shadow: 0 80px 16px rgba(0, 0, 0, 0.3);
	}

	.intro {
		display: flex;
		width: auto;
		align-items: center;
		justify-content: center;
		text-align: center;
		margin-top: 0;
	}

	.seed-container {
		display: flex;
		/* max-width: 900px; */
		flex-direction: column;
		align-items: center;
		justify-content: bottom;
		gap: 20px;
		align-items: bottom;
		background-color: transparent;
	}

	.attachment-icon {
		position: relative;
		border: none;
		height: 30px;
		width: 30px;
		margin-right: 10px;
	}

	.attachment-icon::after {
		content: '\2715';
		position: absolute;
		top: -5px;
		right: -5px;
		background-color: red;
		color: white;
		border-radius: 50%;
		width: 15px;
		height: 15px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
	}
</style>

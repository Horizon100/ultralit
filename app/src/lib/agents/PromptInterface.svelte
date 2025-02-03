<script lang="ts">
	import { onMount, afterUpdate, createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { Send, Paperclip } from 'lucide-svelte';
	import type { AIModel, ChatMessage, InternalChatMessage, Role, Agent } from '$lib/types/types';
	import { Spinner } from 'flowbite-svelte';
	import PromptSelector from './PromptSelector.svelte';
	import { HubAgent } from './HubAgent';
	import { hubStore } from './hubStore';

	export let seedPrompt: string = '';
	export let aiModel: AIModel;
	export let userId: string;

	let hubAgent: HubAgent;
	let chatMessages: InternalChatMessage[] = [];
	let userInput: string = '';
	let isLoading: boolean = false;
	let currentStage: string = 'initial';
	let roles: Role[] = [];
	let agents: Agent[] = [];

	const dispatch = createEventDispatcher();

	onMount(async () => {
		hubAgent = new HubAgent(aiModel, userId);
		await hubAgent.init(seedPrompt);
		updateState();
	});

	function updateState() {
		chatMessages = hubAgent.getChatMessages();
		isLoading = hubAgent.getIsLoading();
		currentStage = hubAgent.getCurrentStage();
		roles = hubAgent.getRoles();
		agents = hubAgent.getAgents();
		hubStore.set({ chatMessages, isLoading, currentStage, roles, agents });
	}

	async function handleSendMessage(message: string = userInput) {
		if (!message) return;
		userInput = '';
		await hubAgent.processUserInput(message);
		updateState();
	}

	async function handleRoleSelection(role: Role) {
		await hubAgent.selectRole(role);
		updateState();
	}

	// ... (keep other utility functions from your original code)
</script>

<div class="chat-container" role="region" aria-label="Chat messages">
	<div class="chat-messages" bind:this={chatMessagesDiv}>
		{#each chatMessages as message (message.id)}
			<!-- ... (keep your existing message rendering logic) -->
		{/each}
	</div>

	<div class="input-container">
		<textarea
			bind:value={userInput}
			on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && !isLoading && handleSendMessage()}
			placeholder="Type your message..."
			disabled={isLoading}
			rows="1"
		></textarea>
		<div class="btn-mode">
			<PromptSelector />
		</div>
		<div class="btn-upload">
			<button>
				<Paperclip size="20" color="white" />
			</button>
		</div>
		<div class="btn-send">
			<button on:click={() => !isLoading && handleSendMessage()} disabled={isLoading}>
				<Send size="20" color="white" />
			</button>
		</div>
	</div>
</div>

<style>
	/* ... (keep your existing styles) */
</style>

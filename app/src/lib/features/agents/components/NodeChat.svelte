<script lang="ts">
	import AIChat from '$lib/features/ai/components/chat/AIChat.svelte';
	import type { AIModel, ChatMessage, AIMessage } from '$lib/types/types';

	const defaultModel: AIModel = {
		id: 'default',
		name: 'GPT-3.5 Turbo',
		api_key: '',
		base_url: 'https://api.openai.com/v1',
		api_type: 'gpt-3.5-turbo',
		api_version: 'v1',
		description: 'Default GPT-3.5 Turbo model',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString()
	};

	let selectedModel: AIModel = defaultModel;
	let agentRole: string = 'assistant';
	let additionalPrompt: string = '';

	const models: AIModel[] = ['gpt-3.5-turbo', 'gpt-4', 'claude-v1', 'other-model'];
	const roles = ['assistant', 'expert', 'creative', 'analyst'];

	function handleModelChange(event: Event) {
		selectedModel = (event.target as HTMLSelectElement).value as AIModel;
	}

	function handleRoleChange(event: Event) {
		agentRole = (event.target as HTMLSelectElement).value;
		updateAdditionalPrompt();
	}

	function updateAdditionalPrompt() {
		additionalPrompt = `You are an AI ${agentRole}. Please respond accordingly.`;
	}
</script>

<div class="node-chat-container">
	<div class="options">
		<label>
			AI Model:
			<select on:change={handleModelChange}>
				{#each models as model}
					<option value={model}>{model}</option>
				{/each}
			</select>
		</label>
		<label>
			Agent Role:
			<select on:change={handleRoleChange}>
				{#each roles as role}
					<option value={role}>{role}</option>
				{/each}
			</select>
		</label>
	</div>
	<AIChat aiModel={selectedModel} {additionalPrompt} />
</div>

<style>
	.node-chat-container {
		display: flex;
		flex-direction: column;
	}

	.options {
		display: flex;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
	}

	select {
		margin-top: 0.5rem;
	}
</style>

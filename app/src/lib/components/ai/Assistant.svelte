<script lang="ts">
	import { onMount, afterUpdate, createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { Send, Paperclip } from 'lucide-svelte';
	import {
		fetchAIResponse,
		generateScenarios,
		generateTasks as generateTasksAPI,
		createAIAgent,
		// determineNetworkStructure,
		// generateSummary as generateSummaryAPI,
		generateGuidance,
		// generateNetwork
	} from '$lib/clients/aiClient';
	import { networkStore } from '$lib/stores/networkStore';
	import NetworkVisualization from '$lib/components/network/NetworkVisualization.svelte';
	import { Spinner } from 'flowbite-svelte';
	import { updateAIAgent, ensureAuthenticated } from '$lib/pocketbase';
	import PromptSelector from './PromptSelector.svelte';
	import type {
		AIModel,
		ChatMessage,
		InternalChatMessage,
		Scenario,
		Task,
		Attachment,
		Guidance,
		PromptType,
		NetworkData,
		AIAgent,
		Network
	} from '$lib/types/types';

	export let seedPrompt: string = '';
	export let additionalPrompt: string = '';
	export let aiModel: AIModel;
	export let userId: string;
	export let attachment: File | null = null;
	export let promptType: PromptType = 'TUTOR';

	const defaultAIModel: AIModel = {
		id: 'default',
		name: 'Default Model',
		api_key: '',
		base_url: 'https://api.openai.com/v1',
		api_type: 'gpt-3.5-turbo',
		api_version: 'v1',
		description: 'Default AI Model',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString()
	};

	$: safeAIModel = aiModel || defaultAIModel;
	let chatMessages: InternalChatMessage[] = [];

	let userInput: string = '';
	let isLoading: boolean = false;
	let hasSentSeedPrompt: boolean = false;
	let chatMessagesDiv: HTMLDivElement;
	let thinkingPhrase: string = '';
	let messageIdCounter: number = 0;
	let thinkingMessageId: string | null = null;
	let typingMessageId: string | null = null;

	let scenarios: Scenario[] = [];
	let tasks: Task[] = [];
	let attachments: Attachment[] = [];
	let currentStage:
		| 'initial'
		| 'scenarios'
		| 'guidance'
		| 'tasks'
		| 'refinement'
		| 'final'
		| 'summary' = 'initial';

	let summary: string = '';
	let selectedScenario: Scenario | null = null;
	let selectedTask: Task | null = null;
	let networkData: any = null;
	let showNetworkVisualization: boolean = false;
	let guidance: Guidance | null = null;

	let textareaElement: HTMLTextAreaElement | null = null;

	let isAuthenticated = false;

	const dispatch = createEventDispatcher();

	function getSystemMessage(promptType: PromptType): string {
		switch (promptType) {
			case 'FLOW':
				return "You are an AI assistant specialized in generating creative scenarios. Please provide detailed and imaginative scenarios based on the user's input.";
			case 'PLANNER':
				return 'You are an AI assistant focused on breaking down scenarios into actionable tasks. Please generate specific, well-defined tasks based on the given scenario.';
			case 'CODER':
				return 'You are an AI assistant designed to create AI agent profiles. Please generate detailed agent profiles based on the provided scenario and tasks.';
			case 'RESEARCH':
				return 'You are an AI assistant specialized in determining optimal network structures. Please analyze the given scenario and tasks to suggest the most suitable network structure.';
			case 'DESIGNER':
				return 'You are an AI assistant focused on refining and improving suggestions. Please provide constructive feedback and enhancements to the given suggestions.';
			case 'WRITER':
				return 'You are an AI assistant specialized in summarizing conversations. Please provide concise and accurate summaries of the given conversation.';
			case 'ANALYZER':
				return 'You are an AI assistant designed to generate network structures. Please create a detailed network structure based on the provided summary.';
			default:
				return "You are a helpful AI assistant. Please provide informative and relevant responses to the user's queries.";
		}
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

	function addMessage(
		role: 'user' | 'assistant' | 'thinking' | 'options',
		content: string | Scenario[] | Task[]
	): InternalChatMessage {
		messageIdCounter++;
		const messageContent = typeof content === 'string' ? content : JSON.stringify(content);
		return {
			role: role as 'user' | 'assistant' | 'thinking', // Cast to allowed roles
			content: messageContent,
			id: `msg-${messageIdCounter}`,
			isTyping: role === 'assistant',
			text: messageContent,
			user: userId,
			collectionId: '',
			collectionName: '',
			created: new Date().toISOString(),
			updated: new Date().toISOString()
		};
	}
	const thinkingPhrases = [
		'Consulting my digital crystal ball...',
		'Asking the oracle of ones and zeros...',
		'Summoning the spirits of Silicon Valley...',
		'Decoding the matrix...',
		'Channeling the ghost in the machine...',
		'Pondering the meaning of artificial life...',
		'Calculating the answer to life, the universe, and everything...',
		'Divining the digital tea leaves...',
		'Consulting the sacred scrolls of binary...',
		'Communing with the AI hive mind...'
	];

	function extractKeywords(text: string): string[] {
		const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
		const uniqueWords = [...new Set(words)];
		return uniqueWords.filter(
			(word) => word.length > 3 && !['the', 'and', 'for', 'that', 'this', 'with'].includes(word)
		);
	}

	function highlightKeywords(text: string, keywords: string[]): string {
		const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
		return text.replace(regex, '<span class="highlight">$1</span>');
	}

	function generateNetworkData(text: string, keywords: string[]): { nodes: any[]; edges: any[] } {
		const nodes = keywords.map((keyword) => ({ id: keyword, label: keyword }));
		const edges: { from: string; to: string }[] = [];

		const sentences = text.split(/[.!?]+/);
		sentences.forEach((sentence) => {
			const sentenceKeywords = keywords.filter((keyword) =>
				sentence.toLowerCase().includes(keyword.toLowerCase())
			);
			for (let i = 0; i < sentenceKeywords.length; i++) {
				for (let j = i + 1; j < sentenceKeywords.length; j++) {
					edges.push({ from: sentenceKeywords[i], to: sentenceKeywords[j] });
				}
			}
		});

		return { nodes, edges };
	}

	function getRandomThinkingPhrase() {
		return thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
	}

	/*
	 * function addMessage(role: 'user' | 'assistant' | 'thinking' | 'options', content: string | Scenario[] | Task[]) {
	 *   messageIdCounter++;
	 *   return { role, content, id: messageIdCounter, isTyping: role === 'assistant' };
	 * }
	 */

	$: if (seedPrompt && !hasSentSeedPrompt) {
		console.log('Processing seed prompt:', seedPrompt);
		hasSentSeedPrompt = true;
		handleSendMessage(seedPrompt);
	}

	async function generateLocalSummary() {
		summary = await generateSummaryAPI(
			chatMessages.map((msg) => ({
				role: msg.role as 'user' | 'assistant' | 'system',
				content: msg.content
			})),
			aiModel,
			userId
		);
		dispatch('summary', summary);
	}

	async function generateLocalTasks() {
		if (selectedScenario) {
			tasks = await generateTasksAPI(selectedScenario, aiModel, userId);
			dispatch('tasks', tasks);
		} else {
			console.error('No scenario selected for task generation');
		}
	}

	$: if (currentStage === 'summary') {
		generateLocalSummary();
	}

	$: if (currentStage === 'tasks' && selectedScenario) {
		generateLocalTasks();
	}

	async function handleSendMessage(message: string = userInput) {
		console.log('Handling send message:', message);
		if (!message && chatMessages.length === 0 && !attachment) return;

		chatMessages = [...chatMessages, addMessage('user', message)];
		userInput = '';
		resetTextareaHeight();

		thinkingPhrase = getRandomThinkingPhrase();
		const thinkingMessage = addMessage('thinking', thinkingPhrase);
		thinkingMessageId = thinkingMessage.id;
		chatMessages = [...chatMessages, thinkingMessage];
		isLoading = true;

		const minDisplayTime = 2000;
		const startTime = Date.now();

		try {
			const formData = new FormData();
			formData.append('message', message);
			formData.append('model', aiModel);
			formData.append('userId', userId);
			if (attachment) {
				formData.append('attachment', attachment);
			}
			if (additionalPrompt) {
				formData.append('additionalPrompt', additionalPrompt);
			}

			const systemMessage = getSystemMessage(promptType);
			const updatedMessages: AIMessage[] = [
				{ role: 'system', content: systemMessage },
				...chatMessages
					.filter((msg) => msg.role !== 'thinking')
					.map(({ role, content }) => ({
						role: role as 'user' | 'assistant' | 'thinking' | 'system',
						content
					}))
			];
			formData.append('messages', JSON.stringify(updatedMessages));

			console.log('Fetching AI response for messages:', updatedMessages);
			const response = await fetch('/api/ai', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			const aiResponse = await fetchAIResponse(
				updatedMessages.map(({ role, content }) => ({ role, content: content.toString() })),
				aiModel,
				userId,
				attachment
			);
			console.log('Received AI response:', aiResponse);

			const elapsedTime = Date.now() - startTime;
			if (elapsedTime < minDisplayTime) {
				await new Promise((resolve) => setTimeout(resolve, minDisplayTime - elapsedTime));
			}

			chatMessages = chatMessages.filter((msg) => msg.id !== String(thinkingMessageId));
			const assistantMessage = addMessage('assistant', '');
			chatMessages = [...chatMessages, assistantMessage];
			typingMessageId = assistantMessage.id;

			await typeMessage(aiResponse);

			if (currentStage === 'initial') {
				scenarios = await generateScenarios(message, aiModel, userId);
				chatMessages = [...chatMessages, addMessage('options', scenarios)];
				currentStage = 'scenarios';
			}
		} catch (error) {
			console.error('Error fetching AI response:', error);
			chatMessages = chatMessages.filter((msg) => msg.id !== thinkingMessageId);
			let errorMessage = 'An unexpected error occurred. Please try again later.';
			if (error instanceof Error) {
				errorMessage = `Error: ${error.message}`;
			}
			chatMessages = [...chatMessages, addMessage('assistant', errorMessage)];
		} finally {
			isLoading = false;
			thinkingMessageId = null;
			typingMessageId = null;
			attachment = null; // Clear the attachment after sending
		}
	}

	async function typeMessage(message: string) {
		const assistantMessage = addMessage('assistant', '');
		chatMessages = [...chatMessages, assistantMessage];
		typingMessageId = assistantMessage.id;

		const typingSpeed = 1; // milliseconds per character
		for (let i = 0; i <= message.length; i++) {
			chatMessages = chatMessages.map((msg) =>
				msg.id === String(typingMessageId)
					? {
							...msg,
							content: message.slice(0, i),
							text: message.slice(0, i),
							isTyping: i < message.length
						}
					: msg
			);
			await new Promise((resolve) => setTimeout(resolve, typingSpeed));
		}
	}

	async function handleScenarioSelection(scenario: Scenario) {
		selectedScenario = scenario;
		chatMessages = [
			...chatMessages,
			addMessage('user', `Selected scenario: ${scenario.description}`)
		];

		guidance = await generateGuidance(
			{ type: 'scenario', description: scenario.description },
			aiModel,
			userId
		);
		chatMessages = [...chatMessages, addMessage('assistant', guidance.content)];

		isLoading = true;
		thinkingPhrase = getRandomThinkingPhrase();
		const thinkingMessage = addMessage('thinking', thinkingPhrase);
		chatMessages = [...chatMessages, thinkingMessage];

		try {
			tasks = await generateTasksAPI(scenario, aiModel, userId);
			chatMessages = chatMessages.filter((msg) => msg.role !== 'thinking');
			chatMessages = [
				...chatMessages,
				addMessage('assistant', 'Based on the selected scenario, here are some suggested tasks:')
			];
			chatMessages = [...chatMessages, addMessage('options', tasks)];
			currentStage = 'tasks';
		} catch (error) {
			if (error instanceof Error) {
				chatMessages = [
					...chatMessages,
					addMessage('assistant', `Sorry, I encountered an error: ${error.message}`)
				];
			} else {
				chatMessages = [
					...chatMessages,
					addMessage('assistant', `Sorry, I encountered an error: Unknown error`)
				];
			}
		} finally {
			isLoading = false;
		}
	}
	async function handleTaskSelection(task: Task) {
		selectedTask = task;
		chatMessages = [...chatMessages, addMessage('user', `Selected task: ${task.description}`)];

		// Provide opportunity for task refinement
		const refinementGuidance = await generateGuidance(
			{ type: 'task_refinement', description: task.description },
			aiModel,
			userId
		);
		chatMessages = [...chatMessages, addMessage('assistant', refinementGuidance.content)];

		// Automatically proceed to finalization
		await finalizeProcess();
	}

	// // Call these functions at appropriate times in your component
	// $: if (currentStage === 'summary') {
	//     generateSummary();
	// }

	/*
	 * $: if (currentStage === 'tasks') {
	 *     generateTasks();
	 * }
	 */

	async function finalizeProcess() {
		if (selectedScenario && selectedTask) {
			isLoading = true;
			chatMessages = [...chatMessages, addMessage('thinking', 'Finalizing process...')];

			try {
				const rootAgent = await createAIAgent(selectedScenario, [selectedTask], aiModel, userId);

				const childAgents = await Promise.all(
					tasks.map((task) =>
						createAIAgent(
							{ id: '', description: task.description } as Scenario,
							[],
							aiModel,
							userId
						)
					)
				);

				// Update root agent with child agents
				await updateAIAgent(rootAgent.id, {
					child_agents: childAgents.map((agent) => agent.id)
				});

				networkStore.addAgent(rootAgent);
				networkStore.addChildAgents(childAgents);

				const summaryMessages = chatMessages.filter(
					(msg) => msg.role !== 'thinking' && msg.role !== 'assistant'
				);
				summary = await generateSummaryAPI(
					summaryMessages.map((msg) => ({
						role: msg.role as 'user' | 'assistant' | 'system',
						content: msg.content.toString()
					})),
					aiModel,
					userId
				);
				const keywords = extractKeywords(summary);
				const highlightedSummary = highlightKeywords(summary, keywords);

				/*
				 * Generate network data based on AI agents
				 * networkData = {
				 *   rootAgent,
				 *   childAgents,
				 *   // Add any other relevant network information
				 * };
				 */

				chatMessages = chatMessages.filter((msg) => msg.role !== 'thinking');
				await typeMessage('Process complete. AI agent created and network structure determined.');
				await typeMessage('Summary:');
				chatMessages = [
					...chatMessages,
					{ ...addMessage('assistant', highlightedSummary), isHighlighted: true }
				];

				currentStage = 'summary';
				dispatch('summary', summary);
				dispatch('networkData', networkData);
			} catch (error) {
				console.error('Error in finalizeProcess:', error);
				chatMessages = chatMessages.filter((msg) => msg.role !== 'thinking');
				await typeMessage(
					`An error occurred while finalizing the process: ${error instanceof Error ? error.message : 'Unknown error'}`
				);
			} finally {
				isLoading = false;
			}
		} else {
			console.error('Cannot finalize process: scenario or task not selected');
			await typeMessage('Error: Cannot finalize process. Please select a scenario and a task.');
		}
	}

	function toggleNetworkVisualization() {
		showNetworkVisualization = !showNetworkVisualization;
	}

	afterUpdate(() => {
		if (chatMessagesDiv) {
			chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
		}
	});

	onMount(() => {
		console.log('Component mounted. Initial chat messages:', chatMessages);
		console.log('AI Model:', aiModel);

		if (textareaElement) {
			const adjustTextareaHeight = () => {
				if (textareaElement) {
					textareaElement.style.height = 'auto';
					textareaElement.style.height = `${Math.min(textareaElement.scrollHeight)}px`;
				}
			};

			textareaElement.addEventListener('input', adjustTextareaHeight);
			adjustTextareaHeight();

			return () => {
				if (textareaElement) {
					textareaElement.removeEventListener('input', adjustTextareaHeight);
				}
			};
		}
	});

	$: console.log('isLoading changed:', isLoading);

	let isDragging = false;
	let startY: number;
	let scrollTopStart: number;

	function startDrag(event: MouseEvent) {
		isDragging = true;
		startY = event.clientY;
		scrollTopStart = chatMessagesDiv.scrollTop;
		document.addEventListener('mousemove', drag);
		document.addEventListener('mouseup', stopDrag);
	}

	function drag(event: MouseEvent) {
		if (isDragging) {
			const deltaY = startY - event.clientY;
			chatMessagesDiv.scrollTop = scrollTopStart + deltaY;
		}
	}

	function stopDrag() {
		isDragging = false;
		document.removeEventListener('mousemove', drag);
		document.removeEventListener('mouseup', stopDrag);
	}

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

	function resetTextareaHeight() {
		if (textareaElement) {
			textareaElement.style.height = 'auto';
			textareaElement.style.height = '50px'; // Set this to your default height
		}
	}
</script>

<div class="chat-container" on:mousedown={startDrag} role="region" aria-label="Chat messages">
	<button class="drag-handle" on:mousedown={startDrag} aria-label="Drag to scroll"> ⋮ </button>

	<div class="chat-messages" bind:this={chatMessagesDiv}>
		{#each chatMessages as message (message.id)}
			<div
				class="message {message.role}"
				in:fly={{ y: 20, duration: 300 }}
				out:fade={{ duration: 200 }}
			>
				<span class="role">
					{#if message.role === 'user'}
						You
					{:else if message.role === 'thinking'}
						AI
					{:else if message.role === 'options'}
						Options
					{:else}
						AI
					{/if}:
				</span>
				{#if message.role === 'options'}
					<div
						class="options"
						in:fly={{ y: 20, duration: 300, delay: 300 }}
						out:fade={{ duration: 200 }}
					>
						{#each JSON.parse(message.content) as option, index (`${message.id}-option-${index}`)}
							<button
								on:click={() =>
									currentStage === 'scenarios'
										? handleScenarioSelection(option)
										: handleTaskSelection(option)}
							>
								<span class="option-description">{option.description}</span>
								<span class="option-id">{option.id}</span>
							</button>
						{/each}
					</div>
				{:else if message.isHighlighted}
					<p>{@html message.content}</p>
				{:else}
					<p class:typing={message.isTyping}>{message.content}</p>
				{/if}
				{#if message.role === 'thinking'}
					<div class="thinking-animation">
						<span></span>
						<span></span>
						<span></span>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<div class="input-container">
		<textarea
			bind:this={textareaElement}
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

		{#if currentStage === 'summary'}
			<button on:click={toggleNetworkVisualization}>
				{showNetworkVisualization ? 'Hide' : 'Show'} Network
			</button>
		{/if}
	</div>
</div>

{#if showNetworkVisualization && networkData}
	<div class="network-overlay">
		<div class="network-container">
			<NetworkVisualization {networkData} />
		</div>
	</div>
{/if}

<style>
	.chat-container {
		display: flex;
		flex-direction: column;
		/* position: fixed; */
		justify-content: flex-end;
		/* border-radius: 20px; */
		/* padding: 10px; */
		backdrop-filter: blur(1px);
		height: 76vh;
		/* width: 50%; */
		overflow-y: auto;
	}

	@media (max-width: 500px) {
		.chat-container {
			width: 90%;
			height: 84vh;
		}
	}

	.chat-messages {
		flex-grow: 1;
		overflow-y: auto;
		padding: 10px;
		border-radius: 10px;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		scrollbar-width: 1px;
		scrollbar-color: #898989 transparent;
		margin-bottom: 10px;
		padding-bottom: 40px;
		background-color: #363f3f 0.1;
		backdrop-filter: blur(3px);
		/* background: linear-gradient (
        90deg,
        rgba(117, 118, 114, 0.9) 0%,
        rgba(0, 0, 0, 0.85) 5%,
        rgba(117, 118, 114, 0.8) 10%,
        rgba(117, 118, 114, 0.75) 15%,
        rgba(117, 118, 114, 0.7) 20%,
        rgba(0, 0, 0, 0.65) 25%,
        rgba(117, 118, 114, 0.6) 30%,
        rgba(0, 0, 0, 0.55) 35%,
        rgba(0, 0, 0, 0.5) 40%,
        rgba(117, 118, 114, 0.45) 45%,
        rgba(0, 0, 0, 0.4) 50%,
        rgba(0, 0, 0, 0.35) 55%,
        rgba(117, 118, 114, 0.3) 60%,
        rgba(117, 118, 114, 0.25) 65%,
        rgba(117, 118, 114, 0.2) 70%,
        rgba(117, 118, 114, 0.15) 75%,
        rgba(0, 0, 0, 0.1) 80%,
        rgba(1, 1, 1, 0.05) 85%,
        rgba(117, 118, 114, 0) 100%
      );
      backdrop-filter: blur(10px); */
	}

	.chat-messages::before,
	.chat-messages::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		height: 70px;
		width: 100%;
		pointer-events: none;
		z-index: 1;
	}

	.chat-messages::before {
		top: 0;
		background: linear-gradient(
			to bottom,
			rgba(117, 118, 114, 0.9) 0%,
			rgba(117, 118, 114, 0.85) 5%,
			rgba(117, 118, 114, 0.8) 10%,
			rgba(117, 118, 114, 0.75) 15%,
			rgba(117, 118, 114, 0.7) 20%,
			rgba(117, 118, 114, 0.65) 25%,
			rgba(117, 118, 114, 0.6) 30%,
			rgba(117, 118, 114, 0.55) 35%,
			rgba(117, 118, 114, 0.5) 40%,
			rgba(117, 118, 114, 0.45) 45%,
			rgba(117, 118, 114, 0.4) 50%,
			rgba(117, 118, 114, 0.35) 55%,
			rgba(117, 118, 114, 0.3) 60%,
			rgba(117, 118, 114, 0.25) 65%,
			rgba(117, 118, 114, 0.2) 70%,
			rgba(117, 118, 114, 0.15) 75%,
			rgba(117, 118, 114, 0.1) 80%,
			rgba(117, 118, 114, 0.05) 85%,
			rgba(117, 118, 114, 0) 100%
		);
		backdrop-filter: blur(3px);
	}

	/* .chat-messages::after {
  bottom: 90px;
  background: linear-gradient(
    to top,
    rgba(117, 118, 114, 0.9) 0%,
    rgba(117, 118, 114, 0.85) 5%,
    rgba(117, 118, 114, 0.8) 10%,
    rgba(117, 118, 114, 0.75) 15%,
    rgba(117, 118, 114, 0.7) 20%,
    rgba(117, 118, 114, 0.65) 25%,
    rgba(117, 118, 114, 0.6) 30%,
    rgba(117, 118, 114, 0.55) 35%,
    rgba(117, 118, 114, 0.5) 40%,
    rgba(117, 118, 114, 0.45) 45%,
    rgba(117, 118, 114, 0.4) 50%,
    rgba(117, 118, 114, 0.35) 55%,
    rgba(117, 118, 114, 0.3) 60%,
    rgba(117, 118, 114, 0.25) 65%,
    rgba(117, 118, 114, 0.2) 70%,
    rgba(117, 118, 114, 0.15) 75%,
    rgba(117, 118, 114, 0.1) 80%,
    rgba(117, 118, 114, 0.05) 85%,
    rgba(117, 118, 114, 0) 100%
  );
  backdrop-filter: blur(5px);
  z-index: 1;
}
   */
	.chat-messages::-webkit-scrollbar {
		width: 10px;
	}

	.chat-messages::-webkit-scrollbar-track {
		background: #f1f1f1;
	}

	.chat-messages::-webkit-scrollbar-thumb {
		background: #888;
		border-radius: 5px;
	}

	.message {
		display: flex;
		flex-direction: column;
		padding: 20px;
		border-radius: 20px;
		font-size: 18px;
		font-weight: 300;
		letter-spacing: 1px;
		line-height: 1.5;
		font-family: 'Roboto', sans-serif;
		transition: all 0.3s ease-in-out;
		word-break: break-word;
		max-width: 100%;
		overflow-wrap: break-word;
	}

	.message::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: radial-gradient(
			circle at center,
			rgba(255, 255, 255, 0.2) 0%,
			rgba(255, 255, 255, 0) 70%
		);
		opacity: 0.5;
		z-index: -1;
		transition: opacity 0.3s ease;
	}

	.message:hover::before {
		opacity: 0.8;
	}

	.message.assistant {
		align-self: flex-start;
		background: #21201d;
		color: white;
		margin-bottom: 20px;
		font-style: italic;
	}

	.message.options {
		align-self: stretch;
		background-color: transparent;
		padding: 0;
		box-shadow: none;
		font-style: italic;
		font-size: 24px;
		font-weight: bold;
	}

	.message.user {
		font-style: italic;
	}

	.message p {
		font-size: calc(7px + 1vmin);
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: break-word;
		word-wrap: break-word;
		hyphens: auto;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
	}

	.options button {
		padding: 12px;
		width: 100%;
		height: 100%;
		font-size: 14px;
		font-family: 'Roboto', sans-serif;
		font-weight: 100;
		color: #000;
		background: linear-gradient(45deg, rgba(255, 255, 255, 0.8) 0%, rgba(128, 128, 128, 0.8) 100%);
		border: 1px solid #ddd;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.3s ease;
		text-align: left;
		word-wrap: break-word;
		font-size: calc(10px + 1vmin);
		line-height: 1.5;
	}

	.options button:hover {
		background-color: #e0e0e0;
		transform: translateY(-2px);
	}

	.option-description {
		display: block;
		margin-bottom: 5px;
	}

	.option-id {
		display: block;
		font-size: 0.8em;
		color: #666;
	}

	.message.thinking {
		align-self: flex-start;
		color: #ffd700;
		background: #4b0082;
		font-style: italic;
		animation: pulsate 1.5s infinite alternate;
		margin-left: 20px;
	}

	.role {
		font-weight: bolder;
		text-decoration: underline;
	}

	@keyframes pulsate {
		0% {
			box-shadow:
				0 0 10px #ffd700,
				0 0 20px #ffd700;
		}
		100% {
			box-shadow:
				0 0 20px #ffd700,
				0 0 30px #ffd700;
		}
	}

	.thinking-animation {
		display: flex;
		justify-content: center;
		align-items: center;
		margin-top: 10px;
	}

	.thinking-animation span {
		width: 10px;
		height: 10px;
		margin: 0 5px;
		background-color: #ffd700;
		border-radius: 50%;
		animation: bounce 1.4s infinite ease-in-out both;
	}

	.thinking-animation span:nth-child(1) {
		animation-delay: -0.32s;
	}
	.thinking-animation span:nth-child(2) {
		animation-delay: -0.16s;
	}

	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: scale(0);
		}
		40% {
			transform: scale(1);
		}
	}

	.input-container {
		display: flex;
		height: 50px;
		padding: 10px;
		margin-bottom: 3rem;
	}

	/* input {
    flex-grow: 1;
    margin-right: 10px;
    padding: 10px;
    height: 50px;
    font-size: 18px;
    border-radius: 25px;
    background-color: #21201d;
    color: #818380;
    border: none;
  } */

	button {
		display: flex;

		width: 50px;
		height: 50px;
		padding: 10px;
		background-color: #21201d;
		color: white;
		border: 2px solid rgb(0, 0, 0);
		border-radius: 30px;
		cursor: pointer;
		transition: background-color 0.3s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	button:hover {
		background: #000000;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
	}

	.typing::after {
		content: '▋';
		display: inline-block;
		vertical-align: bottom;
		animation: blink 0.7s infinite;
	}

	.highlight {
		background-color: rgba(255, 255, 0, 0.3);
		border-radius: 3px;
		padding: 0 2px;
		font-weight: bold;
	}

	.network-overlay {
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.network-container {
		position: absolute;
		margin-left: auto;
		margin-right: auto;
		top: 30%;
		width: 80%;
		height: 50%;
		background-color: #fff;
		border-radius: 10px;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
		padding: 20px;
		display: flex;
		align-items: stre;
	}

	.drag-handle {
		width: 100%;
		height: 20px;
		background-color: transparent;
		border: none;
		cursor: ns-resize;
		display: flex;
		justify-content: center;
		align-items: center;
		color: #888;
	}

	.btn-mode {
		position: absolute;
		bottom: 0;
		right: 140px;
	}

	.btn-send {
		position: absolute;
		bottom: 0;
		right: 20px;
	}

	.btn-upload {
		position: absolute;
		bottom: 0;
		right: 80px;
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

	@keyframes blink {
		0% {
			opacity: 0;
		}
		50% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}
</style>

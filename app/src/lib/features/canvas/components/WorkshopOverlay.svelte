<script lang="ts">
	import { fade, fly, slide } from 'svelte/transition';
	import {
		X,
		ChevronDown,
		ChevronUp,
		Send,
		Camera,
		MessagesSquare,
		CassetteTape
	} from 'lucide-svelte';
	import type { Workshops, User } from '$lib/types/types';
	import { onMount } from 'svelte';
	import {} from '$lib/pocketbase';

	import { showLoading, hideLoading } from '$lib/stores/loadingStore';
	import LoadingSpinner from '$lib/components/feedback/LoadingSpinner.svelte';

	export let workshop: Workshops;
	export let onClose: () => void;
	export let user: any;

	let textareaElement: HTMLTextAreaElement;
	let userPrompt = '';
	let agentsDiscussionOpen = true;
	let resultsOpen = true;
	let creator: User | null = null;
	let activeTab: 'discussion' | 'results' = 'discussion';

	onMount(async () => {
		try {
			creator = await pb.collection('users').getOne(workshop.creator);
		} catch (error) {
			console.error('Error fetching workshop creator:', error);
		}

		if (textareaElement) {
			const adjustTextareaHeight = () => {
				textareaElement.style.height = 'auto';
				textareaElement.style.height = `${Math.min(textareaElement.scrollHeight, 200)}px`;
			};

			textareaElement.addEventListener('input', adjustTextareaHeight);
			adjustTextareaHeight();

			return () => {
				textareaElement.removeEventListener('input', adjustTextareaHeight);
			};
		}
	});

	function toggleAgentsDiscussion() {
		agentsDiscussionOpen = !agentsDiscussionOpen;
	}

	function toggleResults() {
		resultsOpen = !resultsOpen;
	}

	function handleSend() {
		console.log('Sending:', userPrompt);
		userPrompt = '';
		resetTextareaHeight();
	}

	function getAvatarUrl(user: User) {
		if (user.avatar) {
			return pb.getFileUrl(user, user.avatar);
		}
		return null;
	}

	function switchTab(tab: 'discussion' | 'results') {
		activeTab = tab;
	}

	function resetTextareaHeight() {
		if (textareaElement) {
			textareaElement.style.height = '50px'; // Set this to your default height
		}
	}
</script>

<div class="overlay" transition:fade={{ duration: 300 }}>
	<div class="overlay-content" transition:fly={{ y: 50, duration: 300 }}>
		<button class="close-button" on:click={onClose}>
			<X size={34} />
		</button>
		<div class="layout">
			<div class="tabs">
				<div class="tab-buttons">
					<button
						class:active={activeTab === 'discussion'}
						on:click={() => switchTab('discussion')}
					>
						<MessagesSquare />
						Discussion
					</button>
					<button class:active={activeTab === 'results'} on:click={() => switchTab('results')}>
						<CassetteTape />
						Results
					</button>
				</div>
				{#if creator}
					<p class="creator-name">{creator.name || creator.username}</p>
				{/if}
			</div>
			<div class="contents">
				{#if activeTab === 'discussion'}
					<div transition:slide={{ duration: 300 }}>
						<div class="user-prompt">
							<h3>User Prompt:</h3>
							<p>What would you like to know about this workshop?</p>
						</div>
						<div class="accordion">
							<button class="accordion-header" on:click={toggleAgentsDiscussion}>
								Agents Discussion
								{#if agentsDiscussionOpen}
									<ChevronUp size={24} />
								{:else}
									<ChevronDown size={24} />
								{/if}
							</button>
							{#if agentsDiscussionOpen}
								<div class="accordion-content">
									<p>Agents are discussing the workshop...</p>
								</div>
							{/if}
						</div>
						<div class="input-container">
							<div class="textarea-wrapper">
								<textarea
									bind:value={userPrompt}
									bind:this={textareaElement}
									placeholder="Type your message here..."
									rows="1"
								></textarea>
							</div>
							<button class="send-button" on:click={handleSend}>
								<Send />
							</button>
						</div>
					</div>
				{:else if activeTab === 'results'}
					<div transition:slide={{ duration: 300 }}>
						<div class="accordion">
							<button class="accordion-header" on:click={toggleResults}>
								Results
								{#if resultsOpen}
									<ChevronUp size={20} />
								{:else}
									<ChevronDown size={20} />
								{/if}
							</button>
							{#if resultsOpen}
								<div class="accordion-content">
									<p>Workshop results will be displayed here...</p>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<div class="button-row">
					<button class="placeholder-button">Button 1</button>
					<button class="placeholder-button">Button 2</button>
					<button class="placeholder-button">Button 3</button>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.overlay {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		width: 75vw;
		margin-top: 44px;
		/* height:99%; */
		/* margin-top: 220px; */
		/* height: 90%; */
		/* width: 80%; */
		/* margin-left: 20%; */
		/* margin-top: 10%; */
		/* position: relative; */
		border: 4px solid rgb(45, 45, 45);
		border-radius: 20px;
		/* right: 0; */
		background: linear-gradient
			(
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
		backdrop-filter: blur(10px);
	}

	.overlay-content {
		background-color: rgb(31, 31, 31);
		border-radius: 10px;
		overflow-y: auto;

		width: 100%;
		color: white;
		scrollbar-width: thin;
		scrollbar-color: transparent transparent;
	}

	.close-button {
		position: absolute;
		top: 0;
		right: 0;
		padding: 10px;
		background: none;
		border: none;
		cursor: pointer;
		color: white;
		border-radius: 50%;
		transition: background-color 0.3s;
		z-index: 10;
	}

	.close-button:hover {
		background-color: rgba(255, 255, 255, 0.1);
	}

	.layout {
		display: flex;
		flex-direction: column;
		height: 84vh;
		width: 100%;
		overflow: hidden;
	}

	.tabs {
		/* background-color: rgb(41, 41, 41); */
		/* border-radius: 14px; */
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
		overflow-x: hidden;
		width: 90%;
	}

	.contents {
		display: flex;
		flex-direction: column;
		padding: 20px;
		overflow-y: auto;
	}

	.tab-buttons {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
	}

	.tab-buttons button {
		background-color: rgb(61, 61, 61);
		color: white;
		border: none;
		display: flex;
		gap: 5px;
		justify-content: center;
		align-items: center;
		/* border-radius: 20px; */
		padding: 10px 20px;
		cursor: pointer;
		width: 50%;
		transition: background-color 0.3s;
	}

	.tab-buttons button:hover {
		background-color: rgb(71, 71, 71);
	}

	.tab-buttons button.active {
		background-color: rgb(0, 120, 212);
	}

	.user-prompt {
		background-color: rgb(51, 51, 51);
		padding: 15px;
		border-radius: 8px;
		margin-bottom: 20px;
	}

	.accordion {
		margin-bottom: 20px;
	}

	.accordion-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		background-color: rgb(61, 61, 61);
		border: none;
		color: white;
		padding: 10px 15px;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	.accordion-header:hover {
		background-color: rgb(71, 71, 71);
	}

	.accordion-content {
		background-color: rgb(51, 51, 51);
		padding: 15px;
		border-radius: 0 0 8px 8px;
	}

	.input-container {
		display: flex;
		flex-direction: row;
		align-items: flex-end;
		justify-content: center;
		position: absolute;
		bottom: 0;
		left: 0;
		width: 90%;
		padding: 10px;
		background-color: #21201d;
	}

	.textarea-wrapper {
		flex-grow: 1;
		position: relative;
	}

	textarea {
		width: 98%;
		padding: 10px;
		padding-right: 0px; /* Make room for the send button */
		min-height: 50px;
		max-height: 150px;
		font-size: 18px;
		border-radius: 25px;
		background-color: #21201d;
		color: #818380;
		border: none;
		resize: none;
		overflow-y: auto;
		overflow-x: hidden;
		word-wrap: break-word;
		white-space: pre-wrap;
		scrollbar-width: thin;
		scrollbar-color: transparent transparent;
		outline: none;
	}

	textarea::-webkit-scrollbar {
		width: 6px;
	}

	textarea::-webkit-scrollbar-thumb {
		background-color: #818380;
		border-radius: 3px;
	}

	.send-button {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 20px;
		background-color: rgb(0, 120, 212);
		color: white;
		/* border: none; */
		height: 50px;
		width: 50px;
		min-width: 50px;
		border-radius: 50%;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	.send-button:hover {
		background-color: rgb(0, 140, 232);
	}

	.button-row {
		display: flex;
		justify-content: space-between;
		margin-top: 10px;
	}

	.placeholder-button {
		background-color: rgb(61, 61, 61);
		color: white;
		border: none;
		border-radius: 5px;
		padding: 8px 15px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	.placeholder-button:hover {
		background-color: rgb(71, 71, 71);
	}

	.avatar-container {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		overflow: hidden;
		margin-bottom: 15px;
		background-color: rgb(61, 61, 61);
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.avatar {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		color: rgb(150, 150, 150);
	}

	.creator-name {
		font-size: 0.9em;
		color: #888;
		margin-top: 5px;
		margin-bottom: 15px;
	}
</style>

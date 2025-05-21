<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { currentUser } from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AIChat from '$lib/features/ai/components/chat/AIChat.svelte';
	import { Bot } from 'lucide-svelte';
	
	let isLoading = true;
	let error: string | null = null;
	let pageReady = false;
	
	// Default AI model configuration (copy from your root component)
	const defaultAIModel = {
		id: 'default',
		name: 'Default Model',
		api_key: 'default_key',
		base_url: 'https://api.openai.com/v1',
		api_type: 'gpt-3.5-turbo',
		api_version: 'v1',
		description: 'Default OpenAI Model',
		user: [],
		created: new Date().toISOString(),
		updated: new Date().toISOString(),
		collectionId: '',
		collectionName: ''
	};
	
	let userId: string;
	let aiModel = defaultAIModel;
	let threadId: string | null = null;
	let messageId: string | null = null;
	
	onMount(async () => {
		try {
			isLoading = true;
			
			// Check if user is logged in
			if (!$currentUser) {
				// Redirect to root if not logged in
				goto('/');
				return;
			}
			
			userId = $currentUser.id;
			
			// Get URL parameters
			threadId = $page.url.searchParams.get('threadId');
			messageId = $page.url.searchParams.get('messageId');
			
			pageReady = true;
		} catch (e) {
			error = 'Failed to load chat. Please try again.';
			console.error(e);
		} finally {
			const minimumLoadingTime = 800;
			setTimeout(() => {
				isLoading = false;
			}, minimumLoadingTime);
		}
	});
	
	$: userId = $currentUser?.id;
</script>

{#if pageReady}
	{#if isLoading}
		<div class="center-container" transition:fade={{ duration: 300 }}>
			<div class="loading-overlay">
				<div class="spinner">
					<Bot size={80} class="bot-icon" />
				</div>
			</div>
		</div>
	{:else}
		<div class="chat" in:fly={{ x: 200, duration: 400 }} out:fade={{ duration: 300 }}>
			<AIChat {threadId} initialMessageId={messageId} aiModel={aiModel} userId={userId} />
		</div>
	{/if}
{/if}



<style lang="scss">
	@use 'src/styles/themes.scss' as *;

	* {
		font-family: var(--font-family);

		/* font-family: 'Merriweather', serif; */
		/* font-family: Georgia, 'Times New Roman', Times, serif; */
	}

	:global(.loading-spinner) {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 9999;
	}

	

	.center-container {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100%;
		width: 100%;
		position: fixed;
		top: 60px;
		left: 0;
		z-index: 9999;
	}

	.loading-overlay {
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 9999;
		/* top: 40px; */
		/* left: calc(50% - 40px); */
		box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
		border-radius: 50%;
		position: fixed;
		right: calc(50% - 40px);
		top: calc(50% - 40px);
		color: var(--tertiary-color);

		/* bottom: 0; */
	}

	.spinner {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 60px;
		height: 60px;
		color: var(--tertiary-color);
		border: 20px dashed var(--primary-color);
		border-radius: 50%;
		position: relative;
		/* background-color: yellow; */
		animation: nonlinearSpin 4.2s infinite;
		animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
	}

	.loading,
	.error {
		font-size: 1.2rem;
		color: #333;
		text-align: center;
	}

	.error {
		color: #ff3e00;
	}

	.bot-icon {
		width: 100%;
		height: 100%;
	}

	@keyframes nonlinearSpin {
		0% {
			transform: rotate(0deg);
		}
		25% {
			transform: rotate(1080deg);
		}
		50% {
			transform: rotate(0deg);
		}
		75% {
			transform: rotate(1080deg);
		}
		100% {
			transform: rotate(2160deg);
		}
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}

	.section {
		padding: 1rem;
		margin-top: 2rem;
		text-align: center;
		max-width: 1200px;
		width: 100%;
	}



	.feature-cards {
		width: 100%;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		
	}

	.chat {
		position: fixed !important;
		display: flex;
		left: 10rem !important;
	}

	.user-container {
		display: flex;
		flex-direction: column;
		overflow: auto;
		border-radius: 40px;
		width: 100%;
		height: 100%;
		scrollbar-width: thin;
		scrollbar-color: #ffffff transparent;
		overflow-y: auto;
	}

	.half-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		margin-top: 2rem;
	}

	.content-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		width: 100%;
		background: radial-gradient(
			circle at center,
			rgba(255, 255, 255, 0.2) 0%,
			rgba(255, 255, 255, 0) 50%
		);

		/* Remove fixed height to allow content to expand */
	}
	.split-container {
		display: flex;
		flex-direction: column;
		width: 100%;
		/* height: 40%; */
	}

	.auth-overlay {
		position: fixed;
		left: 0;
		width: 100%;
		height: 100%;
		backdrop-filter: blur(5px);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		transition: all 0.3s ease;

	}

	.auth-content {
		position: fixed;
		display: flex;
		justify-content: center;
		/* background-color: #2b2a2a; */
		/* padding: 2rem; */
		width: 100%;
		max-width: 400px;
		border-radius: 2rem;
		/* max-width: 500px; */
		height: auto;
		overflow-y: auto;
		box-shadow: -20px -1px 200px 4px rgba(255, 255, 255, 1) !important;
		transition: all 0.3s ease-in;

	}

	.close-button {
		position: fixed;
		top: 0;
		left: 10px;
		width: 30px;
		height: 30px;
		border: none;
		color: white;
		cursor: pointer;
		background: none;
		display: flex;
		justify-content: center;
		text-align: center;
		font-size: 1rem;
		border-radius: 8px;
		padding: 5px;
		transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);
	}

	.close-button:hover {
		opacity: 0.8;
		background-color: red;
	}

	.dialog-overlay {
		background-color: var(--primary-color);
		border-radius: 30px;
		padding: 1rem;
	}

	.dialog-container {
		display: flex;
		position: relative;
		width: auto;
		height: auto;
	}

	.typewriter {
		width: 50%;
	}

	h1 {
		/* margin-top: 25%; */
		font-size: 4rem;
		color: #fff;
		margin-bottom: 2rem;
		width: 50%;
		text-align: left;
	}
	h2 {
		/* margin-top: 25%; */
		font-size: 3rem;
		font-weight: 500;
		color: #fff;
		margin-bottom: 2rem;
		width: 100%;
	}

	h3 {
		font-size: 1.5rem;
		color: #959595;
		margin-bottom: 2rem;
		font-weight: 300;
		width: 100%;
		font-style: italic;
	}

	p {
		display: flex;
		line-height: 1.5;
		text-align: justify;
		font-size: 24px;
		width: 50%;
	}

	button {
		display: flex;
		align-items: center;
		width: 50%;
		gap: 5px;
		font-size: 30px;
		justify-content: center;
		/* border-radius: 20px; */
		padding: 20px 40px;

		border: none;
		border-radius: 10px;
		cursor: pointer;
		transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);
		background: var(--secondary-color);
		filter: drop-shadow(0 0 4px var(--tertiary-color));

		&.fastlogin {
			width: auto;
			height: 2rem;
			background: var(--primary-color) !important;
			font-size: 1.25rem;
			padding: 1rem;
			position: fixed;
			top: 0;
			left: 1rem;
			background: none;
		}
	}

	button:hover {
		background: var(--tertiary-color) !important;
		color: var(--secondary-color);
	}

	.illustration {
		position: absolute;
		width: 96%;
		height: auto;
		left: 4%;
		top: 50%;
		transform: translateY(-50%);
		opacity: 0.025;
		z-index: 1;
		pointer-events: none;
	}

	.logo-container {
		display: flex;
		justify-content: center;
		align-items: center;
		transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);
		width: 100%;
	}

	.logo {
		max-height: 100%;
		max-width: 100%;
		object-fit: contain;
	}

	h1,
	h2,
	h3,
	button {
		margin-top: 1rem;
		color: var(--text-color);
	}

	.footer-container {
		display: flex;
		flex-direction: column;
		width: 100%;
		justify-content: center;
		align-items: center;
	}

	.footer-container button {
		max-width: 90%;
	}

	.terms-privacy {
		font-size: 1.3rem;
		color: #ffffff;
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.terms-privacy button {
		background: none;
		border: none;
		color: #6fdfc4;
		text-decoration: underline;
		cursor: pointer;
		font-size: 1.3rem;
		padding: 0;
		margin: 0;
		display: inline;
		width: auto;
	}

	.terms-privacy button:hover {
		color: #ffffff;
	}

	.testimonial {
		display: flex;
		flex-direction: row;
		text-align: right;
		justify-content: right;
		align-items: center;
		width: 50%;
	}

	.testimonial p {
		font-style: italic;
		color: var(--text-color);
		justify-content: right;
	}

	.cta-buttons {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		margin-top: 1rem;
		width: auto;
	}

	.cta-buttons button {
		font-size: 14px;
		padding: 10px 20px;
		background-color: var(--bg-gradient);
		color: var(--text-color);
		justify-content: left;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
		filter: drop-shadow(0 0 10px var(--text-color));

		height: 60px;
		width: auto;
		gap: auto;
	}

	.cta-buttons button:hover {
		color: var(--bg-color);
		transform: scale(0.9);
		background-color: var(--tertiary-color);
		filter: none;
	}

	.arrow-overlay {
		position: fixed;
		top: 120px;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		pointer-events: none;
		z-index: 1; /* Ensure it's above other elements */
	}

	.arrow {
		width: 0;
		height: 0;
		border-left: 50px solid transparent;
		border-right: 50px solid transparent;
		border-bottom: 70px solid #6fdfc4;
		margin-top: 40px;
		animation: bounce 1s infinite;
		filter: drop-shadow(0 0 10px rgba(111, 223, 196, 0.7));
	}

	ul {
		// list-style-type: none;
		padding: 0;
	}

	li {
		// margin-bottom: 1rem;
		font-size: 1.2rem;
	}


	.pricing-plans {
		display: flex;
		justify-content: space-around;
		flex-wrap: wrap;
		padding: 1rem;
	}

	.card {
		background: var(--bg-gradient-r);
		border-radius: 10px;
		margin: 1rem;
		text-align: center;
		transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);
		width: calc(69.333% - 2rem); /* 3 cards per row on larger screens */
		min-width: 250px; /* Minimum width for cards */
		margin: 1rem;
		border: 1px solid var(--bg-color);
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	.card:hover {
		background: var(--secondary-color);
		border: 1px solid var(--tertiary-color);
	}

	.card h3 {
		font-size: 1.5rem;
		margin-bottom: 1rem;
		width: 100%;
		text-align: center;
		justify-content: center;
		align-items: center;
	}

	.price {
		font-size: 1.8rem;
		color: #6fdfc4;
		margin-bottom: 1rem;
		width: 100%;
		text-align: center;
		justify-content: center;
		align-items: center;
	}

	.pricing-plans,
	.cta-buttons,
	.footer-container {
		max-width: 100%;
		overflow-x: hidden;
	}
	@keyframes bounce {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-30px);
		}
	}
	@media (max-width: 767px) {
		.cta-buttons {
			flex-direction: column;
			align-items: center;
		}
	}

	@media (max-width: 1199px) {
		h2,
		h3,
		button {
			width: 100%;
		}

		h1,
		.typewriter,
		.testimonial,
		.section {
			width: 90%;
		}
	}

	@media (max-width: 991px) {
		.card {
			width: calc(50% - 2rem); /* 2 cards per row on medium screens */
		}
		h2 {
			font-size: 60px;
		}
	}

	@media (max-width: 767px) {

		.fastlogin {
			display: flex;
		}
		.arrow-overlay {
			top: 200px;
		}

		h1 {
			font-size: 2rem;
		}

		h2 {
			font-size: 30px;
		}

		p {
			font-size: 1rem;
		}

		.terms-privacy {
			font-size: 1rem;
		}
		.terms-privacy button {
			font-size: 1rem;
		}

		.pricing-plans {
			flex-direction: column;
			align-items: center;
		}

		.card {
			width: 100%; /* 1 card per row on small screens */
		}
	}
</style>

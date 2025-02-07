<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { currentLanguage } from '$lib/stores/languageStore';
	import { fade, fly, blur, scale, slide } from 'svelte/transition';
	import { spring } from 'svelte/motion';
	import { quintOut } from 'svelte/easing';
	import { currentUser } from '$lib/pocketbase';
	import { elasticOut, elasticIn } from 'svelte/easing';
	import Auth from '$lib/components/auth/Auth.svelte';

	import Paper from '$lib/components/network/Paper.svelte';
	import { agentStore } from '$lib/stores/agentStore';
	import { initializeLanguage } from '$lib/stores/languageStore';
	import { goto } from '$app/navigation';
	import Builder from '$lib/components/ui/Builder.svelte';
	import SarcasticAuthPopup from '$lib/components/auth/SarcasticAuthPopup.svelte';
	import Headmaster from '$lib/assets/illustrations/headmaster2.png';
	import TypeWriter from '$lib/components/ui/TypeWriter.svelte';
	import Dialog from '$lib/components/ai/Dialog.svelte';
	import type {
		User,
		Node,
		NodeConfig,
		AIModel,
		NetworkData,
		Task,
		PromptType,
		Attachment,
		Threads,
		Messages
	} from '$lib/types/types';
	import { threadsStore } from '$lib/stores/threadsStore';
	import { pb } from '$lib/pocketbase';
	import { navigating } from '$app/stores';
	import { isNavigating } from '$lib/stores/navigationStore';
	import { page } from '$app/stores';
	import AIChat from '$lib/components/ai/AIChat.svelte';
	import horizon100 from '$lib/assets/horizon100.svg';
	import { Mail, Bot, Send, Github, X, ChevronDown, LogIn } from 'lucide-svelte';
	import Terms from '$lib/components/overlays/Terms.svelte';
	import PrivacyPolicy from '$lib/components/overlays/PrivacyPolicy.svelte';
	import FeatureCard from '$lib/components/ui//FeatureCard.svelte';
	import { showLoading } from '../lib/stores/loadingStore';
	import { t } from '$lib/stores/translationStore';
	import NewsletterPopup from '$lib/components/subscriptions/Newsletter.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	$: showThreadList = $threadsStore.showThreadList;

	const defaultAIModel: AIModel = {
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
	let aiModel: AIModel = defaultAIModel;

	let threadId: string | null = null;
	let messageId: string | null = null;
	let pageReady = false;
	let showNewsletterPopup = false;

	let isLoading = true;
	let error: string | null = null;

	$: if ($currentLanguage) {
		updatePageContent();
	}

	async function updatePageContent() {
		pageReady = false;
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 600));
		pageReady = true;
	}

	$: userId = $currentUser?.id;

	// export let userId: string = crypto.randomUUID();
	let threads: Threads[];
	let attachment: Attachment | null = null;
	let dialogAiModel: AIModel | null = null;

	let showContent = false;

	let showAuthPopup = false;
	let showFade = false;
	let showLogo = false;
	let showH1 = false;
	let showH2 = false;
	let showH3 = false;
	let showButton = false;
	let showTypeWriter = false;
	let placeholderText = '';

	let showAuth = false;

	let logoSize = spring(80);
	let logoMargin = spring(0);

	$: user = $currentUser;

	function handleGetStarted() {
		if (user) {
			// goto('/ask');
		} else {
			showAuthPopup = true;
		}
	}

	function checkLoginStatus() {
		showAuthPopup = true;
	}

	function closeAuthPopup() {
		showAuthPopup = false;
	}

	function getRandomTip() {
		const tips = $t('landing.productivityTips');
		return tips[Math.floor(Math.random() * tips.length)];
	}

	$: placeholderText = getRandomTip();

	let currentTip = '';

	function handleDialogSubmit(event: CustomEvent) {
		const { seedPrompt, aiModel, promptType } = event.detail;
		// Handle the submitted data, e.g., create a new thread
		handleSeedPromptSubmit(seedPrompt, aiModel, promptType);
		// goto('/ask');
	}

	let newThreadName = '';
	let newThreadId: string | null = null;
	let showConfirmation = false;

	async function handleSeedPromptSubmit(
		seedPrompt: string,
		aiModel: AIModel,
		promptType: PromptType
	) {
		console.log('handleSeedPromptSubmit called');
		if (!$currentUser) {
			console.error('User is not authenticated');
			return;
		}
		if (seedPrompt.trim() || attachment) {
			isLoading = true;
			try {
				// Create new thread
				const newThread = await threadsStore.addThread({
					op: $currentUser.id,
					name: `Thread ${threads?.length ? threads.length + 1 : 1}`
				});
				if (newThread && newThread.id) {
					threads = [...(threads || []), newThread];
					await threadsStore.setCurrentThread(newThread.id);
					newThreadName = newThread.name;
					newThreadId = newThread.id;

					// Add the seed prompt as the first message
					if (seedPrompt.trim()) {
						const firstMessage = await threadsStore.addMessage({
							thread: newThread.id,
							text: seedPrompt.trim(),
							type: 'human',
							user: $currentUser.id
						});
						console.log('First message added:', firstMessage);
					}

					showConfirmation = true;
					// handleConfirmation();
				} else {
					console.error('Failed to create new thread: Thread object is undefined or missing id');
				}
			} catch (error) {
				console.error('Error creating new thread:', error);
				// Handle the error appropriately (e.g., show an error message to the user)
			} finally {
				isLoading = false;
			}
		}
	}

	let userCount = 0;

	async function fetchUserCount() {
		try {
			const resultList = await pb.collection('users').getList(1, 1, {
				sort: '-created'
			});
			userCount = resultList.totalItems;
		} catch (error) {
			console.error('Error fetching user count:', error);
		}
	}

	let showTermsOverlay = false;
	let showPrivacyOverlay = false;
	let showArrowOverlay = false;

	function openTermsOverlay() {
		showTermsOverlay = true;
	}

	function openPrivacyOverlay() {
		showPrivacyOverlay = true;
	}

	function closeOverlay() {
		showTermsOverlay = false;
		showPrivacyOverlay = false;
	}

	function subscribeToNewsletter() {
		showNewsletterPopup = true;
		// Implement newsletter subscription logic
	}

	function handleOverlayClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			showAuth = false;
			showArrowOverlay = false;
		}
	}

	onMount(async () => {
		try {
			// Initialize loading state
			isLoading = true;
			updatePageContent();

			// Check auth and set initial states
			if (!pb.authStore.isValid) {
				showContent = true;
			}

			user = $currentUser;
			currentTip = getRandomTip();

			// Handle navigation subscription
			const unsubscribe = navigating.subscribe((navigationData) => {
				if (navigationData) {
					isNavigating.set(true);
				} else {
					setTimeout(() => {
						isNavigating.set(false);
					}, 300);
				}
			});

			// Get URL parameters if they exist
			threadId = $page.url.searchParams.get('threadId');
			messageId = $page.url.searchParams.get('messageId');

			/*
			 * Set current thread if threadId exists
			 * if (threadId) {
			 *     await threadsStore.setCurrentThread(threadId);
			 * }
			 */

			// Initialize necessary data
			await initializeLanguage();
			await fetchUserCount();

			// Landing page animations (only if not logged in)
			if (!user) {
				setTimeout(() => (showFade = true), 200);
				setTimeout(() => {
					showLogo = true;
					setTimeout(() => {
						logoSize.set(0);
						logoMargin.set(0);
					}, 300);
				}, 150);

				setTimeout(() => (showH1 = true), 600);
				setTimeout(() => (showH2 = true), 700);
				setTimeout(() => (showH3 = true), 800);
				setTimeout(() => (showTypeWriter = true), 900);
				setTimeout(() => (showButton = true), 1000);
			}

			return () => {
				unsubscribe();
			};
		} catch (e) {
			error = 'Failed to load thread. Please try again.';
			console.error(e);
		} finally {
			// Ensure minimum loading time
			const minimumLoadingTime = 800;
			setTimeout(() => {
				isLoading = false;
			}, minimumLoadingTime);
		}
	});

	function toggleAuth() {
		showAuth = !showAuth;
		showArrowOverlay = !showArrowOverlay;
	}

	function toggleIntro() {
		showArrowOverlay = !showArrowOverlay;
	}

	$: {
		if ($t) {
			placeholderText = getRandomTip();
		}
	}

	$: userId = $currentUser?.id;
	$: aiModel = defaultAIModel;
</script>
<button class="fastlogin"
	on:click={toggleAuth}
	in:fly={{ y: 0, duration: 500, delay: 400 }}
	out:fly={{ y: 50, duration: 500, delay: 400 }}
	>
	<LogIn/>
</button>
{#if pageReady}
	{#if user}
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
				<AIChat {threadId} initialMessageId={messageId} {aiModel} {userId} />
			</div>
		{/if}
	{:else}
		<div class="hero-container" in:fly={{ y: -200, duration: 500 }} out:fade={{ duration: 300 }}>
			{#if showFade}
				<img
					src={Headmaster}
					alt="Landing illustration"
					class="illustration"
					in:fade={{ duration: 2000 }}
				/>
			{/if}
			<div class="half-container">
				<div class="content-wrapper">
					{#if showLogo}
						<div
							class="logo-container"
							style="height: {$logoSize}%; margin-top: {$logoMargin}%;"
							in:fade={{ duration: 2000, delay: 0 }}
							out:fade={{ duration: 100 }}
						>
							<img src={horizon100} alt="Horizon100" class="logo" in:fade={{ duration: 100 }} />
						</div>
					{/if}

					{#if showH2}
						<h1 in:fly={{ y: -50, duration: 500, delay: 200 }} out:fade={{ duration: 300 }}>
							{$t('landing.h1')}
						</h1>
					{/if}
					{#if showTypeWriter}
						<div class="typewriter" in:fade={{ duration: 500, delay: 500 }}>
							<TypeWriter text={$t('landing.introText')} minSpeed={1} maxSpeed={10} />
						</div>
					{/if}
					{#if showButton}
						<div
							class="footer-container"
							in:fly={{ y: -50, duration: 500, delay: 200 }}
							out:fade={{ duration: 300 }}
						>
							{#if !showAuth}
								<button
									on:click={toggleAuth}
									in:fly={{ y: 50, duration: 500, delay: 400 }}
									out:fly={{ y: 50, duration: 500, delay: 400 }}
								>
									{$t('landing.cta')}
								</button>
							{/if}

							<div class="cta-buttons">
								<button on:click={subscribeToNewsletter}>
									<Mail size="30" />
									{$t('landing.subscribing')}
								</button>
								<NewsletterPopup bind:showPopup={showNewsletterPopup} />

								<a href="https://t.me/vrazum" target="_blank" rel="noopener noreferrer">
									<button>
										<Send size="30" />
										Telegram
									</button>
								</a>
								<a
									href="https://github.com/Horizon100/ultralit"
									target="_blank"
									rel="noopener noreferrer"
								>
									<button>
										<Github size="30" />
										GitHub
									</button>
								</a>
							</div>
							<div class="testimonial">
								<p>{userCount} {$t('landing.usercount')}</p>
							</div>
						</div>
					{/if}

					{#if showH2}
						<div id="features" class="section">
							<h2>{$t('features.title')}</h2>
							<div class="feature-cards">
								{#each $t('features.cards') as card}
									<FeatureCard title={card.title} features={card.features} isPro={card.isPro} />
								{/each}
							</div>
						</div>
					{/if}

					{#if showButton}
						<div id="pricing" class="section">
							<h2>{$t('pricing.title')}</h2>
							<div class="pricing-plans">
								{#each $t('pricing.plans') as plan}
									<div class="card">
										<h3>{plan.name}</h3>
										<p class="price">{plan.price}</p>
										<ul>
											{#each plan.features as feature}
												<li>{feature}</li>
											{/each}
										</ul>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
{/if}

{#if showTermsOverlay}
	<Terms on:close={closeOverlay} />
{/if}

{#if showPrivacyOverlay}
	<PrivacyPolicy on:close={closeOverlay} />
{/if}

{#if showArrowOverlay}
	<div class="arrow-overlay" transition:fly={{ y: 200, duration: 300, easing: quintOut }}>
		<div class="arrow"></div>
	</div>
{/if}

{#if showAuth}
	<div
		class="auth-overlay"
		on:click={handleOverlayClick}
		transition:fly={{ y: 0, duration: 300, easing: quintOut }}
	>
		<div class="auth-content" transition:fly={{ y: 50, duration: 700 }}>
			<button
				class="close-button"
				on:click={() => {
					showAuth = false;
					showArrowOverlay = false;
				}}
				transition:fly={{ y: -200, duration: 300 }}
			>
				<X size={24} />
			</button>

			<Auth
				on:close={() => {
					showAuth = false;
					showArrowOverlay = false;
				}}
			/>
		</div>
	</div>
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
		background-color: rgba(0, 0, 0, 0.5);
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
		background-color: var(--bg-color);
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
		width: 50%;
	}

	.chat {
		width: 100%;
	}

	.hero-container {
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
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.auth-content {
		position: fixed;
		top: 0;
		/* background-color: #2b2a2a; */
		/* padding: 2rem; */
		width: 100%;
		/* max-width: 500px; */
		height: auto;
		overflow-y: auto;
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
			width: 40px;
			height: 40px;
			font-size: 10px;
			padding: 0;
			position: fixed;
			top: 0;
			left: 1rem;
			background: none;
		}
	}

	button:hover {
		background: var(--tertiary-color);
		color: rgb(0, 0, 0);
		font-size: 60px;
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
		list-style-type: none;
		padding: 0;
	}

	li {
		margin-bottom: 1rem;
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
		width: calc(33.333% - 2rem); /* 3 cards per row on larger screens */
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

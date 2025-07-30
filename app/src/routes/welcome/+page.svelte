<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { currentUser } from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	import { showAuth, toggleAuth } from '$lib/stores/authStore';
	import { fade, fly } from 'svelte/transition';
	import { spring } from 'svelte/motion';
	import { t } from '$lib/stores/translationStore';
	import TypeWriter from '$lib/transitions/TypeWriter.svelte';
	import FeatureCard from '$lib/components/cards/FeatureCard.svelte';
	import NewsletterPopup from '$lib/features/users/components/Newsletter.svelte';
	import Terms from '$lib/features/legal/components/Terms.svelte';
	import PrivacyPolicy from '$lib/features/legal/components/PrivacyPolicy.svelte';
	import Auth from '$lib/features/auth/components/Auth.svelte';
	import horizon100 from '$lib/assets/thumbnails/horizon100.svg';
	import openaiIcon from '$lib/assets/icons/providers/openai.svg';
	import anthropicIcon from '$lib/assets/icons/providers/anthropic.svg';
	import grokIcon from '$lib/assets/icons/providers/x.svg';
	import deepseekIcon from '$lib/assets/icons/providers/deepseek.svg';
	import { clientTryCatch, storageTryCatch, isSuccess, isFailure } from '$lib/utils/errorUtils';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
	import type { FeatureCardType, PricingPlan, Task } from '$lib/types/types';
	import { createEventDispatcher } from 'svelte';
	import { page } from '$app/stores';
	import { navigationStore } from '$lib/stores/navigationStore';
	let pageReady = false;
	let redirectedFromLogin = false;
	let isLoading = true;
	let error: string | null = null;
	let showNewsletterPopup = false;
	let navigationFlagChecked = false;

	// Animation states
	let showContent = false;
	let showFade = false;
	let showLogo = false;
	let showH1 = false;
	let showH2 = false;
	let showH3 = false;
	let showButton = false;
	let showTypeWriter = false;
	let placeholderText = '';

	let logoSize = spring(80);
	let logoMargin = spring(0);

	let userCount = 0;
	let showTermsOverlay = false;
	let showPrivacyOverlay = false;
	let currentTip = '';

	const dispatch = createEventDispatcher();

	function getRandomTip() {
		const tips = $t('landing.productivityTips') as string[];
		return tips[Math.floor(Math.random() * tips.length)];
	}

	function getRandomGuidance() {
		const guidanceCategories = ['productivity', 'aiPowerTips', 'projectMastery', 'timeSaving'];
		const randomCategory =
			guidanceCategories[Math.floor(Math.random() * guidanceCategories.length)];
		const categoryItems = $t(`guidance.${randomCategory}`) as string[];
		return {
			hook: categoryItems[0],
			question: categoryItems[1],
			hint: categoryItems[2]
		};
	}
	const guidance = getRandomGuidance();

	$: placeholderText = getRandomTip();

	function subscribeToNewsletter() {
		showNewsletterPopup = true;
	}

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

	function handleOverlayClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			$showAuth = false;
		}
	}
	function scrollToSection(sectionId: string) {
		const section = document.getElementById(sectionId);
		if (section) {
			section.scrollIntoView({ behavior: 'smooth' });
			// Dispatch event to parent layout
			dispatch('sectionChange', { sectionId });
		}
	}

	// Navigation functions
	function goToFeatures() {
		scrollToSection('features');
	}

	function goToPricing() {
		scrollToSection('pricing');
	}

	function goToAbout() {
		scrollToSection('about');
	}
	function handlePlanClick(planName: string, e: Event) {
		/*
		 * e.preventDefault();
		 * e.stopPropagation();
		 */

		localStorage.setItem('selectedPlan', planName.toLowerCase());

		switch (planName) {
			case 'Basic':
				toggleAuth(true);
				break;
			case 'Pro':
				goto('/subscription/pro');
				break;
			case 'Enterprise':
				goto('/subscription/enterprise');
				break;
			default:
				// Fallback
				toggleAuth(true);
		}
	}
	function handleSignOut() {
		$showAuth = false;
		// Force page reload to ensure proper state after logout
		setTimeout(() => window.location.reload(), 100);
	}
	$: featureCards = $t('features.cards') as FeatureCardType[];
	$: pricingPlans = $t('pricing.plans') as PricingPlan[];
	$: introText = $t('landing.introText') as string;
	$: {
		console.log('Current active section:', $navigationStore.activeSection);
		console.log('Current page:', $page.url.pathname);
	}
	$: if (
		browser &&
		$currentUser &&
		pageReady &&
		!isLoading &&
		!redirectedFromLogin &&
		!navigationFlagChecked
	) {
		redirectedFromLogin = true;
		goto('/welcome');
	}
	onMount(async () => {
		const mountResult = await clientTryCatch(
			new Promise<void>((resolve) => {
				isLoading = true;

				// Check for logged-in user and let the page appear before redirecting
				if ($currentUser) {
					// Use a flag or localStorage to check if the user deliberately navigated here
					const directNavigation = storageTryCatch(
						() => sessionStorage.getItem('directNavigation') === 'true',
						false,
						'Failed to check navigation flag'
					);

					navigationFlagChecked = true; // Mark that we've checked the flag

					if (!directNavigation) {
						setTimeout(() => {
							goto('/home');
						}, 100);
						resolve();
						return;
					}

					// Clear the flag after using it
					storageTryCatch(
						() => sessionStorage.removeItem('directNavigation'),
						undefined,
						'Failed to clear navigation flag'
					);
				}

				pageReady = true;

				// Only run landing page animations if we're staying on this page
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

				currentTip = getRandomTip();
				resolve();
			}),
			'Failed to load page'
		);

		if (isFailure(mountResult)) {
			error = 'Failed to load page. Please try again.';
		}

		// Always run the minimum loading time logic
		const minimumLoadingTime = 800;
		setTimeout(() => {
			isLoading = false;
		}, minimumLoadingTime);
	});
</script>

{#if pageReady}
	{#if isLoading}
		<div class="center-container" transition:fade={{ duration: 300 }}>
			<div class="loading-overlay">
				<div class="spinner">
					<span class="bot-icon"><Icon name="Bot" size={80} /></span>
				</div>
			</div>
		</div>
	{:else}
		<!-- {#if pageReady && !isLoading && !$currentUser}
			<button 
			class="fastlogin"
			on:click={toggleAuth}
			in:fly={{ y: 0, duration: 500, delay: 400 }}
			out:fly={{ y: 50, duration: 500, delay: 400 }}
			>
			<LogIn/>
			<span>
				{$t('profile.login')}
			</span>
			</button>
		{/if} -->
		<div class="user-container" in:fly={{ y: -200, duration: 500 }} out:fade={{ duration: 300 }}>
			{#if showFade}
				<div class="half-container">
					<div class="content-wrapper">
						<div id="start" class="section">
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
							{#if !$currentUser}
								{#if showH2}
									<h1 in:fly={{ y: -50, duration: 500, delay: 200 }} out:fade={{ duration: 300 }}>
										{$t('landing.h1')}
									</h1>
								{/if}

								{#if showTypeWriter}
									<div class="typewriter" in:fade={{ duration: 500, delay: 500 }}>
										<TypeWriter text={introText} minSpeed={1} maxSpeed={10} />
									</div>
								{/if}
							{:else}
								{#if showH2}
									<h1 in:fly={{ y: -50, duration: 500, delay: 200 }} out:fade={{ duration: 300 }}>
										{guidance.hook}
									</h1>
								{/if}

								{#if showTypeWriter}
									<div class="typewriter" in:fade={{ duration: 500, delay: 500 }}>
										<TypeWriter text={guidance.question} minSpeed={1} maxSpeed={10} />
									</div>
								{/if}
								{#if showTypeWriter}
									<div class="typewriter" in:fade={{ duration: 500, delay: 500 }}>
										<TypeWriter text={guidance.hint} minSpeed={1} maxSpeed={20} />
									</div>
								{/if}
							{/if}
							{#if showButton}
								<div
									class="footer-container"
									in:fly={{ y: -50, duration: 500, delay: 200 }}
									out:fade={{ duration: 300 }}
								>
									{#if !$showAuth}
										{#if pageReady && !isLoading && !$currentUser}
											<button
												on:click={toggleAuth}
												in:fly={{ y: 50, duration: 500, delay: 400 }}
												out:fly={{ y: 50, duration: 500, delay: 400 }}
											>
												{$t('landing.cta')}
											</button>
										{/if}
									{/if}

									<div class="cta-buttons">
										<button on:click={subscribeToNewsletter}>
											<Icon name="Mail" size={30} />
											{$t('landing.subscribing')}
										</button>
										<NewsletterPopup bind:showPopup={showNewsletterPopup} />

										<!-- <a href="https://t.me/vrazum" target="_blank" rel="noopener noreferrer">
											<button>
												<Send size="30" />
												Telegram
											</button>
										</a> -->
										<a
											href="https://github.com/Horizon100/ultralit"
											target="_blank"
											rel="noopener noreferrer"
										>
											<button>
												<Icon name="Github" size={30} />
												GitHub
											</button>
										</a>
									</div>
									<!-- <div class="testimonial">
										<p>{userCount} {$t('landing.usercount')}</p>
									</div> -->
								</div>
							{/if}
						</div>
						{#if showH2}
							<div id="features" class="section">
								<h2>{$t('features.title')}</h2>
								<div class="feature-cards">
									{#each featureCards as card, index}
										<FeatureCard
											title={card.title}
											features={card.features}
											isPro={card.isPro}
											cardId={index}
										/>
									{/each}
								</div>
							</div>
						{/if}
						{#if showButton}
							<div id="pricing" class="section">
								<h2>{$t('pricing.title')}</h2>
								<div class="pricing-plans">
									{#each pricingPlans as plan, index}
										<div class="card">
											<h3>{plan.name}</h3>
											<p class="description">{plan.description}</p>
											<div class="list">
												{#each plan.features as feature}
													<span>
														<Icon name="CheckCircle" size={30} />
														{feature}
													</span>
												{/each}
											</div>
											<span class="subscription">
												<p class="price">{plan.price}</p>
												<p class="month">{plan.month}</p>
											</span>
											<button
												class="card-btn"
												data-sveltekit-noscroll
												on:click={(e) => handlePlanClick(plan.name, e)}
												in:fly={{ y: 50, duration: 500, delay: 400 }}
												out:fly={{ y: 50, duration: 500, delay: 400 }}
											>
												{plan.button}
											</button>
										</div>
									{/each}
								</div>
							</div>
						{/if}
						{#if showH2}
							<div id="integrations" class="section">
								<h2>Integrations</h2>
								<div class="card-wrapper">
									<div class="int-card">
										<img src={openaiIcon} alt="Integration" class="integration-logo" />
										<h2>OpenAI</h2>
									</div>
									<div class="int-card">
										<img src={anthropicIcon} alt="Integration" class="integration-logo" />
										<h2>Anthropic</h2>
									</div>
									<div class="int-card">
										<img src={deepseekIcon} alt="Integration" class="integration-logo" />
										<h2>Deepseek</h2>
									</div>
									<div class="int-card">
										<img src={grokIcon} alt="Integration" class="integration-logo" />
										<h2>Grok</h2>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/if}

{#if showTermsOverlay}
	<Terms on:close={closeOverlay} />
{/if}

{#if showPrivacyOverlay}
	<PrivacyPolicy on:close={closeOverlay} />
{/if}

{#if $showAuth}
	<div class="auth-overlay" on:click={handleOverlayClick} transition:fade={{ duration: 300 }}>
		<div class="auth-content" transition:fade={{ duration: 300 }}>
			<Auth
				on:close={() => {
					$showAuth = false;
				}}
				on:signOut={handleSignOut}
			/>
		</div>
	</div>
{/if}

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
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

	.feature-cards {
		width: 100%;
		max-width: 800px;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: flex-end;
		gap: 0.1rem;
	}

	.chat {
		width: 100%;
	}

	.user-container {
		display: flex;
		flex-direction: column;
		overflow: auto;
		border-radius: 40px;
		width: 100%;
		height: auto;
		scrollbar-width: thin;
		scrollbar-color: #ffffff transparent;
		overflow-y: auto;
	}

	.half-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		scroll-behavior: smooth;
		overflow-x: hidden;
		overflow-y: scroll;
		&::-webkit-scrollbar {
			width: 0.5rem;
			background-color: transparent;
		}
		&::-webkit-scrollbar-track {
			background: transparent;
		}
		&::-webkit-scrollbar-thumb {
			background: var(--secondary-color);
			border-radius: 1rem;
		}
	}

	.content-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		gap: 10rem;
		border-radius: 50%;
		background: radial-gradient(
			circle at center,
			rgba(255, 255, 255, 0.2) 0%,
			rgba(255, 255, 255, 0) 50%
		);
	}
	.section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 0;
		text-align: center;
		border-radius: 10rem;
		max-width: 1200px;
		width: 100%;
		height: 100vh;
		background: radial-gradient(
			circle at center,
			rgba(255, 255, 255, 0.2) 0%,
			rgba(255, 255, 255, 0) 50%
		);
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
		align-items: center;
		background: var(--primary-color);
		/* padding: 2rem; */
		width: auto;
		border-radius: 2rem;
		/* max-width: 500px; */
		height: auto;
		padding: 0;
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
		width: 100%;
		max-width: 1000px;
	}

	h1 {
		/* margin-top: 25%; */
		font-size: 4rem;
		color: var(--text-color);
		margin: 0;
		width: 100%;
		max-width: 1000px;
		text-align: center;
	}
	h2 {
		/* margin-top: 25%; */
		font-size: 3rem;
		font-weight: 500;
		color: var(--text-color);
		margin-bottom: 2rem;
		width: 100%;
	}

	h3 {
		font-size: 1.5rem;
		color: var(--text-color);
		margin-bottom: 2rem;
		font-weight: 300;
		width: 100%;
		font-style: italic;
	}

	p {
		display: flex;
		color: var(--text-color);
		line-height: 1.5;
		text-align: justify;
		width: 100%;
		max-width: 1000px;
	}

	button {
		display: flex;
		align-items: center;
		width: 100%;
		max-width: 800px;
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
		// filter: drop-shadow(0 0 4px var(--tertiary-color));

		&.fastlogin {
			width: auto;
			height: 3rem;
			padding: 0 0.5rem;
			font-size: 1.25rem;
			filter: none;
			position: fixed;
			width: auto !important;
			top: 0;
			left: 1rem;
			background: none;
			margin-top: 0;
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
		position: absolute;
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
		color: var(--text-color);
	}

	.footer-container {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 1000px;
		overflow: hidden;
		justify-content: center;
		align-items: center;
		gap: 1rem;
	}

	.footer-container button {
		max-width: 1000px;
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
		text-align: center;
		justify-content: center;
		align-items: center;
		width: 100%;
	}

	.testimonial p {
		font-style: italic;
		color: var(--text-color);
		justify-content: center;
	}

	.cta-buttons {
		display: flex;
		flex-direction: row;
		justify-content: flex-end;
		width: 100%;
		align-items: center;
		gap: 1rem;
		height: 3rem;

		& button {
			height: 3rem !important;
			margin: 0;
		}
	}

	.cta-buttons button {
		font-size: 14px;
		padding: 0 1rem;
		background-color: var(--bg-gradient);
		color: var(--text-color);
		justify-content: left;
		transition: all 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);

		height: 60px;
		width: auto;
		gap: auto;
	}

	.cta-buttons button:hover {
		color: var(--bg-color);
		transform: scale(0.9);
		background-color: var(--tertiary-color);
		filter: drop-shadow(0 0 4px var(--tertiary-color));
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
		margin-bottom: 1rem;
		font-size: 1.2rem;
	}

	.pricing-plans {
		display: flex;
		justify-content: flex-start;
		flex-wrap: wrap;
		width: calc(100% - 2rem);
		padding: 1rem;
		box-sizing: border-box;
	}

	.card-wrapper {
		gap: 1rem;
		display: flex;
		justify-content: center;
		align-items: center;
		flex-wrap: wrap;
		width: 100%;
		gap: 1rem;
		max-width: calc(600px + 2rem);

		& .int-card {
			background: var(--bg-gradient-r);
			border-radius: 1rem;
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			width: 300px;
			height: 300px;
			& h2 {
				font-size: 1.8rem;
			}

			& .integration-logo {
				user-select: none;
				width: 6rem;
				height: 6rem;
			}
		}
	}
	.card {
		background: var(--bg-gradient-r);
		border-radius: 1rem;
		padding: 1rem;
		text-align: left;
		transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1);
		border: 1px solid var(--bg-color);
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		gap: 0.5rem;
		flex: 1;
		width: 100vw;
		height: 50vh;
		& .list {
			display: flex;
			flex-direction: column;
			gap: 1rem;
			margin-top: 1rem;
			padding-top: 2rem;
			border-top: 1px solid var(--line-color);
		}
		span {
			display: flex;
			flex-direction: row;
			gap: 0.5rem;
			width: auto;
			text-align: left;
			margin-left: 1rem;
			margin-right: 1rem;
		}
		span.subscription {
			display: flex;
			flex-direction: row;
			justify-content: center;
			align-items: flex-end;
			flex: 1;
			padding: 0;
			margin: 0;
			width: 100%;
			gap: 0;
		}
		& li {
			color: red;
			width: 200px;

			word-break: break-word;
		}
	}

	.card h3 {
		font-size: 1.8rem;
		margin: 0;
		font-weight: 800;
		letter-spacing: 0.2rem;
		width: 100%;

		text-align: left;
		font-style: normal;
		justify-content: center;
		align-items: center;
	}

	.description {
		text-align: left;
		letter-spacing: 0.1rem;
		font-size: 1rem;
		font-style: italic;
		margin: 0;
	}

	.price {
		margin: 0;
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--tertiary-color);
		width: auto;
	}
	.month {
		font-size: 1rem;
		color: var(--tertiary-color);
		margin-bottom: 1rem;
		margin: 0;
		width: auto;
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
	}

	@media (max-width: 1000px) {
		.user-container {
			display: flex;
			flex-direction: column;
			overflow: auto;
			border-radius: 40px;
			height: auto;
			width: auto;
			scroll-behavior: smooth;
			overflow-x: hidden;
			&::-webkit-scrollbar {
				width: 0.5rem;
				background-color: transparent;
			}
			&::-webkit-scrollbar-track {
				background: transparent;
			}
			&::-webkit-scrollbar-thumb {
				background: var(--secondary-color);
				border-radius: 1rem;
			}
		}

		.logo-container {
			display: none;
		}
		.content-wrapper {
			display: flex;
			flex-direction: column;
			align-items: center;
			position: relative;
			width: 100%;
			height: 100%;
			background: radial-gradient(
				circle at center,
				rgba(255, 255, 255, 0.2) 0%,
				rgba(255, 255, 255, 0) 50%
			);
		}

		.section {
			margin-top: 3rem;
			height: 100vh !important;
		}

		h2 {
			font-size: 60px;
		}
	}

	@media (max-width: 767px) {
		.feature-cards {
			width: 100%;
			max-width: 800px;
			display: flex;
			flex-wrap: wrap;
			justify-content: center;
			align-items: flex-start;
			gap: 0.1rem;
		}
		.auth-content {
			position: fixed;
			display: flex;
			justify-content: center;
			align-items: center;
			background: var(--bg-gradient);
			/* padding: 2rem; */
			width: 90%;
			border-radius: 2rem;
			/* max-width: 500px; */
			height: auto;
			padding: 0;
			overflow: hidden;
			box-shadow: -20px -1px 200px 4px rgba(255, 255, 255, 1) !important;
			transition: all 0.3s ease-in;
		}
		.fastlogin {
			display: flex;
			&:hover {
				& span {
					display: flex;
				}
			}
			& span {
				display: none;
			}
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
			flex-direction: none;
			align-items: center;
		}

		.section {
			height: auto;
		}
	}
	@media (max-width: 450px) {
		h1 {
			font-size: 1.5rem;
			width: auto;
		}
		.section {
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
			align-items: center;
			padding: 0;
			text-align: center;
			max-width: 1200px;
			width: 100%;
			height: 100vh;
			background: radial-gradient(
				circle at center,
				rgba(255, 255, 255, 0.2) 0%,
				rgba(255, 255, 255, 0) 50%
			);
		}
	}
</style>

<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { fade, fly } from 'svelte/transition';
	import { newsletterStore } from '$lib/stores/newsletterStore';
	import type { NewsletterPreferences } from '$lib/types/types.subscriptions';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	export let showPopup = false;

	let email = '';
	let isSubmitted = false;
	let error = '';
	let preferences: NewsletterPreferences = {
		newsletter: true,
		events: false
	};

	async function handleSubmit() {
		error = '';

		try {
			await newsletterStore.subscribeToNewsletter(email, preferences);
			isSubmitted = true;

			setTimeout(() => {
				showPopup = false;
				isSubmitted = false;
			}, 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to subscribe. Please try again.';
		}
	}

	function close() {
		showPopup = false;
	}
</script>

{#if showPopup}
	<div class="overlay" transition:fade>
		<div class="popup-container" transition:fly={{ y: 20 }}>
			<button class="close-button" on:click={close}>
				<Icon name="X" size={24} />
			</button>

			{#if isSubmitted}
				<div class="success-message">
					<h3>Thank You!</h3>
					<p>You've successfully subscribed to our newsletter.</p>
				</div>
			{:else}
				<form on:submit|preventDefault={handleSubmit} class="subscription-form">
					<h3>Subscribe to Our Newsletter</h3>

					<div class="input-group">
						<input type="email" bind:value={email} placeholder="Enter your email" required />
					</div>

					<div class="checkbox-group">
						<label>
							<input type="checkbox" bind:checked={preferences.newsletter} />
							<span>Newsletter Updates</span>
						</label>

						<label>
							<input type="checkbox" bind:checked={preferences.events} />
							<span>Event Notifications</span>
						</label>
					</div>

					{#if error}
						<p class="error">{error}</p>
					{/if}

					<button type="submit" class="submit-button"> Subscribe </button>
				</form>
			{/if}
		</div>
	</div>
{/if}

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		backdrop-filter: blur(8px);
		z-index: 1000;
	}

	.popup-container {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		padding: 2rem;
		max-width: 500px;
		width: 100%;
		position: relative;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.close-button {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		padding: 0.5rem;
		transition: all 0.3s ease;

		&:hover {
			color: var(--text-color);
			transform: rotate(90deg);
		}
	}

	.success-message {
		text-align: center;
		color: var(--text-color);

		h3 {
			font-size: 2rem;
			font-weight: bold;
			margin-bottom: 1rem;
		}

		p {
			font-size: 1.2rem;
			color: rgba(255, 255, 255, 0.8);
		}

		.verification-note {
			margin-top: 1rem;
			font-size: 1rem;
			color: rgba(255, 255, 255, 0.6);
			font-style: italic;
		}
	}

	.subscription-form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;

		h3 {
			font-size: 2rem;
			font-weight: bold;
			color: var(--text-color);
			margin: 0;
		}
	}

	.input-group {
		input {
			width: 90%;
			padding: 1rem;
			font-size: 1.4rem;
			border: 1px solid rgba(255, 255, 255, 0.2);
			border-radius: 8px;
			background: var(--tertiary-color, rgba(255, 255, 255, 0.1));
			color: var(--text-color);
			transition: all 0.3s ease-in-out;
			text-align: center;
			&::placeholder {
				color: rgba(255, 255, 255, 0.5);
			}

			&:focus {
				outline: none;
				border-color: rgba(255, 255, 255, 0.5);
				background: rgba(255, 255, 255, 0.15);
				transform: translateY(-2px);
				text-align: left;
				font-size: 1.2rem;
			}
		}
	}

	.checkbox-group {
		display: flex;
		flex-direction: column;
		gap: 1rem;

		label {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			color: var(--text-color);
			font-size: 1.2rem;
			cursor: pointer;
			transition: transform 0.2s ease;

			&:hover {
				transform: translateX(5px);
			}
		}

		input[type='checkbox'] {
			width: 20px;
			height: 20px;
			cursor: pointer;
		}
	}

	.error {
		color: #ff6b6b;
		font-size: 1rem;
		padding: 0.5rem;
		border-radius: 4px;
		background: rgba(255, 107, 107, 0.1);
	}

	.submit-button {
		width: 100%;
		padding: 1rem;
		font-size: 1.2rem;
		font-weight: bold;
		color: var(--text-color);
		background: var(--secondary-color);
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.3s ease;

		&:hover {
			background: var(--tertiary-color);
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
		}

		&:active {
			transform: translateY(0);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}
</style>

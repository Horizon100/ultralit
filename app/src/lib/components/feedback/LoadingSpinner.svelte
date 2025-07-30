<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { isLoading } from '$lib/stores/loadingStore';
	import { fade } from 'svelte/transition';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';
</script>

{#if $isLoading}
	<div class="center-container" transition:fade={{ duration: 600 }}>
		<div class="loading-overlay" transition:fade={{ duration: 600 }}>
			<div class="spinner">
				<span class="bot-icon"><Icon name="Bot" size={80} /></span>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	// @use 'src/lib/styles/themes.scss' as *;
	* {
		//   font-family: 'Source Code Pro', monospace;
		font-family: var(--font-family);
		transition: all 0.3s ease;
	}

	.center-container {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100%;
		width: 100%;
		position: absolute;
		top: 0;
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
		// box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
		border-radius: 50%;
		position: absolute;
		right: calc(50% - 40px);
		top: calc(50% - 40px);

		/* bottom: 0; */
	}

	.spinner {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 60px;
		height: 60px;
		color: rgb(71, 69, 69);
		border: 20px dashed #363f3f;
		border-radius: 50%;
		position: relative;
		/* background-color: yellow; */
		animation: nonlinearSpin 4.2s infinite;
		animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
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
</style>

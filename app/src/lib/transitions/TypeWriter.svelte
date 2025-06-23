<script lang="ts">
	import { onMount } from 'svelte';

	export let text: string;
	export let minSpeed: number = 2;
	export let maxSpeed: number = 10;

	let displayText = '';
	let index = 0;
	let showCursor = true;
	let isTypingComplete = false;

	function getRandomSpeed() {
		return Math.floor(Math.random() * (maxSpeed - minSpeed + 1)) + minSpeed;
	}

	function typeNextCharacter() {
		if (index < text.length) {
			displayText += text[index];
			index++;

			const delay = text[index - 1] === ' ' ? getRandomSpeed() * 5 : getRandomSpeed();
			setTimeout(typeNextCharacter, delay);
		} else {
			isTypingComplete = true;
			showCursor = false;
		}
	}

	onMount(() => {
		typeNextCharacter();

		const cursorInterval = setInterval(() => {
			if (!isTypingComplete) {
				showCursor = !showCursor;
			}
		}, 500);

		return () => clearInterval(cursorInterval);
	});
</script>

<p>
	<span class="text-container"
		>{displayText}<span class:blink={!showCursor} class="cursor">|</span></span
	>
</p>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;
	* {
		font-family: var(--font-family);
	}
	p {
		line-height: 1.5;
		text-align: center;
		color: var(--text-color);
		margin-top: 1rem;
		margin-bottom: 1rem;
		font-size: 1.7rem;
		width: 100%;
	}

	.text-container {
		display: inline-block;
	}

	.cursor {
		display: inline-block;
	}

	.blink {
		opacity: 0;
		transition: opacity 0.1s;
	}

	@media (max-width: 767px) {
		p {
			font-size: 1.5rem;
		}
	}
	@media (max-width: 450px) {
		p {
			font-size: 0.9rem;
			line-height: 1.5;
			margin: 1rem;
			text-align: left;
		}
	}
</style>

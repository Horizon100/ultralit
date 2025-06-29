<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { createEventDispatcher, onMount } from 'svelte';
	import { currentUser } from '$lib/pocketbase';
	import { currentTheme, type Theme } from '$lib/stores/themeStore';
	import { t } from '$lib/stores/translationStore';
	import { get } from 'svelte/store';
	import { getIcon, type IconName } from '$lib/utils/lucideIcons';

	interface Style {
		name: string;
		value: Theme;
		icon: IconName;
		description: string;
		dummyContent: string;
	}

	let hoveredStyle: Style | null = null;
	const dispatch = createEventDispatcher();

	const styles: Style[] = [
		{
			name: 'Classic',
			value: 'default' as const,
			icon: 'Sun' as IconName,
			description: 'This style will brighten your day',
			dummyContent: 'Sunshine and clear skies'
		},
		{
			name: 'Dark',
			value: 'dark' as const,
			icon: 'Moon' as IconName,
			description: 'For night owls and stargazers',
			dummyContent: 'Moonlit adventures await'
		},
		{
			name: 'Light',
			value: 'light' as const,
			icon: 'Sunrise' as IconName,
			description: 'Start your day with a fresh look',
			dummyContent: 'Early bird gets the worm'
		},
		{
			name: 'Sunset',
			value: 'sunset' as const,
			icon: 'Sunset' as IconName,
			description: 'Wind down with warm hues',
			dummyContent: 'Golden hour vibes'
		},
		{
			name: 'Focus',
			value: 'focus' as const,
			icon: 'Focus' as IconName,
			description: 'Minimize distractions, maximize productivity',
			dummyContent: 'Concentration intensifies'
		},
		{
			name: 'Bold',
			value: 'bold' as const,
			icon: 'Bold' as IconName,
			description: 'Make a statement with vibrant colors',
			dummyContent: 'Stand out from the crowd'
		},
		{
			name: 'Turbo',
			value: 'turbo' as const,
			icon: 'Gauge' as IconName,
			description: 'Speed up your workflow',
			dummyContent: 'Faster than the speed of light'
		},
		{
			name: 'Bone',
			value: 'bone' as const,
			icon: 'Bone' as IconName,
			description: 'Contrasts brights up.',
			dummyContent: 'Shake it, make it.'
		}
	];

	async function changeStyle(style: Theme) {
		await currentTheme.set(style);
		dispatch('styleChange', { style });
		dispatch('close');
	}

	function applyTheme(theme: string) {
		document.body.className = theme;
	}

	function handleHover(style: Style) {
		hoveredStyle = style;
		applyTheme(style.value);
	}

	function handleMouseLeave() {
		hoveredStyle = null;
		applyTheme($currentTheme);
	}

	$: selectedStyle = styles.find((style) => style.value === $currentTheme) || styles[0];
	$: displayedStyle = hoveredStyle || selectedStyle;

	onMount(async () => {
		await currentTheme.initialize();
	});
</script>

<div class="style-switcher">
	<h2>{$t('nav.themes')}</h2>

	<div class="style-list">
		{#each styles as style}
			<button
				class="style-button {style.value}"
				class:active={$currentTheme === style.value}
				on:click={() => changeStyle(style.value)}
				on:mouseenter={() => handleHover(style)}
				on:mouseleave={handleMouseLeave}
			>
				<Icon name={style.icon} size={20} />
				<span>{style.name}</span>
			</button>
		{/each}
	</div>
</div>

<style lang="scss">
	@use 'src/lib/styles/themes.scss' as *;

	.style-switcher {
		display: flex;
		flex-wrap: wrap;
		position: relative;
		max-width: 400px;
		margin: 0;
		text-align: left;
		left: 0;
		gap: 0;
		justify-content: center;
		align-items: center;
		font-size: var(--font-size-m);
		color: var(--placeholder-color);
		// background: var(--bg-gradient-r);
		border-radius: 2rem;
		line-height: 1.5;
		padding: 1rem;
		// animation: blink 3s ease infinite;
	}

	h2 {
		margin-left: 2rem;
		padding: 1rem 0;
		font-size: 1.5rem;
		text-align: left;
		border-top-left-radius: 2rem;
		border-top-right-radius: 2rem;

		user-select: none;
	}
	.current-style {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		background-color: var(--secondary-color);
		text-align: center;
		border-radius: 50px;

		height: 100%;
	}

	.dummy {
		display: flex;
		width: auto;
		border-radius: 25px;
		height: 50%;
		justify-content: center;
		align-items: center;
	}

	.current-style span {
		background-color: blue;
	}

	.style-list {
		display: flex;
		flex-wrap: wrap;
		margin: 0;
		gap: 0;
		width: 100%;
		text-align: center;
		justify-content: center;
		align-items: center;
		font-size: var(--font-size-m);
		color: var(--placeholder-color);
		line-height: 1.5;
		// animation: blink 1s ease infinite;
	}

	.style-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border: none;
		padding: 0.5rem;
		border-radius: 2rem;
		cursor: pointer;
		transition: all ease 0.3s;
		width: auto;
		min-width: 100px;
		height: 50px;

		&.default {
			background-color: var(--primary-color);
			color: var(--text-color);
			font-family: var(--font-family);
		}

		&.dark {
			background-color: var(--primary-color);
			color: var(--text-color);
			font-family: var(--font-family);
		}

		&.light {
			background-color: var(--primary-color);
			color: var(--text-color);
			font-family: var(--font-family);
		}

		&.sunset {
			background-color: var(--primary-color);
			color: var(--text-color);
			font-family: var(--font-family);
		}

		&.focus {
			background-color: var(--primary-color);
			color: var(--text-color);
			font-family: var(--font-family);
		}

		&.bold {
			background-color: var(--primary-color);
			color: var(--text-color);
			font-family: var(--font-family);
		}

		&.turbo {
			background-color: var(--primary-color);
			color: var(--text-color);
			font-family: var(--font-family);
		}
		&.bone {
			background-color: var(--primary-color);
			color: var(--text-color);
			font-family: var(--font-family);
		}

		&:hover,
		&.active {
			background-color: var(--tertiary-color);
		}
	}

	p {
		margin: 0.5rem 0;
	}

	@media (max-width: 1000px) {
		.style-switcher {
			flex-direction: column;
			padding: 2rem;
			width: auto;
		}

		.style-list {
			margin-left: 1%;
			margin-bottom: 1rem;
			width: auto;
		}
	}
</style>

<script lang="ts">
	import { Menu, MessageCircle, Drill, NotebookTabs, Brain } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { page } from '$app/stores';
	import { currentUser } from '$lib/pocketbase';
	// import TimeTracker from '$lib/components/features/TimeTracker.svelte';

	export let activeLink: string;
	export let setActiveLink: (path: string) => void;

	$: isAskRoute = $page.url.pathname === '/ask';
</script>

<div class="sidenav" transition:fly={{ x: -100, duration: 300 }}>
	<div class="nav-icons">
		<!-- <TimeTracker /> -->
		{#if $currentUser}
			<a
				href="/ask"
				class="nav-link"
				class:active={activeLink === '/ask'}
				on:click|preventDefault={() => setActiveLink('/ask')}
			>
				<MessageCircle size={24} />
			</a>
			<a
				href="/launcher"
				class="nav-link"
				class:active={activeLink === '/launcher'}
				on:click|preventDefault={() => setActiveLink('/launcher')}
			>
				<Drill size={24} />
			</a>
			<a
				href="/notes"
				class="nav-link"
				class:active={activeLink === '/notes'}
				on:click|preventDefault={() => setActiveLink('/notes')}
			>
				<NotebookTabs size={24} />
			</a>
			<a
				href="/brain"
				class="nav-link"
				class:active={activeLink === '/brain'}
				on:click|preventDefault={() => setActiveLink('/brain')}
			>
				<Brain size={24} />
			</a>
		{/if}
	</div>
</div>

<style>
	.sidenav {
		position: fixed;
		left: 0;
		top: 0;
		height: 100vh;
		width: 10rem;
		/* background: rgba(0, 0, 0, 0.5); */
		backdrop-filter: blur(8px);
		border-right: 1px solid rgba(255, 255, 255, 0.1);
		z-index: 100;
		display: flex;
		flex-direction: row;
		align-items: center;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.nav-icons {
		display: flex;
		flex-direction: row;
		gap: 1rem;
		margin-top: 5rem;
		width: 100%;
	}

	.nav-link {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0.75rem;
		color: rgb(156 163 175);
		transition: all 0.3s ease-in;
		border-left: 2px solid transparent;
	}

	.nav-link:hover {
		color: white;
		background: rgba(255, 255, 255, 0.1);
	}

	.nav-link.active {
		color: white;
		border-left: 2px solid white;
		background: rgba(255, 255, 255, 0.05);
	}
</style>
